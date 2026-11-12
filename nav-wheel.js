/* ==============================================================================
   Time Tracker — La rueda de navegación (reemplaza la barra lateral)
   "Más" en la barra inferior (o Ctrl/⌘ + K) abre los destinos en círculo
   alrededor del avatar, con un buscador "Ir a…". Cada destino hace clic en el
   enlace original del menú (que sigue en la página, oculto), así la navegación,
   las vistas, el tema, el perfil y cerrar sesión funcionan exactamente igual.
   ============================================================================== */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let overlay = null;
  let lastFocus = null;

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Destinos visibles para el rol actual, leídos del menú original.
  function destinations() {
    const sidebar = $("appSidebar");
    if (!sidebar) return [];
    return [...sidebar.querySelectorAll(".sidebar-nav-link")].filter((a) => {
      let el = a;
      while (el && el !== sidebar) {
        if (el.classList.contains("hidden")) return false;
        el = el.parentElement;
      }
      return true;
    }).map((a) => ({
      link: a,
      nav: a.dataset.nav,
      label: (a.querySelector("span")?.textContent || a.textContent || "").trim(),
      icon: a.querySelector("i")?.className.replace(/\btext-\S+|\bw-5\b|\btext-center\b/g, "").trim() || "fa-solid fa-circle",
      active: a.classList.contains("active"),
      admin: !!a.closest("#sidebarAdminLinks"),
    }));
  }

  function build() {
    overlay = h("div", "nav-wheel");
    overlay.id = "navWheel";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Navegación");
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="nw-scrim" data-close></div>' +
      '<div class="nw-panel">' +
      '<label class="nw-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
      '<input id="navWheelSearch" type="search" placeholder="Ir a…" autocomplete="off" aria-label="Buscar destino"><kbd>Esc</kbd></label>' +
      '<div class="nw-wheel" id="navWheelRing">' +
      '<button type="button" class="nw-center" id="navWheelCenter" aria-label="Abrir mi perfil">' +
      '<span class="nw-avatar" id="navWheelAvatar"></span><b id="navWheelName"></b><small id="navWheelRole"></small></button>' +
      "</div>" +
      '<div class="nw-foot">' +
      '<button type="button" class="nw-pill" id="navWheelTheme"><i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i><span></span></button>' +
      '<button type="button" class="nw-pill is-danger" id="navWheelLogout"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Cerrar sesión</span></button>' +
      '<button type="button" class="nw-pill" data-close><i class="fa-solid fa-xmark" aria-hidden="true"></i><span>Cerrar</span></button>' +
      "</div></div>";
    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    $("navWheelCenter").addEventListener("click", () => go(() => {
      const profileLink = document.querySelector('.sidebar-nav-link[data-nav="myprofile"]');
      if (profileLink) profileLink.click(); else $("userProfileBar")?.click();
    }));
    $("navWheelTheme").addEventListener("click", () => { $("themeToggle")?.click(); syncFoot(); });
    $("navWheelLogout").addEventListener("click", () => go(() => $("btnLogout")?.click()));
    const search = $("navWheelSearch");
    search.addEventListener("input", filter);
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = overlay.querySelector(".nw-item:not(.is-dim)");
        if (first) { e.preventDefault(); first.click(); }
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        overlay.querySelector(".nw-item:not(.is-dim)")?.focus();
      }
    });
    overlay.addEventListener("keydown", onKey);
  }

  function syncFoot() {
    const dark = document.documentElement.classList.contains("dark");
    const t = $("navWheelTheme");
    if (t) t.querySelector("span").textContent = dark ? "Modo claro" : "Modo oscuro";
  }

  function render() {
    const ring = $("navWheelRing");
    ring.querySelectorAll(".nw-item").forEach((n) => n.remove());
    const items = destinations();
    const n = items.length || 1;
    items.forEach((d, i) => {
      const b = h("button", "nw-item" + (d.active ? " is-active" : "") + (d.admin ? " is-admin" : ""));
      b.type = "button";
      b.style.setProperty("--a", `${(i / n) * 360 - 90}deg`);
      b.style.setProperty("--i", String(i));
      b.dataset.label = d.label.toLowerCase();
      const ic = h("span", "nw-icon");
      const icon = h("i", d.icon);
      icon.setAttribute("aria-hidden", "true");
      ic.appendChild(icon);
      b.append(ic, h("span", "nw-label", d.label));
      b.addEventListener("click", () => go(() => d.link.click()));
      ring.appendChild(b);
    });
    $("navWheelAvatar").textContent = ($("userAvatar")?.textContent || "U").trim();
    $("navWheelName").textContent = ($("userNameDisplay")?.textContent || "").trim();
    $("navWheelRole").textContent = ($("userRoleBadge")?.textContent || "").trim().toLowerCase();
    syncFoot();
  }

  function filter() {
    const q = $("navWheelSearch").value.trim().toLowerCase();
    overlay.querySelectorAll(".nw-item").forEach((b) => {
      b.classList.toggle("is-dim", !!q && !b.dataset.label.includes(q));
    });
  }

  function open() {
    if (!document.documentElement.classList.contains("has-user-session")) return;
    if (!overlay) build();
    lastFocus = document.activeElement;
    render();
    $("navWheelSearch").value = "";
    filter();
    overlay.hidden = false;
    overlay.classList.remove("is-closing");
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    document.documentElement.classList.add("nav-wheel-open");
    setTimeout(() => $("navWheelSearch")?.focus({ preventScroll: true }), reduceMotion() ? 0 : 60);
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("nav-wheel-open");
    const done = () => { overlay.hidden = true; lastFocus?.focus?.({ preventScroll: true }); };
    if (reduceMotion()) done(); else setTimeout(done, 180);
  }

  function go(action) {
    close();
    setTimeout(action, reduceMotion() ? 0 : 120);
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    const items = [...overlay.querySelectorAll(".nw-item:not(.is-dim)")];
    const idx = items.indexOf(document.activeElement);
    if (idx < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
    if (e.key === "Tab") {
      const focusables = [...overlay.querySelectorAll("input, button:not(.is-dim)")].filter((x) => !x.closest("[hidden]"));
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  // "Más" y el botón de menú abren la rueda en lugar de la barra lateral.
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest('#mobileTabbar [data-tab-click="btnToggleMobileSidebar"], #btnToggleMobileSidebar');
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  }, true);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      overlay && !overlay.hidden ? close() : open();
    }
  });

  window.addEventListener("themeChanged", syncFoot);
})();
