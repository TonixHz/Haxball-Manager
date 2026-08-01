// ============================================================================
// Market — mercado de fichajes
// ----------------------------------------------------------------------------
// Arquitectura de datos:
//
//   players/{id}                     -> catálogo MAESTRO, global, INMUTABLE.
//                                        Se siembra una sola vez para todo el
//                                        juego (ver ensureMasterPlayersSeeded).
//
//   saves/{saveId}/players/{id}      -> copia COMPLETA e independiente del
//                                        catálogo maestro para esa partida.
//                                        Acá viven ownerId, goles, edad,
//                                        moral, fatiga, etc. Cada partida es
//                                        autónoma: nada de esto toca ni lee
//                                        el catálogo maestro ni otra partida.
//
// El mercado, la plantilla, la liga y todo lo demás SIEMPRE trabajan contra
// saves/{saveId}/players. Nunca contra la colección "players" global.
// ============================================================================

import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  runTransaction,
} from "./firebase-config.js";
import { generatePlayerPool, SEED_VERSION } from "./players-seed.js";

const SELL_BACK_RATE = 0.65; // % del precio que recuperás al vender

// Dueño "de tu club" dentro de una partida. Como cada save le pertenece a un
// único usuario, no hace falta usar el uid de Firebase acá adentro — así
// las funciones de mercado quedan desacopladas de la autenticación.
export const YOU_OWNER_ID = "you";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ============================================================================
// CATÁLOGO MAESTRO (players) — global, se siembra 1 sola vez, nunca se toca
// durante una partida. Solo se vuelve a generar si sube SEED_VERSION (o sea,
// si el juego se actualiza con un pool de jugadores distinto).
// ============================================================================
export async function ensureMasterPlayersSeeded() {
  const metaRef = doc(db, "meta", "players_seed");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists() && metaSnap.data().version === SEED_VERSION) return;

  try {
    await setDoc(metaRef, { seeded: true, version: SEED_VERSION, at: Date.now() });
  } catch (e) {
    return; // otro cliente ya está sembrando / no hay permisos, no pasa nada
  }

  // El catálogo maestro no tiene "dueños" ni estado de partida (eso vive
  // solo en saves/{saveId}/players), así que si hay una versión vieja la
  // reemplazamos entera sin riesgo de romper ninguna partida en curso.
  const existingSnap = await getDocs(collection(db, "players"));
  for (const batchDocs of chunk(existingSnap.docs, 400)) {
    const batch = writeBatch(db);
    batchDocs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const players = generatePlayerPool();
  for (const batchPlayers of chunk(players, 400)) {
    const batch = writeBatch(db);
    for (const p of batchPlayers) batch.set(doc(db, "players", p.id), p);
    await batch.commit();
  }
}

export async function fetchMasterPlayers() {
  const snap = await getDocs(collection(db, "players"));
  return snap.docs.map((d) => d.data());
}

// ============================================================================
// COPIA POR PARTIDA — se llama una sola vez, al crear la partida.
// ============================================================================

// Copia TODO el catálogo maestro dentro de saves/{saveId}/players, agregando
// los campos de carrera que no existen en el maestro. A partir de acá esa
// copia es 100% independiente: ni el maestro ni otra partida la afectan.
export async function copyMasterPlayersToSave(saveId) {
  const masterPlayers = await fetchMasterPlayers();
  for (const batchPlayers of chunk(masterPlayers, 400)) {
    const batch = writeBatch(db);
    for (const p of batchPlayers) {
      batch.set(doc(db, "saves", saveId, "players", p.id), {
        ...p,
        ownerId: null,
        ownerClub: null,
        age: 22,
        goals: 0,
        assists: 0,
        matchesPlayed: 0,
        injuries: [],
        morale: 100,
        fatigue: 0,
        history: [],
      });
    }
    await batch.commit();
  }
}

