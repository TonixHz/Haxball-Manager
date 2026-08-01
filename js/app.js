// ============================================================================
// App — controlador principal
// ============================================================================

import { auth, onAuthStateChanged } from "./firebase-config.js";
import { signInWithGoogle, logoutClub, getClubDoc, createClub, translateAuthError, buildEmptyLineup } from "./auth.js";
import { ensurePlayersSeeded, fetchFreeAgents, fetchRoster, buyPlayer, sellPlayer, formatMoney } from "./market.js";
import { FORMATIONS, DEFAULT_FORMATION, getFormationSlots, assignSlot, clearSlot, saveLineup, saveFormation, computeTeamStrength, rosterToMap } from "./team.js";
import { createLeague, getLeague, computeStandings, getNextMatchday, simulateCurrentMatchday, YOU_ID } from "./league.js";
import { RARITY_COLORS } from "./players-seed.js";

// ----------------------------------------------------------------------------
// Estado global de la app (en memoria, se recarga de Firestore al loguearse)
// ----------------------------------------------------------------------------
const state = {
  user: null,
  club: null,       // { club, budget, lineup }
  roster: [],        // jugadores del usuario
  rosterMap: {},      // id -> jugador
  freeAgents: [],
  league: null,
  selectedSlot: null,
  activeTab: "dashboard",
};

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// AUTH
// ============================================================================

function showAuthError(msg) {
  const el = $("auth-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hideAuthError() {
  $("auth-error").classList.add("hidden");
}

$("google-signin-btn").addEventListener("click", async () => {
  hideAuthError();
  const btn = $("google-signin-btn");
  btn.disabled = true;
  try {
    await signInWithGoogle();
    // el resto del flujo lo maneja onAuthStateChanged
  } catch (err) {
    showAuthError(translateAuthError(err.code));
  } finally {
    btn.disabled = false;
  }
});

$("setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const clubName = $("setup-club").value.trim();
  if (!clubName) return;

  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    state.club = await createClub(state.user.uid, state.user.email, clubName);
    $("setup-screen").classList.add("hidden");
    $("main-screen").classList.remove("hidden");
    await finishBootstrap();
  } catch (err) {
    showAuthError(translateAuthError(err.code));
    submitBtn.disabled = false;
  }
});

$("logout-btn").addEventListener("click", () => logoutClub());

onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.user = user;
    const existingClub = await getClubDoc(user.uid);

    if (!existingClub) {
      // Primera vez que este usuario entra: le pedimos nombre de club
      $("auth-screen").classList.add("hidden");
      $("setup-screen").classList.remove("hidden");
      $("setup-club").value = "";
      return;
    }

    state.club = existingClub;
    $("auth-screen").classList.add("hidden");
    $("setup-screen").classList.add("hidden");
    $("main-screen").classList.remove("hidden");
    await finishBootstrap();
  } else {
    state.user = null;
    state.club = null;
    $("main-screen").classList.add("hidden");
    $("setup-screen").classList.add("hidden");
    $("auth-screen").classList.remove("hidden");
  }
});

async function finishBootstrap() {
  await ensurePlayersSeeded();
  if (!state.club.formation) state.club.formation = DEFAULT_FORMATION; // clubes viejos sin formación guardada
  state.roster = await fetchRoster(state.user.uid);
  state.rosterMap = rosterToMap(state.roster);
  state.league = await getLeague(state.user.uid);

  $("club-name-display").textContent = state.club.club;
  $("budget-display").textContent = formatMoney(state.club.budget);

  renderActiveTab();
}

// ============================================================================
// TABS
// ============================================================================

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    state.activeTab = btn.dataset.tab;
    $(`view-${state.activeTab}`).classList.remove("hidden");
    renderActiveTab();
  });
});

function renderActiveTab() {
  if (state.activeTab === "dashboard") renderDashboard();
  if (state.activeTab === "squad") renderSquad();
  if (state.activeTab === "market") loadAndRenderMarket();
  if (state.activeTab === "league") renderLeagueView();
}

// ============================================================================
// DASHBOARD
// ============================================================================

