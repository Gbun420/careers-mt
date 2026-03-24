import * as admin from "firebase-admin";

/**
 * Initializes and returns the Firebase Admin SDK instance.
 * Ensures that it is only initialized once and handles environment variables safely.
 */
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountStr) {
      try {
        const serviceAccount = JSON.parse(serviceAccountStr);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin initialized with service account.");
      } catch (error) {
        console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", error);
        // Fallback or throw based on preference
        admin.initializeApp();
      }
    } else {
      console.log("ℹ️  FIREBASE_SERVICE_ACCOUNT not found, using default initialization.");
      admin.initializeApp();
    }
  }
  return admin;
}

export const adminApp = getFirebaseAdmin();
export const db = adminApp.firestore();
export const auth = adminApp.auth();
export const appCheck = adminApp.appCheck();