// Borra la subcolección saves/{saveId}/players entera (se usa al borrar una
// carrera). Nunca toca el catálogo maestro "players".
export async function deleteSavePlayers(saveId) {
  const snap = await getDocs(collection(db, "saves", saveId, "players"));
  for (const batchDocs of chunk(snap.docs, 400)) {
    const batch = writeBatch(db);
    batchDocs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// ============================================================================
// LECTURA — siempre sobre la copia de la partida (saves/{saveId}/players)
// ============================================================================

export async function fetchFreeAgents(saveId) {
  const q = query(collection(db, "saves", saveId, "players"), where("ownerId", "==", null));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchAllSavePlayers(saveId) {
  const snap = await getDocs(collection(db, "saves", saveId, "players"));
  return snap.docs.map((d) => d.data());
}

export async function fetchRoster(saveId) {
  const q = query(collection(db, "saves", saveId, "players"), where("ownerId", "==", YOU_OWNER_ID));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// ----------------------------------------------------------------------------
// Al crear la liga, todo jugador libre de la partida se reparte al azar
// entre los 5 equipos CPU — sin ningún criterio de equilibrio. Quedan
// marcados como fichados por ese CPU y desaparecen del mercado de esa
// partida (solo de esa partida).
// ----------------------------------------------------------------------------
export async function assignFreeAgentsToCpuTeams(saveId, freeAgents, cpuTeams) {
  const cpuIds = Object.keys(cpuTeams);
  const assignment = {};
  cpuIds.forEach((id) => (assignment[id] = []));

  for (const batchPlayers of chunk(freeAgents, 400)) {
    const batch = writeBatch(db);
    for (const player of batchPlayers) {
      const cpuId = cpuIds[Math.floor(Math.random() * cpuIds.length)];
      assignment[cpuId].push(player);
      batch.update(doc(db, "saves", saveId, "players", player.id), {
        ownerId: cpuId,
        ownerClub: cpuTeams[cpuId].name,
      });
    }
    await batch.commit();
  }

  return assignment;
}

// ----------------------------------------------------------------------------
// Fichar un jugador: transacción atómica sobre saves/{saveId} (presupuesto) y
// saves/{saveId}/players/{id} (dueño), verificando que siga libre y que
// alcance el presupuesto. No toca el catálogo maestro ni otras partidas.
// ----------------------------------------------------------------------------
export async function buyPlayer(saveId, clubName, playerId) {
  const playerRef = doc(db, "saves", saveId, "players", playerId);
  const saveRef = doc(db, "saves", saveId);

  return runTransaction(db, async (tx) => {
    const playerSnap = await tx.get(playerRef);
    const saveSnap = await tx.get(saveRef);

    if (!playerSnap.exists()) throw new Error("Ese jugador ya no existe.");
    const player = playerSnap.data();
    if (player.ownerId) throw new Error(`${player.alias} ya fue fichado por otro club.`);

    const save = saveSnap.data();
    if (save.budget < player.price) throw new Error("No te alcanza el presupuesto.");

    tx.update(playerRef, { ownerId: YOU_OWNER_ID, ownerClub: clubName });
    tx.update(saveRef, { budget: save.budget - player.price });

    return { newBudget: save.budget - player.price };
  });
}

// ----------------------------------------------------------------------------
// Vender un jugador: vuelve al mercado libre DE ESA PARTIDA (nunca al
// catálogo maestro) y el club recupera parte del valor. Si estaba en el
// once titular, se lo saca del lineup.
// ----------------------------------------------------------------------------
export async function sellPlayer(saveId, playerId) {
  const playerRef = doc(db, "saves", saveId, "players", playerId);
  const saveRef = doc(db, "saves", saveId);

  return runTransaction(db, async (tx) => {
    const playerSnap = await tx.get(playerRef);
    const saveSnap = await tx.get(saveRef);

    if (!playerSnap.exists()) throw new Error("Ese jugador ya no existe.");
    const player = playerSnap.data();
    if (player.ownerId !== YOU_OWNER_ID) throw new Error("Ese jugador no es tuyo.");

    const save = saveSnap.data();
    const refund = Math.round((player.price * SELL_BACK_RATE) / 500) * 500;

    const newLineup = { ...save.lineup };
    for (const slot of Object.keys(newLineup)) {
      if (newLineup[slot] === playerId) newLineup[slot] = null;
    }

    tx.update(playerRef, { ownerId: null, ownerClub: null });
    tx.update(saveRef, { budget: save.budget + refund, lineup: newLineup });

    return { refund, newBudget: save.budget + refund };
  });
}

export function formatMoney(n) {
  return "H$ " + Math.round(n).toLocaleString("es-AR");
}
