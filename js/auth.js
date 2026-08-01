// ============================================================================
// Auth — login con Google + gestión de la partida ("save") del usuario
// ----------------------------------------------------------------------------
// users/{uid}          -> puntero liviano: { activeSaveId }
// saves/{saveId}        -> la partida en sí (club, presupuesto, alineación)
// saves/{saveId}/players -> copia independiente del catálogo maestro (market.js)
// leagues/{saveId}       -> la liga de esa partida (league.js)
//
// El catálogo maestro "players" nunca se toca desde acá.
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
  deleteDoc,
  serverTimestamp,
  collection,
} from "./firebase-config.js";
import { getFormationSlots, DEFAULT_FORMATION } from "./team.js";
import { copyMasterPlayersToSave, deleteSavePlayers } from "./market.js";
import { deleteLeague } from "./league.js";

export const STARTING_BUDGET = 200000;

// Arma un lineup vacío (todos los puestos en null) para una formación dada.
export function buildEmptyLineup(formationKey) {
  const lineup = {};
  for (const slot of getFormationSlots(formationKey)) lineup[slot.key] = null;
  return lineup;
}

// Retrocompatible: lineup vacío de la formación por defecto.
export const EMPTY_LINEUP = buildEmptyLineup(DEFAULT_FORMATION);

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function logoutClub() {
  await fbSignOut(auth);
}

// ----------------------------------------------------------------------------
// Devuelve la partida activa del usuario (o null si nunca creó una / la
// borró). users/{uid}.activeSaveId es el único lugar donde uid y saveId
// se cruzan — todo lo demás (mercado, plantilla, liga) trabaja con saveId.
// ----------------------------------------------------------------------------
export async function getActiveSave(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  const saveId = userSnap.exists() ? userSnap.data().activeSaveId : null;
  if (!saveId) return null;

  const saveSnap = await getDoc(doc(db, "saves", saveId));
  if (!saveSnap.exists()) return null; // puntero colgado, por las dudas

  return { saveId, ...saveSnap.data() };
}

// Se llama la primera vez que un usuario nuevo entra con Google (o después
// de borrar su carrera), para arrancar una partida nueva desde cero.
// Copia TODO el catálogo maestro a saves/{saveId}/players: la partida queda
// 100% independiente desde el minuto uno.
export async function createSave(uid, email, clubName) {
  const saveRef = doc(collection(db, "saves"));
  const saveId = saveRef.id;

  const saveData = {
    ownerUid: uid,
    club: clubName,
    email: email || null,
    budget: STARTING_BUDGET,
    formation: DEFAULT_FORMATION,
    lineup: buildEmptyLineup(DEFAULT_FORMATION),
    createdAt: serverTimestamp(),
  };
  await setDoc(saveRef, saveData);

  await copyMasterPlayersToSave(saveId);

  await setDoc(doc(db, "users", uid), { activeSaveId: saveId }, { merge: true });

  return { saveId, ...saveData };
}

// Borra la partida activa por completo: su copia de jugadores, su liga y el
// doc de la partida. El catálogo maestro "players" queda exactamente igual,
// así que la próxima partida vuelve a arrancar con el pool completo.
export async function deleteActiveSave(uid, saveId) {
  await deleteSavePlayers(saveId);
  await deleteLeague(saveId);
  await deleteDoc(doc(db, "saves", saveId));
  await setDoc(doc(db, "users", uid), { activeSaveId: null }, { merge: true });
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
