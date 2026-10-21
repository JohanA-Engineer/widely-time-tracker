# Widely Social — Agent & Development Guidelines

## Official UI Design System: "Clinical Blueprint on Frosted Paper" (shadcn/ui style reference)

All UI development, styling, and components in Widely Social must adhere strictly to the rules and design tokens outlined in `Design.md`.

### Core Design Principles
1. **Achromatic by Default**:
   - The palette is monochromatic. Color is absence, not expression.
   - Canvas: `#f5f5f5`
   - Paper / Card: `#ffffff`
   - Surface Alt / Sidebar: `#fafafa`
   - Primary Ink: `#0a0a0a`
   - Soft Ink: `#171717`
   - Mid Gray (Muted text / placeholders): `#737373`
   - Hairline borders: `#e5e5e5`
   - **Destructive Ember**: `#e7000b` (Strictly reserved for destructive actions, errors, and alerts. Never used for decoration or non-error emphasis).

2. **Strict Border-Radius Hierarchy**:
   - **Interactive Elements** (Buttons, Inputs, Badges): `18px` (`--radius-2xl` / perfect pill geometry).
   - **Containers & Cards**: `24px` (`--radius-3xl`).
   - **Nested elements**: `10px` (`--radius-lg`).
   - **Small accents**: `6px` (`--radius-md`).
   - *Never use arbitrary radius values or sharp square corners.*

3. **Whisper-Quiet Elevation & Hairlines**:
   - Cards always use a 1px hairline border (`#e5e5e5`) paired with subtle elevation:
     `box-shadow: 0 0 0 1px rgba(23, 23, 23, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);`
   - Filled primary buttons rely solely on tonal contrast (`#0a0a0a` on `#ffffff`), without drop shadows.
   - Input fields: `#f5f5f5` fill resting with no border; on `:focus` display a 1px `#e5e5e5` ring without offset.

4. **Typography (Geist / Inter)**:
   - Body: `14px / 1.43` font-weight 400.
   - Headings: `24px–36px / font-weight 600` with tight letter spacing (`-0.6px` to `-0.9px`).
   - Display Headings: `48px / font-weight 600` with tight tracking (`-0.05em` / `-2.4px`).
   - Caption / Uppercase tags: `12px / 1.33` with loose tracking (`+0.6px` / `+0.05em`).

5. **Component Rules**:
   - **Primary Action**: Pill radius 18px, bg `#0a0a0a`, text `#fafafa`, font 14px 500, height 36–40px.
   - **Secondary / Ghost**: Pill radius 18px, bg `#f5f5f5`, text `#0a0a0a`, no border.
   - **Outline**: Pill radius 18px, transparent bg, border 1px solid `#e5e5e5`, text `#0a0a0a`.
   - **Stat Blocks**: Large numeric metric in 30–48px 600 `#0a0a0a` with tight tracking, label in 12px uppercase `#737373`.
   - **No gradients, colored shadows, or chromatic brand fills on general UI surfaces.** (Virtual payment cards retain their specific banking finishes).

Consult `Design.md` for complete token values and CSS custom properties.
