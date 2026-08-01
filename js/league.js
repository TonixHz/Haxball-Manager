// ============================================================================
// League — liga local (tu club + 5 CPU), calendario ida y vuelta
// ============================================================================

import { db, doc, getDoc, setDoc, updateDoc } from "./firebase-config.js";
import { CPU_TEAM_NAMES, generateCpuTeam } from "./players-seed.js";
import { simulateMatch, simulateMatchScoreOnly } from "./simulation.js";

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

export async function createLeague(uid, clubName, clubStrengthFallback = 45) {
  const teams = {
    [YOU_ID]: { name: clubName, isCpu: false },
  };
  CPU_TEAM_NAMES.forEach((name, i) => {
    const cpu = generateCpuTeam(name, i);
    teams[`cpu${i}`] = { name: cpu.name, isCpu: true, strength: cpu.strength };
  });

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
