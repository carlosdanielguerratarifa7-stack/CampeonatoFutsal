const ADMIN_USER = "admin";
const ADMIN_PASS = "pitagoras2026";
const DATA_KEY = "futsal_pitagoras_data_v2";
const SESSION_KEY = "futsal_pitagoras_logged";

const clone = (value) => JSON.parse(JSON.stringify(value));
const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function normalizeSeed(seed) {
  const data = clone(seed || {});
  data.meta = data.meta || {};
  data.teams = Array.isArray(data.teams) ? data.teams : [];
  data.players = Array.isArray(data.players) ? data.players : [];
  data.matches = Array.isArray(data.matches) ? data.matches : [];
  data.events = Array.isArray(data.events) ? data.events : [];
  return data;
}

let state = loadData();
let logged = sessionStorage.getItem(SESSION_KEY) === "true";

function loadData() {
  const stored = localStorage.getItem(DATA_KEY);
  if (stored) {
    try {
      return normalizeSeed(JSON.parse(stored));
    } catch (error) {
      console.warn("No se pudo cargar localStorage. Se usará datos.js", error);
    }
  }
  return normalizeSeed(window.FUTSAL_DATA);
}

function saveData() {
  state.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(DATA_KEY, JSON.stringify(state));
  renderAll();
}
 try {
    const { doc, setDoc } = window.firebaseTools;
    const ref = doc(window.firebaseDB, "campeonato", "principal");

    await setDoc(ref, state);
    console.log("Datos guardados en Firebase");
  } catch (error) {
    console.error("Error al guardar en Firebase:", error);
    alert("No se pudieron guardar los datos en Firebase.");
  }
}

function teamById(id) {
  return state.teams.find((team) => team.id === id);
}

function playerById(id) {
  return state.players.find((player) => player.id === id);
}

function matchById(id) {
  return state.matches.find((match) => match.id === id);
}

function teamName(id) {
  return teamById(id)?.name || "Equipo eliminado";
}

function playerName(id) {
  return playerById(id)?.fullName || "Jugador no registrado";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateValue, timeValue) {
  if (!dateValue) return "Fecha por definir";
  const date = new Date(`${dateValue}T${timeValue || "00:00"}`);
  if (Number.isNaN(date.getTime())) return `${dateValue} ${timeValue || ""}`.trim();
  return date.toLocaleString("es-BO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: timeValue ? "2-digit" : undefined,
    minute: timeValue ? "2-digit" : undefined
  });
}

function formatUpdated() {
  const updated = state.meta.updatedAt ? new Date(state.meta.updatedAt) : null;
  if (!updated || Number.isNaN(updated.getTime())) return "Actualizado recientemente";
  return `Actualizado: ${updated.toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" })}`;
}

function statusLabel(status) {
  const labels = {
    programado: "Programado",
    en_juego: "En juego",
    finalizado: "Finalizado"
  };
  return labels[status] || "Programado";
}

function matchWinnerText(match) {
  const a = Number(match.goalsA || 0);
  const b = Number(match.goalsB || 0);
  const nameA = teamName(match.teamA);
  const nameB = teamName(match.teamB);

  if (match.status === "programado") return "El partido aún no inició.";
  if (a === b) return match.status === "finalizado" ? "El partido terminó empatado." : "El partido está empatado por el momento.";
  const winner = a > b ? nameA : nameB;
  const loser = a > b ? nameB : nameA;
  return match.status === "finalizado" ? `${winner} ganó. ${loser} perdió.` : `${winner} va ganando. ${loser} va perdiendo.`;
}

function completedMatches() {
  return state.matches.filter((match) => match.status === "finalizado");
}

