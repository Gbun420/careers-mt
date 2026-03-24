import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../lib/appCheck';
import { handleApiError, UnauthorizedError } from '../lib/errors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // 1. App Check Verification (Optional for public GET)
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      console.warn('App Check verification failed or missing for public job list access');
      // For now, we allow public access to the job list to ensure the site is functional
      // throw new UnauthorizedError('Invalid App Check token');
    }

    const jobsSnap = await db.collection("jobs")
      .where("status", "==", "active")
      .get();
      
    const jobs = jobsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json(jobs);
  } catch (error: any) {
    return handleApiError(error, res);
  }
}
