// ============================================================================
// Auth — registro / login / logout + creación del "club" del usuario
// ============================================================================

import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
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

export async function registerClub(clubName, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: clubName });

  await setDoc(doc(db, "clubs", cred.user.uid), {
    club: clubName,
    email,
    budget: STARTING_BUDGET,
    lineup: EMPTY_LINEUP,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

export async function loginClub(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutClub() {
  await fbSignOut(auth);
}

export async function getClubDoc(uid) {
  const snap = await getDoc(doc(db, "clubs", uid));
  return snap.exists() ? snap.data() : null;
}

// Traduce los códigos de error de Firebase Auth a mensajes en español,
// para no mostrarle al usuario cosas como "auth/invalid-credential".
export function translateAuthError(code) {
  const map = {
    "auth/email-already-in-use": "Ese email ya tiene una cuenta creada.",
    "auth/invalid-email": "El email no es válido.",
    "auth/weak-password": "La contraseña tiene que tener al menos 6 caracteres.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/wrong-password": "Email o contraseña incorrectos.",
    "auth/user-not-found": "No existe una cuenta con ese email.",
    "auth/too-many-requests": "Demasiados intentos. Probá de nuevo en un rato.",
  };
  return map[code] || "Algo salió mal. Probá de nuevo.";
}