function computeStandings() {
  const rows = state.teams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    dg: 0,
    pts: 0
  }));

  const rowMap = new Map(rows.map((row) => [row.id, row]));

  completedMatches().forEach((match) => {
    const rowA = rowMap.get(match.teamA);
    const rowB = rowMap.get(match.teamB);
    if (!rowA || !rowB) return;
    const goalsA = Number(match.goalsA || 0);
    const goalsB = Number(match.goalsB || 0);

    rowA.pj += 1;
    rowB.pj += 1;
    rowA.gf += goalsA;
    rowA.gc += goalsB;
    rowB.gf += goalsB;
    rowB.gc += goalsA;

    if (goalsA > goalsB) {
      rowA.pg += 1;
      rowB.pp += 1;
      rowA.pts += 3;
    } else if (goalsA < goalsB) {
      rowB.pg += 1;
      rowA.pp += 1;
      rowB.pts += 3;
    } else {
      rowA.pe += 1;
      rowB.pe += 1;
      rowA.pts += 1;
      rowB.pts += 1;
    }
  });

  rows.forEach((row) => {
    row.dg = row.gf - row.gc;
  });

  return rows.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name));
}

function computeEventStats(type) {
  const map = new Map();
  state.events
    .filter((event) => event.type === type)
    .forEach((event) => {
      const player = playerById(event.playerId);
      const key = event.playerId || `${event.teamId}-${event.playerName || "sin-nombre"}`;
      const current = map.get(key) || {
        playerId: event.playerId,
        player: player?.fullName || event.playerName || "Jugador no registrado",
        teamId: event.teamId || player?.teamId,
        team: teamName(event.teamId || player?.teamId),
        count: 0
      };
      current.count += Number(event.quantity || 1);
      map.set(key, current);
    });
  return [...map.values()].sort((a, b) => b.count - a.count || a.player.localeCompare(b.player));
}

function computeCardStats() {
  const map = new Map();
  state.events
    .filter((event) => event.type === "amarilla" || event.type === "roja")
    .forEach((event) => {
      const player = playerById(event.playerId);
      const key = event.playerId || `${event.teamId}-${event.playerName || "sin-nombre"}`;
      const current = map.get(key) || {
        player: player?.fullName || event.playerName || "Jugador no registrado",
        team: teamName(event.teamId || player?.teamId),
        yellow: 0,
        red: 0
      };
      if (event.type === "amarilla") current.yellow += 1;
      if (event.type === "roja") current.red += 1;
      map.set(key, current);
    });
  return [...map.values()].sort((a, b) => b.red - a.red || b.yellow - a.yellow || a.player.localeCompare(b.player));
}

function renderSummary() {
  const totalGoals = state.events.filter((event) => event.type === "gol").reduce((sum, event) => sum + Number(event.quantity || 1), 0);
  const yellows = state.events.filter((event) => event.type === "amarilla").length;
  const reds = state.events.filter((event) => event.type === "roja").length;
  const finished = completedMatches().length;
  qs("#summaryCards").innerHTML = `
    <article class="summary-card"><span>Equipos</span><strong>${state.teams.length}</strong></article>
    <article class="summary-card"><span>Jugadores</span><strong>${state.players.length}</strong></article>
    <article class="summary-card"><span>Partidos finalizados</span><strong>${finished}</strong></article>
    <article class="summary-card"><span>Goles / TA / TR</span><strong>${totalGoals}/${yellows}/${reds}</strong></article>
  `;
}

function renderScoreboard() {
  const target = qs("#scoreboard");
  if (!state.matches.length) {
    target.innerHTML = `<p class="empty">Todavía no hay partidos registrados.</p>`;
    return;
  }

  const matches = [...state.matches].sort((a, b) => `${b.date || ""}${b.time || ""}`.localeCompare(`${a.date || ""}${a.time || ""}`));
  target.innerHTML = matches.map((match) => `
    <article class="score-card">
      <div class="score-head">
        <div>
          <span>${escapeHtml(match.round || "Fecha")}</span><br />
          ${escapeHtml(formatDate(match.date, match.time))}
        </div>
        <strong class="status ${escapeHtml(match.status || "programado")}">${statusLabel(match.status)}</strong>
      </div>
      <div class="score-body">
        <div class="versus">
          <div class="team-score">
            <h3>${escapeHtml(teamName(match.teamA))}</h3>
            <strong>${Number(match.goalsA || 0)}</strong>
          </div>
          <div class="vs">VS</div>
          <div class="team-score">
            <h3>${escapeHtml(teamName(match.teamB))}</h3>
            <strong>${Number(match.goalsB || 0)}</strong>
          </div>
        </div>
        <p class="match-note"><strong>Estado:</strong> ${escapeHtml(matchWinnerText(match))}<br /><strong>Lugar:</strong> ${escapeHtml(match.venue || "Por definir")} · <strong>Árbitro:</strong> ${escapeHtml(match.referee || "Por definir")}</p>
      </div>
    </article>
  `).join("");
}

