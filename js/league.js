// ============================================================================
// League — liga local (tu club + 5 CPU), calendario ida y vuelta
// ============================================================================

import { db, doc, getDoc, setDoc, updateDoc, deleteDoc } from "./firebase-config.js";
import { CPU_TEAM_NAMES } from "./players-seed.js";
import { simulateMatch, simulateMatchScoreOnly } from "./simulation.js";
import { fetchAllPlayers, assignFreeAgentsToCpuTeams } from "./market.js";
import { FORMATIONS, autoPickLineup, computeTeamStrength, rosterToMap } from "./team.js";

export const YOU_ID = "you";

// ----------------------------------------------------------------------------
// Calendario round-robin (método del círculo), ida y vuelta.
// ----------------------------------------------------------------------------
function roundRobinRounds(teamIds) {
  const arr = teamIds.slice();
  const numRounds = arr.length - 1;
  const half = arr.length / 2;
  const rounds = [];
  let list = arr.slice();

  for (let r = 0; r < numRounds; r++) {
    const pairs = [];
    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[list.length - 1 - i];
      pairs.push(r % 2 === 0 ? [home, away] : [away, home]);
    }
    rounds.push(pairs);
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop());
    list = [fixed, ...rest];
  }
  return rounds;
}

function buildFixtures(teamIds) {
  const firstLeg = roundRobinRounds(teamIds);
  const secondLeg = firstLeg.map((round) =>
    round.map(([h, a]) => [a, h])
  );
  const allRounds = [...firstLeg, ...secondLeg];

  return allRounds.map((round) => ({
    matches: round.map(([home, away]) => ({
      home,
      away,
      played: false,
      homeGoals: null,
      awayGoals: null,
    })),
  }));
}

export async function createLeague(uid, clubName) {
  const teams = {
    [YOU_ID]: { name: clubName, isCpu: false },
  };
  CPU_TEAM_NAMES.forEach((name, i) => {
    teams[`cpu${i}`] = { name, isCpu: true };
  });

  // Los jugadores que nadie fichó todavía se reparten al azar (sin
  // equilibrar) entre los 5 clubes CPU, así arrancan con plantel propio.
  const cpuTeamsOnly = {};
  CPU_TEAM_NAMES.forEach((name, i) => (cpuTeamsOnly[`cpu${i}`] = { name }));

  const allPlayers = await fetchAllPlayers();
  const freeAgents = allPlayers.filter((p) => !p.ownerId);
  const assignment = await assignFreeAgentsToCpuTeams(freeAgents, cpuTeamsOnly);

  const formationKeys = Object.keys(FORMATIONS);
  for (const cpuId of Object.keys(cpuTeamsOnly)) {
    const roster = assignment[cpuId] || [];
    const formation = formationKeys[Math.floor(Math.random() * formationKeys.length)];
    const { lineup, chosen } = autoPickLineup(formation, roster);
    const rosterById = rosterToMap(roster);
    const strength = computeTeamStrength(lineup, rosterById);

    teams[cpuId] = {
      ...teams[cpuId],
      strength,
      formation,
      // "foto" de la alineación elegida, para poder mostrarla en el fixture
      // sin tener que volver a leer la colección de jugadores.
      lineupPreview: chosen.map((p) => ({
        slotKey: p.slotKey,
        slotLabel: p.slotLabel,
        alias: p.alias,
        position: p.position,
        overall: p.overall,
        rarity: p.rarity,
      })),
    };
  }

  const teamIds = Object.keys(teams);
  const fixtures = buildFixtures(teamIds);

  const leagueDoc = {
    teams,
    fixtures,
    currentMatchday: 0,
    totalMatchdays: fixtures.length,
  };

  await setDoc(doc(db, "leagues", uid), leagueDoc);
  return leagueDoc;
}

export async function getLeague(uid) {
  const snap = await getDoc(doc(db, "leagues", uid));
  return snap.exists() ? snap.data() : null;
}

// Borra la liga del usuario (se usa al borrar la carrera para empezar de cero).
export async function deleteLeague(uid) {
  await deleteDoc(doc(db, "leagues", uid));
}

export function computeStandings(league) {
  const table = {};
  for (const id of Object.keys(league.teams)) {
    table[id] = { id, name: league.teams[id].name, isCpu: league.teams[id].isCpu, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };
  }

  for (const round of league.fixtures) {
    for (const m of round.matches) {
      if (!m.played) continue;
      const home = table[m.home];
      const away = table[m.away];
      home.pj++; away.pj++;
      home.gf += m.homeGoals; home.gc += m.awayGoals;
      away.gf += m.awayGoals; away.gc += m.homeGoals;
      if (m.homeGoals > m.awayGoals) { home.g++; home.pts += 3; away.p++; }
      else if (m.homeGoals < m.awayGoals) { away.g++; away.pts += 3; home.p++; }
      else { home.e++; away.e++; home.pts += 1; away.pts += 1; }
    }
  }

  return Object.values(table).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const dgA = a.gf - a.gc, dgB = b.gf - b.gc;
    if (dgB !== dgA) return dgB - dgA;
    return b.gf - a.gf;
  });
}

export function getNextMatchday(league) {
  if (league.currentMatchday >= league.totalMatchdays) return null;
  return league.fixtures[league.currentMatchday].matches;
}

// ----------------------------------------------------------------------------
// Simula toda la jornada actual. Los partidos CPU vs CPU se resuelven
// directo; el partido de "you" (si hay) devuelve además el timeline
// completo para animarlo en el marcador.
// ----------------------------------------------------------------------------
export async function simulateCurrentMatchday(uid, league, yourStrength) {
  const idx = league.currentMatchday;
  if (idx >= league.totalMatchdays) throw new Error("La liga ya terminó.");

  const round = league.fixtures[idx].matches;
  let yourMatch = null;

  const updatedRound = round.map((m) => {
    const homeIsYou = m.home === YOU_ID;
    const awayIsYou = m.away === YOU_ID;

    const homeStrength = homeIsYou ? yourStrength : league.teams[m.home].strength;
    const awayStrength = awayIsYou ? yourStrength : league.teams[m.away].strength;

    if (homeIsYou || awayIsYou) {
      const result = simulateMatch(
        league.teams[m.home].name,
        league.teams[m.away].name,
        homeStrength,
        awayStrength
      );
      yourMatch = {
        homeName: league.teams[m.home].name,
        awayName: league.teams[m.away].name,
        youAreHome: homeIsYou,
        ...result,
      };
      return { ...m, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals };
    } else {
      const result = simulateMatchScoreOnly(homeStrength, awayStrength);
      return { ...m, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals };
    }
  });

  const newFixtures = league.fixtures.slice();
  newFixtures[idx] = { matches: updatedRound };

  const newLeague = {
    ...league,
    fixtures: newFixtures,
    currentMatchday: idx + 1,
  };

  await updateDoc(doc(db, "leagues", uid), {
    fixtures: newFixtures,
    currentMatchday: idx + 1,
  });

  return { league: newLeague, round: updatedRound, yourMatch };
}
