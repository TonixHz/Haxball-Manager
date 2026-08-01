// ============================================================================
// Auth — login con Google + creación del "club" del usuario
// ============================================================================

import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "./firebase-config.js";

export const STARTING_BUDGET = 200000;

export const EMPTY_LINEUP = {
  POR: null,
  DEF1: null,
  DEF2: null,
  MED1: null,
  MED2: null,
  DEL: null,
};

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function logoutClub() {
  await fbSignOut(auth);
}

export async function getClubDoc(uid) {
  const snap = await getDoc(doc(db, "clubs", uid));
  return snap.exists() ? snap.data() : null;
}

// Se llama la primera vez que un usuario nuevo entra con Google, para que
// elija el nombre de su club antes de arrancar a jugar.
export async function createClub(uid, email, clubName) {
  const clubData = {
    club: clubName,
    email: email || null,
    budget: STARTING_BUDGET,
    lineup: EMPTY_LINEUP,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, "clubs", uid), clubData);
  return clubData;
}

// Traduce los códigos de error más comunes del popup de Google a español.
export function translateAuthError(code) {
  const map = {
    "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
    "auth/cancelled-popup-request": "Se canceló el inicio de sesión.",
    "auth/popup-blocked": "El navegador bloqueó la ventana emergente. Habilitala e intentá de nuevo.",
    "auth/network-request-failed": "Falló la conexión. Revisá tu internet e intentá de nuevo.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).",
  };
  return map[code] || "No se pudo iniciar sesión con Google. Probá de nuevo.";
}