function renderStandings() {
  const rows = computeStandings();
  qs("#standingsBody").innerHTML = rows.length
    ? rows.map((row, index) => `
      <tr>
        <td><strong>${index + 1}</strong></td>
        <td><span class="number" style="background:${escapeHtml(row.color || "#0b3a67")}">${index + 1}</span> ${escapeHtml(row.name)}</td>
        <td>${row.pj}</td>
        <td>${row.pg}</td>
        <td>${row.pe}</td>
        <td>${row.pp}</td>
        <td>${row.gf}</td>
        <td>${row.gc}</td>
        <td>${row.dg}</td>
        <td><strong>${row.pts}</strong></td>
      </tr>
    `).join("")
    : `<tr><td colspan="10">No existen equipos registrados.</td></tr>`;
}

function renderTeams() {
  const target = qs("#teamsRoster");
  if (!state.teams.length) {
    target.innerHTML = `<p class="empty">Todavía no hay equipos registrados.</p>`;
    return;
  }

  target.innerHTML = state.teams.map((team) => {
    const players = state.players.filter((player) => player.teamId === team.id && player.active !== false);
    return `
      <article class="team-card">
        <div class="team-banner" style="background:${escapeHtml(team.color || "#0b3a67")}"></div>
        <div class="team-content">
          <h3>${escapeHtml(team.name)}</h3>
          <div class="team-meta">
            <span><strong>Curso:</strong> ${escapeHtml(team.course || "Por definir")}</span>
            <span><strong>Responsable:</strong> ${escapeHtml(team.coach || "Por definir")}</span>
            <span><strong>Jugadores:</strong> ${players.length}</span>
          </div>
          ${players.length ? `<ul class="player-list">${players.map((player) => `
            <li class="player-item">
              <span class="number" style="background:${escapeHtml(team.color || "#0b3a67")}">${escapeHtml(player.number || "-")}</span>
              <span>
                <strong>${escapeHtml(player.fullName)}</strong>
                <small>${escapeHtml(player.position || "Posición pendiente")} · ${escapeHtml(player.age || "Edad pendiente")} años · ${escapeHtml(player.course || team.course || "Curso pendiente")}</small>
              </span>
            </li>
          `).join("")}</ul>` : `<p class="empty">Sin jugadores registrados.</p>`}
        </div>
      </article>
    `;
  }).join("");
}

function renderStats() {
  const scorers = computeEventStats("gol");
  qs("#scorersBody").innerHTML = scorers.length
    ? scorers.map((row) => `<tr><td>${escapeHtml(row.player)}</td><td>${escapeHtml(row.team)}</td><td><strong>${row.count}</strong></td></tr>`).join("")
    : `<tr><td colspan="3">No hay goles registrados.</td></tr>`;

  const cards = computeCardStats();
  qs("#cardsBody").innerHTML = cards.length
    ? cards.map((row) => `<tr><td>${escapeHtml(row.player)}</td><td>${escapeHtml(row.team)}</td><td>${row.yellow}</td><td>${row.red}</td></tr>`).join("")
    : `<tr><td colspan="4">No hay tarjetas registradas.</td></tr>`;

  const discipline = state.events
    .filter((event) => event.type === "amarilla" || event.type === "roja")
    .slice()
    .reverse();

  qs("#disciplineFeed").innerHTML = discipline.length
    ? discipline.map((event) => `
      <article class="event-item">
        <div>
          <span class="badge-card ${event.type}">${event.type === "amarilla" ? "Tarjeta amarilla" : "Tarjeta roja"}</span>
          <strong>${escapeHtml(playerName(event.playerId))}</strong>
          <span> · ${escapeHtml(teamName(event.teamId))} · Min. ${escapeHtml(event.minute || "-")}</span>
          ${event.detail ? `<small>Motivo: ${escapeHtml(event.detail)}</small>` : ""}
        </div>
        <small>${escapeHtml(matchById(event.matchId)?.round || "Partido")}</small>
      </article>
    `).join("")
    : `<p class="empty">Todavía no hay tarjetas registradas.</p>`;
}

