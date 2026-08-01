// ============================================================================
// Team — alineación (formación 1-2-2-1) y fuerza del equipo
// ============================================================================

import { db, doc, updateDoc } from "./firebase-config.js";

export const FORMATION_SLOTS = [
  { key: "POR", label: "Portero", pos: "POR" },
  { key: "DEF1", label: "Defensor", pos: "DEF" },
  { key: "DEF2", label: "Defensor", pos: "DEF" },
  { key: "MED1", label: "Mediocampista", pos: "MED" },
  { key: "MED2", label: "Mediocampista", pos: "MED" },
  { key: "DEL", label: "Delantero", pos: "DEL" },
];

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

export async function saveLineup(uid, lineup) {
  await updateDoc(doc(db, "clubs", uid), { lineup });
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
