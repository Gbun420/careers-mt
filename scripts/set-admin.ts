import * as admin from 'firebase-admin';

/**
 * USAGE:
 * 1. Ensure FIREBASE_SERVICE_ACCOUNT is set in your .env
 * 2. Run: npx ts-node scripts/set-admin.ts <USER_ID>
 */

const uid = process.argv[2];

if (!uid) {
  console.error('❌ Error: Please provide a User UID as the first argument.');
  console.error('Example: npx ts-node scripts/set-admin.ts abc123def456');
  process.exit(1);
}

// Initialize Firebase Admin (following the pattern in api/_genkit.ts)
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
    : undefined;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // Attempt local default
    admin.initializeApp();
  }
}

async function setAdmin(targetUid: string) {
  try {
    console.log(`⏳ Setting ADMIN role for user: ${targetUid}...`);
    
    // 1. Set Custom Claims
    await admin.auth().setCustomUserClaims(targetUid, { role: 'ADMIN' });
    
    // 2. Mirror into Firestore
    const db = admin.firestore();
    await db.collection('users').doc(targetUid).set({ 
      role: 'ADMIN',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`✅ Success! User ${targetUid} is now an ADMIN.`);
    console.log('User must log out and log back in (or refresh their token) for the changes to take effect.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error setting admin role:', error.message);
    process.exit(1);
  }
}

setAdmin(uid);