function optionTeams(selected = "") {
  return state.teams.map((team) => `<option value="${team.id}" ${team.id === selected ? "selected" : ""}>${escapeHtml(team.name)}</option>`).join("");
}

function optionPlayers(teamId = "", selected = "") {
  const players = state.players.filter((player) => !teamId || player.teamId === teamId);
  return players.map((player) => `<option value="${player.id}" ${player.id === selected ? "selected" : ""}>${escapeHtml(player.fullName)} - ${escapeHtml(teamName(player.teamId))}</option>`).join("");
}

function optionMatches(selected = "") {
  return state.matches.map((match) => `<option value="${match.id}" ${match.id === selected ? "selected" : ""}>${escapeHtml(match.round || "Fecha")} · ${escapeHtml(teamName(match.teamA))} vs ${escapeHtml(teamName(match.teamB))}</option>`).join("");
}

function renderAdmin() {
  const area = qs("#adminArea");
  if (!logged) {
    area.innerHTML = `
      <article class="admin-card login-card">
        <h3>Iniciar sesión</h3>
        <p class="inline-note">Acceso para la persona encargada de registrar resultados, tarjetas y jugadores.</p>
        <form id="loginForm" class="form-grid">
          <label class="full">Usuario
            <input type="text" name="user" autocomplete="username" required />
          </label>
          <label class="full">Contraseña
            <input type="password" name="pass" autocomplete="current-password" required />
          </label>
          <div class="actions full">
            <button class="btn primary" type="submit">Ingresar</button>
          </div>
        </form>
      </article>
    `;
    return;
  }

  area.innerHTML = `
    <div class="admin-header">
      <div>
        <h3>Panel de control</h3>
        <p class="inline-note warning">Esta versión funciona en GitHub Pages sin base de datos. Para que todos vean los cambios, exporte datos.js y reemplácelo en el repositorio. No publique CI, teléfonos o datos médicos de menores en la vista pública.</p>
      </div>
      <button class="btn danger" type="button" data-action="logout">Cerrar sesión</button>
    </div>

    <div class="admin-grid">
      <article class="admin-card">
        <h3>Equipos</h3>
        <form id="teamForm" class="form-grid">
          <input type="hidden" name="id" />
          <label>Nombre del equipo
            <input name="name" placeholder="Ej.: 6to A" required />
          </label>
          <label>Curso/Categoría
            <input name="course" placeholder="Ej.: Secundaria varones" />
          </label>
          <label>Responsable/DT
            <input name="coach" placeholder="Nombre del responsable" />
          </label>
          <label>Color
            <input type="color" name="color" value="#0b3a67" />
          </label>
          <label class="full">Observaciones
            <textarea name="notes" placeholder="Datos internos del equipo"></textarea>
          </label>
          <div class="actions full">
            <button class="btn primary" type="submit">Guardar equipo</button>
            <button class="btn light" type="reset" data-action="clear-team">Limpiar</button>
          </div>
        </form>
        <div class="admin-list" id="adminTeams"></div>
      </article>

      <article class="admin-card">
        <h3>Jugadores</h3>
        <form id="playerForm" class="form-grid">
          <input type="hidden" name="id" />
          <label>Equipo
            <select name="teamId" required>${optionTeams()}</select>
          </label>
          <label>Nombre completo
            <input name="fullName" required />
          </label>
          <label>Edad
            <input name="age" type="number" min="4" max="30" />
          </label>
          <label>Fecha de nacimiento
            <input name="birthdate" type="date" />
          </label>
          <label>Curso/Grado
            <input name="course" />
          </label>
          <label>Dorsal
            <input name="number" type="number" min="0" max="99" />
          </label>
          <label>Posición
            <select name="position">
              <option>Arquero</option>
              <option>Cierre</option>
              <option>Ala</option>
              <option>Pívot</option>
              <option>Universal</option>
            </select>
          </label>
          <label>CI/RUDE interno
            <input name="ciRude" placeholder="No se muestra públicamente" />
          </label>
          <label>Padre/Madre/Tutor
            <input name="tutor" placeholder="No se muestra públicamente" />
          </label>
          <label>Contacto interno
            <input name="phone" placeholder="No se muestra públicamente" />
          </label>
          <label>Autorización
            <select name="authorization">
              <option>Pendiente</option>
              <option>Entregada</option>
              <option>No entregada</option>
            </select>
          </label>
          <label>Estado
            <select name="active">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>
          <label class="full">Observaciones de salud/internas
            <textarea name="healthNotes" placeholder="Uso interno. Evite publicar datos sensibles."></textarea>
          </label>
          <div class="actions full">
            <button class="btn primary" type="submit">Guardar jugador</button>
            <button class="btn light" type="reset" data-action="clear-player">Limpiar</button>
          </div>
        </form>
        <div class="admin-list" id="adminPlayers"></div>
      </article>

      <article class="admin-card">
        <h3>Partidos y marcador</h3>
        <form id="matchForm" class="form-grid">
          <input type="hidden" name="id" />
          <label>Fecha/Ronda
            <input name="round" placeholder="Ej.: Fecha 1" required />
          </label>
          <label>Estado
            <select name="status">
              <option value="programado">Programado</option>
              <option value="en_juego">En juego</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </label>
          <label>Fecha
            <input name="date" type="date" />
          </label>
          <label>Hora
            <input name="time" type="time" />
          </label>
          <label>Equipo A
            <select name="teamA" required>${optionTeams()}</select>
          </label>
          <label>Equipo B
            <select name="teamB" required>${optionTeams()}</select>
          </label>
          <label>Goles Equipo A
            <input name="goalsA" type="number" min="0" value="0" />
          </label>
          <label>Goles Equipo B
            <input name="goalsB" type="number" min="0" value="0" />
          </label>
          <label>Lugar
            <input name="venue" />
          </label>
          <label>Árbitro
            <input name="referee" />
          </label>
          <div class="actions full">
            <button class="btn primary" type="submit">Guardar partido</button>
            <button class="btn light" type="reset" data-action="clear-match">Limpiar</button>
          </div>
        </form>
        <div class="admin-list" id="adminMatches"></div>
      </article>

      <article class="admin-card">
        <h3>Eventos: goles y tarjetas</h3>
        <form id="eventForm" class="form-grid">
          <label>Partido
            <select name="matchId" required>${optionMatches()}</select>
          </label>
          <label>Tipo
            <select name="type">
              <option value="gol">Gol</option>
              <option value="amarilla">Tarjeta amarilla</option>
              <option value="roja">Tarjeta roja</option>
            </select>
          </label>
          <label>Equipo
            <select name="teamId" required>${optionTeams()}</select>
          </label>
          <label>Jugador
            <select name="playerId" required>${optionPlayers()}</select>
          </label>
          <label>Minuto
            <input name="minute" type="number" min="0" max="120" />
          </label>
          <label>Cantidad
            <input name="quantity" type="number" min="1" max="20" value="1" />
          </label>
          <label class="full">Detalle/Motivo
            <textarea name="detail" placeholder="Ej.: falta, conducta antideportiva, asistencia, etc."></textarea>
          </label>
          <label class="checkbox-line full">
            <input name="addToScore" type="checkbox" checked /> Sumar goles automáticamente al marcador cuando el evento sea gol.
          </label>
          <div class="actions full">
            <button class="btn primary" type="submit">Registrar evento</button>
          </div>
        </form>
        <div class="admin-list" id="adminEvents"></div>
      </article>
    </div>

    <article class="admin-card">
      <h3>Exportar / importar datos</h3>
      <p class="inline-note">Use “Exportar datos.js” para publicar los cambios en GitHub Pages. Reemplace el archivo datos.js del repositorio con el archivo descargado.</p>
      <div class="actions">
        <button class="btn primary" type="button" data-action="export-js">Exportar datos.js</button>
        <button class="btn light" type="button" data-action="export-json">Exportar JSON</button>
        <label class="btn light" for="importFile">Importar JSON</label>
        <input id="importFile" type="file" accept="application/json,.json" hidden />
        <button class="btn danger" type="button" data-action="reset-data">Restablecer ejemplo</button>
      </div>
    </article>
  `;

  updateAdminLists();
  refreshEventPlayerOptions();
}

