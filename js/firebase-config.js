// ============================================================
// Firebase init (modular SDK, loaded via CDN — no bundler needed)
// Replace the values below with YOUR Firebase project's config.
// Firebase Console → Project settings → General → Your apps → SDK setup and config
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIeipwM9XuDjt-pGY7yB3EBgjxMBvgoFM",
  authDomain: "scheduler-a7d59.firebaseapp.com",
  projectId: "scheduler-a7d59",
  storageBucket: "scheduler-a7d59.firebasestorage.app",
  messagingSenderId: "891565923132",
  appId: "1:891565923132:web:68795ab3d894f0b3691c39"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
