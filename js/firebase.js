// ============================================================
// CONFIGURAÇÃO FIREBASE — compartilhada entre site e admin
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyARUPJBEiVdkYh6De-H9EYtq6L77vFPs0A",
  authDomain: "cardapiohelogourmet.firebaseapp.com",
  projectId: "cardapiohelogourmet",
  storageBucket: "cardapiohelogourmet.firebasestorage.app",
  messagingSenderId: "968993366150",
  appId: "1:968993366150:web:327fb9b8ae9bb58fe7f107",
  measurementId: "G-4SZREB6SF6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