function updateAdminLists() {
  const teams = qs("#adminTeams");
  const players = qs("#adminPlayers");
  const matches = qs("#adminMatches");
  const events = qs("#adminEvents");
  if (!teams || !players || !matches || !events) return;

  teams.innerHTML = state.teams.length ? state.teams.map((team) => `
    <div class="admin-row">
      <div><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.course || "Curso pendiente")} · ${escapeHtml(team.coach || "Responsable pendiente")}</small></div>
      <div class="row-actions">
        <button class="btn small light" data-action="edit-team" data-id="${team.id}">Editar</button>
        <button class="btn small danger" data-action="delete-team" data-id="${team.id}">Eliminar</button>
      </div>
    </div>
  `).join("") : `<p class="empty">Sin equipos.</p>`;

  players.innerHTML = state.players.length ? state.players.map((player) => `
    <div class="admin-row">
      <div><strong>#${escapeHtml(player.number || "-")} ${escapeHtml(player.fullName)}</strong><small>${escapeHtml(teamName(player.teamId))} · ${escapeHtml(player.position || "Posición")} · ${escapeHtml(player.age || "-")} años · Autorización: ${escapeHtml(player.authorization || "Pendiente")}</small></div>
      <div class="row-actions">
        <button class="btn small light" data-action="edit-player" data-id="${player.id}">Editar</button>
        <button class="btn small danger" data-action="delete-player" data-id="${player.id}">Eliminar</button>
      </div>
    </div>
  `).join("") : `<p class="empty">Sin jugadores.</p>`;

  matches.innerHTML = state.matches.length ? state.matches.map((match) => `
    <div class="admin-row">
      <div><strong>${escapeHtml(match.round || "Fecha")}: ${escapeHtml(teamName(match.teamA))} ${Number(match.goalsA || 0)} - ${Number(match.goalsB || 0)} ${escapeHtml(teamName(match.teamB))}</strong><small>${escapeHtml(statusLabel(match.status))} · ${escapeHtml(formatDate(match.date, match.time))}</small></div>
      <div class="row-actions">
        <button class="btn small light" data-action="edit-match" data-id="${match.id}">Editar</button>
        <button class="btn small danger" data-action="delete-match" data-id="${match.id}">Eliminar</button>
      </div>
    </div>
  `).join("") : `<p class="empty">Sin partidos.</p>`;

  events.innerHTML = state.events.length ? state.events.slice().reverse().map((event) => `
    <div class="admin-row">
      <div><strong>${escapeHtml(event.type)} · ${escapeHtml(playerName(event.playerId))}</strong><small>${escapeHtml(teamName(event.teamId))} · ${escapeHtml(matchById(event.matchId)?.round || "Partido")} · Min. ${escapeHtml(event.minute || "-")} ${event.quantity ? `· Cant. ${escapeHtml(event.quantity)}` : ""}</small></div>
      <div class="row-actions">
        <button class="btn small danger" data-action="delete-event" data-id="${event.id}">Eliminar</button>
      </div>
    </div>
  `).join("") : `<p class="empty">Sin eventos.</p>`;
}

