---
name: Time Tracker
description: El tiempo que corre se anuncia como el precio del día en la plaza, en cartulina fluorescente y marcador negro.
colors:
  ink: "#17131F"
  ink-soft: "#2A2338"
  ground: "#F4F1F8"
  paper: "#FFFFFF"
  paper-alt: "#FAF8FC"
  muted: "#EEE9F5"
  mid: "#5E5470"
  faint: "#968BAA"
  line: "#E2DAEE"
  line-strong: "#CBBFDD"
  magenta: "#D4136F"
  magenta-hover: "#B80F5F"
  magenta-soft: "#F9D3E5"
  cartulina: "#F4EA2A"
  cartulina-mid: "#54480E"
  leaf: "#3FD86A"
  tang: "#FF8A1F"
  ember: "#C81E1E"
  dark-ground: "#120E19"
  dark-paper: "#1D1727"
  dark-ink: "#F6F1FF"
  dark-mid: "#B6A8CC"
  dark-line: "#342A46"
  dark-magenta: "#FF4FA3"
  dark-sidebar: "#0C0912"
  status-pending-bg: "#FFF7B0"
  status-pending-rule: "#8A7A00"
  status-pending-text: "#3D3500"
  status-approved-bg: "#C9F7D5"
  status-approved-rule: "#187A35"
  status-approved-text: "#0F4D23"
  status-rejected-bg: "#FFE0EA"
  status-rejected-rule: "#B0124F"
  status-rejected-text: "#8A0E3E"
typography:
  timer:
    fontFamily: "Archivo, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(64px, 8.2vw, 128px)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "0"
    fontVariation: "'wdth' 62"
    fontFeature: "'tnum'"
  display:
    fontFamily: "Archivo, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "46px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 78"
  hero-figure:
    fontFamily: "Archivo, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "68px"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 68"
    fontFeature: "'tnum'"
  figure:
    fontFamily: "Archivo, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 82"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Archivo, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "28px"
    fontWeight: 900
    lineHeight: 1.05
    fontVariation: "'wdth' 78"
  title:
    fontFamily: "Archivo, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 850
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 80"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Archivo, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 700
rounded:
  nested: "10px"
  control-sm: "12px"
  control: "14px"
  tile: "16px"
  control-pill: "18px"
  module: "22px"
  card: "24px"
  cartulina: "26px"
spacing:
  hairline: "1px"
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  gutter: "36px"
components:
  button-primary:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control-pill}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.magenta-hover}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control-pill}"
    padding: "0 14px"
    height: "36px"
  button-register:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    height: "54px"
  button-start:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cartulina}"
    rounded: "{rounded.control}"
    height: "48px"
  button-control:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control-pill}"
  nav-link-active:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control-sm}"
    padding: "10px 12px"
  timer-card:
    backgroundColor: "{colors.cartulina}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cartulina}"
    padding: "22px 26px 24px"
  budget-hero:
    backgroundColor: "{colors.cartulina}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cartulina}"
  balance-plate:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.tile}"
  live-cost-tag:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.nested}"
    padding: "6px 14px"
  input-cartulina:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control-sm}"
  status-pending:
    backgroundColor: "{colors.status-pending-bg}"
    textColor: "{colors.status-pending-text}"
    rounded: "{rounded.control-pill}"
    padding: "2px 10px"
  status-approved:
    backgroundColor: "{colors.status-approved-bg}"
    textColor: "{colors.status-approved-text}"
    rounded: "{rounded.control-pill}"
    padding: "2px 10px"
  status-rejected:
    backgroundColor: "{colors.status-rejected-bg}"
    textColor: "{colors.status-rejected-text}"
    rounded: "{rounded.control-pill}"
    padding: "2px 10px"
---

# Design System: Time Tracker

## Overview

**Creative North Star: "Cartulina de plaza"**

