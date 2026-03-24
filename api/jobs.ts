import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { db } from './_genkit';
import { verifyAppCheckToken, getAppCheckToken } from '../lib/appCheck';
import { handleApiError, UnauthorizedError, ValidationError, ForbiddenError } from '../lib/errors';
import { generalLimiter, checkRateLimit as redisRateLimit } from '../lib/rate-limit/redis';
import { z } from 'zod';

const jobCreateSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  companyName: z.string().min(1, 'Company name is required'),
  location: z.string().min(1, 'Location is required'),
  type: z.string().optional(),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  salaryMin: z.number().positive('salaryMin must be positive'),
  salaryMax: z.number().positive('salaryMax must be positive'),
  pricing: z.enum(['free', 'standard', 'premium', 'ppqa', 'executive']),
  budgetCap: z.number().positive().optional().nullable(),
  knockoutQuestions: z.array(z.object({
    question: z.string(),
    required: z.boolean(),
    rejectIfNo: z.boolean()
  })).optional().default([])
}).refine(data => data.salaryMin <= data.salaryMax, {
  message: 'salaryMin must be less than or equal to salaryMax',
  path: ['salaryMin']
}).refine(data => {
  if (data.pricing === 'ppqa' || data.pricing === 'executive') {
    return data.budgetCap !== null && data.budgetCap !== undefined && data.budgetCap >= 12;
  }
  return true;
}, {
  message: 'Budget cap is required for paid plans (min 12)',
  path: ['budgetCap']
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGetJobs(req, res);
  }
  if (req.method === 'POST') {
    return handleCreateJob(req, res);
  }
  return res.status(405).send('Method Not Allowed');
}

async function handleGetJobs(req: VercelRequest, res: VercelResponse) {
  try {
    const appCheckToken = getAppCheckToken(req);
    if (!appCheckToken || !await verifyAppCheckToken(appCheckToken)) {
      console.warn('App Check verification failed or missing for public job list access');
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

async function handleCreateJob(req: VercelRequest, res: VercelResponse) {
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

    // 3. Role Verification
    if (decodedToken.role !== 'EMPLOYER' && decodedToken.role !== 'ADMIN') {
      throw new ForbiddenError('Only employers and admins can create jobs');
    }

    // 4. Rate Limiting (5 job posts per hour per employer)
    await redisRateLimit(generalLimiter, decodedToken.uid);

    // 5. Payload Validation
    const jobData = jobCreateSchema.parse(req.body);

    // 5. Write to Firestore
    const jobRef = db.collection('jobs').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const normalizedJob = {
      ...jobData,
      employerId: decodedToken.uid,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    await jobRef.set(normalizedJob);

    return res.status(201).json({
      success: true,
      jobId: jobRef.id
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    return handleApiError(error, res);
  }
}