function renderAll() {
  renderSummary();
  renderScoreboard();
  renderStandings();
  renderTeams();
  renderStats();
  renderAdmin();
  qs("#lastUpdated").textContent = formatUpdated();
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setFormValues(form, values) {
  Object.entries(values).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    field.value = value ?? "";
  });
}

function clearForm(form) {
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
}

function handleLogin(form) {
  const data = formToObject(form);
  if (data.user === ADMIN_USER && data.pass === ADMIN_PASS) {
    logged = true;
    sessionStorage.setItem(SESSION_KEY, "true");
    renderAll();
  } else {
    alert("Usuario o contraseña incorrectos.");
  }
}

function saveTeam(form) {
  const data = formToObject(form);
  const team = {
    id: data.id || uid("eq"),
    name: data.name.trim(),
    course: data.course.trim(),
    coach: data.coach.trim(),
    color: data.color || "#0b3a67",
    notes: data.notes.trim()
  };
  if (!team.name) return alert("Escriba el nombre del equipo.");
  const index = state.teams.findIndex((item) => item.id === team.id);
  if (index >= 0) state.teams[index] = team;
  else state.teams.push(team);
  clearForm(form);
  saveData();
}

function savePlayer(form) {
  const data = formToObject(form);
  const player = {
    id: data.id || uid("pl"),
    teamId: data.teamId,
    fullName: data.fullName.trim(),
    age: data.age,
    birthdate: data.birthdate,
    course: data.course.trim(),
    number: data.number,
    position: data.position,
    ciRude: data.ciRude.trim(),
    tutor: data.tutor.trim(),
    phone: data.phone.trim(),
    authorization: data.authorization,
    healthNotes: data.healthNotes.trim(),
    active: data.active === "true"
  };
  if (!player.teamId || !player.fullName) return alert("Seleccione equipo y escriba el nombre completo.");
  const index = state.players.findIndex((item) => item.id === player.id);
  if (index >= 0) state.players[index] = player;
  else state.players.push(player);
  clearForm(form);
  saveData();
}

