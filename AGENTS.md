# Widely Social — Agent & Development Guidelines

## Official UI Design System: "Cartulina de plaza"

All UI development, styling, and components in Widely Social must follow `Design.md` and `PRODUCT.md`. The previous achromatic system ("Clinical Blueprint on Frosted Paper") was retired on 2026-11-11; do not reintroduce it.

### Core Design Principles
1. **Color does real jobs.** Tokens live as RGB channels in `styles.css` (`:root` and `.dark`) and feed Tailwind (`tailwind.config.js`).
   - Ink `#17131F` (sidebar, inverted plates, marker text) · Ground `#F4F1F8` (pale violet) · Paper `#FFFFFF`
   - Action magenta `#D4136F` (dark mode `#FF4FA3` with ink text): primary buttons, selection, active nav.
   - Cartulina yellow `#F4EA2A`: the live timer card and the admin budget hero only.
   - Accents: green `#3FD86A` (approved / TRM), orange `#FF8A1F` (high priority), red `#C81E1E` for errors and destructive actions.
2. **The timer is the protagonist.** `#timerMainCard.cartulina` is a yellow card with a 2px ink rule; the elapsed time is set in Archivo at 900 weight, 62% width. One reversed (ink) plate per screen for the balance owed.
3. **Status by shape and color.** Pending = yellow, dashed border. Approved = green, solid. Rejected = pink, struck through.
4. **Typography: Archivo (variable width axis).** UI text at normal width; titles and figures condensed (78–82% width, 800–900 weight). Minimum 11px.
5. **Depth:** soft offset shadows (`--shadow-card`, `--shadow-lift`), no zero-offset glows, no thick side-tab borders.
6. **Never rename or remove ids, classes or `data-*` attributes used by `app.js`** when restyling; add style-only classes instead.
7. **Accessibility:** WCAG AA contrast in both themes, visible focus (2px magenta outline).

Consult `Design.md` for complete token values and component rules.
