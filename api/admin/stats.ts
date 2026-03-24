import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from '../_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../../lib/appCheck';
import { handleApiError, UnauthorizedError, ForbiddenError } from '../../lib/errors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

    // 1. Security Check
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      throw new UnauthorizedError('Invalid App Check token');
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing authorization');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access only');
    }

    // 2. Aggregate Data
    const [jobsSnap, appsSnap, usersSnap, paymentsSnap] = await Promise.all([
      db.collection('jobs').where('status', '==', 'active').count().get(),
      db.collection('applications').count().get(),
      db.collection('users').count().get(),
      db.collection('payments').where('status', '==', 'succeeded').get()
    ]);

    // Calculate revenue from payments collection
    let totalRevenue = 0;
    paymentsSnap.forEach(doc => {
      const data = doc.data();
      totalRevenue += (data.amount || 0);
    });

    const stats = {
      totalRevenue: totalRevenue / 100, // Convert cents to Euro
      activeJobs: jobsSnap.data().count,
      totalApplications: appsSnap.data().count,
      totalUsers: usersSnap.data().count,
      updatedAt: new Date().toISOString()
    };

    return res.status(200).json(stats);
  } catch (error: any) {
    return handleApiError(error, res);
  }
}
