# Haxball Manager

Un "manager" de fútbol tipo Football Manager / WSC, pero fichando jugadores
de la comunidad de Haxball en vez de futbolistas reales. Armás tu plantilla,
elegís tu once titular, fichás jugadores en el mercado con un presupuesto
limitado, y competís en una liga local contra 5 equipos de la CPU.

Es un proyecto 100% estático (HTML + CSS + JS con módulos ES, sin build
tools) que usa **Firebase Auth** (cuentas de usuario) y **Firestore**
(persistencia: tu club, tu plantilla, el mercado y la liga).

## 1. Configurar Firebase (importante, sin esto no anda)

Tu proyecto de Firebase (`haxball-manager`) ya está creado y la config ya
está en `js/firebase-config.js`. Te falta activar dos cosas desde la
[consola de Firebase](https://console.firebase.google.com/):

### a) Activar el método de login por email/contraseña
`Authentication → Sign-in method → Email/Password → Habilitar`

### b) Crear la base de Firestore (si todavía no existe)
`Firestore Database → Crear base de datos → modo producción → elegí una región`

### c) Pegar las reglas de seguridad
`Firestore Database → Reglas`, reemplazá todo por esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Cada club solo lo puede leer/editar su dueño
    match /clubs/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // El mercado de jugadores es compartido: cualquier usuario logueado
    // puede fichar/vender (así funciona el mercado en tiempo real).
    // Nota: para producción real esto conviene moverlo a una Cloud
    // Function que valide la transacción del lado del servidor.
    match /players/{playerId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Cada liga es privada del usuario que la creó
    match /leagues/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Doc de control para no re-sembrar la colección de jugadores
    match /meta/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
  }
}
```

## 2. Correrlo localmente

Como usa `<script type="module">` e imports, necesitás servirlo con un
servidor local (no sirve abrir el `index.html` con doble click). Por ejemplo:

```bash
npx serve .
# o
python3 -m http.server 8000
```

Y después abrís `http://localhost:8000` (o el puerto que te indique).

## 3. Cómo funciona

- **Registro**: al crear un club se te asigna un presupuesto inicial de
  `H$ 200.000` (`STARTING_BUDGET` en `js/auth.js`).
- **Mercado**: la primera vez que alguien entra a la app se siembra
  automáticamente la colección `players` en Firestore con ~30 jugadores de
  ejemplo (ver punto 4). Cuando fichás a uno, deja de estar disponible para
  el resto — es un mercado compartido de verdad.
- **Plantilla**: formación fija 1-2-2-1 (POR-DEF-DEF-MED-MED-DEL). Tocás un
  puesto vacío, después tocás un jugador del banco para asignarlo.
- **Liga**: se genera un calendario ida y vuelta contra 5 equipos CPU. Cada
  "Simular jornada" resuelve todos los partidos de la fecha; tu partido se
  anima jugada a jugada en el marcador.

## 4. Personalizar los jugadores (lo más importante para vos)

Todos los datos de ejemplo están en `js/players-seed.js`, con nombres
placeholder tipo "Jugador 01". Para reemplazarlos por nicks reales de la
comunidad, lo más simple es cambiar la función `generatePlayerPool()` por un
array fijo, por ejemplo:

```js
export function generatePlayerPool() {
  return [
    {
      id: "p001",
      alias: "NickDeEjemplo",
      position: "DEL",       // POR | DEF | MED | DEL
      rarity: "leyenda",     // bronce | plata | oro | leyenda
      stats: { velocidad: 88, tiro: 91, pase: 70, regate: 85, defensa: 30, portero: 10 },
      overall: 0,             // se recalcula abajo
      price: 0,                // se recalcula abajo
      ownerId: null,
      ownerClub: null,
    },
    // ... el resto de tus jugadores
  ].map((p) => {
    p.overall = computeOverall(p.stats, p.position);
    p.price = computePrice(p.overall, p.rarity);
    return p;
  });
}
```

**Importante:** la colección `players` en Firestore solo se siembra *una
vez* (hay un doc de control en `meta/players_seed`). Si ya jugaste y después
cambiás `players-seed.js`, para que los cambios se reflejen tenés que borrar
manualmente desde la consola de Firestore la colección `players` y el
documento `meta/players_seed`.

## 5. Estructura del proyecto

```
index.html          → estructura de toda la app (auth + 4 pantallas)
style.css            → sistema de diseño (estética estadio nocturno / LED)
js/
  firebase-config.js → init de Firebase, re-exporta todo lo del SDK
  auth.js             → registro / login / logout
  players-seed.js     → datos de jugadores + cálculo de overall/precio
  market.js            → sembrado, listar/fichar/vender jugadores
  team.js               → alineación y fuerza del equipo
  simulation.js          → motor de simulación de partidos
  league.js               → calendario, tabla de posiciones, jornadas
  app.js                   → controlador principal (UI + eventos)
```

## 6. Ideas para seguir (no implementadas todavía)

- Ligas entre usuarios reales en vez de vs. CPU (usando los `clubs` de otros
  usuarios como rivales).
- Historial de partidos jugados y estadísticas por jugador.
- Avatares reales en vez de discos con iniciales (podrías subir imágenes a
  Firebase Storage).
- Mercado con pujas entre usuarios en vez de precio fijo.
- Renovación semanal de agentes libres en el mercado.
# Haxball-Manager