El tiempo que corre se anuncia como el precio del día en la plaza de mercado: una cartulina amarilla fluorescente con la cifra escrita a marcador negro. El cronómetro es el protagonista de la pantalla del colaborador y el presupuesto semanal es el protagonista de la pantalla de administración; los dos son cartulinas. Todo lo demás vive en papel blanco sobre un fondo violeta pálido, con tinta violeta-negra para el texto y una sola voz de acción en magenta.

El color hace trabajo real: el amarillo marca lo que está vivo o en juego, el magenta marca lo que se puede hacer, el verde marca lo aprobado y la TRM, el naranja marca la prioridad alta. El estado nunca depende solo del color: pendiente es punteado, aprobado es sólido, rechazado es tachado. La tipografía es una sola familia variable (Archivo) que cambia de voz con el eje de ancho: ancho normal para leer la interfaz, condensado y pesado para las cifras y los títulos, como un marcador sobre cartulina.

Se rechaza explícitamente el dashboard gris de tarjetas idénticas con un acento, y el sistema acromático anterior ("Clinical Blueprint on Frosted Paper"), retirado el 2026-11-11.

**Key Characteristics:**
- Dos cartulinas amarillas como máximo por pantalla: el cronómetro (colaborador) y el héroe de presupuesto (administración).
- Una sola placa invertida (tinta) por pantalla para el saldo que se le debe al colaborador.
- Cifras en Archivo condensado (62–82 % de ancho, peso 800–900) con números tabulares.
- Magenta como única voz de acción; nunca como texto sobre amarillo.
- Estado por forma además de color.
- Barra lateral en tinta en ambos temas, con ítem activo magenta.

## Colors

Tinta violeta-negra sobre fondo violeta pálido, con amarillo cartulina para lo vivo, magenta para la acción y verde y naranja como acentos de estado y datos. Todos los colores viven como canales RGB (`--c-*`) en `:root` y `.dark` de `styles.css` y Tailwind los consume con `rgb(var(--c-x) / <alpha-value>)`; nunca se define un color nuevo en Tailwind fuera de esos tokens.

### Primary
- **Magenta de acción** (`--c-primary`, magenta / dark-magenta): botón primario, "Registrar tarea", ítem activo de la barra lateral, filtros seleccionados, barras de progreso, anillo de foco, cursor de texto y la etiqueta del costo en vivo. En claro lleva texto blanco (5.1:1); en oscuro se enciende a dark-magenta y lleva texto de tinta (6.0:1). Hover en magenta-hover; fondo suave en magenta-soft (`#4A1D38` en oscuro).

### Secondary
- **Amarillo cartulina** (`--c-sun`, cartulina): fondo de la cartulina del cronómetro y del héroe de presupuesto, color de selección de texto, fondo del avatar del saludo, ítem activo dentro de ámbitos de tinta (barra lateral, isla flotante) y texto de las etiquetas sobre la placa invertida. Tinta sobre amarillo da 14.5:1. El texto secundario sobre amarillo usa cartulina-mid (7.2:1).

### Tertiary
- **Verde hoja** (`--c-leaf`, leaf): aprobado (relleno del punto del filtro, borde en oscuro), insignia de la TRM con texto de tinta (9.8:1), icono del segundo KPI de administración, fondo suave `#DDF8E5` del segundo KPI del colaborador.
- **Naranja mandarina** (`--c-tang`, tang): prioridad alta en tareas, alerta de horas extra, icono del tercer KPI, fondo suave `#FFE8D2` del tercer KPI. Siempre con texto de tinta (7.8:1).
- **Rojo brasa** (`--c-ember`, ember; `#FF6B6B` en oscuro): solo errores y acciones destructivas. Nunca como estado de una hora rechazada (eso es rosa tachado).

