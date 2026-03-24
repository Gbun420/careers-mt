import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB14328keCHi0O07eZMfHSv5sCM1B5RSRc",
  authDomain: "careers-mt-2026-v1.firebaseapp.com",
  projectId: "careers-mt-2026-v1",
  storageBucket: "careers-mt-2026-v1.firebasestorage.app",
  messagingSenderId: "289521747811",
  appId: "1:289521747811:web:105b22e5c71ba0aefd7556"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
