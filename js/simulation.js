// ============================================================================
// Simulation — motor de partidos
// ----------------------------------------------------------------------------
// No es un motor físico como el de Haxball real: es una simulación por
// eventos basada en la "fuerza" (overall promedio) de cada equipo. Cada
// minuto hay una probabilidad chica de que ocurra una jugada de gol; qué
// equipo la genera depende del balance de fuerzas, y si termina en gol
// depende también de eso más algo de azar.
// ============================================================================

const CHANCE_TEXTS = [
  "remata desde afuera del área",
  "encara y define solo",
  "cabecea tras un centro",
  "arranca desde el medio y dispara",
  "la toca al primer palo",
];

const SAVE_TEXTS = [
  "el arquero la saca al córner",
  "el arquero ataja abajo",
  "se estrella en el travesaño",
  "sale desviada por poco",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function simulateMatch(homeName, awayName, strengthHome, strengthAway) {
  const timeline = [];
  let homeGoals = 0;
  let awayGoals = 0;

  const totalStrength = strengthHome + strengthAway;
  const homeShare = (strengthHome + 8) / (totalStrength + 16); // +8 de "localía"

  for (let minute = 1; minute <= 90; minute++) {
    // Probabilidad de que haya una jugada de gol este minuto
    const chanceRoll = Math.random();
    if (chanceRoll > 0.088) continue;

    const isHomeChance = Math.random() < homeShare;
    const team = isHomeChance ? "home" : "away";
    const teamName = isHomeChance ? homeName : awayName;
    const strengthDiff = isHomeChance
      ? strengthHome - strengthAway
      : strengthAway - strengthHome;

    // Probabilidad base de convertir la jugada en gol, ajustada por la
    // diferencia de fuerza (equipos mejores definen mejor)
    const goalProb = Math.min(0.62, Math.max(0.14, 0.32 + strengthDiff / 220));

    if (Math.random() < goalProb) {
      if (team === "home") homeGoals++;
      else awayGoals++;
      timeline.push({
        minute,
        team,
        type: "goal",
        text: `¡GOL! ${teamName} ${pick(CHANCE_TEXTS)}.`,
      });
    } else {
      timeline.push({
        minute,
        team,
        type: "chance",
        text: `${teamName} ${pick(CHANCE_TEXTS)}... ${pick(SAVE_TEXTS)}.`,
      });
    }
  }

  return { homeGoals, awayGoals, timeline };
}

// Simulación rápida sin timeline, usada para partidos CPU vs CPU
// dentro de una misma jornada (no hace falta mostrarlos jugada a jugada).
export function simulateMatchScoreOnly(strengthHome, strengthAway) {
  const { homeGoals, awayGoals } = simulateMatch("H", "A", strengthHome, strengthAway);
  return { homeGoals, awayGoals };
}
