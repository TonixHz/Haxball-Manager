// ============================================================================
// Jugadores — datos de ejemplo (PLACEHOLDER)
// ----------------------------------------------------------------------------
// Reemplazá "alias" por los nicks reales de la comunidad de Haxball que
// quieras usar, y ajustá las stats como quieras. Cada jugador tiene:
//
//   alias      -> nombre que se muestra (el "nick" de Haxball)
//   position   -> "POR" | "DEF" | "MED" | "DEL"
//   rarity     -> "bronce" | "plata" | "oro" | "leyenda" (define color y precio base)
//   stats      -> velocidad, tiro, pase, regate, defensa, portero (0-99)
//
// El "overall" y el precio se calculan solos con las funciones de abajo,
// así que solo tenés que tocar estos datos.
// ============================================================================

export const RARITY_ORDER = ["bronce", "plata", "oro", "leyenda"];

export const RARITY_COLORS = {
  bronce: "#b06a34",
  plata: "#aab6c4",
  oro: "#d9a521",
  leyenda: "#b06fe0",
};

export const RARITY_PRICE_MULT = {
  bronce: 1,
  plata: 1.8,
  oro: 3,
  leyenda: 5,
};

const POSITIONS = ["POR", "DEF", "MED", "DEL"];

function statsFor(position, level) {
  // level 0..1 aproximado según rareza, con algo de ruido para variedad
  const base = 35 + level * 55;
  const noise = () => Math.round((Math.random() - 0.5) * 14);
  const clamp = (n) => Math.max(20, Math.min(99, n));

  if (position === "POR") {
    return {
      velocidad: clamp(base - 10 + noise()),
      tiro: clamp(base - 30 + noise()),
      pase: clamp(base - 10 + noise()),
      regate: clamp(base - 25 + noise()),
      defensa: clamp(base - 5 + noise()),
      portero: clamp(base + 15 + noise()),
    };
  }
  if (position === "DEF") {
    return {
      velocidad: clamp(base + noise()),
      tiro: clamp(base - 20 + noise()),
      pase: clamp(base + noise()),
      regate: clamp(base - 10 + noise()),
      defensa: clamp(base + 15 + noise()),
      portero: clamp(15 + noise()),
    };
  }
  if (position === "MED") {
    return {
      velocidad: clamp(base + noise()),
      tiro: clamp(base + noise()),
      pase: clamp(base + 15 + noise()),
      regate: clamp(base + 10 + noise()),
      defensa: clamp(base - 5 + noise()),
      portero: clamp(10 + noise()),
    };
  }
  // DEL
  return {
    velocidad: clamp(base + 10 + noise()),
    tiro: clamp(base + 18 + noise()),
    pase: clamp(base - 5 + noise()),
    regate: clamp(base + 12 + noise()),
    defensa: clamp(base - 25 + noise()),
    portero: clamp(10 + noise()),
  };
}

export function computeOverall(stats, position) {
  const w =
    position === "POR"
      ? { velocidad: 0.1, tiro: 0.02, pase: 0.13, regate: 0.05, defensa: 0.2, portero: 0.5 }
      : position === "DEF"
      ? { velocidad: 0.2, tiro: 0.05, pase: 0.2, regate: 0.1, defensa: 0.45, portero: 0 }
      : position === "MED"
      ? { velocidad: 0.15, tiro: 0.15, pase: 0.35, regate: 0.25, defensa: 0.1, portero: 0 }
      : { velocidad: 0.2, tiro: 0.35, pase: 0.1, regate: 0.25, defensa: 0.1, portero: 0 };

  const val =
    stats.velocidad * w.velocidad +
    stats.tiro * w.tiro +
    stats.pase * w.pase +
    stats.regate * w.regate +
    stats.defensa * w.defensa +
    stats.portero * w.portero;

  return Math.round(val);
}

export function computePrice(overall, rarity) {
  const base = Math.pow(overall / 10, 2.15) * 350;
  return Math.round((base * RARITY_PRICE_MULT[rarity]) / 500) * 500;
}

// Distribución: 10 bronce, 10 plata, 7 oro, 3 leyenda = 30 jugadores
const DISTRIBUTION = [
  ...Array(10).fill({ rarity: "bronce", level: 0.15 }),
  ...Array(10).fill({ rarity: "plata", level: 0.42 }),
  ...Array(7).fill({ rarity: "oro", level: 0.68 }),
  ...Array(3).fill({ rarity: "leyenda", level: 0.92 }),
];

export function generatePlayerPool() {
  const players = [];
  let n = 1;
  for (const { rarity, level } of DISTRIBUTION) {
    const position = POSITIONS[n % POSITIONS.length];
    const stats = statsFor(position, level + (Math.random() - 0.5) * 0.1);
    const overall = computeOverall(stats, position);
    players.push({
      id: `seed-${String(n).padStart(2, "0")}`,
      alias: `Jugador ${String(n).padStart(2, "0")}`,
      position,
      rarity,
      stats,
      overall,
      price: computePrice(overall, rarity),
      ownerId: null,
      ownerClub: null,
    });
    n++;
  }
  return players;
}

// ----------------------------------------------------------------------------
// Genera equipos CPU para la liga local a partir de un pool de jugadores
// que no pertenece a ningún usuario (o del pool completo si hace falta).
// ----------------------------------------------------------------------------
export const CPU_TEAM_NAMES = [
  "Turbo FC",
  "Los Rebotes",
  "Cannon Kickers",
  "Rush United",
  "Disco Rojo CF",
];

export function generateCpuTeam(name, seedIndex) {
  // Cada equipo CPU tiene una "fuerza" fija que se usa directo en la simulación,
  // no dependen de la colección de Firestore de jugadores.
  const strength = 45 + ((seedIndex * 13) % 40); // 45-84 aprox, variado
  return { name, strength, isCpu: true };
}