function renderDashboard() {
  const starters = Object.values(state.club.lineup).filter(Boolean).length;
  let posText = "Todavía no armaste tu liga";
  if (state.league) {
    const standings = computeStandings(state.league);
    const pos = standings.findIndex((t) => t.id === YOU_ID) + 1;
    posText = `${pos}º de ${standings.length} — ${standings[pos - 1].pts} pts`;
  }

  $("dashboard-cards").innerHTML = `
    <div class="card">
      <div class="section-sub" style="margin-bottom:6px;">Presupuesto</div>
      <div class="mono" style="font-size:26px; color:var(--gold);">${formatMoney(state.club.budget)}</div>
    </div>
    <div class="card">
      <div class="section-sub" style="margin-bottom:6px;">Plantilla</div>
      <div style="font-size:26px; font-family:var(--font-display);">${state.roster.length} jugadores</div>
      <div class="section-sub" style="margin-top:4px;">${starters}/5 titulares definidos</div>
    </div>
    <div class="card">
      <div class="section-sub" style="margin-bottom:6px;">Liga local</div>
      <div style="font-size:20px; font-family:var(--font-display);">${posText}</div>
    </div>
  `;
}

// ============================================================================
// SQUAD (formación + banco)
// ============================================================================

function discInitials(alias) {
  return alias.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function renderFormationBar() {
  const bar = $("formation-bar");
  if (!bar) return;
  bar.innerHTML = `
    <label for="formation-select" style="font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-dim); margin-right:8px;">Formación</label>
    <select id="formation-select">
      ${Object.keys(FORMATIONS)
        .map((key) => `<option value="${key}" ${state.club.formation === key ? "selected" : ""}>${FORMATIONS[key].label}</option>`)
        .join("")}
    </select>
  `;
  $("formation-select").addEventListener("change", onFormationChange);
}

async function onFormationChange(e) {
  const newFormation = e.target.value;
  if (newFormation === state.club.formation) return;
  if (!confirm("Cambiar de formación vacía tu alineación actual (los jugadores vuelven al banco). ¿Seguir?")) {
    e.target.value = state.club.formation;
    return;
  }
  state.club.formation = newFormation;
  state.club.lineup = buildEmptyLineup(newFormation);
  state.selectedSlot = null;
  await saveFormation(state.user.uid, newFormation, state.club.lineup);
  renderSquad();
}

function renderSquad() {
  renderFormationBar();

  const board = $("formation-board");
  const slots = getFormationSlots(state.club.formation);
  // Filas de arriba (ataque) hacia abajo (arquero), agrupando por posición.
  const rowOrder = ["DEL", "MED", "DEF", "POR"];
  const rows = rowOrder
    .map((pos) => slots.filter((s) => s.pos === pos).map((s) => s.key))
    .filter((row) => row.length > 0);

  board.innerHTML = rows
    .map(
      (row) => `
    <div class="formation-row">
      ${row
        .map((key) => {
          const slot = slots.find((s) => s.key === key);
          const pid = state.club.lineup[key];
          const player = pid ? state.rosterMap[pid] : null;
          const selected = state.selectedSlot === key;
          return `
          <div class="slot" data-slot="${key}" style="${selected ? "outline:2px solid var(--blue); border-radius:10px;" : ""}">
            <div class="disc-avatar ${player ? "" : "empty"}" style="--rarity-color:${player ? RARITY_COLORS[player.rarity] : "transparent"}">
              ${player ? discInitials(player.alias) : "+"}
            </div>
            <div class="slot-name">${player ? player.alias : "Vacío"}</div>
            <div class="slot-pos">${slot.label}</div>
          </div>`;
        })
        .join("")}
    </div>`
    )
    .join("");

  board.querySelectorAll(".slot").forEach((el) => {
    el.addEventListener("click", () => onSlotClick(el.dataset.slot));
  });

  renderBench();
}

async function onSlotClick(slotKey) {
  const currentPid = state.club.lineup[slotKey];

  if (currentPid) {
    // Sacar al jugador de este puesto (vuelve al banco)
    state.club.lineup = clearSlot(state.club.lineup, slotKey);
    state.selectedSlot = null;
    await saveLineup(state.user.uid, state.club.lineup);
    renderSquad();
    return;
  }

  if (state.selectedSlot === slotKey) {
    state.selectedSlot = null;
  } else {
    state.selectedSlot = slotKey;
  }
  renderSquad();
}

function renderBench() {
  const assignedIds = new Set(Object.values(state.club.lineup).filter(Boolean));
  const bench = state.roster.filter((p) => !assignedIds.has(p.id));

  if (bench.length === 0) {
    $("bench-list").innerHTML = `<p class="section-sub">No tenés suplentes. Fichá jugadores en el Mercado.</p>`;
    return;
  }

  $("bench-list").innerHTML = bench
    .map(
      (p) => `
    <div class="bench-chip" data-id="${p.id}">
      <div class="disc-avatar" style="--rarity-color:${RARITY_COLORS[p.rarity]}; width:26px;height:26px;font-size:11px;">${discInitials(p.alias)}</div>
      <span>${p.alias} <span class="mono" style="color:var(--text-dim);">${p.overall}</span></span>
      <button class="btn-sell" data-sell="${p.id}" title="Vender">✕</button>
    </div>`
    )
    .join("");

  $("bench-list").querySelectorAll(".bench-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      if (e.target.closest("[data-sell]")) return;
      onBenchPick(chip.dataset.id);
    });
  });
  $("bench-list").querySelectorAll("[data-sell]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSell(btn.dataset.sell);
    });
  });
}

