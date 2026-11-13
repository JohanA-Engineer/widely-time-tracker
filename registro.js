/* ==============================================================================
   Time Tracker — Registrar horas (página propia)
   Formulario a la izquierda y "así quedará" a la derecha. No guarda nada por su
   cuenta: llena el formulario original #formManualEntry y lo envía, así las
   validaciones, el estado (aprobada / pendiente) y los avisos siguen siendo los
   de app.js. Lee el estado por window.__tt (solo lectura).
   ============================================================================== */
(function () {
  "use strict";

  const CLIENTS = ["#6D4BFF", "#FF5A5F", "#12B5A6", "#FF9F1C", "#2E86FF", "#C94BD8", "#3FAE4F", "#E8A400"];
  const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const $ = (id) => document.getElementById(id);
  const getState = () => (window.__tt && window.__tt.state) || null;
  const trm = () => Number(window.__tt && window.__tt.trm) || 0;
  const isWorkerRole = () => getState()?.userProfile?.rol === "worker";

  const form = {
    mode: "horas", workerId: "", date: "", hours: 1, artCount: 1, artRate: "", artHours: "",
    client: "", category: "", description: "", search: "",
  };
  let view = null;
  let saving = false;

  /* ---------- utilidades ---------- */
  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(cls) {
    const i = h("i", cls);
    i.setAttribute("aria-hidden", "true");
    return i;
  }
  function colorFor(name) {
    const key = String(name || "General").trim().toLowerCase();
    let x = 0;
    for (let i = 0; i < key.length; i++) x = (x * 31 + key.charCodeAt(i)) >>> 0;
    return CLIENTS[x % CLIENTS.length];
  }
  const initials = (name) => String(name || "C").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "C";
  const usd = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cop = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-CO")} COP`;
  const fmtH = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} h`;
  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function parseKey(k) {
    const [y, m, d] = String(k || "").split("-").map(Number);
    return y ? new Date(y, m - 1, d) : new Date();
  }
  function longDate(k) {
    const d = parseKey(k);
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  }
  function weekOf(k) {
    const base = parseKey(k);
    const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  }
  const hoursOf = (t) => {
    const x = Number(t.horas);
    if (Number.isFinite(x) && x > 0) return x;
    const s = Number(t.segundos);
    return Number.isFinite(s) && s > 0 ? s / 3600 : 0;
  };
  const isRejected = (t) => t.estado === "rechazada" || t.aprobada === false;

  function workers() {
    const s = getState();
    const list = (s?.workers || []).slice();
    if (isWorkerRole()) {
      const id = s?.userProfile?.trabajadorId;
      return list.filter((w) => w.id === id);
    }
    return list;
  }
  const currentWorker = () => workers().find((w) => w.id === form.workerId) || null;

  function categories() {
    const sel = $("manualCategory");
    return sel ? [...sel.options].map((o) => ({ value: o.value, label: o.textContent.trim() })) : [];
  }
  function clientNames() {
    const s = getState();
    const names = new Set((s?.clients || []).map((c) => String(c.nombre || "").trim()).filter(Boolean));
    // Clientes usados recientemente por la persona elegida (o por el equipo)
    (s?.tasks || []).slice(0, 200).forEach((t) => {
      const n = String(t.cliente || "").trim();
      if (n && names.size < 14) names.add(n);
    });
    return [...names];
  }

  function calc() {
    const w = currentWorker();
    if (form.mode === "artes") {
      const count = Math.max(0, parseInt(form.artCount, 10) || 0);
      const own = Number(w?.tarifaArte || 0);
      const typed = parseFloat(form.artRate);
      const rate = (!isWorkerRole() && typed > 0) ? typed : own;
      const typedH = parseFloat(form.artHours);
      const hours = typedH > 0 ? typedH : Number((count * 0.5).toFixed(2));
      return { cost: count * rate, rate, units: count, hours, detail: rate > 0 ? `${count} arte${count === 1 ? "" : "s"} × ${usd(rate)}` : "Sin tarifa por arte" };
    }
    const hours = Math.max(0, Number(form.hours) || 0);
    const rate = Number(w?.tarifaHora || 0);
    return { cost: hours * rate, rate, units: hours, hours, detail: rate > 0 ? `${fmtH(hours)} × ${usd(rate)}/h` : (w ? `${w.nombre} no tiene tarifa por hora` : "Elige quién trabajó") };
  }

  /* ---------- estructura ---------- */
  function section(labelText, forId, extra) {
    const s = h("div", "rh-field");
    const head = h("div", "rh-label");
    const l = h(forId ? "label" : "span", "", labelText);
    if (forId) l.htmlFor = forId;
    head.appendChild(l);
    if (extra) head.appendChild(extra);
    s.appendChild(head);
    return s;
  }

  function build() {
    view = $("registroHorasView");
    if (!view) return;
    view.innerHTML = "";
    view.setAttribute("role", "region");

    const grid = h("div", "rh-grid");
    const main = h("form", "rh-form tile-surface");
    main.noValidate = true;
    main.addEventListener("submit", (e) => { e.preventDefault(); save(false); });

    const head = h("div", "rh-head");
    const title = h("h1", "rh-title", "Registrar horas");
    title.id = "rhTitle";
    const seg = h("div", "rh-seg");
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", "Cómo se cobra");
    [["horas", "Por horas", "fa-solid fa-clock"], ["artes", "Por artes", "fa-solid fa-palette"]].forEach(([v, t, ic]) => {
      const b = h("button", "rh-seg-btn");
      b.type = "button";
      b.dataset.mode = v;
      b.setAttribute("role", "radio");
      b.append(icon(ic), h("span", "", t));
      b.addEventListener("click", () => { form.mode = v; if (v === "artes" && !form.category) form.category = "diseno"; refresh(); });
      seg.appendChild(b);
    });
    head.append(title, seg);
    main.appendChild(head);

    // Quién
    const searchWrap = h("label", "rh-search");
    searchWrap.append(icon("fa-solid fa-magnifying-glass"));
    const search = h("input");
    search.type = "search"; search.id = "rhSearch"; search.placeholder = "Buscar"; search.autocomplete = "off";
    search.setAttribute("aria-label", "Buscar colaborador");
    search.addEventListener("input", () => { form.search = search.value; renderPeople(); });
    searchWrap.appendChild(search);
    const who = section("¿Quién trabajó?", null, searchWrap);
    who.id = "rhWhoField";
    const people = h("div", "rh-people");
    people.id = "rhPeople";
    people.setAttribute("role", "radiogroup");
    people.setAttribute("aria-label", "Colaborador");
    who.appendChild(people);
    main.appendChild(who);

    // Día + cantidad
    const row = h("div", "rh-row");
    const otherDate = h("label", "rh-other-date");
    const dateInput = h("input");
    dateInput.type = "date"; dateInput.id = "rhDate";
    dateInput.setAttribute("aria-label", "Otra fecha");
    dateInput.addEventListener("click", () => { try { dateInput.showPicker(); } catch (_) { /* el navegador abre el suyo */ } });
    dateInput.addEventListener("change", () => { if (dateInput.value) { form.date = dateInput.value; refresh(); } });
    otherDate.append(icon("fa-regular fa-calendar"), h("span", "", "Otra fecha"), dateInput);
    const day = section("Día", null, otherDate);
    const days = h("div", "rh-days");
    days.id = "rhDays";
    day.appendChild(days);

    const qty = h("div", "rh-field");
    qty.id = "rhQty";
    row.append(day, qty);
    main.appendChild(row);

    // Cliente
    const clientInputWrap = h("div", "rh-client-other");
    const clientInput = h("input");
    clientInput.type = "text"; clientInput.id = "rhClientOther"; clientInput.maxLength = 120;
    clientInput.placeholder = "Otro cliente…"; clientInput.setAttribute("list", "clientsDatalist");
    clientInput.setAttribute("aria-label", "Otro cliente");
    clientInput.addEventListener("input", () => { form.client = clientInput.value; renderClients(false); renderReceipt(); });
    clientInputWrap.appendChild(clientInput);
    const client = section("Cliente");
    const chips = h("div", "rh-chips");
    chips.id = "rhClients";
    client.append(chips, clientInputWrap);
    main.appendChild(client);

    // Categoría
    const cat = section("Categoría");
    const catChips = h("div", "rh-chips");
    catChips.id = "rhCats";
    cat.appendChild(catChips);
    main.appendChild(cat);

    // Descripción
    const desc = section("Descripción", "rhDesc");
    const ta = h("textarea", "rh-input");
    ta.id = "rhDesc"; ta.rows = 2; ta.maxLength = 1000;
    ta.placeholder = "Ej. Diseño de 4 posts para feed y 2 historias";
    ta.addEventListener("input", () => { form.description = ta.value; clearError(); });
    desc.appendChild(ta);
    main.appendChild(desc);

    const err = h("p", "rh-error");
    err.id = "rhError";
    err.setAttribute("role", "alert");
    main.appendChild(err);

    // Así quedará
    const side = h("aside", "rh-receipt tile-surface");
    side.setAttribute("aria-label", "Así quedará");
    side.innerHTML =
      '<div class="rh-who" id="rhReceiptWho"></div>' +
      '<div class="rh-money"><span class="rh-money-label">Costo de esta actividad</span>' +
      '<b class="rh-money-big" id="rhCost">$0.00</b><span class="rh-money-calc" id="rhCalc"></span></div>' +
      '<div class="rh-dayline"><div class="rh-dayline-head"><span>Su día con esta actividad</span><b id="rhDayTotal">0 h</b></div>' +
      '<div class="rh-daybar" id="rhDayBar"></div><div class="rh-dayline-foot"><span id="rhDayBefore"></span><span id="rhDayNew"></span></div></div>' +
      '<p class="rh-status" id="rhStatus"></p>';
    const actions = h("div", "rh-actions");
    const saveBtn = h("button", "rh-btn is-ink");
    saveBtn.type = "button"; saveBtn.id = "rhSave";
    saveBtn.append(icon("fa-solid fa-check"), h("span", "", "Guardar actividad"));
    saveBtn.addEventListener("click", () => save(false));
    const againBtn = h("button", "rh-btn is-soft");
    againBtn.type = "button"; againBtn.id = "rhSaveAgain";
    againBtn.append(icon("fa-solid fa-plus"), h("span", "", "Guardar y registrar otra"));
    againBtn.addEventListener("click", () => save(true));
    actions.append(saveBtn, againBtn);
    side.appendChild(actions);

    grid.append(main, side);
    view.appendChild(grid);

    // Barra fija en celular
    const bar = h("div", "rh-mbar");
    bar.innerHTML = '<div class="rh-mbar-text"><b id="rhBarCost">$0.00</b><small id="rhBarMeta"></small></div>';
    const barBtn = h("button", "rh-btn is-ink");
    barBtn.type = "button"; barBtn.id = "rhBarSave";
    barBtn.append(h("span", "", "Guardar"));
    barBtn.addEventListener("click", () => save(false));
    bar.appendChild(barBtn);
    view.appendChild(bar);
  }

  /* ---------- pintar ---------- */
  function renderMode() {
    view.querySelectorAll(".rh-seg-btn").forEach((b) => {
      const on = b.dataset.mode === form.mode;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function renderPeople() {
    const box = $("rhPeople");
    const field = $("rhWhoField");
    if (!box) return;
    const list = workers();
    const worker = isWorkerRole();
    field.classList.toggle("is-self", worker);
    field.querySelector(".rh-label span").textContent = worker ? "Registras a tu nombre" : "¿Quién trabajó?";
    field.querySelector(".rh-search").hidden = worker || list.length <= 6;
    box.innerHTML = "";
    const q = form.search.trim().toLowerCase();
    const shown = list.filter((w) => !q || String(w.nombre || "").toLowerCase().includes(q));
    if (!list.length) {
      const empty = h("p", "rh-empty", worker ? "Tu ficha de colaborador aún no está vinculada. Pídele a la administración que la cree." : "Cargando el equipo…");
      box.appendChild(empty);
      return;
    }
    if (!shown.length) { box.appendChild(h("p", "rh-empty", "Nadie coincide con la búsqueda.")); return; }
    shown.forEach((w) => {
      const b = h("button", "rh-person" + (w.id === form.workerId ? " is-on" : ""));
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", w.id === form.workerId ? "true" : "false");
      const hr = Number(w.tarifaHora || 0), ar = Number(w.tarifaArte || 0);
      const rates = [hr > 0 ? `${usd(hr)}/h` : "", ar > 0 ? `${usd(ar)}/arte` : ""].filter(Boolean).join(" · ") || "Sin tarifa";
      const txt = h("span", "rh-person-text");
      txt.append(h("b", "", w.nombre || "Colaborador"), h("small", "", rates));
      b.append(h("span", "rh-badge", initials(w.nombre)), txt);
      b.addEventListener("click", () => { selectWorker(w.id); refresh(); });
      box.appendChild(b);
    });
  }

  function selectWorker(id) {
    form.workerId = id;
    const w = currentWorker();
    if (!w) return;
    const hr = Number(w.tarifaHora || 0), ar = Number(w.tarifaArte || 0);
    if (ar > 0 && hr === 0) form.mode = "artes";
    form.artRate = ar > 0 ? ar.toFixed(2) : "";
    clearError();
  }

  function renderDays() {
    const box = $("rhDays");
    if (!box) return;
    box.innerHTML = "";
    const today = dateKey(new Date());
    weekOf(form.date).forEach((d, i) => {
      const k = dateKey(d);
      const b = h("button", "rh-day" + (k === form.date ? " is-on" : "") + (k > today ? " is-future" : "") + (k === today ? " is-today" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", k === form.date ? "true" : "false");
      b.setAttribute("aria-label", longDate(k));
      b.append(h("span", "", DAY_LABELS[i]), h("b", "", String(d.getDate())));
      b.addEventListener("click", () => { form.date = k; refresh(); });
      box.appendChild(b);
    });
    const di = $("rhDate");
    if (di) di.value = form.date;
  }

  function stepper(id, value, step, min, unit, onSet, label) {
    const wrap = h("div", "rh-stepper");
    const minus = h("button", "rh-step", "−");
    minus.type = "button"; minus.setAttribute("aria-label", `Restar ${step}`);
    const plus = h("button", "rh-step", "+");
    plus.type = "button"; plus.setAttribute("aria-label", `Sumar ${step}`);
    const box = h("label", "rh-step-value");
    const input = h("input");
    // Texto con teclado decimal: acepta "2,5" o "2.5" y se ajusta al ancho de la cifra
    input.type = "text"; input.id = id; input.inputMode = "decimal"; input.autocomplete = "off";
    input.value = String(value);
    input.setAttribute("aria-label", label);
    box.append(input, h("small", "", unit));
    const num = () => parseFloat(String(input.value).replace(",", ".")) || 0;
    const fit = () => { input.style.width = `${Math.max(1, String(input.value).length) * 0.62 + 0.2}em`; };
    const set = (v) => { const n = Math.max(min, Math.round(v * 100) / 100); input.value = String(n); fit(); onSet(n); };
    minus.addEventListener("click", () => set(num() - step));
    plus.addEventListener("click", () => set(num() + step));
    input.addEventListener("input", () => { fit(); onSet(Math.max(min, num())); });
    fit();
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") { e.preventDefault(); set(num() + step); }
      if (e.key === "ArrowDown") { e.preventDefault(); set(num() - step); }
    });
    wrap.append(minus, box, plus);
    return wrap;
  }

  function renderQty() {
    const box = $("rhQty");
    if (!box) return;
    box.innerHTML = "";
    if (form.mode === "artes") {
      const head = h("div", "rh-label");
      head.appendChild(h("label", "", "Artes entregadas"));
      head.querySelector("label").htmlFor = "rhArtCount";
      box.append(head, stepper("rhArtCount", form.artCount, 1, 0, form.artCount === 1 ? "arte" : "artes", (n) => { form.artCount = Math.round(n); renderReceipt(); }, "Cantidad de artes"));
      const more = h("div", "rh-art-more");
      if (!isWorkerRole()) {
        const rate = h("label", "rh-mini");
        rate.append(h("span", "", "Tarifa por arte"));
        const ri = h("input", "rh-input");
        ri.type = "number"; ri.step = "any"; ri.min = "0"; ri.inputMode = "decimal"; ri.placeholder = "0.00"; ri.value = form.artRate;
        ri.addEventListener("input", () => { form.artRate = ri.value; renderReceipt(); });
        rate.appendChild(ri);
        more.appendChild(rate);
      }
      const hrs = h("label", "rh-mini");
      hrs.append(h("span", "", "Tiempo aproximado (opcional)"));
      const hi = h("input", "rh-input");
      hi.type = "number"; hi.step = "any"; hi.min = "0"; hi.inputMode = "decimal"; hi.placeholder = "Horas"; hi.value = form.artHours;
      hi.addEventListener("input", () => { form.artHours = hi.value; renderReceipt(); });
      hrs.appendChild(hi);
      more.appendChild(hrs);
      box.appendChild(more);
      return;
    }
    const head = h("div", "rh-label");
    const l = h("label", "", "Horas trabajadas");
    l.htmlFor = "rhHours";
    head.appendChild(l);
    box.append(head, stepper("rhHours", form.hours, 0.25, 0, "h", (n) => { form.hours = n; syncQuick(); renderReceipt(); }, "Horas trabajadas"));
    const quick = h("div", "rh-quick");
    quick.id = "rhQuick";
    [0.5, 1, 2, 4, 8].forEach((v) => {
      const b = h("button", "rh-quick-btn", String(v));
      b.type = "button";
      b.dataset.v = String(v);
      b.setAttribute("aria-label", `${v} horas`);
      b.addEventListener("click", () => {
        const i = $("rhHours");
        if (i) { i.value = String(v); i.dispatchEvent(new Event("input")); }
        else { form.hours = v; syncQuick(); renderReceipt(); }
      });
      quick.appendChild(b);
    });
    box.appendChild(quick);
    syncQuick();
  }
  function syncQuick() {
    $("rhQuick")?.querySelectorAll(".rh-quick-btn").forEach((b) => b.classList.toggle("is-on", Number(b.dataset.v) === Number(form.hours)));
  }

  function renderClients(rebuildInput = true) {
    const box = $("rhClients");
    if (!box) return;
    box.innerHTML = "";
    const names = clientNames();
    names.forEach((n) => {
      const on = form.client.trim().toLowerCase() === n.toLowerCase();
      const b = h("button", "rh-chip" + (on ? " is-on" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      const sq = h("i", "rh-sq");
      sq.style.background = colorFor(n);
      b.append(sq, h("span", "", n));
      b.addEventListener("click", () => { form.client = on ? "" : n; renderClients(); renderReceipt(); });
      box.appendChild(b);
    });
    if (!names.length) box.appendChild(h("p", "rh-empty", "Aún no hay clientes guardados: escríbelo abajo."));
    const other = $("rhClientOther");
    if (other && rebuildInput) {
      const isListed = names.some((n) => n.toLowerCase() === form.client.trim().toLowerCase());
      other.value = isListed ? "" : form.client;
    }
  }

  function renderCats() {
    const box = $("rhCats");
    if (!box) return;
    box.innerHTML = "";
    categories().forEach((c) => {
      const on = c.value === form.category;
      const b = h("button", "rh-chip" + (on ? " is-on" : ""), c.label);
      b.type = "button";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.addEventListener("click", () => { form.category = c.value; renderCats(); });
      box.appendChild(b);
    });
  }

  function renderReceipt() {
    const w = currentWorker();
    const c = calc();
    const who = $("rhReceiptWho");
    if (!who) return;
    who.innerHTML = "";
    if (w) {
      const t = h("div", "rh-who-text");
      t.append(h("b", "", w.nombre || "Colaborador"), h("small", "", longDate(form.date)));
      who.append(h("span", "rh-badge", initials(w.nombre)), t);
    } else {
      const t = h("div", "rh-who-text");
      t.append(h("b", "", "Elige quién trabajó"), h("small", "", longDate(form.date)));
      who.append(h("span", "rh-badge is-empty", "?"), t);
    }
    $("rhCost").textContent = usd(c.cost);
    const rate = trm();
    $("rhCalc").textContent = c.cost > 0 && rate > 0 ? `${c.detail} · ≈ ${cop(c.cost * rate)}` : c.detail;

    // El día de esa persona
    const s = getState();
    const done = (s?.tasks || []).filter((t) => w && t.trabajadorId === w.id && t.fecha === form.date && !isRejected(t));
    const byClient = new Map();
    done.forEach((t) => {
      const n = String(t.cliente || "").trim() || "General";
      byClient.set(n, (byClient.get(n) || 0) + hoursOf(t));
    });
    const before = [...byClient.values()].reduce((a, b) => a + b, 0);
    const add = c.hours > 0 ? c.hours : 0;
    const total = before + add;
    const scale = Math.max(8, total);
    const bar = $("rhDayBar");
    bar.innerHTML = "";
    byClient.forEach((v, n) => {
      const seg = h("em");
      seg.style.flex = String(v / scale);
      seg.style.background = colorFor(n);
      seg.title = `${n}: ${fmtH(v)}`;
      bar.appendChild(seg);
    });
    if (add > 0) {
      const seg = h("em", isWorkerRole() ? "is-new is-pending" : "is-new is-approved");
      seg.style.flex = String(add / scale);
      bar.appendChild(seg);
    }
    const rest = h("em", "is-rest");
    rest.style.flex = String(Math.max(0, scale - total) / scale);
    bar.appendChild(rest);
    $("rhDayTotal").textContent = fmtH(total);
    $("rhDayBefore").textContent = before > 0 ? `${fmtH(before)} ya registradas` : "Sin horas ese día";
    $("rhDayNew").textContent = add > 0 ? `+${fmtH(add)} nuevas` : "";

    const st = $("rhStatus");
    const pending = isWorkerRole();
    st.className = "rh-status " + (pending ? "is-pending" : "is-approved");
    st.innerHTML = "";
    st.append(icon(pending ? "fa-regular fa-hourglass-half" : "fa-solid fa-circle-check"),
      h("span", "", pending ? "Quedará pendiente de aprobación" : "Quedará aprobada y sumará a la nómina"));

    $("rhBarCost").textContent = usd(c.cost);
    const unit = form.mode === "artes" ? `${c.units} arte${c.units === 1 ? "" : "s"}` : fmtH(c.units);
    $("rhBarMeta").textContent = [unit, w ? (w.nombre || "").split(" ")[0] : "", DAY_LABELS[(parseKey(form.date).getDay() + 6) % 7] + " " + parseKey(form.date).getDate()].filter(Boolean).join(" · ");
  }

  function refresh() {
    if (!view || view.classList.contains("hidden")) return;
    renderMode();
    renderPeople();
    renderDays();
    renderQty();
    renderClients();
    renderCats();
    renderReceipt();
  }

  /* ---------- errores ---------- */
  function showError(msg, focusId) {
    const e = $("rhError");
    if (e) e.textContent = msg;
    if (focusId) $(focusId)?.focus({ preventScroll: false });
  }
  function clearError() {
    const e = $("rhError");
    if (e) e.textContent = "";
  }

  /* ---------- guardar con el formulario original ---------- */
  function setVal(id, v) {
    const el = $(id);
    if (el) el.value = v;
  }

  function save(again) {
    if (saving) return;
    const worker = isWorkerRole();
    const w = currentWorker();
    if (!w && !worker) { showError("Elige quién trabajó.", null); $("rhPeople")?.querySelector("button")?.focus(); return; }
    if (form.mode === "horas" && !(Number(form.hours) > 0)) { showError("Escribe cuántas horas trabajó (por ejemplo 2.5).", "rhHours"); return; }
    if (form.mode === "artes" && !(parseInt(form.artCount, 10) > 0)) { showError("Escribe cuántas artes entregó (mínimo 1).", "rhArtCount"); return; }
    if (!form.description.trim()) { showError("Describe la actividad para poder guardarla.", "rhDesc"); return; }
    clearError();

    const select = $("manualWorkerSelect");
    const fm = $("formManualEntry");
    if (!fm) return;
    if (typeof window.setManualEntryMode === "function") window.setManualEntryMode(form.mode);
    if (select && w) {
      if (![...select.options].some((o) => o.value === w.id)) {
        const o = document.createElement("option");
        o.value = w.id; o.textContent = w.nombre || "Colaborador";
        select.appendChild(o);
      }
      select.value = w.id;
    }
    setVal("manualDate", form.date);
    setVal("manualHours", form.mode === "horas" ? String(form.hours) : "");
    setVal("manualArtCount", form.mode === "artes" ? String(parseInt(form.artCount, 10) || 0) : "");
    setVal("manualArtRateInput", form.mode === "artes" ? form.artRate : "");
    setVal("manualArtHours", form.mode === "artes" ? form.artHours : "");
    setVal("manualClientProject", form.client.trim());
    const cat = $("manualCategory");
    if (cat && form.category) cat.value = form.category;
    setVal("manualDescription", form.description.trim());

    saving = true;
    view.classList.add("is-saving");
    if (typeof fm.requestSubmit === "function") fm.requestSubmit();
    else fm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    // app.js limpia el formulario original solo cuando guardó con éxito
    const started = Date.now();
    const check = () => {
      const desc = $("manualDescription");
      if (desc && desc.value === "") { done(true); return; }
      if (Date.now() - started > 8000) { done(false); return; }
      setTimeout(check, 120);
    };
    const done = (ok) => {
      saving = false;
      view.classList.remove("is-saving");
      if (!ok) return; // app.js ya mostró el aviso de qué faltó
      form.description = "";
      const ta = $("rhDesc");
      if (ta) ta.value = "";
      if (again) {
        form.hours = 1; form.artCount = 1; form.artHours = "";
        refresh();
        flash();
        $(form.mode === "artes" ? "rhArtCount" : "rhHours")?.focus();
      } else {
        close(true);
      }
    };
    setTimeout(check, 150);
  }

  function flash() {
    const r = view?.querySelector(".rh-receipt");
    if (!r) return;
    r.classList.remove("is-saved");
    void r.offsetWidth;
    r.classList.add("is-saved");
  }

  /* ---------- abrir / cerrar ---------- */
  const PORTALS = ["adminPortalView", "workerPortalView", "collaboratorPageView", "profilePageView"];

  function open(opts = {}) {
    if (!document.documentElement.classList.contains("has-user-session")) return;
    if (!view) build();
    if (!view) return;
    const s = getState();
    if (!form.date) form.date = dateKey(new Date());
    if (!form.category) {
      const sel = $("manualCategory");
      form.category = sel ? ([...sel.options].find((o) => o.defaultSelected)?.value || sel.value || "general") : "general";
    }
    if (isWorkerRole()) form.workerId = s?.userProfile?.trabajadorId || "";
    if (opts.workerId) selectWorker(opts.workerId);
    else if (form.workerId) selectWorker(form.workerId);

    PORTALS.forEach((id) => $(id)?.classList.add("hidden"));
    view.classList.remove("hidden");
    document.documentElement.classList.add("rh-open");
    document.querySelectorAll(".sidebar-nav-link").forEach((l) => l.classList.toggle("active", l.dataset.nav === "registro"));
    document.querySelectorAll("#mobileTabbar button.active").forEach((b) => b.classList.remove("active"));
    clearError();
    refresh();
    window.scrollTo({ top: 0, behavior: "auto" });
    setTimeout(() => $("rhTitle")?.focus?.({ preventScroll: true }), 0);
  }

  function close(backHome) {
    if (!view || view.classList.contains("hidden")) return;
    view.classList.add("hidden");
    document.documentElement.classList.remove("rh-open");
    if (backHome) {
      const home = document.querySelector('.sidebar-nav-link[data-nav="dashboard"]');
      if (home) { home.click(); return; }
    }
    const portal = isWorkerRole() ? "workerPortalView" : "adminPortalView";
    if ($("profilePageView")?.classList.contains("hidden") && $("collaboratorPageView")?.classList.contains("hidden")) {
      $(portal)?.classList.remove("hidden");
    }
  }

  // Entrada desde el menú (rueda de navegación) y salida al ir a cualquier otro lugar
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".sidebar-nav-link");
    if (link) {
      if (link.dataset.nav === "registro") setTimeout(() => open(), 0);
      else close(false);
      return;
    }
    if (!view || view.classList.contains("hidden")) return;
    const leave = e.target.closest('#mobileTabbar button:not([data-tab-click="btnToggleMobileSidebar"]), .avt-btn, #userProfileBar, #btnLogout');
    if (leave) close(false);
  }, true);

  // Los botones "Registrar manual" llevan a esta página
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btnOpenManualEntry, #btnWorkerOpenManualEntry");
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open();
  }, true);

  function wrapGlobal() {
    const original = window.openManualEntryModal;
    if (typeof original !== "function" || original.__rh) return;
    const wrapped = function (workerId) {
      if (typeof workerId === "string" && workerId) open({ workerId });
      else open();
    };
    wrapped.__rh = true;
    wrapped.modal = original;
    window.openManualEntryModal = wrapped;
  }

  // El estado llega por Firestore: repintar mientras la página esté abierta
  let lastSig = "";
  setInterval(() => {
    wrapGlobal();
    if (!view || view.classList.contains("hidden") || saving) return;
    const s = getState();
    const sig = `${s?.workers?.length}|${s?.tasks?.length}|${s?.clients?.length}|${trm()}`;
    if (sig !== lastSig) {
      lastSig = sig;
      if (isWorkerRole() && !form.workerId) form.workerId = s?.userProfile?.trabajadorId || "";
      renderPeople();
      renderClients(false);
      renderReceipt();
    }
  }, 1000);

  window.openRegistroHoras = open;
})();
