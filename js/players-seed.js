// ============================================================================
// Jugadores — datos de ejemplo (PLACEHOLDER)
// ----------------------------------------------------------------------------
// Este archivo genera el CATÁLOGO MAESTRO del juego (colección global
// "players"). Nunca genera jugadores dentro de una partida — eso lo hace
// market.js copiando este pool hacia saves/{saveId}/players.
//
//   alias      -> nombre que se muestra (el "nick" de Haxball)
//   position   -> "POR" | "DEF" | "MED" | "DEL"
//   rarity     -> "bronce" | "plata" | "oro" | "leyenda" (define color y precio base)
//   stats      -> velocidad, tiro, pase, regate, defensa, portero (0-99)
//
// El "overall" y el precio se calculan solos con las funciones de abajo,
// así que solo tenés que tocar estos datos.
// ============================================================================

// Subí este número cada vez que cambies COMMUNITY_PLAYERS/DETAILED_PLAYERS
// de forma importante: ensureMasterPlayersSeeded() lo usa para darse cuenta
// de que el catálogo maestro quedó desactualizado y refrescarlo por completo.
export const SEED_VERSION = 3;

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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Deriva la rareza a partir del overall real del jugador (para los jugadores
// "de la comunidad" que ya vienen con overall fijo, en vez de generarlo).
function deriveRarity(overall) {
  if (overall >= 85) return "leyenda";
  if (overall >= 75) return "oro";
  if (overall >= 65) return "plata";
  return "bronce";
}

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

// ----------------------------------------------------------------------------
// Jugadores reales de la comunidad (nicks conocidos). overall/potencial vienen
// dados; las stats detalladas se generan a partir del overall y la posición
// para que las barras de stats tengan sentido, y se ajustan un poco donde
// hay una característica marcada (ej. "buen rematador").
// ----------------------------------------------------------------------------
const COMMUNITY_PLAYERS = [
  { alias: "principito", country: "URU", position: "DEF", overall: 72, potential: 73 },
  { alias: "lil for", country: "URU", position: "DEF", overall: 65, potential: 66 },
  { alias: "dezza", country: "ARG", position: "MED", overall: 66, potential: 71 },
  { alias: "pdf", country: "URU", position: "POR", overall: 57, potential: 66 },
  { alias: "white", country: "CHI", position: "DEF", overall: 68, potential: 74 },
  { alias: "pcl", country: "CHI", position: "MED", overall: 71, potential: 73 },
  { alias: "Draco", country: "CHI", position: "DEF", overall: 74, potential: 76 },
  { alias: "lrrd", country: "CHI", position: "DEL", overall: 85, potential: 87, boost: { tiro: 12 } },
  { alias: "hosungryn", country: "ARG", position: "MED", overall: 69, potential: 76, boost: { regate: 12 } },
  { alias: "trop", country: "URU", position: "DEL", overall: 66, potential: 71 },
  { alias: "Charrua", country: "URU", position: "DEL", overall: 80, potential: 84 },
  { alias: "aqua", country: "URU", position: "MED", overall: 75, potential: 77 },
  { alias: "gordito santos", country: "URU", position: "DEF", overall: 62, potential: 69 },
];

// Nicks genéricos para rellenar el mercado con jugadores chilenos y
// argentinos de nivel medio-bajo (59-68 de overall), variados en posición.
// (quedan acá por si hace falta generar más volumen a futuro, pero ya no
// se usan: los reemplazamos por los jugadores reales de abajo)
const FILLER_NICKS_CHI = [
  "Toti", "Cabro Rulo", "Wacho", "Guaton", "Flaite FC", "Pana", "Cuico",
  "Chamullo", "Pije", "Bacan", "Choro Bueno", "Weon Fino",
];
const FILLER_NICKS_ARG = [
  "Bocha", "Pelusita", "Chiqui", "Tano", "Cebolla", "Nene", "Turquito",
  "Colo", "Pampa", "Zurdito", "Petiso", "Bostero",
];

// ----------------------------------------------------------------------------
// Segunda tanda de jugadores reales de la comunidad, con stats detalladas
// (las que vienen del "perfil" completo: tiro, pase, control, lectura,
// arquero, etc). Mapeamos su posición original a nuestras 4 posiciones:
// GK->POR, LAT->DEF, EXT->MED, y DEF/MED/DEL quedan igual.
// ----------------------------------------------------------------------------
const DETAILED_PLAYERS = [
  { alias: "CZ", country: "URU", position: "DEL", overall: 98, potential: 99, raw: { esquineo:99, bunny:91, dtouch:94, rifle:98, rifleAncho:97, punteria:93, pase:99, control:99, regate:99, definicion:99, marca:94, posicionamiento:94, anticipacion:99, lectura:99, cobertura:99, presion:90, desmarque:99, vision:93, pasesLargos:96, gk:91, reflejos:92, atajadas:91, manoMano:98, saques:93, gkPos:92, salidas:99, cobArco:99, lectRem:99, seguridad:99, comunicacion:99 } },
  { alias: "Lushe", country: "ARG", position: "MED", overall: 90, potential: 99, raw: { esquineo:93, bunny:85, dtouch:82, rifle:90, rifleAncho:86, punteria:83, pase:95, control:90, regate:91, definicion:98, marca:92, posicionamiento:82, anticipacion:84, lectura:84, cobertura:85, presion:92, desmarque:83, vision:97, pasesLargos:97, gk:86, reflejos:86, atajadas:91, manoMano:94, saques:88, gkPos:88, salidas:89, cobArco:93, lectRem:94, seguridad:98, comunicacion:94 } },
  { alias: "Gonzalo", country: "URU", position: "DEL", overall: 89, potential: 99, raw: { esquineo:91, bunny:93, dtouch:89, rifle:88, rifleAncho:89, punteria:85, pase:82, control:96, regate:81, definicion:94, marca:96, posicionamiento:97, anticipacion:93, lectura:86, cobertura:95, presion:85, desmarque:90, vision:92, pasesLargos:95, gk:87, reflejos:94, atajadas:85, manoMano:81, saques:83, gkPos:88, salidas:96, cobArco:96, lectRem:96, seguridad:85, comunicacion:92 } },
  { alias: "Javo", country: "CHI", position: "DEL", overall: 86, potential: 88, raw: { esquineo:93, bunny:84, dtouch:93, rifle:80, rifleAncho:85, punteria:87, pase:81, control:82, regate:92, definicion:85, marca:91, posicionamiento:78, anticipacion:84, lectura:81, cobertura:93, presion:91, desmarque:83, vision:82, pasesLargos:78, gk:88, reflejos:78, atajadas:79, manoMano:92, saques:91, gkPos:87, salidas:81, cobArco:82, lectRem:85, seguridad:84, comunicacion:81 } },
  { alias: "Gurua", country: "URU", position: "MED", overall: 84, potential: 88, raw: { esquineo:91, bunny:84, dtouch:77, rifle:85, rifleAncho:79, punteria:78, pase:81, control:91, regate:86, definicion:86, marca:77, posicionamiento:85, anticipacion:78, lectura:80, cobertura:79, presion:84, desmarque:83, vision:76, pasesLargos:86, gk:80, reflejos:87, atajadas:91, manoMano:82, saques:92, gkPos:92, salidas:84, cobArco:77, lectRem:78, seguridad:88, comunicacion:92 } },
  { alias: "Cascote", country: "ARG", position: "MED", overall: 84, potential: 86, raw: { esquineo:77, bunny:90, dtouch:83, rifle:83, rifleAncho:91, punteria:90, pase:91, control:88, regate:86, definicion:89, marca:87, posicionamiento:79, anticipacion:91, lectura:90, cobertura:86, presion:83, desmarque:91, vision:90, pasesLargos:92, gk:76, reflejos:87, atajadas:79, manoMano:88, saques:82, gkPos:82, salidas:81, cobArco:88, lectRem:88, seguridad:82, comunicacion:84 } },
  { alias: "Sarpes", country: "URU", position: "DEL", overall: 82, potential: 87, raw: { esquineo:85, bunny:82, dtouch:78, rifle:84, rifleAncho:84, punteria:77, pase:82, control:74, regate:83, definicion:75, marca:77, posicionamiento:85, anticipacion:80, lectura:76, cobertura:76, presion:84, desmarque:77, vision:82, pasesLargos:82, gk:75, reflejos:87, atajadas:87, manoMano:77, saques:81, gkPos:88, salidas:79, cobArco:84, lectRem:82, seguridad:87, comunicacion:77 } },
  { alias: "Roff", country: "ARG", position: "DEL", overall: 81, potential: 94, raw: { esquineo:87, bunny:86, dtouch:74, rifle:75, rifleAncho:85, punteria:83, pase:89, control:86, regate:82, definicion:75, marca:82, posicionamiento:73, anticipacion:84, lectura:75, cobertura:77, presion:88, desmarque:89, vision:80, pasesLargos:80, gk:89, reflejos:77, atajadas:80, manoMano:76, saques:86, gkPos:86, salidas:89, cobArco:82, lectRem:89, seguridad:87, comunicacion:85 } },
  { alias: "ZKD", country: "URU", position: "DEL", overall: 81, potential: 93, raw: { esquineo:78, bunny:87, dtouch:89, rifle:76, rifleAncho:84, punteria:83, pase:73, control:75, regate:89, definicion:77, marca:73, posicionamiento:80, anticipacion:83, lectura:81, cobertura:81, presion:77, desmarque:73, vision:83, pasesLargos:88, gk:89, reflejos:76, atajadas:86, manoMano:89, saques:86, gkPos:81, salidas:85, cobArco:77, lectRem:79, seguridad:87, comunicacion:84 } },
  { alias: "th!", country: "URU", position: "POR", overall: 78, potential: 89, raw: { esquineo:82, bunny:81, dtouch:76, rifle:85, rifleAncho:76, punteria:81, pase:83, control:85, regate:80, definicion:81, marca:84, posicionamiento:72, anticipacion:73, lectura:73, cobertura:80, presion:82, desmarque:80, vision:75, pasesLargos:72, gk:77, reflejos:84, atajadas:85, manoMano:78, saques:80, gkPos:75, salidas:77, cobArco:78, lectRem:86, seguridad:73, comunicacion:84 } },
  { alias: "TryFede", country: "ARG", position: "MED", overall: 78, potential: 80, raw: { esquineo:85, bunny:77, dtouch:75, rifle:80, rifleAncho:73, punteria:83, pase:77, control:86, regate:81, definicion:86, marca:78, posicionamiento:80, anticipacion:77, lectura:86, cobertura:84, presion:74, desmarque:85, vision:80, pasesLargos:71, gk:74, reflejos:70, atajadas:81, manoMano:80, saques:77, gkPos:80, salidas:73, cobArco:86, lectRem:85, seguridad:78, comunicacion:83 } },
  { alias: "Nahu", country: "ARG", position: "DEL", overall: 79, potential: 83, raw: { esquineo:85, bunny:78, dtouch:79, rifle:76, rifleAncho:74, punteria:85, pase:85, control:85, regate:72, definicion:72, marca:73, posicionamiento:85, anticipacion:87, lectura:87, cobertura:78, presion:84, desmarque:73, vision:85, pasesLargos:71, gk:71, reflejos:85, atajadas:72, manoMano:76, saques:72, gkPos:82, salidas:71, cobArco:76, lectRem:74, seguridad:74, comunicacion:86 } },
  { alias: "Norx", country: "ARG", position: "DEL", overall: 75, potential: 84, raw: { esquineo:82, bunny:81, dtouch:70, rifle:71, rifleAncho:81, punteria:70, pase:77, control:74, regate:71, definicion:83, marca:78, posicionamiento:72, anticipacion:74, lectura:74, cobertura:75, presion:68, desmarque:68, vision:71, pasesLargos:73, gk:74, reflejos:74, atajadas:83, manoMano:82, saques:78, gkPos:81, salidas:82, cobArco:82, lectRem:67, seguridad:77, comunicacion:74 } },
  { alias: "Kross", country: "ARG", position: "DEF", overall: 74, potential: 74, raw: { esquineo:66, bunny:82, dtouch:75, rifle:66, rifleAncho:82, punteria:72, pase:70, control:82, regate:68, definicion:70, marca:78, posicionamiento:69, anticipacion:67, lectura:79, cobertura:82, presion:69, desmarque:66, vision:81, pasesLargos:66, gk:79, reflejos:67, atajadas:66, manoMano:73, saques:67, gkPos:80, salidas:80, cobArco:77, lectRem:75, seguridad:77, comunicacion:77 } },
  { alias: "Praiz", country: "URU", position: "MED", overall: 73, potential: 90, raw: { esquineo:77, bunny:67, dtouch:66, rifle:79, rifleAncho:78, punteria:68, pase:67, control:73, regate:72, definicion:73, marca:70, posicionamiento:81, anticipacion:79, lectura:75, cobertura:79, presion:73, desmarque:70, vision:67, pasesLargos:80, gk:67, reflejos:77, atajadas:70, manoMano:81, saques:74, gkPos:73, salidas:78, cobArco:76, lectRem:67, seguridad:69, comunicacion:66 } },
  { alias: "V'", country: "ARG", position: "DEF", overall: 69, potential: 84, raw: { esquineo:65, bunny:64, dtouch:62, rifle:70, rifleAncho:67, punteria:63, pase:75, control:66, regate:74, definicion:70, marca:64, posicionamiento:65, anticipacion:73, lectura:61, cobertura:75, presion:69, desmarque:63, vision:66, pasesLargos:67, gk:77, reflejos:72, atajadas:75, manoMano:73, saques:70, gkPos:66, salidas:69, cobArco:70, lectRem:71, seguridad:72, comunicacion:77 } },
  { alias: "Bas", country: "URU", position: "MED", overall: 63, potential: 88, raw: { esquineo:55, bunny:65, dtouch:68, rifle:68, rifleAncho:69, punteria:59, pase:66, control:58, regate:63, definicion:62, marca:71, posicionamiento:61, anticipacion:55, lectura:68, cobertura:57, presion:61, desmarque:65, vision:70, pasesLargos:69, gk:67, reflejos:57, atajadas:69, manoMano:62, saques:63, gkPos:68, salidas:65, cobArco:64, lectRem:67, seguridad:59, comunicacion:64 } },
  { alias: "Monze", country: "URU", position: "DEL", overall: 88, potential: 90, raw: { esquineo:94, bunny:91, dtouch:95, rifle:82, rifleAncho:92, punteria:91, pase:86, control:94, regate:92, definicion:86, marca:96, posicionamiento:92, anticipacion:83, lectura:84, cobertura:84, presion:83, desmarque:89, vision:82, pasesLargos:84, gk:90, reflejos:80, atajadas:89, manoMano:83, saques:92, gkPos:88, salidas:81, cobArco:80, lectRem:84, seguridad:95, comunicacion:83 } },
  { alias: "Daboss", country: "ARG", position: "POR", overall: 87, potential: 88, raw: { esquineo:86, bunny:88, dtouch:82, rifle:89, rifleAncho:83, punteria:81, pase:93, control:91, regate:90, definicion:86, marca:91, posicionamiento:94, anticipacion:86, lectura:84, cobertura:83, presion:81, desmarque:95, vision:84, pasesLargos:80, gk:88, reflejos:86, atajadas:89, manoMano:85, saques:94, gkPos:79, salidas:88, cobArco:83, lectRem:85, seguridad:85, comunicacion:86 } },
  { alias: "Tincho", country: "ARG", position: "DEF", overall: 86, potential: 87, raw: { esquineo:82, bunny:94, dtouch:89, rifle:91, rifleAncho:92, punteria:83, pase:85, control:80, regate:79, definicion:90, marca:94, posicionamiento:91, anticipacion:80, lectura:78, cobertura:79, presion:83, desmarque:86, vision:80, pasesLargos:92, gk:78, reflejos:89, atajadas:93, manoMano:86, saques:93, gkPos:88, salidas:87, cobArco:83, lectRem:90, seguridad:84, comunicacion:81 } },
  { alias: "Bear", country: "ARG", position: "DEL", overall: 86, potential: 87, raw: { esquineo:90, bunny:93, dtouch:82, rifle:79, rifleAncho:82, punteria:87, pase:84, control:94, regate:87, definicion:86, marca:94, posicionamiento:87, anticipacion:91, lectura:80, cobertura:86, presion:88, desmarque:94, vision:92, pasesLargos:81, gk:84, reflejos:87, atajadas:85, manoMano:84, saques:92, gkPos:93, salidas:94, cobArco:81, lectRem:82, seguridad:94, comunicacion:88 } },
  { alias: "Axel", country: "URU", position: "DEF", overall: 71, potential: 82, raw: { esquineo:72, bunny:71, dtouch:68, rifle:73, rifleAncho:75, punteria:79, pase:78, control:79, regate:74, definicion:76, marca:65, posicionamiento:76, anticipacion:71, lectura:68, cobertura:78, presion:65, desmarque:72, vision:64, pasesLargos:79, gk:74, reflejos:66, atajadas:74, manoMano:74, saques:75, gkPos:67, salidas:63, cobArco:69, lectRem:73, seguridad:68, comunicacion:65 } },
  { alias: "Lucho", country: "ARG", position: "POR", overall: 72, potential: 79, raw: { esquineo:73, bunny:76, dtouch:79, rifle:80, rifleAncho:73, punteria:80, pase:64, control:74, regate:74, definicion:67, marca:77, posicionamiento:71, anticipacion:67, lectura:70, cobertura:67, presion:77, desmarque:78, vision:67, pasesLargos:68, gk:71, reflejos:77, atajadas:73, manoMano:77, saques:80, gkPos:66, salidas:78, cobArco:76, lectRem:78, seguridad:77, comunicacion:73 } },
  { alias: "Bruno", country: "URU", position: "DEF", overall: 70, potential: 84, raw: { esquineo:73, bunny:73, dtouch:74, rifle:78, rifleAncho:70, punteria:73, pase:77, control:71, regate:77, definicion:71, marca:64, posicionamiento:66, anticipacion:66, lectura:75, cobertura:62, presion:64, desmarque:77, vision:62, pasesLargos:73, gk:74, reflejos:71, atajadas:69, manoMano:68, saques:64, gkPos:78, salidas:64, cobArco:63, lectRem:62, seguridad:65, comunicacion:65 } },
  { alias: "Enzo", country: "ARG", position: "MED", overall: 73, potential: 86, raw: { esquineo:67, bunny:75, dtouch:70, rifle:66, rifleAncho:72, punteria:71, pase:76, control:77, regate:67, definicion:67, marca:67, posicionamiento:74, anticipacion:81, lectura:67, cobertura:81, presion:74, desmarque:68, vision:75, pasesLargos:71, gk:74, reflejos:72, atajadas:74, manoMano:68, saques:76, gkPos:78, salidas:76, cobArco:75, lectRem:74, seguridad:66, comunicacion:67 } },
  { alias: "Mauro", country: "ARG", position: "DEL", overall: 68, potential: 81, raw: { esquineo:61, bunny:62, dtouch:65, rifle:76, rifleAncho:73, punteria:67, pase:67, control:68, regate:72, definicion:73, marca:63, posicionamiento:70, anticipacion:66, lectura:62, cobertura:73, presion:63, desmarque:65, vision:68, pasesLargos:75, gk:68, reflejos:70, atajadas:70, manoMano:65, saques:68, gkPos:76, salidas:64, cobArco:60, lectRem:62, seguridad:64, comunicacion:68 } },
  { alias: "Tomi", country: "URU", position: "DEF", overall: 74, potential: 85, raw: { esquineo:71, bunny:80, dtouch:66, rifle:69, rifleAncho:69, punteria:66, pase:76, control:79, regate:79, definicion:72, marca:70, posicionamiento:76, anticipacion:78, lectura:79, cobertura:67, presion:77, desmarque:81, vision:77, pasesLargos:74, gk:70, reflejos:70, atajadas:81, manoMano:77, saques:70, gkPos:67, salidas:77, cobArco:66, lectRem:76, seguridad:80, comunicacion:81 } },
];

// Convierte el perfil detallado (tiro, pase, control, lectura, arquero, etc)
// a nuestras 6 stats de siempre, promediando los atributos más parecidos.
function statsFromDetailed(position, raw) {
  const clamp = (n) => Math.max(20, Math.min(99, Math.round(n)));
  const avg = (...vals) => vals.reduce((a, b) => a + b, 0) / vals.length;

  const velocidad = clamp(avg(raw.bunny, raw.dtouch, raw.esquineo));
  const tiro = clamp(avg(raw.rifle, raw.rifleAncho, raw.punteria, raw.definicion));
  const pase = clamp(avg(raw.pase, raw.pasesLargos, raw.vision));
  const regate = clamp(avg(raw.control, raw.regate, raw.desmarque));
  const defensa = clamp(avg(raw.marca, raw.cobertura, raw.presion, raw.anticipacion, raw.lectura));
  const portero =
    position === "POR"
      ? clamp(avg(raw.gk, raw.reflejos, raw.atajadas, raw.manoMano, raw.saques, raw.gkPos, raw.salidas, raw.cobArco, raw.lectRem, raw.seguridad, raw.comunicacion))
      : Math.max(10, Math.min(25, Math.round(raw.gk * 0.2)));

  return { velocidad, tiro, pase, regate, defensa, portero };
}

// ----------------------------------------------------------------------------
// IMPORTANTE: estos builders generan el CATÁLOGO MAESTRO. No llevan ownerId
// ni ownerClub — el maestro es un catálogo puro, sin estado de partida.
// Esos campos (y todos los de carrera: edad, goles, moral, etc.) se agregan
// recién al copiar el pool dentro de una partida (ver market.copyMasterPlayersToSave).
// ----------------------------------------------------------------------------
function buildDetailedPlayer(def, n) {
  const rarity = deriveRarity(def.overall);
  return {
    id: `det-${String(n).padStart(2, "0")}`,
    alias: def.alias,
    country: def.country,
    position: def.position,
    rarity,
    stats: statsFromDetailed(def.position, def.raw),
    overall: def.overall,
    potential: def.potential,
    price: computePrice(def.overall, rarity),
  };
}

function buildCommunityPlayer(def, n) {
  const level = def.overall / 99;
  const stats = statsFor(def.position, level);
  if (def.boost) {
    for (const key of Object.keys(def.boost)) {
      stats[key] = Math.max(20, Math.min(99, stats[key] + def.boost[key]));
    }
  }
  const rarity = deriveRarity(def.overall);
  return {
    id: `com-${String(n).padStart(2, "0")}`,
    alias: def.alias,
    country: def.country,
    position: def.position,
    rarity,
    stats,
    overall: def.overall,
    potential: def.potential,
    price: computePrice(def.overall, rarity),
  };
}

// Genera el catálogo maestro completo (sin estado de partida ni dueños).
export function generatePlayerPool() {
  const players = [];
  let n = 1;

  for (const def of COMMUNITY_PLAYERS) {
    players.push(buildCommunityPlayer(def, n));
    n++;
  }

  for (const def of DETAILED_PLAYERS) {
    players.push(buildDetailedPlayer(def, n));
    n++;
  }

  return players;
}

// ----------------------------------------------------------------------------
// Genera equipos CPU para la liga local. La "fuerza" depende del plantel
// que le tocó dentro de la partida (ver league.js), esta función solo da
// el nombre — se mantiene por compatibilidad con el resto del código.
// ----------------------------------------------------------------------------
export const CPU_TEAM_NAMES = [
  "Turbo FC",
  "Los Rebotes",
  "Cannon Kickers",
  "Rush United",
  "Disco Rojo CF",
];

export function generateCpuTeam(name, seedIndex) {
  const strength = 45 + ((seedIndex * 13) % 40); // 45-84 aprox, variado
  return { name, strength, isCpu: true };
}
