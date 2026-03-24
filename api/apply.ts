import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from './_genkit';
import { calculateFitScore } from '../lib/ai';
import { verifyAppCheckToken, getAppCheckToken } from '../lib/appCheck';
import { handleApiError, UnauthorizedError, ValidationError } from '../lib/errors';
import { applyLimiter, checkRateLimit as redisRateLimit } from '../lib/rate-limit/redis';
import { sendApplicationConfirmation, sendEmployerNotification } from '../lib/email';
import { normalizeJobData } from '../lib/job-data';
import { z } from 'zod';


const applySchema = z.object({
  jobId: z.string().min(1),
  resumeText: z.string().min(50, "Resume must be at least 50 characters")
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. App Check Verification
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      throw new UnauthorizedError('Invalid App Check token');
    }

    // 2. Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Unauthorized: Missing or invalid token');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // 3. Validation
    const { jobId, resumeText } = applySchema.parse(req.body);

    // 4. Redis-based Rate Limiting
    await redisRateLimit(applyLimiter, userId);

    // 5. Fetch Job Description
    const jobSnap = await db.collection("jobs").doc(jobId).get();
    if (!jobSnap.exists) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    // 6. AI Matching using Groq
    const job = normalizeJobData(jobSnap.data() || {});
    const output = await calculateFitScore(resumeText, job.description);

    // 7. Create Application Document
    const appRef = db.collection("applications").doc();
    const appData = {
      id: appRef.id,
      jobId,
      jobTitle: job.title,
      candidateId: userId,
      employerId: job.employerId,
      companyName: job.companyName,
      resumeText,
      status: 'applied',
      fitScore: output.score,
      aiReason: output.explanation,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await appRef.set(appData);

    // 8. Send Email Notifications
    try {
      const user = await admin.auth().getUser(userId);
      const candidateEmail = user.email;
      const candidateName = user.displayName || candidateEmail || 'Candidate';
      const jobTitle = job.title || 'Job Position';

      let employerEmail = job.employerEmail;
      if (!employerEmail && job.employerId) {
        try {
          const employerProfile = await db.collection('users').doc(job.employerId).get();
          const employerProfileData = employerProfile.data() || {};
          employerEmail = typeof employerProfileData.email === 'string' ? employerProfileData.email : null;
        } catch (lookupError) {
          console.error('Failed to resolve employer email:', lookupError);
        }
      }

      if (candidateEmail) {
        await sendApplicationConfirmation(candidateEmail, jobTitle, candidateName, job.companyName);
      }

      if (employerEmail) {
        await sendEmployerNotification(employerEmail, jobTitle, candidateName);
      }
    } catch (emailError) {
      console.error('Failed to send notifications:', emailError);
      // Don't fail the application if emails fail
    }

    return res.status(200).json({ 
      success: true, 
      applicationId: appRef.id, 
      fitScore: output.score 
    });


  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    return handleApiError(error, res);
  }
}
