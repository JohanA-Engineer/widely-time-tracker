# Widely Social — Agent & Development Guidelines

## Official UI Design System: "La rueda del día"

All UI development, styling, and components in Widely Social must follow `Design.md` and `PRODUCT.md`. Retired systems: "Clinical Blueprint on Frosted Paper" (achromatic) and "Cartulina de plaza" (2026-11-11). Do not reintroduce them.

### Core Design Principles
1. **The day is a wheel.** The collaborator's timer tile draws today's registered hours as arcs colored by client, with the live timer in the center (`#dayWheel`, drawn by `ui-shell.js`). The admin "Centro de mando" (built by `admin-shell.js`) has five views — Inicio (money river, team lanes, constellation), Aprobar (tickets by person + week strip), Nómina (ledger per person), Clientes (client cards + margin bubbles) and Equipo (people cards) — layered over the original sections, which stay in the page inside "Ver la tabla…" details. People are always ink badges with initials; color is reserved for clients.
2. **Navigation:** a floating dock at the bottom (`#mobileTabbar`, all widths) plus the **navigation wheel** (`nav-wheel.js`): "Más" or Ctrl/⌘+K opens every destination in a circle around the user's avatar, with an "Ir a…" search, theme toggle and logout. There is no sidebar: `#appSidebar` stays in the DOM (hidden) only because app.js wires its links; the wheel clicks those same links.
3. **Layout:** a mosaic of rounded tiles (28px radius, soft offset shadow) on a cool lavender ground `#ECEEF6` (dark `#0D0E1A`, tiles `#171933`).
4. **Color does jobs:** ink `#12122A` for actions and selection; sun `#FFC83A` only for money (balance, budget); coral `#FF5A5F` only for what is live (running timer, start, "+"); client colors from the palette in `ui-shell.js` (violet `#6D4BFF`, coral, teal `#12B5A6`, orange, blue, magenta, green, gold). Status: pending = yellow + dashed border, approved = teal + solid, rejected = coral + struck through.
5. **Type:** Unbounded for figures and titles, Onest for interface text. Minimum 11px.
6. **Never rename or remove ids, classes or `data-*` attributes used by `app.js`.** Add style-only classes. `ui-shell.js` only reads state through the read-only `window.__tt` accessor; it never writes data.
7. **Accessibility:** WCAG AA in both themes, visible 2px violet focus ring, `prefers-reduced-motion` respected.
8. **Deploy:** every new front-end file must be added to `.github/workflows/deploy.yml` (copy + version query) and to `sw.js`.

Consult `Design.md` for complete token values and component rules.
