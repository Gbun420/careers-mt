import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { db, auth } from '../../lib/firebase-admin';
import { computeUnlockPrice } from '../../lib/payments';
import { handleApiError, UnauthorizedError, ValidationError } from '../../lib/errors';
import * as admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Unauthorized: Missing or invalid token');
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // 2. Validation
    const { applicationId } = req.body;
    if (!applicationId) {
      throw new ValidationError('Application ID is required');
    }

    // 3. Fetch Application and Job Details
    const appSnap = await db.collection('applications').doc(applicationId).get();
    if (!appSnap.exists) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const appData = appSnap.data()!;
    const jobId = appData.jobId;
    const employerId = appData.employerId;

    // 4. Verify Ownership
    if (employerId !== userId) {
      // Bonus check: is the job actually owned by this user?
      const jobSnap = await db.collection('jobs').doc(jobId).get();
      if (!jobSnap.exists || jobSnap.data()?.employerId !== userId) {
        throw new UnauthorizedError('You are not authorized to unlock this application');
      }
    }

    // Check if already unlocked
    if (appData.unlocked) {
      return res.status(400).json({ error: 'Application is already unlocked' });
    }

    // 5. Get Pricing
    const jobSnap = await db.collection('jobs').doc(jobId).get();
    const jobData = jobSnap.data() || {};
    const priceCents = computeUnlockPrice(jobData.level || 'standard');

    if (priceCents === 0) {
      // Handle free unlocks instantly
      await db.collection('applications').doc(applicationId).update({
        unlocked: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ success: true, unlocked: true });
    }

    // 6. Create Stripe Session
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Unlock Candidacy: ${appData.jobTitle || 'Job Position'}`,
              description: `Unlock contact details for candidate on careers.mt`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/employer/dashboard?session_id={CHECKOUT_SESSION_ID}&unlocked=true`,
      cancel_url: `${origin}/employer/dashboard?applicationId=${applicationId}&canceled=true`,
      metadata: {
        applicationId,
        employerId: userId,
        jobId,
      },
      customer_email: decodedToken.email,
    });

    // 7. Record Transaction
    await db.collection('transactions').doc(session.id).set({
      id: session.id,
      applicationId,
      employerId: userId,
      amount: priceCents,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ sessionId: session.id, url: session.url });

  } catch (error: any) {
    console.error('Checkout Error:', error);
    return handleApiError(error, res);
  }
}
