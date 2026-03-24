import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from '../_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../../lib/appCheck';
import { handleApiError, UnauthorizedError, ForbiddenError } from '../../lib/errors';
import { z } from 'zod';

const moderateSchema = z.object({
  jobId: z.string().min(1),
  action: z.enum(['suspend', 'delete'])
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

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

    const { jobId, action } = moderateSchema.parse(req.body);
    const jobRef = db.collection('jobs').doc(jobId);

    if (action === 'suspend') {
      await jobRef.update({ 
        status: 'suspended', 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      return res.status(200).json({ success: true, message: 'Job suspended successfully' });
    } else {
      await jobRef.delete();
      return res.status(200).json({ success: true, message: 'Job deleted successfully' });
    }

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    return handleApiError(error, res);
  }
}
