import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from './_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../lib/appCheck';
import { handleApiError, UnauthorizedError, ForbiddenError } from '../lib/errors';
import { z } from 'zod';

const applicationsSchema = z.object({
  candidateId: z.string().min(1)
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
    
    // 3. Validation
    const { candidateId } = applicationsSchema.parse(req.body);

    // 4. Authorization: Candidate can only view their own, Employer/Admin can view any?
    // For now, let's keep it restricted as in the original code.
    if (decodedToken.uid !== candidateId && decodedToken.role !== 'EMPLOYER' && decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('You can only view your own applications');
    }

    const appsSnap = await db
      .collection("applications")
      .where("candidateId", "==", candidateId)
      .get();

    const apps = appsSnap.docs.map((d: admin.firestore.QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data(),
    }));

    return res.status(200).json(apps);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    return handleApiError(error, res);
  }
}
