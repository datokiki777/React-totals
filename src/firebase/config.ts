import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

/**
 * Firebase web config — reused from the same project the old vanilla-JS
 * app already syncs to, so cloud backups stay compatible across both
 * apps. This is NOT a secret: Firebase's own docs are explicit that this
 * client config is meant to be public (it identifies the project, it
 * doesn't authorize anything by itself) — the actual security boundary is
 * Firestore Security Rules plus Firebase Auth, not hiding this object.
 * https://firebase.google.com/docs/projects/api-keys
 */
const firebaseConfig = {
  apiKey: "AIzaSyBQi84qyPArf_-11RKOfyFkwfWB0io2ipM",
  authDomain: "client-totals-sync.firebaseapp.com",
  projectId: "client-totals-sync",
  storageBucket: "client-totals-sync.firebasestorage.app",
  messagingSenderId: "69584526058",
  appId: "1:69584526058:web:9a06b863e83663476f5593",
};

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}
