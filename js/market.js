// ============================================================================
// Market — mercado de fichajes
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

// ----------------------------------------------------------------------------
// Siembra la colección "players" para todo el proyecto, usando un doc de
// control en meta/players_seed con la versión de datos actual (SEED_VERSION
// en players-seed.js). Si alguien cambia la lista de jugadores más adelante,
// basta con subir SEED_VERSION: acá se detecta el desfasaje, se borran los
// jugadores viejos que sigan libres (a nadie le tocan los que ya fichó) y
// se cargan los nuevos, sin tener que borrar la base a mano.
// ----------------------------------------------------------------------------
export async function ensurePlayersSeeded() {
  const metaRef = doc(db, "meta", "players_seed");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists() && metaSnap.data().version === SEED_VERSION) return;

  try {
    await setDoc(metaRef, { seeded: true, version: SEED_VERSION, at: Date.now() });
  } catch (e) {
    return; // otro cliente ya está sembrando / no hay permisos, no pasa nada
  }

  // Los jugadores libres (que nadie fichó) de una siembra anterior quedan
  // obsoletos y se borran; los que ya son de algún club (usuario o CPU) se
  // dejan intactos para no romper ningún plantel existente.
  const existingSnap = await getDocs(collection(db, "players"));
  const staleFree = existingSnap.docs.filter((d) => !d.data().ownerId);
  if (staleFree.length > 0) {
    const deleteBatch = writeBatch(db);
    staleFree.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
  }

  const players = generatePlayerPool();
  const batch = writeBatch(db);
  for (const p of players) {
    batch.set(doc(db, "players", p.id), p);
  }
  await batch.commit();
}

export async function fetchFreeAgents() {
  const q = query(collection(db, "players"), where("ownerId", "==", null));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchAllPlayers() {
  const snap = await getDocs(collection(db, "players"));
  return snap.docs.map((d) => d.data());
}

// ----------------------------------------------------------------------------
// Al crear la liga, todo jugador libre (que nadie fichó todavía) se reparte
// al azar entre los 5 equipos CPU — sin ningún criterio de equilibrio, pura
// suerte, así que un CPU puede terminar con un plantel mucho mejor que otro.
// Quedan marcados como fichados por ese CPU y desaparecen del mercado.
// ----------------------------------------------------------------------------
export async function assignFreeAgentsToCpuTeams(freeAgents, cpuTeams) {
  const cpuIds = Object.keys(cpuTeams);
  const assignment = {};
  cpuIds.forEach((id) => (assignment[id] = []));

  const batch = writeBatch(db);
  for (const player of freeAgents) {
    const cpuId = cpuIds[Math.floor(Math.random() * cpuIds.length)];
    assignment[cpuId].push(player);
    batch.update(doc(db, "players", player.id), {
      ownerId: cpuId,
      ownerClub: cpuTeams[cpuId].name,
    });
  }
  await batch.commit();

  return assignment;
}

export async function fetchRoster(uid) {
  const q = query(collection(db, "players"), where("ownerId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// ----------------------------------------------------------------------------
// Al borrar una carrera, el plantel del usuario vuelve al mercado libre en
// vez de perderse (así otro club los puede fichar más adelante).
// ----------------------------------------------------------------------------
export async function releaseRoster(uid) {
  const roster = await fetchRoster(uid);
  if (roster.length === 0) return;
  const batch = writeBatch(db);
  for (const p of roster) {
    batch.update(doc(db, "players", p.id), { ownerId: null, ownerClub: null });
  }
  await batch.commit();
}

// ----------------------------------------------------------------------------
// Fichar un jugador: transacción atómica que verifica que siga libre y que
// el club tenga presupuesto suficiente antes de confirmar.
// ----------------------------------------------------------------------------
export async function buyPlayer(uid, clubName, playerId) {
  const playerRef = doc(db, "players", playerId);
  const clubRef = doc(db, "clubs", uid);

  return runTransaction(db, async (tx) => {
    const playerSnap = await tx.get(playerRef);
    const clubSnap = await tx.get(clubRef);

    if (!playerSnap.exists()) throw new Error("Ese jugador ya no existe.");
    const player = playerSnap.data();
    if (player.ownerId) throw new Error(`${player.alias} ya fue fichado por otro club.`);

    const club = clubSnap.data();
    if (club.budget < player.price) throw new Error("No te alcanza el presupuesto.");

    tx.update(playerRef, { ownerId: uid, ownerClub: clubName });
    tx.update(clubRef, { budget: club.budget - player.price });

    return { newBudget: club.budget - player.price };
  });
}

// ----------------------------------------------------------------------------
// Vender un jugador: vuelve al mercado libre y el club recupera parte
// del valor. Si estaba en el once titular, se lo saca del lineup.
// ----------------------------------------------------------------------------
export async function sellPlayer(uid, playerId) {
  const playerRef = doc(db, "players", playerId);
  const clubRef = doc(db, "clubs", uid);

  return runTransaction(db, async (tx) => {
    const playerSnap = await tx.get(playerRef);
    const clubSnap = await tx.get(clubRef);

    if (!playerSnap.exists()) throw new Error("Ese jugador ya no existe.");
    const player = playerSnap.data();
    if (player.ownerId !== uid) throw new Error("Ese jugador no es tuyo.");

    const club = clubSnap.data();
    const refund = Math.round((player.price * SELL_BACK_RATE) / 500) * 500;

    const newLineup = { ...club.lineup };
    for (const slot of Object.keys(newLineup)) {
      if (newLineup[slot] === playerId) newLineup[slot] = null;
    }

    tx.update(playerRef, { ownerId: null, ownerClub: null });
    tx.update(clubRef, { budget: club.budget + refund, lineup: newLineup });

    return { refund, newBudget: club.budget + refund };
  });
}

export function formatMoney(n) {
  return "H$ " + Math.round(n).toLocaleString("es-AR");
}