### Neutral
- **Tinta de marcador** (`--c-ink`, ink): texto principal, barra lateral, placa invertida, pestañas activas, botón Iniciar, filete superior de los módulos de administración. En oscuro el token se invierte a dark-ink.
- **Fondo violeta pálido** (`--c-canvas`, ground): lienzo de la app; en oscuro dark-ground.
- **Papel** (`--c-paper`, paper): tarjetas, campos dentro de la cartulina, botones de contorno; en oscuro dark-paper. paper-alt y muted son los dos escalones de superficie sutil.
- **Gris violeta medio** (`--c-mid`, mid): texto secundario (6.3:1 sobre el fondo; dark-mid 7.9:1 sobre dark-paper).
- **Gris violeta tenue** (`--c-faint`, faint): solo decoración, iconos inactivos y series de gráfica. Da 2.9:1 sobre el fondo: nunca para texto.
- **Filete** (`--c-line`, line; line-strong para contornos de botón): bordes y divisores.

### Estados (colores fijos, no tokens de tema)
- Pendiente: fondo status-pending-bg, borde punteado status-pending-rule, texto status-pending-text (11.2:1). Oscuro: amarillo al 12 %, borde `#F4EA2A`, texto `#F7F08A`.
- Aprobado: fondo status-approved-bg, borde sólido status-approved-rule, texto status-approved-text (8.4:1). Oscuro: verde al 14 %, borde `#3FD86A`, texto `#8BF0A8`.
- Rechazado: fondo status-rejected-bg, borde sólido status-rejected-rule, texto status-rejected-text tachado (7.7:1). Oscuro: magenta encendido al 14 %, borde `#FF4FA3`, texto `#FF9CCB`.

### Serie de gráficas
Las categorías en `app.js` usan general `#968BAA`, diseño `#D4136F`, video `#7B4DD8`, copy `#FF8A1F`, ads `#2FB85A`, reunión `#E8DD1E`, estrategia `#17131F` (se invierte a `#F6F1FF` en oscuro).

### Named Rules
**The Two Cartulinas Rule.** El amarillo cartulina como superficie existe solo en el cronómetro (`#timerMainCard.cartulina`) y en el héroe de presupuesto (`#adminUpworkBudgetSection`). En otros lugares aparece como punto, icono, selección o tinte suave, nunca como otra tarjeta amarilla.

**The One Plate Rule.** Una sola placa invertida por pantalla: el cuarto KPI del colaborador (saldo). En claro es tinta con etiquetas amarillas; en oscuro se invierte a cartulina con texto de tinta.

**The No Magenta On Yellow Rule.** Magenta sobre amarillo da 4.0:1. Dentro de la cartulina el magenta solo aparece como relleno (botón Registrar, etiqueta de costo, punto en vivo) con texto blanco; el texto pequeño es tinta o cartulina-mid.

## Typography

**Display Font:** Archivo variable, ejes `wdth` 62–125 y `wght` 400–900 (con -apple-system, Segoe UI, sans-serif)
**Body Font:** Archivo a ancho normal
**Label/Mono Font:** ninguna aparte; las cifras usan Archivo con `font-feature-settings: 'tnum'`

**Character:** Una sola familia con dos voces: la interfaz habla a ancho normal y peso 400–700; las cifras y los títulos gritan condensados y pesados, como letras de marcador sobre cartulina. El ancho se controla con `font-stretch` en porcentaje.

### Hierarchy
- **Timer** (900, `clamp(64px, 8.2vw, 128px)`, 0.92; 62 % de ancho; en celular `clamp(64px, 20vw, 96px)`): solo la cifra del cronómetro.
- **Hero figure** (900, 68px, 0.95; 68 % de ancho; 52px en celular): el monto disponible del héroe de presupuesto.
- **Display** (900, 46px, 1; 78 % de ancho; 34px en celular): título de página y saludo del colaborador (`clamp(32px, 3.6vw, 50px)`).
- **Figure** (800, 34–36px, 1.05; 82 % de ancho): valores de KPI de colaborador y de administración.
- **Headline** (900, 28px, 1.05; 78 % de ancho): encabezado del bloque de cobro.
- **Title** (850, 22px; 80 % de ancho): títulos de tarjeta; los títulos de sección en mayúsculas van a 18px, 80 % de ancho. La tarea en curso sobre el cronómetro va a 24px, 850, 85 % de ancho.
- **Body** (400, 14px, 1.43): todo el texto de interfaz a ancho normal.
- **Label** (600–700, 11–13px): etiquetas de campos, subtítulos de KPI, insignias. 11px es el mínimo: las clases `text-[9px]` y `text-[10px]` se elevan a 11px en la app.

