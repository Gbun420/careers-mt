import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { db } from '../../lib/firebase-admin';
import * as admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Vercel handles the raw body, but we need it for signature verification.
// For serverless functions on Vercel, req.body is already parsed if it's JSON.
// We need the raw body. 
// Note: In some Vercel environments, we might need to disable body parsing.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event: Stripe.Event;

  try {
    // If req.body is already an object, use JSON.stringify(req.body)
    // BUT Stripe verification is very strict about formatting.
    // On Vercel, it's better to use the buffer if available.
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const { applicationId, employerId } = session.metadata || {};

        if (!applicationId) {
          console.error('No applicationId in session metadata');
          break;
        }

        // 1. Mark transaction as paid
        await db.collection('transactions').doc(session.id).update({
          status: 'paid',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentIntent: session.payment_intent as string,
        });

        // 2. Unlock the application
        await db.collection('applications').doc(applicationId).update({
          unlocked: true,
          unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
          transactionId: session.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Application ${applicationId} unlocked for employer ${employerId}`);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (dbError) {
    console.error('Database update error in webhook:', dbError);
    return res.status(500).send('Internal Server Error');
  }
}
