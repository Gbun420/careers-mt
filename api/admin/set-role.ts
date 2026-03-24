import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from '../_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../../lib/appCheck';
import { handleApiError, ForbiddenError, UnauthorizedError, ValidationError } from '../../lib/errors';
import { z } from 'zod';

const setRoleSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(['CANDIDATE', 'EMPLOYER', 'ADMIN'])
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Verify App Check
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      throw new UnauthorizedError('Invalid App Check token');
    }

    // 2. Verify Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // 3. Authorization: Only Admins can set roles
    if (decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required');
    }

    // 4. Validate Request Body
    const { uid, role } = setRoleSchema.parse(req.body);

    // 5. Set Custom Claims
    await admin.auth().setCustomUserClaims(uid, { role });

    // 6. Mirror into Firestore
    await db.collection('users').doc(uid).set({ 
      role, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });

    return res.status(200).json({ success: true, targetUid: uid, assignedRole: role });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    return handleApiError(error, res);
  }
}
