import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_genkit';
import * as admin from 'firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify Vercel Cron Secret for security
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  try {
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    );

    const snap = await db
      .collection('applications')
      .where('status', '==', 'applied')
      .where('createdAt', '<=', cutoff)
      .get();

    const batch = db.batch();
    snap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
      batch.update(doc.ref, {
        status: 'stalled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    console.log(`[Vercel Cron: Anti‑Ghosting] Flagged ${snap.size} stale applications.`);
    return res.status(200).json({ success: true, flagged: snap.size });
  } catch (error: any) {
    console.error('Error in anti-ghosting cron:', error);
    return res.status(500).json({ error: error.message });
  }
}
