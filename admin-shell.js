/* ==============================================================================
   Time Tracker — Centro de mando "La rueda del día" (capa de interfaz de admin)
   - El río del dinero: recaudo → nómina → pagado → por pagar → disponible.
   - Los carriles del equipo: una columna por colaborador con su semana, su saldo
     y sus horas por aprobar.
   - La constelación: un anillo por colaborador, segmentado por cliente.
   - Vistas: Inicio, Aprobar, Nómina, Clientes y Equipo.
   Lee el estado de app.js por window.__tt (solo lectura) y los valores ya
   calculados en la página. Las acciones llaman a las mismas funciones globales
   de app.js (approveTask, openRejectModal, quickPayWorker, openCollaboratorPage),
   así que la lógica no cambia.
   ============================================================================== */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PEOPLE = ["#6D4BFF", "#C94BD8", "#2E86FF", "#12B5A6", "#FF9F1C", "#3FAE4F", "#E8A400", "#FF5A5F"];
  const CLIENTS = ["#6D4BFF", "#FF5A5F", "#12B5A6", "#FF9F1C", "#2E86FF", "#C94BD8", "#3FAE4F", "#E8A400"];
  const VIEWS = [
    { id: "inicio", label: "Inicio", icon: "fa-solid fa-house" },
    { id: "aprobar", label: "Aprobar", icon: "fa-regular fa-circle-check" },
    { id: "nomina", label: "Nómina", icon: "fa-solid fa-file-invoice-dollar" },
    { id: "clientes", label: "Clientes", icon: "fa-solid fa-briefcase" },
    { id: "equipo", label: "Equipo", icon: "fa-solid fa-users" },
  ];

  const $ = (id) => document.getElementById(id);
  const getState = () => (window.__tt && window.__tt.state) || null;
  const isAdmin = () => document.documentElement.classList.contains("role-admin");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hashColor(name, palette) {
    const key = String(name || "General").trim().toLowerCase();
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
  const clientColor = (n) => hashColor(n, CLIENTS);
  const clientOf = (t) => (String(t.cliente || "").trim() || "General");
  const hoursOf = (t) => {
    const h = Number(t.horas);
    if (Number.isFinite(h) && h > 0) return h;
    const s = Number(t.segundos);
    return Number.isFinite(s) && s > 0 ? s / 3600 : 0;
  };
  const isRejected = (t) => t.estado === "rechazada" || t.aprobada === false;
  const isApproved = (t) => t.estado === "aprobada" || t.aprobada === true;
  const fmtH = (h) => `${(Math.round(h * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  const fmtUsd = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const initials = (name) => String(name || "C").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "C";
  const textOf = (id) => ($(id)?.textContent || "").trim();
  const numOf = (id) => {
    const raw = textOf(id).replace(/[^\d.,-]/g, "");
    if (!raw) return 0;
    // Formato de la app: $1,000.00 (coma de miles, punto decimal)
    return Number(raw.replace(/,/g, "")) || 0;
  };

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function weekKeys() {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return dateKey(d); });
  }

  function svg(tag, attrs, text) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function polar(cx, cy, r, frac) {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  // ---------------------------------------------------------------- estructura
  function ensureShell() {
    const portal = $("adminPortalView");
    const head = $("adminDashboardSection");
    if (!portal || !head) return null;

    // Pestañas de vistas dentro del encabezado
    if (!$("adminViewTabs")) {
      const tabs = h("nav", "admin-view-tabs");
      tabs.id = "adminViewTabs";
      tabs.setAttribute("aria-label", "Vistas del Centro de mando");
      VIEWS.forEach((v) => {
        const b = h("button", "avt-btn");
        b.type = "button";
        b.dataset.aviewTab = v.id;
        const i = h("i", v.icon);
        i.setAttribute("aria-hidden", "true");
        const s = h("span", null, v.label);
        b.append(i, s);
        if (v.id === "aprobar") {
          const badge = h("em", "avt-badge");
          badge.id = "adminTabPendingBadge";
          b.appendChild(badge);
        }
        b.addEventListener("click", () => setAdminView(v.id, true));
        tabs.appendChild(b);
      });
      head.appendChild(tabs);
    }

    // Inicio: río + carriles + constelación
    let home = $("adminHome");
    if (!home) {
      home = h("section", "admin-home");
      home.id = "adminHome";
      home.dataset.aview = "inicio";
      home.innerHTML =
        '<section class="river-tile" aria-label="Dinero del mes"><p id="riverCaption" class="river-meta"></p>' +
        '<div id="moneyRiver" class="river"></div></section>' +
        '<div class="home-row">' +
        '<section class="lanes-tile" aria-label="Colaboradores">' +
        '<div id="teamLanes" class="lanes"></div></section>' +
        '<section class="constellation-tile" aria-label="Semana del equipo por persona y cliente">' +
        '<div class="constellation-body"><div id="teamConstellation" class="constellation"></div><div id="constellationLegend" class="const-legend"></div></div></section>' +
        "</div>";
      head.insertAdjacentElement("afterend", home);
      home.querySelectorAll("[data-proxy]").forEach((b) => b.addEventListener("click", () => {
        const target = $(b.dataset.proxy);
        if (b.dataset.proxy === "btnAdminScrollToWorker") setAdminView("equipo");
        target?.click();
      }));
    }

    // Etiquetar cada sección con su vista
    const tag = (el, view) => { if (el && !el.dataset.aview) el.dataset.aview = view; };
    tag(head, "todas");
    tag(portal.querySelector(":scope > .hero-grid"), "nomina");
    tag($("adminApprovalsSection"), "aprobar");
    tag($("adminWeeklySection"), "aprobar");
    tag($("selfSummarySection"), "aprobar");
    tag($("adminTasksSlot"), "aprobar");
    tag($("adminFinancialSection"), "nomina");
    tag($("adminClientsSection"), "clientes");
    tag($("adminReportsSection"), "clientes");
    tag($("adminManagementSection"), "equipo");
    const timerCard = $("adminTimerSlot")?.closest("#adminPortalView > *");
    tag(timerCard, "equipo");
    return home;
  }

  // ---------------------------------------------------------------- vistas
  function adminViewOf(node) {
    const portal = $("adminPortalView");
    if (!node || !portal || !portal.contains(node) || node === portal) return null;
    let top = node;
    while (top.parentElement && top.parentElement !== portal) top = top.parentElement;
    if (top.parentElement !== portal) return null;
    const v = top.dataset.aview;
    if (!v || v === "todas") return "inicio";
    return v;
  }

  function setAdminView(view, scroll) {
    if (!view) return;
    document.documentElement.dataset.aview = view;
    document.querySelectorAll("#adminViewTabs [data-aview-tab]").forEach((b) => {
      const on = b.dataset.aviewTab === view;
      b.classList.toggle("active", on);
      b.setAttribute("aria-current", on ? "page" : "false");
    });
    const dock = $("mobileTabbar");
    if (dock) {
      dock.querySelector('.admin-only-feature[data-tab-nav="dashboard"]')?.classList.toggle("active", view === "inicio");
      dock.querySelector('.admin-only-feature[data-tab-scroll="adminApprovalsSection"]')?.classList.toggle("active", view === "aprobar");
      dock.querySelector('.admin-only-feature[data-tab-nav="billing"]')?.classList.toggle("active", view === "nomina");
    }
    if (view === "inicio") {
      playRiver();
      const c = $("teamConstellation");
      if (c && !reduceMotion()) { c.classList.remove("is-in"); void c.offsetWidth; c.classList.add("is-in"); }
    }
    if (scroll) window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
  }

  const prevScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...args) {
    try { if (isAdmin()) { const v = adminViewOf(this); if (v) setAdminView(v); } } catch (e) { /* sin efecto */ }
    return prevScrollIntoView.apply(this, args);
  };

  // ---------------------------------------------------------------- el río del dinero
  let riverPlayed = false;
  function playRiver() {
    const river = $("moneyRiver");
    if (!river || reduceMotion()) return;
    river.classList.remove("is-rising");
    void river.offsetWidth;
    river.classList.add("is-rising");
    riverPlayed = true;
  }

  function renderRiver() {
    const host = $("moneyRiver");
    if (!host || host.offsetParent === null) return;
    const steps = [
      { key: "recaudo", label: "Recaudo", sub: "Entró del cliente", value: numOf("upworkRevenueDisplay"), cop: textOf("upworkRevenueCopDisplay"), cls: "rv-sun", go: "btnOpenUpworkBudgetModal" },
      { key: "nomina", label: "Nómina causada", sub: textOf("upworkPayrollDetails") || "Horas aprobadas", value: numOf("upworkPayrollCostDisplay"), cop: textOf("upworkPayrollCostCopDisplay"), cls: "rv-violet", nav: "billing" },
      { key: "pagado", label: "Pagado", sub: "Desembolsado al equipo", value: numOf("kpiTotalPagado"), cop: textOf("kpiTotalPagadoCop"), cls: "rv-teal", nav: "billing" },
      { key: "porpagar", label: "Por pagar", sub: textOf("kpiSaldoDesc") || "Saldo del equipo", value: numOf("kpiSaldoPendiente"), cop: textOf("kpiSaldoPendienteCop"), cls: "rv-owed", nav: "payments" },
      { key: "disponible", label: "Disponible", sub: textOf("upworkBudgetSubtitle") || "Margen del mes", value: numOf("upworkAvailableBudgetDisplay"), cop: textOf("upworkAvailableBudgetCopDisplay"), cls: "rv-ink", go: "btnOpenUpworkBudgetModal", big: true },
    ];
    const sig = steps.map((s) => s.value + s.cop).join("|");
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;
    const max = Math.max(1, ...steps.map((s) => Math.abs(s.value)));
    host.replaceChildren();
    const pct = textOf("upworkBudgetPercentLabel");
    const cap = $("riverCaption");
    if (cap) cap.textContent = `${textOf("upworkWeekCycleBadge") || "Este mes"}${pct ? ` · presupuesto ${pct}` : ""}`;
    steps.forEach((s, i) => {
      const col = h("button", `rv-step ${s.cls}${s.big ? " rv-big" : ""}`);
      col.type = "button";
      const ratio = Math.abs(s.value) / max;
      col.style.setProperty("--rv-h", `${Math.max(8, ratio * 100)}%`);
      col.style.setProperty("--rv-px", `${Math.round(64 + ratio * 150)}px`);
      col.style.setProperty("--rv-i", String(i));
      col.setAttribute("aria-label", `${s.label}: ${fmtUsd(s.value)}`);
      const bar = h("span", "rv-bar");
      const amt = h("b", "rv-amount", fmtUsd(s.value));
      const lbl = h("span", "rv-label", s.label);
      bar.append(lbl, amt);
      const foot = h("span", "rv-foot");
      foot.append(h("span", "rv-cop", s.cop || ""), h("small", "rv-sub", s.sub));
      col.append(bar, foot);
      col.addEventListener("click", () => {
        if (s.go) $(s.go)?.click();
        else if (s.nav) document.querySelector(`.sidebar-nav-link[data-nav="${s.nav}"]`)?.click();
      });
      host.appendChild(col);
      if (i < steps.length - 1) {
        const link = h("span", "rv-link");
        link.setAttribute("aria-hidden", "true");
        host.appendChild(link);
      }
    });
    if (!riverPlayed) playRiver();
  }

  // ---------------------------------------------------------------- saldos por colaborador
  function balancesFromPage() {
    // Los saldos ya los calcula app.js en la tabla de liquidaciones (botones de abono)
    const map = new Map();
    document.querySelectorAll('#adminFinancialSection [onclick*="quickPayWorker"]').forEach((b) => {
      const m = /quickPayWorker\((.+?),\s*(.+?),\s*(-?[\d.]+)\)/.exec(b.getAttribute("onclick") || "");
      if (!m) return;
      try { map.set(JSON.parse(m[1].replace(/^'|'$/g, '"')), { name: JSON.parse(m[2].replace(/^'|'$/g, '"')), balance: Number(m[3]) }); } catch (e) { /* ignorar */ }
    });
    return map;
  }

  function computeBalance(state, w) {
    const earned = (state.tasks || []).filter((t) => t.trabajadorId === w.id && isApproved(t)).reduce((a, t) => a + (Number(t.costoTotal) || 0), 0);
    const paid = (state.payments || []).filter((p) => p.trabajadorId === w.id).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    return Number((earned - paid).toFixed(2));
  }

  // ---------------------------------------------------------------- carriles
  function miniRing(hours, goal, segs, color) {
    const s = svg("svg", { viewBox: "0 0 80 80", width: "72", height: "72", "aria-hidden": "true" });
    const r = 32, C = 2 * Math.PI * r;
    s.appendChild(svg("circle", { cx: 40, cy: 40, r, fill: "none", class: "ring-track", "stroke-width": 10 }));
    const g = svg("g", { transform: "rotate(-90 40 40)", fill: "none", "stroke-width": 10, "stroke-linecap": "butt" });
    let off = 0;
    const cap = Math.max(goal, hours, 1);
    segs.forEach((seg) => {
      const len = (seg.value / cap) * C;
      if (len <= 0) return;
      g.appendChild(svg("circle", { cx: 40, cy: 40, r, stroke: seg.color, "stroke-dasharray": `${Math.max(1, len - (segs.length > 1 ? 2 : 0))} ${C}`, "stroke-dashoffset": String(-off) }));
      off += len;
    });
    s.appendChild(g);
    if (hours >= goal && goal > 0) s.appendChild(svg("circle", { cx: 40, cy: 40, r: 6, fill: color }));
    return s;
  }

  function renderLanes(state) {
    const host = $("teamLanes");
    if (!host || host.offsetParent === null) return;
    const keys = new Set(weekKeys());
    const balances = balancesFromPage();
    const workers = (state.workers || []).slice();
    const pendingAll = (state.tasks || []).filter((t) => t.estado === "pendiente");
    const sig = JSON.stringify([workers.map((w) => [w.id, w.nombre, w.tarifaHora, w.metaSemanal]), pendingAll.map((t) => t.id), (state.tasks || []).length, (state.payments || []).length, [...balances.values()].map((b) => b.balance)]);
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;
    host.replaceChildren();
    if (!workers.length) {
      host.appendChild(h("p", "empty-note", "Todavía no hay colaboradores. Agrega uno desde Equipo."));
      return;
    }
    workers.forEach((w, idx) => {
      const color = PEOPLE[idx % PEOPLE.length];
      const lane = h("article", "lane");
      lane.style.setProperty("--person", color);

      const head = h("button", "lane-who");
      head.type = "button";
      head.title = "Abrir el perfil del colaborador";
      head.addEventListener("click", () => window.openCollaboratorPage?.(w.id));
      const av = h("span", "lane-av", initials(w.nombre));
      const who = h("span", "lane-name");
      who.append(h("b", null, w.nombre || "Colaborador"));
      const rate = Number(w.tarifaHora) || 0;
      who.append(h("small", null, rate > 0 ? `$${rate.toFixed(2)}/h` : "Sin tarifa · asígnala para valorar"));
      head.append(av, who, h("i", "fa-solid fa-chevron-right lane-go"));

      const week = (state.tasks || []).filter((t) => t.trabajadorId === w.id && keys.has(t.fecha) && !isRejected(t));
      const hours = week.reduce((a, t) => a + hoursOf(t), 0);
      const byClient = new Map();
      week.forEach((t) => byClient.set(clientOf(t), (byClient.get(clientOf(t)) || 0) + hoursOf(t)));
      const goal = Number(w.metaSemanal) || 20;
      const stat = h("div", "lane-week");
      stat.append(miniRing(hours, goal, [...byClient.entries()].map(([n, v]) => ({ value: v, color: clientColor(n) })), color));
      const sw = h("div");
      sw.append(h("b", null, fmtH(hours)), h("small", null, `de ${goal} h esta semana · ${Math.round((hours / (goal || 1)) * 100)} %`));
      stat.appendChild(sw);

      const bal = balances.get(w.id)?.balance ?? computeBalance(state, w);
      const owe = h("div", "lane-owe" + (bal > 0 ? " has-debt" : ""));
      const ow = h("div");
      ow.append(h("small", null, bal >= 0 ? "Saldo por pagar" : "Anticipo a favor"), h("b", null, fmtUsd(Math.abs(bal))));
      const pay = h("button", "lane-pay");
      pay.type = "button";
      pay.innerHTML = '<i class="fa-solid fa-money-bill-transfer" aria-hidden="true"></i><span>Pagar</span>';
      pay.disabled = !(bal > 0);
      pay.addEventListener("click", () => window.quickPayWorker?.(w.id, w.nombre, bal));
      owe.append(ow, pay);

      const pend = pendingAll.filter((t) => t.trabajadorId === w.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      const list = h("div", "lane-queue");
      const qh = h("span", "lane-cap", pend.length ? `Por aprobar · ${pend.length}` : "Por aprobar");
      list.appendChild(qh);
      if (!pend.length) {
        const ok = h("div", "lane-clear");
        ok.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>Todo al día</span>';
        list.appendChild(ok);
      }
      pend.slice(0, 3).forEach((t) => {
        const it = h("div", "lane-item");
        const info = h("div", "li-info");
        info.append(h("b", null, t.descripcion || "Tarea sin descripción"));
        const isArt = Number(t.cantidadArtes) > 0;
        const qty = isArt ? `${Number(t.cantidadArtes)} arte${Number(t.cantidadArtes) === 1 ? "" : "s"}` : fmtH(hoursOf(t));
        const meta = [clientOf(t), qty, Number(t.costoTotal) > 0 ? fmtUsd(t.costoTotal) : "sin tarifa", t.esManual ? "manual" : "cronómetro"].join(" · ");
        const metaEl = h("small", null, meta);
        const dot = h("i", "li-client");
        dot.style.background = clientColor(clientOf(t));
        metaEl.prepend(dot);
        info.appendChild(metaEl);
        const acts = h("div", "li-acts");
        const no = h("button", "li-no");
        no.type = "button";
        no.setAttribute("aria-label", `Rechazar: ${t.descripcion || "tarea"}`);
        no.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        no.addEventListener("click", () => window.openRejectModal?.(t.id));
        const yes = h("button", "li-yes");
        yes.type = "button";
        yes.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>Aprobar</span>';
        yes.addEventListener("click", () => approveWithFeedback(it, t.id));
        acts.append(no, yes);
        it.append(info, acts);
        list.appendChild(it);
      });
      if (pend.length > 3) {
        const more = h("button", "lane-more", `Ver ${pend.length - 3} más`);
        more.type = "button";
        more.addEventListener("click", () => $("adminApprovalsSection")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        list.appendChild(more);
      }

      const assign = h("button", "lane-assign");
      assign.type = "button";
      assign.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i><span>Asignar tarea</span>';
      assign.addEventListener("click", () => window.openCollaboratorPage?.(w.id));

      lane.append(head, stat, owe, list, assign);
      host.appendChild(lane);
    });
  }

  // ---------------------------------------------------------------- constelación
  function renderConstellation(state) {
    const host = $("teamConstellation");
    if (!host || host.offsetParent === null) return;
    const keys = new Set(weekKeys());
    const workers = (state.workers || []).slice(0, 6);
    const data = workers.map((w, idx) => {
      const week = (state.tasks || []).filter((t) => t.trabajadorId === w.id && keys.has(t.fecha) && !isRejected(t));
      const by = new Map();
      week.forEach((t) => by.set(clientOf(t), (by.get(clientOf(t)) || 0) + hoursOf(t)));
      return { w, color: PEOPLE[idx % PEOPLE.length], goal: Number(w.metaSemanal) || 20, total: week.reduce((a, t) => a + hoursOf(t), 0), segs: [...by.entries()].map(([n, v]) => ({ name: n, value: v, color: clientColor(n) })) };
    });
    const sig = JSON.stringify(data.map((d) => [d.w.id, d.total, d.goal, d.segs.map((s) => [s.name, s.value])]));
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;
    const size = 400, cx = 200, cy = 200;
    const n = Math.max(1, data.length);
    const outer = 180, inner = 76;
    const step = n > 1 ? (outer - inner) / (n - 1) : 0;
    const width = Math.min(22, Math.max(10, step - 6 || 22));
    const s = svg("svg", { viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": "Semana del equipo por persona y cliente" });
    data.forEach((d, i) => {
      const r = outer - i * step;
      const C = 2 * Math.PI * r;
      s.appendChild(svg("circle", { cx, cy, r, fill: "none", class: "ring-track", "stroke-width": width }));
      const g = svg("g", { transform: `rotate(-90 ${cx} ${cy})`, fill: "none", "stroke-width": width, "stroke-linecap": "round" });
      let off = 0;
      const cap = Math.max(d.goal, d.total, 1);
      d.segs.forEach((seg) => {
        const len = (seg.value / cap) * C;
        if (len <= 0) return;
        const c = svg("circle", { cx, cy, r, stroke: seg.color, "stroke-dasharray": `${Math.max(1, len - width * 0.9)} ${C}`, "stroke-dashoffset": String(-off - width * 0.45) });
        c.appendChild(svg("title", {}, `${d.w.nombre} · ${seg.name} · ${fmtH(seg.value)}`));
        g.appendChild(c);
        off += len;
      });
      s.appendChild(g);
      const [x, y] = polar(cx, cy, r, 0);
      const pr = Math.max(10, Math.min(13, width / 2 + 2));
      s.appendChild(svg("circle", { cx: x - width * 1.1, cy: y, r: pr, class: "const-person" }));
      s.appendChild(svg("text", { x: x - width * 1.1, y: y + 3.5, class: "const-initials", "text-anchor": "middle" }, initials(d.w.nombre)));
    });
    const total = data.reduce((a, d) => a + d.total, 0);
    s.appendChild(svg("text", { x: cx, y: cy - 2, class: "const-total", "text-anchor": "middle" }, fmtH(total)));
    s.appendChild(svg("text", { x: cx, y: cy + 20, class: "const-sub", "text-anchor": "middle" }, "equipo · semana"));
    host.replaceChildren(s);

    const legend = $("constellationLegend");
    if (legend) {
      legend.replaceChildren();
      data.forEach((d) => {
        const row = h("button", "cl-row");
        row.type = "button";
        row.addEventListener("click", () => window.openCollaboratorPage?.(d.w.id));
        const dot = personBadge(d.w.nombre);
        const name = h("span", null, d.w.nombre);
        const val = h("b", null, `${fmtH(d.total)} / ${d.goal} h`);
        row.append(dot, name, val);
        legend.appendChild(row);
      });
      const clients = new Map();
      data.forEach((d) => d.segs.forEach((sg) => clients.set(sg.name, (clients.get(sg.name) || 0) + sg.value)));
      if (clients.size) {
        const chips = h("div", "cl-clients");
        [...clients.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, v]) => {
          const c = h("span", "cl-chip");
          const i = h("i");
          i.style.background = clientColor(name);
          c.append(i, document.createTextNode(`${name} · ${fmtH(v)}`));
          chips.appendChild(c);
        });
        legend.appendChild(chips);
      }
    }
  }

  // ---------------------------------------------------------------- utilidades de las vistas
  function insertAfterHead(section, node) {
    if (!section || node.isConnected) return;
    const head = section.firstElementChild;
    head ? head.insertAdjacentElement("afterend", node) : section.prepend(node);
  }

  // Mueve el contenido detallado original a un desplegable "Ver detalle" (mismos ids, mismos botones).
  function tuckIntoDetails(section, selector, label) {
    if (!section) return;
    const target = section.querySelector(selector);
    if (!target || target.closest(".raw-detail")) return;
    const det = document.createElement("details");
    det.className = "raw-detail";
    const sum = h("summary", null, label);
    det.appendChild(sum);
    target.insertAdjacentElement("beforebegin", det);
    det.appendChild(target);
  }

  function hoursArc(hours, cap, color) {
    const s = svg("svg", { viewBox: "0 0 36 36", width: "34", height: "34", "aria-hidden": "true" });
    const r = 14, C = 2 * Math.PI * r;
    s.appendChild(svg("circle", { cx: 18, cy: 18, r, fill: "none", class: "ring-track", "stroke-width": 5 }));
    s.appendChild(svg("circle", { cx: 18, cy: 18, r, fill: "none", stroke: color, "stroke-width": 5, "stroke-dasharray": `${Math.min(1, hours / (cap || 1)) * C} ${C}`, transform: "rotate(-90 18 18)", "stroke-linecap": "round" }));
    return s;
  }

  function personBadge(name) {
    return h("span", "person-badge", initials(name));
  }

  // Aprobar con un gesto visible: el tiquete pasa a verde sólido y luego sale.
  function approveWithFeedback(card, taskId) {
    if (card.classList.contains("is-approving")) return;
    card.classList.add("is-approving");
    const go = () => window.approveTask?.(taskId);
    if (reduceMotion()) go(); else setTimeout(go, 420);
  }

  function ticket(t, opts = {}) {
    const it = h("div", "lane-item ticket");
    const top = h("div", "tk-top");
    const info = h("div", "li-info");
    info.append(h("b", null, t.descripcion || "Tarea sin descripción"));
    const isArt = Number(t.cantidadArtes) > 0;
    const qty = isArt ? `${Number(t.cantidadArtes)} arte${Number(t.cantidadArtes) === 1 ? "" : "s"}` : fmtH(hoursOf(t));
    const meta = h("small");
    const dot = h("i", "li-client");
    dot.style.background = clientColor(clientOf(t));
    meta.append(dot, document.createTextNode([opts.withPerson ? t.trabajadorNombre : null, clientOf(t), qty, Number(t.costoTotal) > 0 ? fmtUsd(t.costoTotal) : "sin tarifa", t.esManual ? "manual" : "cronómetro", t.fecha].filter(Boolean).join(" · ")));
    info.appendChild(meta);
    top.append(hoursArc(isArt ? 1 : hoursOf(t), isArt ? 1 : 8, clientColor(clientOf(t))), info);
    const acts = h("div", "li-acts");
    const no = h("button", "li-no");
    no.type = "button";
    no.setAttribute("aria-label", `Rechazar: ${t.descripcion || "tarea"}`);
    no.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    no.addEventListener("click", () => window.openRejectModal?.(t.id));
    const yes = h("button", "li-yes");
    yes.type = "button";
    yes.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>Aprobar</span>';
    yes.addEventListener("click", () => approveWithFeedback(it, t.id));
    acts.append(no, yes);
    it.append(top, acts);
    return it;
  }

  // ---------------------------------------------------------------- Aprobar
  function renderApprovalBoard(state) {
    const section = $("adminApprovalsSection");
    if (!section) return;
    let board = $("approvalBoard");
    if (!board) {
      board = h("div", "approval-board");
      board.id = "approvalBoard";
      insertAfterHead(section, board);
    }
    if (board.offsetParent === null) return;
    const pending = (state.tasks || []).filter((t) => t.estado === "pendiente");
    const sig = JSON.stringify(pending.map((t) => [t.id, t.horas, t.costoTotal]));
    if (board.dataset.sig === sig) return;
    board.dataset.sig = sig;
    board.replaceChildren();
    if (!pending.length) {
      const ok = h("div", "board-clear");
      ok.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><div><b>Todo al día</b><span>No hay horas esperando tu aprobación.</span></div>';
      board.appendChild(ok);
      return;
    }
    const byPerson = new Map();
    pending.forEach((t) => {
      const key = t.trabajadorId || t.trabajadorNombre || "otro";
      if (!byPerson.has(key)) byPerson.set(key, { name: t.trabajadorNombre || "Colaborador", id: t.trabajadorId, items: [] });
      byPerson.get(key).items.push(t);
    });
    [...byPerson.values()].forEach((g) => {
      const col = h("section", "board-col");
      const head = h("button", "board-head");
      head.type = "button";
      head.addEventListener("click", () => g.id && window.openCollaboratorPage?.(g.id));
      const total = g.items.reduce((a, t) => a + hoursOf(t), 0);
      const nm = h("span", "board-name");
      nm.append(h("b", null, g.name), h("small", null, `${g.items.length} por aprobar · ${fmtH(total)}`));
      head.append(personBadge(g.name), nm);
      col.appendChild(head);
      g.items.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).forEach((t) => col.appendChild(ticket(t)));
      board.appendChild(col);
    });
  }

  // Franja semanal: siete días por persona, horas apiladas por cliente; lo pendiente va punteado.
  let weekOffset = 0;
  function weekKeysAt(offset) {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return dateKey(d); });
  }

  function renderWeekStrip(state) {
    const section = $("adminWeeklySection");
    if (!section) return;
    let strip = $("weekStrip");
    if (!strip) {
      strip = h("div", "week-strip");
      strip.id = "weekStrip";
      insertAfterHead(section, strip);
      tuckIntoDetails(section, "[data-weekly-body]", "Ver la tabla con horas y costos por día");
      section.querySelectorAll("[data-weekly-step]").forEach((b) => b.addEventListener("click", () => {
        const step = Number(b.dataset.weeklyStep);
        weekOffset = step === 0 ? 0 : weekOffset + step;
        strip.dataset.sig = "";
      }));
    }
    if (strip.offsetParent === null) return;
    const keys = weekKeysAt(weekOffset);
    const today = dateKey(new Date());
    const workers = state.workers || [];
    const sig = JSON.stringify([weekOffset, (state.tasks || []).filter((t) => keys.includes(t.fecha)).map((t) => [t.id, t.estado, t.horas])]);
    if (strip.dataset.sig === sig) return;
    strip.dataset.sig = sig;
    strip.replaceChildren();
    const head = h("div", "ws-row ws-head");
    head.appendChild(h("span", "ws-who"));
    keys.forEach((k, i) => {
      const d = new Date(k + "T00:00:00");
      const c = h("span", "ws-day" + (k === today ? " is-today" : ""), `${["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"][i]} ${d.getDate()}`);
      head.appendChild(c);
    });
    head.appendChild(h("span", "ws-total", "Semana"));
    strip.appendChild(head);
    const all = (state.tasks || []).filter((t) => keys.includes(t.fecha) && !isRejected(t));
    const max = Math.max(4, ...workers.map((w) => Math.max(...keys.map((k) => all.filter((t) => t.trabajadorId === w.id && t.fecha === k).reduce((a, t) => a + hoursOf(t), 0)))));
    workers.forEach((w) => {
      const row = h("div", "ws-row");
      const who = h("button", "ws-who");
      who.type = "button";
      who.addEventListener("click", () => window.openCollaboratorPage?.(w.id));
      who.append(personBadge(w.nombre), h("span", null, w.nombre));
      row.appendChild(who);
      let weekTotal = 0, weekPending = 0;
      keys.forEach((k) => {
        const cell = h("span", "ws-cell" + (k === today ? " is-today" : ""));
        const items = all.filter((t) => t.trabajadorId === w.id && t.fecha === k);
        const sum = items.reduce((a, t) => a + hoursOf(t), 0);
        weekTotal += sum;
        const stack = h("span", "ws-stack");
        stack.style.height = `${sum ? Math.max(12, (sum / max) * 100) : 0}%`;
        items.forEach((t) => {
          const seg = h("em", t.estado === "pendiente" ? "is-pending" : "");
          seg.style.flexGrow = String(hoursOf(t) || 0.01);
          seg.style.setProperty("--c", clientColor(clientOf(t)));
          seg.title = `${clientOf(t)} · ${fmtH(hoursOf(t))}${t.estado === "pendiente" ? " · pendiente" : ""}`;
          if (t.estado === "pendiente") weekPending += hoursOf(t);
          stack.appendChild(seg);
        });
        cell.appendChild(stack);
        if (sum) cell.appendChild(h("small", null, (Math.round(sum * 10) / 10).toString()));
        row.appendChild(cell);
      });
      const tot = h("span", "ws-total");
      tot.append(h("b", null, fmtH(weekTotal)));
      if (weekPending) tot.append(h("small", null, `${fmtH(weekPending)} pendientes`));
      row.appendChild(tot);
      strip.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- Nómina
  function renderPayrollLedger(state) {
    const section = $("adminFinancialSection");
    if (!section) return;
    let ledger = $("payrollLedger");
    if (!ledger) {
      ledger = h("div", "payroll-ledger");
      ledger.id = "payrollLedger";
      insertAfterHead(section, ledger);
      tuckIntoDetails(section, ".liq-table-wrap", "Ver la tabla de liquidaciones con todos los botones");
    }
    if (ledger.offsetParent === null) return;
    const balances = balancesFromPage();
    const workers = state.workers || [];
    const rows = workers.map((w) => {
      const earned = (state.tasks || []).filter((t) => t.trabajadorId === w.id && isApproved(t)).reduce((a, t) => a + (Number(t.costoTotal) || 0), 0);
      const paid = (state.payments || []).filter((p) => p.trabajadorId === w.id).reduce((a, p) => a + (Number(p.monto) || 0), 0);
      const bal = balances.get(w.id)?.balance ?? Number((earned - paid).toFixed(2));
      return { w, earned, paid, bal };
    });
    const sig = JSON.stringify(rows.map((r) => [r.w.id, r.earned, r.paid, r.bal]));
    if (ledger.dataset.sig === sig) return;
    ledger.dataset.sig = sig;
    ledger.replaceChildren();
    const max = Math.max(1, ...rows.map((r) => Math.max(r.earned, r.paid)));
    rows.forEach((r) => {
      const card = h("article", "pl-card");
      const head = h("button", "pl-head");
      head.type = "button";
      head.addEventListener("click", () => window.openCollaboratorPage?.(r.w.id));
      const nm = h("span", "board-name");
      const rate = Number(r.w.tarifaHora) || 0;
      nm.append(h("b", null, r.w.nombre), h("small", null, rate > 0 ? `$${rate.toFixed(2)}/h` : "Sin tarifa"));
      head.append(personBadge(r.w.nombre), nm);
      const flow = h("div", "pl-flow");
      const bar = (cls, label, value) => {
        const b = h("div", "pl-bar " + cls);
        const fill = h("span");
        fill.style.width = `${Math.max(value > 0 ? 6 : 0, (value / max) * 100)}%`;
        b.append(h("small", null, label), fill, h("b", null, fmtUsd(value)));
        return b;
      };
      flow.append(bar("is-earned", "Causado", r.earned), bar("is-paid", "Pagado", r.paid));
      const foot = h("div", "pl-foot" + (r.bal > 0 ? " has-debt" : ""));
      const ow = h("div");
      ow.append(h("small", null, r.bal >= 0 ? "Saldo por pagar" : "Anticipo a favor"), h("b", null, fmtUsd(Math.abs(r.bal))));
      const actions = h("div", "pl-actions");
      const rec = h("button", "pl-ghost");
      rec.type = "button";
      rec.innerHTML = '<i class="fa-solid fa-file-invoice-dollar" aria-hidden="true"></i><span>Cuenta de cobro</span>';
      rec.addEventListener("click", () => window.openStatementModal?.(r.w.id));
      const pay = h("button", "lane-pay");
      pay.type = "button";
      pay.disabled = !(r.bal > 0);
      pay.innerHTML = '<i class="fa-solid fa-money-bill-transfer" aria-hidden="true"></i><span>Pagar</span>';
      pay.addEventListener("click", () => window.quickPayWorker?.(r.w.id, r.w.nombre, r.bal));
      actions.append(rec, pay);
      foot.append(ow, actions);
      card.append(head, flow, foot);
      ledger.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- Clientes
  function clientRows(state) {
    return (state.clients || []).map((c) => {
      const norm = (c.nombre || "").trim().toLowerCase();
      const tasks = (state.tasks || []).filter((t) => (t.cliente || "").trim().toLowerCase() === norm && isApproved(t));
      const hours = tasks.reduce((a, t) => a + (Number(t.horas) || 0), 0);
      const cost = tasks.reduce((a, t) => a + (Number(t.costoTotal) || 0), 0);
      const rate = Number(c.tarifaPorHora) || 0;
      const revenue = hours * rate;
      return { c, hours, cost, rate, revenue, margin: revenue - cost, limit: Number(c.limiteHoras) || 0, color: clientColor(c.nombre) };
    });
  }

  function renderClientBoard(state) {
    const section = $("adminClientsSection");
    if (!section) return;
    let board = $("clientBoard");
    if (!board) {
      board = h("div", "client-board");
      board.id = "clientBoard";
      insertAfterHead(section, board);
      const wrap = section.querySelector("#clientsTableBody")?.closest(".overflow-x-auto, .liq-table-wrap, .desktop-table, table");
      if (wrap) {
        if (!wrap.id) wrap.dataset.rawTable = "clientes";
        tuckIntoDetails(section, wrap.id ? `#${wrap.id}` : '[data-raw-table="clientes"]', "Ver la tabla de clientes");
      }
    }
    if (board.offsetParent === null) return;
    const rows = clientRows(state);
    const sig = JSON.stringify(rows.map((r) => [r.c.id, r.c.nombre, r.hours, r.cost, r.rate, r.limit]));
    if (board.dataset.sig === sig) return;
    board.dataset.sig = sig;
    board.replaceChildren();
    if (!rows.length) {
      board.appendChild(h("p", "empty-note", "Todavía no hay clientes. Créalos con “Nuevo cliente” o sincronízalos desde las tareas."));
      return;
    }
    rows.sort((a, b) => b.revenue - a.revenue).forEach((r) => {
      const card = h("article", "cb-card");
      card.style.setProperty("--client", r.color);
      const head = h("div", "cb-head");
      const name = h("div", "cb-name");
      name.append(h("b", null, r.c.nombre), h("small", null, r.rate > 0 ? `$${r.rate.toFixed(2)}/h facturable${r.c.notas ? " · " + r.c.notas : ""}` : "Sin tarifa de cobro"));
      const acts = h("div", "cb-acts");
      const ed = h("button", "pl-ghost");
      ed.type = "button";
      ed.setAttribute("aria-label", `Editar ${r.c.nombre}`);
      ed.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i>';
      ed.addEventListener("click", () => window.openClientModal?.(r.c.id));
      const del = h("button", "pl-ghost is-danger");
      del.type = "button";
      del.setAttribute("aria-label", `Eliminar ${r.c.nombre}`);
      del.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
      del.addEventListener("click", () => window.deleteClient?.(r.c.id, r.c.nombre));
      acts.append(ed, del);
      head.append(h("i", "cb-chip"), name, acts);
      const pkg = h("div", "cb-pkg");
      const pct = r.limit ? Math.round((r.hours / r.limit) * 100) : 0;
      const track = h("span", "cb-track" + (pct > 100 ? " is-over" : ""));
      const fill = h("span");
      fill.style.width = `${r.limit ? Math.min(100, pct) : (r.hours ? 100 : 0)}%`;
      track.appendChild(fill);
      pkg.append(h("small", null, r.limit ? `Paquete: ${fmtH(r.hours)} de ${r.limit} h · ${pct} %` : `${fmtH(r.hours)} aprobadas · sin paquete`), track);
      const money = h("div", "cb-money");
      const split = h("span", "cb-split");
      const total = Math.max(r.revenue, r.cost, 0.01);
      const costSeg = h("span", "is-cost");
      costSeg.style.width = `${(r.cost / total) * 100}%`;
      const marginSeg = h("span", r.margin >= 0 ? "is-margin" : "is-loss");
      marginSeg.style.width = `${(Math.abs(r.margin) / total) * 100}%`;
      split.append(costSeg, marginSeg);
      const figs = h("div", "cb-figs");
      const f = (label, value, cls) => { const d = h("div", cls || ""); d.append(h("small", null, label), h("b", null, fmtUsd(value))); return d; };
      figs.append(f("Facturación", r.revenue), f("Costo nómina", r.cost, "is-cost"), f(r.margin >= 0 ? "Margen" : "Pérdida", Math.abs(r.margin), r.margin >= 0 ? "is-margin" : "is-loss"));
      money.append(split, figs);
      card.append(head, pkg, money);
      board.appendChild(card);
    });
  }

  function renderMarginBubbles(state) {
    const section = $("adminReportsSection");
    if (!section) return;
    let field = $("marginBubbles");
    if (!field) {
      const wrap = h("div", "bubbles-tile");
      wrap.setAttribute("aria-label", "Clientes según su margen");
      field = h("div", "bubble-field");
      field.id = "marginBubbles";
      wrap.appendChild(field);
      insertAfterHead(section, wrap);
    }
    if (field.offsetParent === null) return;
    const rows = clientRows(state).filter((r) => r.revenue > 0 || r.hours > 0).sort((a, b) => b.margin - a.margin);
    const sig = JSON.stringify(rows.map((r) => [r.c.nombre, r.margin, r.hours]));
    if (field.dataset.sig === sig) return;
    field.dataset.sig = sig;
    field.replaceChildren();
    if (!rows.length) { field.appendChild(h("p", "empty-note", "Aún no hay horas aprobadas con clientes.")); return; }
    const maxM = Math.max(1, ...rows.map((r) => Math.abs(r.margin)));
    rows.forEach((r, i) => {
      const size = 96 + Math.sqrt(Math.abs(r.margin) / maxM) * 120;
      const b = h("button", "bubble" + (r.margin < 0 ? " is-loss" : ""));
      b.type = "button";
      b.style.setProperty("--client", r.color);
      b.style.setProperty("--size", `${Math.round(size)}px`);
      b.style.setProperty("--i", String(i));
      b.setAttribute("aria-label", `${r.c.nombre}: margen ${fmtUsd(r.margin)}, ${fmtH(r.hours)}`);
      b.addEventListener("click", () => window.openClientModal?.(r.c.id));
      b.append(h("b", null, r.c.nombre), h("span", null, `${r.margin >= 0 ? "+" : "−"}${fmtUsd(Math.abs(r.margin))}`), h("small", null, fmtH(r.hours)));
      field.appendChild(b);
    });
  }

  // ---------------------------------------------------------------- Equipo
  function renderPeopleCards(state) {
    const section = $("adminTeamSection");
    if (!section) return;
    let grid = $("peopleCards");
    if (!grid) {
      grid = h("div", "people-cards");
      grid.id = "peopleCards";
      const head = section.querySelector(":scope > div > div:first-child");
      head ? head.insertAdjacentElement("afterend", grid) : section.prepend(grid);
    }
    if (grid.offsetParent === null) return;
    const keys = new Set(weekKeys());
    const workers = state.workers || [];
    const sig = JSON.stringify(workers.map((w) => [w.id, w.nombre, w.email, w.tarifaHora, w.tarifaArte, w.ownerUid, w.metaSemanal, (state.tasks || []).filter((t) => t.trabajadorId === w.id && keys.has(t.fecha)).length]));
    if (grid.dataset.sig === sig) return;
    grid.dataset.sig = sig;
    grid.replaceChildren();
    workers.forEach((w) => {
      const card = h("article", "pc-card");
      const week = (state.tasks || []).filter((t) => t.trabajadorId === w.id && keys.has(t.fecha) && !isRejected(t));
      const hours = week.reduce((a, t) => a + hoursOf(t), 0);
      const by = new Map();
      week.forEach((t) => by.set(clientOf(t), (by.get(clientOf(t)) || 0) + hoursOf(t)));
      const goal = Number(w.metaSemanal) || 20;
      const top = h("div", "pc-top");
      const nm = h("div", "board-name");
      nm.append(h("b", null, w.nombre), h("small", null, w.email || "Sin correo"));
      top.append(personBadge(w.nombre), nm, h("span", "pc-status" + (w.ownerUid ? " has-account" : ""), w.ownerUid ? "Con cuenta" : "Solo datos"));
      const mid = h("div", "lane-week");
      mid.append(miniRing(hours, goal, [...by.entries()].map(([n, v]) => ({ value: v, color: clientColor(n) })), "#12122A"));
      const sw = h("div");
      sw.append(h("b", null, fmtH(hours)), h("small", null, `de ${goal} h esta semana`));
      mid.appendChild(sw);
      const rate = Number(w.tarifaHora) || 0, art = Number(w.tarifaArte) || 0;
      const acts = h("div", "pc-acts");
      const rateBtn = h("button", "pl-ghost");
      rateBtn.type = "button";
      rateBtn.innerHTML = `<i class="fa-solid fa-pen" aria-hidden="true"></i><span>${rate > 0 ? `$${rate.toFixed(2)}/h` : "Asignar tarifa"}${art > 0 ? ` · $${art.toFixed(2)}/arte` : ""}</span>`;
      rateBtn.addEventListener("click", () => window.openEditRateModal?.(w.id, w.nombre, rate, art));
      const prof = h("button", "lane-pay");
      prof.type = "button";
      prof.innerHTML = '<i class="fa-solid fa-user" aria-hidden="true"></i><span>Perfil</span>';
      prof.addEventListener("click", () => window.openCollaboratorPage?.(w.id));
      acts.append(rateBtn, prof);
      card.append(top, mid, acts);
      grid.appendChild(card);
    });
  }

  function renderBadge(state) {
    const b = $("adminTabPendingBadge");
    if (!b) return;
    const n = (state.tasks || []).filter((t) => t.estado === "pendiente").length;
    b.textContent = n ? String(n) : "";
    b.hidden = !n;
  }

  function renderAll() {
    if (!isAdmin()) return;
    const state = getState();
    if (!state) return;
    ensureShell();
    if (!document.documentElement.dataset.aview) setAdminView("inicio");
    try { renderRiver(); } catch (e) { console.warn("[río]", e); }
    try { renderLanes(state); } catch (e) { console.warn("[carriles]", e); }
    try { renderConstellation(state); } catch (e) { console.warn("[constelación]", e); }
    try { renderBadge(state); } catch (e) { /* sin efecto */ }
    try { renderApprovalBoard(state); } catch (e) { console.warn("[aprobar]", e); }
    try { renderWeekStrip(state); } catch (e) { console.warn("[semana]", e); }
    try { renderPayrollLedger(state); } catch (e) { console.warn("[nómina]", e); }
    try { renderClientBoard(state); } catch (e) { console.warn("[clientes]", e); }
    try { renderMarginBubbles(state); } catch (e) { console.warn("[burbujas]", e); }
    try { renderPeopleCards(state); } catch (e) { console.warn("[equipo]", e); }
  }

  function wire() {
    document.querySelectorAll("#appSidebar .sidebar-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        if (!isAdmin()) return;
        const nav = link.dataset.nav;
        if (nav === "dashboard") setAdminView("inicio", true);
      });
    });
    document.querySelector('#mobileTabbar .admin-only-feature[data-tab-nav="dashboard"]')?.addEventListener("click", () => { if (isAdmin()) setAdminView("inicio", true); });
  }

  function start() {
    wire();
    renderAll();
    setInterval(renderAll, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
