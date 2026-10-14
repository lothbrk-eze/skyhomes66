/**
 * Firebase initialisation for SkyHomes.
 *
 * We use Firebase Auth solely for Google Sign-In credential verification.
 * The actual user account is stored on the SkyHomes backend.
 *
 * ⚠️  Google Sign-In requires a native development build.
 *     It will NOT work inside Expo Go.
 */
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDfkBHDgYv8TNBzMhSkWVkPD93RYmv1LZA",
  authDomain: "hood-app-f3c68.firebaseapp.com",
  projectId: "hood-app-f3c68",
  storageBucket: "hood-app-f3c68.firebasestorage.app",
  messagingSenderId: "250434053132",
  appId: "1:250434053132:android:a27bbfeccd95c9ac19ba29",
};

// Prevent duplicate app initialisation during hot-reload
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export default app;