### Named Rules
**The Marker Width Rule.** Condensado (62–85 %) solo para cifras y títulos; nunca para párrafos, etiquetas de campo ni botones. Cuanto más importante la cifra, más condensada y pesada: cronómetro 62 %, héroe 68 %, títulos 78–80 %, KPIs 82 %.

**The Tabular Figures Rule.** Toda cifra que cambia (cronómetro, costo en vivo, KPIs, celdas de tabla) usa números tabulares para que no baile.

## Layout

Una página por rol con barra lateral fija en escritorio y barra inferior en celular (por debajo de 1024px). El cronómetro ocupa todo el ancho del contenido.

- **Cronómetro:** en celular apila la cifra primero y luego colaborador, cliente, descripción y controles (filas de 14px). Desde 1024px pasa a dos columnas (`1fr` / `1.15fr`, separación 36px): campos y controles a la izquierda, la cámara con la cifra a la derecha separada por un filete punteado de tinta al 35 %.
- **KPIs del colaborador:** directamente sobre el fondo, sin tarjeta envolvente; cuatro baldosas en rejilla.
- **KPIs de administración:** módulos pegados con separación de 1px (el filete), filete superior de tinta de 2px y filete inferior de tinta al 16 %; cada módulo con relleno 16px 18px 18px.
- **Héroe de presupuesto:** subdivisiones con filete superior de tinta, separadas 20px; a una sola columna por debajo de 480px.
- **Celular (≤767px):** el saludo se compacta para que el cronómetro suba; la cartulina usa relleno 18px 16px.
- Puntos de quiebre observados: 480px, 767px, 1023/1024px.

## Elevation & Depth

Híbrido: superficies planas de papel con sombras suaves desplazadas hacia abajo y teñidas de violeta; las dos cartulinas se levantan más que todo lo demás. Dentro de los módulos de administración no hay sombra: la estructura la dan los filetes.

### Shadow Vocabulary
- **Card** (`--shadow-card`: `0 1px 2px rgba(40,20,70,.06), 0 12px 28px -18px rgba(60,25,100,.32)`): tarjetas de papel, meta semanal, placa invertida.
- **Lift** (`--shadow-lift`: `0 2px 4px rgba(40,20,70,.08), 0 22px 44px -22px rgba(60,25,100,.45)`): cartulina del cronómetro y héroe de presupuesto.
- **Live** (`0 2px 4px rgba(23,19,31,.12), 0 30px 60px -26px rgba(212,19,111,.55)`): la cartulina del cronómetro cuando corre; la sombra se tiñe de magenta.
- **Action** (`0 8px 18px -12px rgb(var(--c-primary) / .9)`): bajo botones primarios y el ítem activo de la barra lateral.
- En oscuro las sombras son negras más densas (definidas en `.dark`).

### Named Rules
**The Downward Shadow Rule.** Toda sombra tiene desplazamiento vertical y difuminado negativo; no hay resplandores de desplazamiento cero ni sombras duras desplazadas. Los anillos de 0 offset solo existen como contorno (isla flotante con anillo amarillo de 2px, punto en vivo).

## Shapes

Esquinas generosas y graduadas por jerarquía: cartulinas 26px (22px en celular), tarjetas 24px, módulos de KPI 22px, baldosas del colaborador 16px, controles en píldora 18px, controles dentro de la cartulina 12–14px, anidados 10px. Los módulos de administración pierden la esquina (0px) porque viven dentro de un filete.

Los bordes de tinta tienen grosor de marcador: 2px en las cartulinas y en los botones de control, 1.5px en campos de la cartulina, botones de contorno e insignias de estado. Dos objetos se inclinan como papel pegado: el avatar del saludo y el logotipo (-4°) y la etiqueta del costo en vivo (-2°). Ningún otro elemento rota.