function saveMatch(form) {
  const data = formToObject(form);
  if (data.teamA === data.teamB) return alert("Seleccione equipos diferentes.");
  const match = {
    id: data.id || uid("mt"),
    round: data.round.trim(),
    date: data.date,
    time: data.time,
    venue: data.venue.trim(),
    teamA: data.teamA,
    teamB: data.teamB,
    goalsA: Number(data.goalsA || 0),
    goalsB: Number(data.goalsB || 0),
    status: data.status,
    referee: data.referee.trim()
  };
  const index = state.matches.findIndex((item) => item.id === match.id);
  if (index >= 0) state.matches[index] = match;
  else state.matches.push(match);
  clearForm(form);
  saveData();
}

function saveEvent(form) {
  const data = formToObject(form);
  if (!data.matchId || !data.teamId || !data.playerId) return alert("Complete partido, equipo y jugador.");
  const event = {
    id: uid("ev"),
    matchId: data.matchId,
    type: data.type,
    teamId: data.teamId,
    playerId: data.playerId,
    minute: data.minute,
    quantity: Number(data.quantity || 1),
    detail: data.detail.trim(),
    createdAt: new Date().toISOString()
  };
  state.events.push(event);

  if (event.type === "gol" && data.addToScore === "on") {
    const match = matchById(event.matchId);
    if (match) {
      if (match.teamA === event.teamId) match.goalsA = Number(match.goalsA || 0) + event.quantity;
      if (match.teamB === event.teamId) match.goalsB = Number(match.goalsB || 0) + event.quantity;
    }
  }
  form.reset();
  refreshEventPlayerOptions();
  saveData();
}

function editTeam(id) {
  const team = teamById(id);
  const form = qs("#teamForm");
  if (team && form) setFormValues(form, team);
}

function editPlayer(id) {
  const player = playerById(id);
  const form = qs("#playerForm");
  if (player && form) setFormValues(form, { ...player, active: String(player.active !== false) });
}

function editMatch(id) {
  const match = matchById(id);
  const form = qs("#matchForm");
  if (match && form) setFormValues(form, match);
}

