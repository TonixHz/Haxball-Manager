// ============================================================================
// Firebase — inicialización
// Usamos el SDK modular servido desde CDN, así no hace falta bundler:
// funciona con un simple index.html + <script type="module">.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCV_fWeMa194XgfKogKvVE6vg0yiRNKKL8",
  authDomain: "haxball-manager.firebaseapp.com",
  projectId: "haxball-manager",
  storageBucket: "haxball-manager.firebasestorage.app",
  messagingSenderId: "385481712087",
  appId: "1:385481712087:web:b426afff8641f820fe2b92",
  measurementId: "G-88X4Y4B29P",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Re-exportamos todo lo que van a necesitar los demás módulos
// para no tener que repetir imports del CDN en cada archivo.
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  runTransaction,
};
