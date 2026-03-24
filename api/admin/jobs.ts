import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from '../_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../../lib/appCheck';
import { handleApiError, UnauthorizedError, ForbiddenError } from '../../lib/errors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. App Check Verification
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      throw new UnauthorizedError('Invalid App Check token');
    }

    // 2. Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization token');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // 3. Admin-Only Enforcement
    if (decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access only');
    }

    if (req.method === 'GET') {
      const snap = await db.collection('jobs').orderBy('createdAt', 'desc').get();
      const jobs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(jobs);
    }

    if (req.method === 'PATCH') {
      const { jobId, status } = req.body;
      if (!jobId || !status) return res.status(400).json({ error: 'Missing jobId or status' });
      await db.collection('jobs').doc(jobId).update({ 
        status, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { jobId } = req.body;
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
      await db.collection('jobs').doc(jobId).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(405).send('Method Not Allowed');
  } catch (error: any) {
    return handleApiError(error, res);
  }
}
