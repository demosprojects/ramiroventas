import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBNU_FoJfrwmvZC-EAo5EmTcyJkYxXpfLE",
  authDomain: "ramiroventas-1e595.firebaseapp.com",
  projectId: "ramiroventas-1e595",
  storageBucket: "ramiroventas-1e595.firebasestorage.app",
  messagingSenderId: "372625447687",
  appId: "1:372625447687:web:d6c4491c2d10d63862c3a2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);