import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from '../_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../../lib/appCheck';
import { handleApiError, UnauthorizedError, ForbiddenError } from '../../lib/errors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      throw new UnauthorizedError('Invalid App Check token');
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization token');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access only');
    }

    if (req.method === 'GET') {
      const snap = await db.collection('applications').orderBy('createdAt', 'desc').get();
      const applications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(applications);
    }

    return res.status(405).send('Method Not Allowed');
  } catch (error: any) {
    return handleApiError(error, res);
  }
}
