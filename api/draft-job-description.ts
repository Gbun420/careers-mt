import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { generateJobDescription } from '../lib/ai';
import { verifyAppCheckToken, getAppCheckToken } from '../lib/appCheck';
import { handleApiError, UnauthorizedError, ForbiddenError } from '../lib/errors';
import { z } from 'zod';

const draftSchema = z.object({
  title: z.string().min(1),
  responsibilities: z.string().min(1),
  requirements: z.string().min(1)
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
    
    // 3. Authorization: Only Employers or Admins can draft
    if (decodedToken.role !== 'EMPLOYER' && decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('Only employers can draft job descriptions');
    }

    // 4. Validation
    const { title, responsibilities, requirements } = draftSchema.parse(req.body);

    // 5. AI Generation using Groq
    const description = await generateJobDescription(title, `${responsibilities}\n${requirements}`);

    return res.status(200).json({ description });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    return handleApiError(error, res);
  }
}