function deleteTeam(id) {
  const linked = state.players.some((player) => player.teamId === id) || state.matches.some((match) => match.teamA === id || match.teamB === id);
  if (linked) return alert("No se puede eliminar un equipo con jugadores o partidos vinculados.");
  if (confirm("¿Eliminar este equipo?")) {
    state.teams = state.teams.filter((team) => team.id !== id);
    saveData();
  }
}

function deletePlayer(id) {
  if (confirm("¿Eliminar este jugador? También se mantendrán eventos históricos como jugador no registrado.")) {
    state.players = state.players.filter((player) => player.id !== id);
    saveData();
  }
}

function deleteMatch(id) {
  if (confirm("¿Eliminar este partido y sus eventos relacionados?")) {
    state.matches = state.matches.filter((match) => match.id !== id);
    state.events = state.events.filter((event) => event.matchId !== id);
    saveData();
  }
}

function deleteEvent(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  if (confirm("¿Eliminar este evento?")) {
    state.events = state.events.filter((item) => item.id !== id);
    if (event.type === "gol") {
      const match = matchById(event.matchId);
      if (match) {
        if (match.teamA === event.teamId) match.goalsA = Math.max(0, Number(match.goalsA || 0) - Number(event.quantity || 1));
        if (match.teamB === event.teamId) match.goalsB = Math.max(0, Number(match.goalsB || 0) - Number(event.quantity || 1));
      }
    }
    saveData();
  }
}

function refreshEventPlayerOptions() {
  const form = qs("#eventForm");
  if (!form) return;
  const teamId = form.elements.teamId?.value || "";
  const playerSelect = form.elements.playerId;
  const previous = playerSelect.value;
  playerSelect.innerHTML = optionPlayers(teamId, previous);
  if (![...playerSelect.options].some((option) => option.value === previous)) {
    playerSelect.selectedIndex = 0;
  }
}

function downloadText(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  downloadText("datos-campeonato-futsal.json", JSON.stringify(state, null, 2), "application/json");
}

function exportDatosJs() {
  const content = `window.FUTSAL_DATA = ${JSON.stringify(state, null, 2)};\n`;
  downloadText("datos.js", content, "text/javascript");
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeSeed(JSON.parse(reader.result));
      state = imported;
      saveData();
      alert("Datos importados correctamente.");
    } catch (error) {
      alert("No se pudo importar el archivo JSON.");
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (confirm("¿Restablecer los datos de ejemplo? Se borrarán los cambios guardados en este navegador.")) {
    localStorage.removeItem(DATA_KEY);
    state = normalizeSeed(window.FUTSAL_DATA);
    saveData();
  }
}

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id === "loginForm") {
    event.preventDefault();
    handleLogin(form);
  }
  if (form.id === "teamForm") {
    event.preventDefault();
    saveTeam(form);
  }
  if (form.id === "playerForm") {
    event.preventDefault();
    savePlayer(form);
  }
  if (form.id === "matchForm") {
    event.preventDefault();
    saveMatch(form);
  }
  if (form.id === "eventForm") {
    event.preventDefault();
    saveEvent(form);
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === "logout") {
    logged = false;
    sessionStorage.removeItem(SESSION_KEY);
    renderAll();
  }
  if (action === "clear-team") clearForm(qs("#teamForm"));
  if (action === "clear-player") clearForm(qs("#playerForm"));
  if (action === "clear-match") clearForm(qs("#matchForm"));
  if (action === "edit-team") editTeam(id);
  if (action === "edit-player") editPlayer(id);
  if (action === "edit-match") editMatch(id);
  if (action === "delete-team") deleteTeam(id);
  if (action === "delete-player") deletePlayer(id);
  if (action === "delete-match") deleteMatch(id);
  if (action === "delete-event") deleteEvent(id);
  if (action === "export-json") exportJson();
  if (action === "export-js") exportDatosJs();
  if (action === "reset-data") resetData();
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#eventForm select[name='teamId']")) refreshEventPlayerOptions();
  if (event.target.id === "importFile") importJson(event.target.files[0]);
});

renderAll();
