import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from './_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../lib/appCheck';
import { handleApiError, UnauthorizedError, ForbiddenError } from '../lib/errors';
import { z } from 'zod';

const unlockSchema = z.object({
  applicationId: z.string().min(1)
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. App Check
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      throw new UnauthorizedError('Invalid App Check token');
    }

    // 2. Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid token');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // 3. Authorization: Only Employers or Admins can unlock
    if (decodedToken.role !== 'EMPLOYER' && decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('Only employers may unlock candidates');
    }

    // 4. Validation
    const { applicationId } = unlockSchema.parse(req.body);

    const appRef = db.collection("applications").doc(applicationId);
    const appSnap = await appRef.get();
    
    if (!appSnap.exists) {
      throw new Error("Application not found.");
    }

    // Update with unlock details
    await appRef.update({
      unlocked: true,
      unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    return handleApiError(error, res);
  }
}