## Components

### Buttons
Táctiles y seguros, en peso 650.
- **Shape:** píldora suave (18px), 36px de alto, 0 14px de relleno; pequeño 30px.
- **Primary:** magenta con texto blanco (tinta en oscuro) y sombra de acción.
- **Hover / Focus:** magenta-hover; `:active` escala a 0.98; foco con contorno magenta de 2px a 2px de distancia.
- **Outline:** papel con borde de 1.5px line-strong; en hover el borde pasa a tinta.
- **Ghost:** superficie muted con texto de tinta.
- **Grises heredados:** cualquier `.bg-faint.text-white` se reasigna a magenta porque no alcanzaba AA.

### Filters and Tabs
- **Filtro de periodo:** grupo segmentado en papel con contorno interno de 1px, relleno 3px, radio 14px; cada botón radio 11px, peso 600; el seleccionado es magenta.
- **Filtros de estado:** el punto de cada filtro repite el estado: pendiente amarillo con contorno punteado, aprobado verde con anillo verde oscuro, rechazado rosa con anillo vino. Los contadores dentro de un filtro activo van a opacidad completa.
- **Pestañas activas** (`.tab-btn`, tareas): tinta con texto de papel, sin sombra.

### Status Badges
- **Forma por estado:** pendiente con borde punteado de 1.5px, aprobado con borde sólido de 1.5px, rechazado con borde sólido y texto tachado (1.5px). Peso 700, relleno 2px 10px, píldora.
- El punto del pendiente no parpadea: la forma punteada ya dice "en espera".
- Prioridad alta en tareas: naranja con texto de tinta.

### Cards / Containers
- **Corner Style:** 24px (tarjetas), 20px (meta semanal).
- **Background:** papel sobre el fondo violeta pálido.
- **Shadow Strategy:** Card (ver Elevation).
- **Border:** filete de 1px line cuando existe.
- **Recordatorios:** fondo amarillo muy pálido (`#FFFBD6`; amarillo al 8 % en oscuro) con icono magenta.

### Inputs / Fields
- **Style general:** superficie muted sin borde, píldora de 18px, 14px de texto.
- **Dentro de la cartulina:** papel blanco, borde de tinta al 85 % de 1.5px, radio 12px, placeholder `#6E6338`; las etiquetas son tinta en peso 700.
- **Focus:** borde magenta con anillo magenta al 30 % de 3px (cartulina); en toda la app el contorno de foco magenta de 2px.

### Navigation
- **Barra lateral:** ámbito de tinta en ambos temas (fondo ink; dark-sidebar en oscuro). Enlaces de 14px peso 500 en gris violeta claro, relleno 10px 12px, radio 12px; hover en tinta clara; activo en magenta con texto blanco, peso 700 y sombra de acción.
- **Barra superior:** fondo al 86 % con desenfoque y filete inferior.
- **Celular:** barra inferior con pestaña activa en magenta peso 700 y botón flotante con sombra de acción.

### Cartulina del cronómetro (signature)
`#timerMainCard.cartulina`: amarillo cartulina, borde de tinta de 2px, radio 26px, relleno 22px 26px 24px, sombra Lift (Live cuando corre). Encabezado en tinta, 13px peso 800. Sobre la cifra, cuando hay tarea en curso, su nombre en Title condensado y el cliente en 13px cartulina-mid. La cifra en Timer. Debajo, la etiqueta del costo en vivo (magenta, texto blanco 20px peso 800, radio 10px, inclinada -2°) y el equivalente en COP en 13px peso 700 cartulina-mid. Controles: blancos con borde de tinta de 2px, 48px de alto, radio 14px, peso 800; **Iniciar** en tinta con texto amarillo; **Registrar tarea** en magenta, 54px de alto. Deshabilitados: tinta al 7 % con texto al 45 %, sin sombra. La alerta de horas extra es papel con borde punteado ember e icono naranja.

