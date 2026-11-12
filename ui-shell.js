/* ==============================================================================
   Time Tracker — "La rueda del día" (capa de interfaz)
   - Dibuja la rueda del día (un arco por actividad registrada hoy, en orden),
     la rueda del equipo en el Centro de mando y las barras de la semana.
   - Organiza el portal del colaborador en dos vistas: "Hoy" y "Actividad".
   Lee el estado de app.js por window.__tt (solo lectura). No escribe datos ni
   cambia la lógica: los botones y enlaces existentes siguen haciendo lo mismo.
   ============================================================================== */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#6D4BFF", "#FF5A5F", "#12B5A6", "#FF9F1C", "#2E86FF", "#C94BD8", "#3FAE4F", "#E8A400"];
  const LIVE = "#FF5A5F";
  const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  const getState = () => (window.__tt && window.__tt.state) || null;
  const $ = (id) => document.getElementById(id);

  function colorFor(name) {
    const key = String(name || "General").trim().toLowerCase();
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function weekKeys() {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return dateKey(d);
    });
  }

  const hoursOf = (t) => {
    const h = Number(t.horas);
    if (Number.isFinite(h) && h > 0) return h;
    const s = Number(t.segundos);
    return Number.isFinite(s) && s > 0 ? s / 3600 : 0;
  };
  const isRejected = (t) => t.estado === "rechazada" || t.aprobada === false;
  const clientOf = (t) => (String(t.cliente || "").trim() || "General");
  const fmtH = (h) => (h > 0 && h < 1)
    ? `${Math.max(1, Math.round(h * 60))} min`
    : `${(Math.round(h * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  const createdMs = (t) => {
    const c = t.createdAt;
    if (!c) return 0;
    if (typeof c === "string") return Date.parse(c) || 0;
    if (typeof c.toMillis === "function") return c.toMillis();
    if (typeof c.seconds === "number") return c.seconds * 1000;
    return 0;
  };

  function el(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  function polar(cx, cy, r, frac) {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  // Anillo con segmentos [{color, value, faded}] sobre una capacidad total.
  function drawRing(host, segments, capacity, opts) {
    const cx = 200, cy = 200, r = opts.radius || 160, w = opts.width || 30;
    const svg = el("svg", { viewBox: "0 0 400 400", role: "img", "aria-label": opts.label || "" });
    svg.appendChild(el("circle", { cx, cy, r, fill: "none", class: "wheel-track", "stroke-width": w }));
    const C = 2 * Math.PI * r;
    if (opts.hourLabels) {
      for (let i = 0; i < capacity; i++) {
        const major = i % 2 === 0;
        const [x1, y1] = polar(cx, cy, r + w / 2 + 5, i / capacity);
        const [x2, y2] = polar(cx, cy, r + w / 2 + (major ? 13 : 9), i / capacity);
        svg.appendChild(el("line", { x1, y1, x2, y2, class: "wheel-tick", "stroke-linecap": "round" }));
        if (major) {
          const [tx, ty] = polar(cx, cy, r + w / 2 + 26, i / capacity);
          svg.appendChild(el("text", { x: tx, y: ty + 4, class: "wheel-hour", "text-anchor": "middle" }, i === 0 ? `${capacity} h` : `${i} h`));
        }
      }
    }
    let offset = 0;
    const gap = 3;
    const g = el("g", { transform: `rotate(-90 ${cx} ${cy})`, fill: "none", "stroke-width": w });
    segments.forEach((seg) => {
      const len = Math.max(0, (seg.value / capacity) * C);
      if (len <= 0) return;
      const draw = Math.max(1, len - (segments.length > 1 ? gap : 0));
      const arc = el("circle", { cx, cy, r, stroke: seg.color, "stroke-dasharray": `${draw} ${C}`, "stroke-dashoffset": String(-offset) });
      if (seg.faded) arc.setAttribute("stroke-opacity", "0.4");
      if (seg.title) arc.appendChild(el("title", {}, seg.title));
      g.appendChild(arc);
      offset += len;
    });
    svg.appendChild(g);
    if (opts.liveDot && offset > 0) {
      const [x, y] = polar(cx, cy, r, Math.min(offset / C, 0.999));
      svg.appendChild(el("circle", { cx: x, cy: y, r: 10, class: "wheel-live-dot" }));
    }
    host.replaceChildren(svg);
  }

  function legendRows(host, title, rows) {
    host.replaceChildren();
    if (!rows.length) return;
    const head = document.createElement("div");
    head.className = "wl-head";
    head.textContent = title;
    host.appendChild(head);
    rows.forEach((row) => {
      const div = document.createElement("div");
      div.className = "wl-row";
      const sw = document.createElement("i");
      sw.style.background = row.color;
      if (row.faded) sw.style.opacity = "0.45";
      const name = document.createElement("span");
      name.textContent = row.name;
      const val = document.createElement("b");
      val.textContent = fmtH(row.value);
      div.append(sw, name, val);
      host.appendChild(div);
    });
  }

  function currentWorkerId(state) {
    if (state.userProfile?.rol === "worker") return state.userProfile.trabajadorId || null;
    return $("timerWorkerSelect")?.value || null;
  }

  // --- Rueda del día: un arco por actividad de hoy, en el orden en que se registró ---
  function renderDayWheel(state) {
    const host = $("dayWheel");
    if (!host || host.offsetParent === null) return;
    const wid = currentWorkerId(state);
    const today = dateKey(new Date());
    const tasks = (state.tasks || [])
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.fecha === today && !isRejected(t) && (!wid || t.trabajadorId === wid))
      .sort((a, b) => (createdMs(a.t) - createdMs(b.t)) || (b.i - a.i))
      .map(({ t }) => t);
    const segments = tasks.map((t) => ({
      value: hoursOf(t),
      color: colorFor(clientOf(t)),
      title: `${clientOf(t)} · ${t.descripcion || "Actividad"} · ${fmtH(hoursOf(t))}`,
    }));
    const running = !!$("timerDisplay")?.classList.contains("timer-active");
    const liveHours = Math.max(0, Number(state.timer?.elapsedSeconds) || 0) / 3600;
    // Solo hay sesión en curso o en pausa si el cronómetro está corriendo o se puede reiniciar
    const hasSession = running || ($("btnReset") && !$("btnReset").disabled);
    const showLive = liveHours > 0 && hasSession;
    if (showLive) segments.push({ value: liveHours, color: LIVE, faded: !running, title: running ? "En curso" : "En pausa" });
    const registered = tasks.reduce((a, t) => a + hoursOf(t), 0);
    const total = registered + (showLive ? liveHours : 0);
    const capacity = Math.max(8, Math.ceil(total / 2) * 2);
    drawRing(host, segments, capacity, {
      hourLabels: true,
      liveDot: running && showLive,
      label: `Hoy: ${fmtH(total)} de una jornada de ${capacity} h`,
    });
    const legend = $("dayWheelLegend");
    if (legend) {
      const byClient = new Map();
      tasks.forEach((t) => byClient.set(clientOf(t), (byClient.get(clientOf(t)) || 0) + hoursOf(t)));
      const rows = [...byClient.entries()].map(([name, value]) => ({ name, value, color: colorFor(name) })).sort((a, b) => b.value - a.value);
      if (showLive) rows.push({ name: running ? "En curso" : "En pausa", value: liveHours, color: LIVE, faded: !running });
      legendRows(legend, `${wid ? "Hoy" : "Equipo hoy"} · ${fmtH(total)}`, rows);
    }
  }

  // --- Barras de la semana del colaborador ---
  function renderWeekBars(state) {
    const host = $("weekBars");
    if (!host || host.offsetParent === null) return;
    const wid = currentWorkerId(state);
    const keys = weekKeys();
    const today = dateKey(new Date());
    const days = keys.map(() => new Map());
    (state.tasks || []).forEach((t) => {
      if (isRejected(t) || (wid && t.trabajadorId !== wid)) return;
      const idx = keys.indexOf(t.fecha);
      if (idx < 0) return;
      days[idx].set(clientOf(t), (days[idx].get(clientOf(t)) || 0) + hoursOf(t));
    });
    const totals = days.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
    const max = Math.max(4, ...totals);
    host.replaceChildren();
    days.forEach((m, i) => {
      const day = document.createElement("div");
      day.className = "wb-day" + (keys[i] === today ? " is-today" : "");
      day.title = `${DAY_LABELS[i]}: ${fmtH(totals[i])}`;
      const val = document.createElement("b");
      val.textContent = totals[i] > 0 ? (Math.round(totals[i] * 10) / 10).toLocaleString("en-US") : "";
      const stack = document.createElement("span");
      stack.className = "wb-stack";
      stack.style.height = `${Math.max(4, (totals[i] / max) * 100)}%`;
      [...m.entries()].forEach(([name, h]) => {
        const em = document.createElement("em");
        em.style.height = `${(h / (totals[i] || 1)) * 100}%`;
        em.style.background = colorFor(name);
        stack.appendChild(em);
      });
      const lbl = document.createElement("small");
      lbl.textContent = DAY_LABELS[i];
      day.append(val, stack, lbl);
      host.appendChild(day);
    });
  }

  // --- Rueda del equipo (Centro de mando) ---
  function ensureTeamTile() {
    const budget = $("adminUpworkBudgetSection");
    if (!budget) return null;
    let tile = $("teamWheelTile");
    if (!tile) {
      tile = document.createElement("section");
      tile.id = "teamWheelTile";
      tile.className = "team-wheel-tile";
      tile.innerHTML = '<div><h3>La semana del equipo</h3><p>Horas registradas por cliente, de lunes a domingo (sin rechazadas).</p></div>' +
        '<div class="team-wheel-body"><div class="team-wheel-ring"><div id="teamWheel" class="day-wheel"></div>' +
        '<div class="wheel-total"><b id="teamWheelTotal">0 h</b><span>esta semana</span></div></div>' +
        '<div id="teamWheelLegend" class="wheel-legend"></div></div>';
      budget.insertAdjacentElement("afterend", tile);
    }
    return tile;
  }

  function renderTeamWheel(state) {
    const tile = ensureTeamTile();
    if (!tile || tile.offsetParent === null) return;
    const keys = new Set(weekKeys());
    const byClient = new Map();
    (state.tasks || []).forEach((t) => {
      if (!keys.has(t.fecha) || isRejected(t)) return;
      byClient.set(clientOf(t), (byClient.get(clientOf(t)) || 0) + hoursOf(t));
    });
    const rows = [...byClient.entries()].map(([name, value]) => ({ name, value, color: colorFor(name) })).sort((a, b) => b.value - a.value);
    const total = rows.reduce((a, r) => a + r.value, 0);
    drawRing($("teamWheel"), rows, total || 1, { radius: 160, width: 44, label: `Equipo: ${fmtH(total)} esta semana` });
    $("teamWheelTotal").textContent = fmtH(total);
    legendRows($("teamWheelLegend"), "Por cliente", rows);
  }

  // --- Vistas del colaborador: "hoy" y "actividad" ---
  const ACTIVITY_IDS = ["workerTasksSlot", "workerWeeklySection"];
  function viewOf(node) {
    const portal = $("workerPortalView");
    if (!node || !portal || !portal.contains(node) || node === portal) return null;
    let top = node;
    while (top.parentElement && top.parentElement !== portal) top = top.parentElement;
    if (top.parentElement !== portal) return null;
    if (ACTIVITY_IDS.includes(top.id) || top.matches('[data-summary-scope="worker"]')) return "actividad";
    return "hoy";
  }

  function setView(view) {
    if (!view) return;
    document.documentElement.dataset.wview = view;
    const dock = $("mobileTabbar");
    if (!dock) return;
    dock.querySelector('.worker-only-feature[data-tab-nav="tracker"]')?.classList.toggle("active", view === "hoy");
    dock.querySelector('.worker-only-feature[data-tab-nav="tasks"]')?.classList.toggle("active", view === "actividad");
  }

  // Cualquier desplazamiento hacia una sección cambia primero a su vista,
  // así los botones existentes (dock, menú, accesos) siguen llevando a su destino.
  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...args) {
    try {
      if (document.documentElement.classList.contains("role-worker")) setView(viewOf(this));
    } catch (e) { /* sin efecto en la navegación */ }
    return nativeScrollIntoView.apply(this, args);
  };

  function wireNavigation() {
    // El menú lateral es un cajón también en escritorio: se cierra al elegir un destino.
    document.querySelectorAll("#appSidebar .sidebar-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        const nav = link.dataset.nav;
        if (nav === "reports" && document.documentElement.classList.contains("role-worker")) {
          document.querySelector('#workerPortalView > [data-summary-scope="worker"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (nav === "dashboard" || nav === "tracker" || nav === "billing") {
          setView("hoy");
        }
        const sidebar = $("appSidebar");
        if (window.innerWidth >= 1024 && sidebar && !sidebar.classList.contains("-translate-x-full")) {
          $("btnCloseSidebarMobile")?.click();
        }
      });
    });
    setView("hoy");
  }

  // "+ Horas / Artes" vive junto a los controles del cronómetro (mismo botón, mismo id).
  function placeManualButton() {
    const btn = $("btnWorkerOpenManualEntry");
    const controls = document.querySelector("#timerMainCard .timer-controls");
    if (btn && controls && btn.parentElement !== controls) {
      controls.appendChild(btn);
      btn.classList.add("manual-in-timer");
    }
  }

  // En escritorio el saludo vive en la barra superior; en celular vuelve al inicio del portal.
  function placeGreeting() {
    const hero = $("workerDashboardSection");
    const portal = $("workerPortalView");
    const slot = document.querySelector("#appSidebar + div > header > div:first-child");
    if (!hero || !portal || !slot) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop && hero.parentElement !== slot) {
      slot.appendChild(hero);
      hero.classList.add("hero-in-topbar");
    } else if (!desktop && hero.parentElement !== portal) {
      portal.insertBefore(hero, portal.firstChild);
      hero.classList.remove("hero-in-topbar");
    }
  }

  function renderAll() {
    const state = getState();
    if (!state) return;
    try { renderDayWheel(state); } catch (e) { console.warn("[rueda]", e); }
    try { renderWeekBars(state); } catch (e) { console.warn("[semana]", e); }
  }

  function start() {
    placeManualButton();
    placeGreeting();
    window.matchMedia("(min-width: 1024px)").addEventListener("change", placeGreeting);
    wireNavigation();
    renderAll();
    setInterval(renderAll, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