async function onSell(playerId) {
  const player = state.rosterMap[playerId];
  const refundEstimate = Math.round((player.price * 0.65) / 500) * 500;
  if (!confirm(`¿Vender a ${player.alias} por ${formatMoney(refundEstimate)}?`)) return;

  try {
    const { newBudget } = await sellPlayer(state.user.uid, playerId);
    state.club.budget = newBudget;
    $("budget-display").textContent = formatMoney(newBudget);

    state.roster = await fetchRoster(state.user.uid);
    state.rosterMap = rosterToMap(state.roster);
    marketLoaded = false; // el jugador vendido vuelve a estar disponible en el mercado

    renderSquad();
    renderDashboard();
    showToast(`${player.alias} vendido.`);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function onBenchPick(playerId) {
  if (!state.selectedSlot) {
    showToast("Primero tocá un puesto vacío en la cancha.", true);
    return;
  }
  const slot = getFormationSlots(state.club.formation).find((s) => s.key === state.selectedSlot);
  const player = state.rosterMap[playerId];

  if (player.position !== slot.pos) {
    showToast(`${player.alias} juega de ${player.position}, no puede ir de ${slot.pos}.`, true);
    return;
  }

  state.club.lineup = assignSlot(state.club.lineup, state.selectedSlot, playerId);
  state.selectedSlot = null;
  await saveLineup(state.user.uid, state.club.lineup);
  renderSquad();
}

// ============================================================================
// MARKET
// ============================================================================

let marketLoaded = false;

async function loadAndRenderMarket() {
  if (!marketLoaded) {
    state.freeAgents = await fetchFreeAgents();
    marketLoaded = true;
  }
  renderMarket();
}

["filter-position", "filter-rarity", "filter-search"].forEach((id) => {
  $(id).addEventListener("input", renderMarket);
});

function renderMarket() {
  const pos = $("filter-position").value;
  const rarity = $("filter-rarity").value;
  const search = $("filter-search").value.trim().toLowerCase();

  const filtered = state.freeAgents
    .filter((p) => !pos || p.position === pos)
    .filter((p) => !rarity || p.rarity === rarity)
    .filter((p) => !search || p.alias.toLowerCase().includes(search))
    .sort((a, b) => b.overall - a.overall);

  if (filtered.length === 0) {
    $("market-grid").innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>No hay jugadores</h3><p>Probá cambiar los filtros.</p></div>`;
    return;
  }

  $("market-grid").innerHTML = filtered.map((p) => playerCardHTML(p, { buyable: true })).join("");

  $("market-grid").querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => onBuy(btn.dataset.buy));
  });
}

function playerCardHTML(p, { buyable }) {
  const color = RARITY_COLORS[p.rarity];
  const s = p.stats;
  return `
  <div class="player-card" style="--rarity-color:${color}">
    <div class="player-top">
      <div class="disc-avatar" style="--rarity-color:${color}">${discInitials(p.alias)}</div>
      <div class="player-name-block">
        <div class="player-alias">${p.alias}</div>
        <div class="player-meta">${p.position} · <span class="rarity-tag" style="--rarity-color:${color}">${p.rarity}</span></div>
      </div>
      <div class="overall-badge" style="margin-left:auto;">${p.overall}</div>
    </div>
    <div class="stat-bars">
      ${statRow("VEL", s.velocidad)}
      ${statRow("TIR", s.tiro)}
      ${statRow("PAS", s.pase)}
      ${statRow("REG", s.regate)}
      ${statRow("DEF", s.defensa)}
      ${statRow("POR", s.portero)}
    </div>
    <div class="player-footer">
      <span class="player-price">${formatMoney(p.price)}</span>
      ${buyable ? `<button class="btn btn-sm btn-primary" data-buy="${p.id}">Fichar</button>` : ""}
    </div>
  </div>`;
}

function statRow(label, val) {
  return `
  <div class="stat-row">
    <span class="stat-label">${label}</span>
    <span class="stat-track"><span class="stat-fill" style="width:${val}%"></span></span>
    <span class="stat-val">${val}</span>
  </div>`;
}

async function onBuy(playerId) {
  try {
    const { newBudget } = await buyPlayer(state.user.uid, state.club.club, playerId);
    state.club.budget = newBudget;
    $("budget-display").textContent = formatMoney(newBudget);

    state.freeAgents = state.freeAgents.filter((p) => p.id !== playerId);
    state.roster = await fetchRoster(state.user.uid);
    state.rosterMap = rosterToMap(state.roster);

    renderMarket();
    showToast("¡Fichaje confirmado!");
  } catch (err) {
    showToast(err.message, true);
  }
}

// ============================================================================
// LEAGUE
// ============================================================================

function renderLeagueView() {
  if (!state.league) {
    $("league-setup").classList.remove("hidden");
    $("league-active").classList.add("hidden");
    return;
  }
  $("league-setup").classList.add("hidden");
  $("league-active").classList.remove("hidden");
  renderStandings();
  renderNextFixtures();
}

$("create-league-btn").addEventListener("click", async () => {
  state.league = await createLeague(state.user.uid, state.club.club);
  renderLeagueView();
  renderDashboard();
});

function teamLabel(league, id) {
  const isYou = id === YOU_ID;
  return `<span class="${isYou ? "" : ""}" style="${isYou ? "color:var(--pitch); font-weight:700;" : ""}">${league.teams[id].name}</span>`;
}

function renderStandings() {
  const standings = computeStandings(state.league);
  const rows = standings
    .map(
      (t, i) => `
    <tr class="${t.id === YOU_ID ? "you" : ""}">
      <td>${i + 1}. ${t.name}</td>
      <td>${t.pj}</td>
      <td>${t.g}</td>
      <td>${t.e}</td>
      <td>${t.p}</td>
      <td>${t.gf}</td>
      <td>${t.gc}</td>
      <td class="pts">${t.pts}</td>
    </tr>`
    )
    .join("");

  $("league-table").innerHTML = `
    <thead><tr><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Pts</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

// Arma la lista de titulares (puesto + nombre + overall) de un equipo, ya
// sea el tuyo (según tu alineación actual) o un CPU (según la alineación
// que se le armó automáticamente al crear la liga).
function teamLineupList(teamId) {
  if (teamId === YOU_ID) {
    return getFormationSlots(state.club.formation)
      .map((slot) => {
        const pid = state.club.lineup[slot.key];
        const player = pid ? state.rosterMap[pid] : null;
        return { slotLabel: slot.label, alias: player ? player.alias : "Vacío", overall: player ? player.overall : null };
      });
  }
  const team = state.league.teams[teamId];
  return (team.lineupPreview || []).map((p) => ({
    slotLabel: p.slotLabel,
    alias: p.alias,
    overall: p.overall,
  }));
}

function teamFormationLabel(teamId) {
  if (teamId === YOU_ID) return FORMATIONS[state.club.formation]?.label || state.club.formation;
  const team = state.league.teams[teamId];
  return team.formation ? FORMATIONS[team.formation]?.label || team.formation : "—";
}

function rivalLineupHTML(homeId, awayId) {
  const side = (teamId) => `
    <div class="rival-lineup-team">
      <div class="rival-lineup-title">${state.league.teams[teamId].name} (${teamFormationLabel(teamId)})</div>
      ${teamLineupList(teamId)
        .map(
          (p) => `<div class="rival-lineup-row"><span class="pos">${p.slotLabel}</span><span>${p.alias}</span><span class="ovr">${p.overall ?? "-"}</span></div>`
        )
        .join("")}
    </div>`;
  return `<div class="rival-lineup hidden">${side(homeId)}${side(awayId)}</div>`;
}

function renderNextFixtures() {
  const round = getNextMatchday(state.league);
  const container = $("next-fixtures");
  const simBtn = $("simulate-matchday-btn");

  if (!round) {
    container.innerHTML = `<p class="section-sub">La liga terminó. ¡Gracias por jugar!</p>`;
    simBtn.disabled = true;
    simBtn.textContent = "Liga finalizada";
    return;
  }

  simBtn.disabled = false;
  simBtn.textContent = `Simular jornada ${state.league.currentMatchday + 1} de ${state.league.totalMatchdays}`;

  container.innerHTML = round
    .map(
      (m, i) => `
    <div>
      <div class="fixture-row">
        <div class="fixture-teams">${teamLabel(state.league, m.home)} vs ${teamLabel(state.league, m.away)}</div>
        <button class="lineup-toggle-btn" data-lineup-toggle="${i}">Ver alineaciones</button>
      </div>
      ${rivalLineupHTML(m.home, m.away)}
    </div>`
    )
    .join("");

  container.querySelectorAll("[data-lineup-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest("div").nextElementSibling;
      panel.classList.toggle("hidden");
      btn.textContent = panel.classList.contains("hidden") ? "Ver alineaciones" : "Ocultar alineaciones";
    });
  });
}

$("simulate-matchday-btn").addEventListener("click", async () => {
  const btn = $("simulate-matchday-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>`;

  try {
    const yourStrength = computeTeamStrength(state.club.lineup, state.rosterMap);
    const { league, round, yourMatch } = await simulateCurrentMatchday(
      state.user.uid,
      state.league,
      yourStrength
    );
    state.league = league;

    renderStandings();
    renderMatchdayResults(round);
    renderDashboard();

    if (yourMatch) {
      $("match-result-card").hidden = false;
      await playMatchAnimation(yourMatch);
    } else {
      $("match-result-card").hidden = true;
    }

    renderNextFixtures();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = getNextMatchday(state.league) === null;
  }
});

function renderMatchdayResults(round) {
  $("matchday-results").innerHTML = round
    .map(
      (m) => `
    <div class="fixture-row">
      <div class="fixture-teams">${teamLabel(state.league, m.home)} vs ${teamLabel(state.league, m.away)}</div>
      <div class="fixture-score">${m.homeGoals} - ${m.awayGoals}</div>
    </div>`
    )
    .join("");
}

async function playMatchAnimation(match) {
  $("score-home").textContent = match.homeName;
  $("score-away").textContent = match.awayName;
  $("score-home").classList.toggle("you", match.youAreHome);
  $("score-away").classList.toggle("you", !match.youAreHome);
  $("score-numbers").textContent = "0 - 0";
  $("score-clock").textContent = "MIN 0'";
  $("match-feed").innerHTML = "";

  let h = 0, a = 0;
  for (const ev of match.timeline) {
    await sleep(260);
    $("score-clock").textContent = `MIN ${ev.minute}'`;
    if (ev.type === "goal") {
      if (ev.team === "home") h++; else a++;
      $("score-numbers").textContent = `${h} - ${a}`;
    }
    const line = document.createElement("div");
    line.className = "feed-line" + (ev.type === "goal" ? " goal" : "");
    line.innerHTML = `<span class="min">${ev.minute}'</span><span>${ev.text}</span>`;
    $("match-feed").prepend(line);
  }
  await sleep(200);
  $("score-clock").textContent = `FINAL — ${h} - ${a}`;
}

// ============================================================================
// TOAST
// ============================================================================

function showToast(msg, isError = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = msg;
  $("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