### Héroe de presupuesto (signature)
`#adminUpworkBudgetSection`: segunda cartulina, mismo borde, radio y sombra. El monto en Hero figure. Las subdivisiones son transparentes con filete superior de tinta al 80 %; el paso final de la ruta es una placa de tinta con texto amarillo. Dentro de este ámbito el "primario" es tinta con texto amarillo, no magenta.

### KPI tiles
- **Colaborador:** baldosas de 16px sin borde con tintes de cartulina (amarillo `#FFF9C4`, verde `#DDF8E5`, naranja `#FFE8D2`; al 12–13 % en oscuro) y la cuarta como placa invertida (ver The One Plate Rule). Cifras en Figure.
- **Administración:** módulos con filete (ver Layout) sobre el fondo de la app, sin sombra ni radio; icono de 28px radio 8px en cartulina de color (amarillo, verde, naranja, magenta con icono blanco) y texto de tinta.

### Isla flotante del tiempo activo
`#dynamicIslandTimer`: píldora de tinta con anillo amarillo de 2px y sombra hacia abajo; dentro, el primario es amarillo.

### Ámbitos de tokens
Cuatro ámbitos reescriben los canales `--c-*` y recalculan las variables derivadas (`--bg-*`, `--primary`, `--text-*`, `--border-soft`): `#appSidebar` (tinta), `#timerMainCard.cartulina` (amarillo con magenta como primario), `#adminUpworkBudgetSection` (amarillo con tinta como primario) y `#dynamicIslandTimer` (tinta con amarillo como primario). `.scope-inverse` es el ámbito de tinta reutilizable. Un componente nuevo dentro de estos ámbitos debe usar tokens, no hex fijos, para heredar la inversión.

### Motion
Solo hay un movimiento ambiental: el punto en vivo del cronómetro late (anillo magenta que se expande de 4px a 8px y se desvanece, 1.4s ease-in-out, infinito) mientras el tiempo corre, y se apaga con `prefers-reduced-motion: reduce`. El resto son transiciones de estado de 120–200ms (color, borde, sombra) y la escala 0.98 al presionar.

## Do's and Don'ts

### Do:
- **Do** tomar todo color de los canales `--c-*` de `styles.css` (o de las clases Tailwind que los consumen) y definir cualquier variante oscura en `.dark`.
- **Do** mantener el amarillo cartulina como superficie solo en el cronómetro y en el héroe de presupuesto.
- **Do** marcar el estado con forma además de color: pendiente punteado, aprobado sólido, rechazado tachado.
- **Do** escribir cifras y títulos en Archivo condensado (62–85 % de ancho, peso 800–900) con números tabulares, y la interfaz a ancho normal.
- **Do** usar magenta para la acción principal y para el foco (contorno de 2px, separación 2px).
- **Do** mantener contraste AA en ambos temas; texto secundario en mid / dark-mid y, sobre amarillo, cartulina-mid.
- **Do** respetar `prefers-reduced-motion` en cualquier animación nueva.
- **Do** añadir clases solo de estilo cuando haga falta un gancho visual nuevo.

### Don't:
- **Don't** renombrar ni eliminar ids, clases ni atributos `data-*` que use `app.js` (por ejemplo `#timerMainCard`, `#timerDisplay`, `#btnStart`, `#btnRegisterTask`, `#liveCostBadge`, `#timerActiveTitle`, `#liveCostCop`, `.btn-status-filter[data-status]`, `.status-*`); la capa visual se engancha a ellos sin tocarlos.
- **Don't** poner texto magenta sobre amarillo (4.0:1).
- **Don't** usar faint para texto (2.9:1 sobre el fondo).
- **Don't** usar ember (rojo) para "rechazado"; rechazado es rosa tachado y ember queda para errores y acciones destructivas.
- **Don't** añadir una segunda placa invertida ni una tercera cartulina en la misma pantalla.
- **Don't** usar resplandores de desplazamiento cero ni sombras duras desplazadas.
- **Don't** bajar de 11px en la app.
- **Don't** reintroducir el sistema acromático "Clinical Blueprint on Frosted Paper" ni la fuente Geist/Inter.
