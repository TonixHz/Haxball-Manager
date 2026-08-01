// ============================================================================
// Team — alineación (varias formaciones) y fuerza del equipo
// ============================================================================

import { db, doc, updateDoc } from "./firebase-config.js";

// Formaciones disponibles: siempre 1 arquero + 4 jugadores de campo (5 en
// cancha en total, como en las salas clásicas de Haxball).
export const FORMATIONS = {
  "2-2": {
    label: "2-2",
    fieldSlots: [
      { key: "DEF1", label: "Defensor", pos: "DEF" },
      { key: "DEF2", label: "Defensor", pos: "DEF" },
      { key: "MED1", label: "Mediocampista", pos: "MED" },
      { key: "MED2", label: "Mediocampista", pos: "MED" },
    ],
  },
  "1-2-1": {
    label: "1-2-1",
    fieldSlots: [
      { key: "DEF1", label: "Defensor", pos: "DEF" },
      { key: "MED1", label: "Mediocampista", pos: "MED" },
      { key: "MED2", label: "Mediocampista", pos: "MED" },
      { key: "DEL1", label: "Delantero", pos: "DEL" },
    ],
  },
  "1-1-2": {
    label: "1-1-2",
    fieldSlots: [
      { key: "DEF1", label: "Defensor", pos: "DEF" },
      { key: "MED1", label: "Mediocampista", pos: "MED" },
      { key: "DEL1", label: "Delantero", pos: "DEL" },
      { key: "DEL2", label: "Delantero", pos: "DEL" },
    ],
  },
  "2-1-1": {
    label: "2-1-1",
    fieldSlots: [
      { key: "DEF1", label: "Defensor", pos: "DEF" },
      { key: "DEF2", label: "Defensor", pos: "DEF" },
      { key: "MED1", label: "Mediocampista", pos: "MED" },
      { key: "DEL1", label: "Delantero", pos: "DEL" },
    ],
  },
};

export const DEFAULT_FORMATION = "2-1-1"; // más parecida a la 1-2-2-1 anterior

// Devuelve los puestos (arquero + los de campo) de una formación dada.
export function getFormationSlots(formationKey) {
  const f = FORMATIONS[formationKey] || FORMATIONS[DEFAULT_FORMATION];
  return [{ key: "POR", label: "Portero", pos: "POR" }, ...f.fieldSlots];
}

// Alias retrocompatible: puestos de la formación por defecto.
export const FORMATION_SLOTS = getFormationSlots(DEFAULT_FORMATION);

// Arma automáticamente el mejor once posible con un plantel dado, para una
// formación puntual. Se usa para los equipos CPU dentro de una partida.
// Prioriza cubrir cada puesto con un jugador de esa posición; si no hay,
// mete al mejor que quede libre (penaliza igual en computeTeamStrength).
export function autoPickLineup(formationKey, players) {
  const slots = getFormationSlots(formationKey);
  const pool = players.slice();
  const lineup = {};
  const chosen = [];

  for (const slot of slots) {
    let bestIdx = -1;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].position !== slot.pos) continue;
      if (bestIdx === -1 || pool[i].overall > pool[bestIdx].overall) bestIdx = i;
    }
    if (bestIdx === -1) {
      // no hay nadie de esa posición: mete al mejor disponible igual
      for (let i = 0; i < pool.length; i++) {
        if (bestIdx === -1 || pool[i].overall > pool[bestIdx].overall) bestIdx = i;
      }
    }
    if (bestIdx !== -1) {
      const player = pool[bestIdx];
      lineup[slot.key] = player.id;
      chosen.push({ slotKey: slot.key, slotLabel: slot.label, slotPos: slot.pos, ...player });
      pool.splice(bestIdx, 1);
    } else {
      lineup[slot.key] = null;
    }
  }

  return { lineup, chosen };
}

// Pone a un jugador en un puesto, sacándolo de cualquier otro puesto
// donde ya estuviera (así no hay duplicados en la cancha).
export function assignSlot(lineup, slotKey, playerId) {
  const next = { ...lineup };
  for (const key of Object.keys(next)) {
    if (next[key] === playerId) next[key] = null;
  }
  next[slotKey] = playerId;
  return next;
}

export function clearSlot(lineup, slotKey) {
  return { ...lineup, [slotKey]: null };
}

// Todo lo que persiste la alineación/formación ahora escribe en
// saves/{saveId}, la partida — nunca en el catálogo maestro.
export async function saveLineup(saveId, lineup) {
  await updateDoc(doc(db, "saves", saveId), { lineup });
}

// Cambiar de formación reinicia el once (los puestos cambian de forma
// y no siempre hay un mapeo obvio), así que se guardan juntos.
export async function saveFormation(saveId, formation, lineup) {
  await updateDoc(doc(db, "saves", saveId), { formation, lineup });
}

// Fuerza del equipo = promedio del overall de los titulares.
// Los puestos vacíos penalizan bastante (jugás con menos gente en la cancha).
export function computeTeamStrength(lineup, rosterById) {
  const slots = Object.keys(lineup);
  let total = 0;
  let filled = 0;
  for (const key of slots) {
    const pid = lineup[key];
    if (pid && rosterById[pid]) {
      total += rosterById[pid].overall;
      filled++;
    }
  }
  if (filled === 0) return 30; // equipo vacío, muy débil
  const avg = total / filled;
  const emptyPenalty = (slots.length - filled) * 6;
  return Math.max(20, Math.round(avg - emptyPenalty));
}

export function rosterToMap(roster) {
  const map = {};
  for (const p of roster) map[p.id] = p;
  return map;
}
