---
name: Time Tracker
description: El día de trabajo es una rueda; cada actividad es un arco del color de su cliente y el cronómetro vive en el centro.
colors:
  lavanda: "#ECEEF6"
  tile: "#FFFFFF"
  tile-alt: "#F5F6FB"
  hundido: "#E4E7F2"
  linea: "#DFE2EE"
  borde-fuerte: "#C6CADD"
  tinta: "#12122A"
  tinta-suave: "#2A2B48"
  tinta-media: "#5B5E78"
  tinta-tenue: "#9497B3"
  ember: "#C82030"
  sol: "#FFC83A"
  sol-texto: "#5A4500"
  coral: "#FF5A5F"
  coral-hover: "#FF7A7E"
  violeta: "#6D4BFF"
  teal: "#12B5A6"
  naranja: "#FF9F1C"
  azul: "#2E86FF"
  magenta: "#C94BD8"
  verde: "#3FAE4F"
  oro: "#E8A400"
  dock-texto: "#C9CCE6"
  pendiente-fondo: "#FFF4CC"
  pendiente-borde: "#B38600"
  aprobada-fondo: "#D7F5EE"
  aprobada-borde: "#0B8A7C"
  aprobada-texto: "#0B5C53"
  rechazada-fondo: "#FFE3E4"
  rechazada-borde: "#D63A40"
  rechazada-texto: "#A1222A"
  noche-fondo: "#0D0E1A"
  noche-tile: "#171933"
  noche-tile-alt: "#13152A"
  noche-hundido: "#232646"
  noche-linea: "#2A2D4D"
  noche-borde-fuerte: "#3A3E66"
  noche-tinta: "#F1F1FA"
  noche-tinta-media: "#A3A6C4"
  noche-tinta-tenue: "#6E7191"
  noche-ember: "#FF6B73"
  noche-dock: "#262948"
typography:
  display:
    fontFamily: "Brygada 1918, Onest, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  cifra-dinero:
    fontFamily: "Brygada 1918, Onest, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  cifra-reloj:
    fontFamily: "Brygada 1918, Onest, sans-serif"
    fontSize: "clamp(30px, 3.4vw, 44px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  cifra-indicador:
    fontFamily: "Brygada 1918, Onest, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Brygada 1918, Onest, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Brygada 1918, Onest, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  leyenda-cabeza:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.06em"
  minimo:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
rounded:
  muestra: "4px"
  barra: "8px"
  filtro: "10px"
  anidado: "12px"
  control: "14px"
  avatar: "16px"
  dock: "22px"
  tile: "28px"
  rueda: "50%"
spacing:
  dock-hueco: "4px"
  dock-relleno: "8px"
  fila: "14px"
  mosaico: "18px"
  tile-y: "22px"
  tile-x: "24px"
  rueda-columna: "30px"
  despeje-dock: "130px"
components:
  tile:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.tile}"
    padding: "22px 24px"
  tile-dinero:
    backgroundColor: "{colors.sol}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.tile}"
    padding: "22px 24px"
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.tile}"
    rounded: "{rounded.control}"
    height: "54px"
  button-primary-hover:
    backgroundColor: "{colors.tinta-suave}"
    textColor: "{colors.tile}"
  button-vivo:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "48px"
  button-vivo-hover:
    backgroundColor: "{colors.coral-hover}"
  button-control:
    backgroundColor: "{colors.hundido}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "48px"
  button-control-hover:
    backgroundColor: "{colors.linea}"
  button-outline:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.hundido}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.anidado}"
  input-focus:
    backgroundColor: "{colors.tile}"
  filtro-periodo:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.control}"
    padding: "4px"
  filtro-periodo-activo:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.tile}"
    rounded: "{rounded.filtro}"
  dock:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.dock-texto}"
    rounded: "{rounded.dock}"
    padding: "8px"
  dock-item-activo:
    backgroundColor: "{colors.lavanda}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  dock-mas:
    backgroundColor: "{colors.lavanda}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    size: "46px"
  estado-pendiente:
    backgroundColor: "{colors.pendiente-fondo}"
    textColor: "{colors.sol-texto}"
    padding: "2px 10px"
  estado-aprobada:
    backgroundColor: "{colors.aprobada-fondo}"
    textColor: "{colors.aprobada-texto}"
    padding: "2px 10px"
  estado-rechazada:
    backgroundColor: "{colors.rechazada-fondo}"
    textColor: "{colors.rechazada-texto}"
    padding: "2px 10px"
  cajon-enlace-activo:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.tile}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
---

# Design System: Time Tracker

## Overview

**Creative North Star: "La rueda del día"**

El día de trabajo es una rueda. Cada actividad registrada hoy es un arco del color de su cliente, en el orden en que se registró, y el cronómetro vive en el centro. Todo lo demás se organiza alrededor de esa imagen: un mosaico de tiles blancos muy redondeados sobre un fondo lavanda frío, una tinta azul noche que hace el trabajo de las acciones y la selección, y tres acentos con un solo oficio cada uno: el amarillo sol es dinero, el coral es lo que está en vivo, el violeta es el foco. Los colores de cliente son los únicos que pueden aparecer en cantidad, porque son datos.

La densidad es de tablero, no de formulario: pocos tiles grandes en la primera vista, cifras en Brygada 1918 con peso alto y tracking cerrado, interfaz en Onest. La navegación flota en un dock oscuro abajo, en todos los anchos, y el menú completo vive en un cajón; no hay barra lateral fija ni columna larga de tarjetas. Los títulos van solos, sin rótulos encima.

El sistema reemplaza por completo a "Cartulina de plaza" y al anterior "Clinical Blueprint on Frosted Paper"; nada de esos mundos se hereda.

**Key Characteristics:**
- La rueda del día (400px en escritorio) es la protagonista del colaborador; la rueda del equipo, del Centro de mando.
- Tiles de 28px de radio con sombra suave difusa sobre lavanda; en oscuro, tiles azul noche sobre casi negro.
- Color con oficio: tinta = acción, sol = dinero, coral = en vivo, violeta = foco, paleta de clientes = datos.
- Brygada 1918 para cifras y títulos, Onest para todo lo demás; nada por debajo de 11px.
- Dock flotante + cajón; el estado se lee por forma y color a la vez.

## Colors

Fondo frío y neutro, tinta casi negra con matiz azul, y acentos saturados que se reservan para un trabajo concreto. Todos los neutros se publican como canales RGB (`--c-*` en `:root` y `.dark` de `styles.css`) para que Tailwind los use con opacidad; los valores de esta sección son los de esos canales.

### Primary
- **Tinta azul noche** (#12122A; oscuro #F1F1FA): texto principal y toda acción principal (Registrar, pestaña activa, enlace activo del cajón, filtro de período activo, el dock). En modo oscuro la tinta se invierte a casi blanco y el texto sobre ella pasa a #0D0E1A. Hover: tinta suave (#2A2B48; en oscuro #FFFFFF).

### Secondary
- **Amarillo sol** (#FFC83A): dinero y nada más. Fondo del tile de saldo del colaborador y del tile de presupuesto de la administración (igual en ambos temas), el botón "+" del dock de administración (registrar pago) y el estado pendiente. Sobre el sol, el texto es tinta (#12122A) y el texto secundario es ocre (#5A4500); las líneas son tinta al 15–22%.
- **Coral en vivo** (#FF5A5F; hover #FF7A7E): lo que está corriendo ahora. El arco en curso de la rueda y su punto, el botón Iniciar, la alerta de sobretiempo, la prioridad alta y los recordatorios. Siempre con texto tinta encima, nunca blanco.

### Tertiary
- **Violeta foco** (#6D4BFF): anillo de foco, cursor de texto, selección (al 28%), barras de progreso de liquidación y meta, y el día de hoy en calendarios y tablas semanales (al 5–8%).
- **Paleta de clientes** (`PALETTE` en `ui-shell.js`): violeta #6D4BFF, coral #FF5A5F, teal #12B5A6, naranja #FF9F1C, azul #2E86FF, magenta #C94BD8, verde #3FAE4F, oro #E8A400. Cada cliente recibe un color estable por hash de su nombre; colorea arcos, barras de la semana y muestras de leyenda. Las categorías de `app.js` (`chartColor`) usan la misma familia: General #9497B3, Diseño #6D4BFF, Video #C94BD8, Copy #FF9F1C, Ads #FF5A5F, Reunión #FFC83A, Estrategia #12B5A6.
- **Teal** (#12B5A6): además de color de cliente, el estado aprobada y el punto de la TRM conectada.

### Neutral
- **Lavanda frío** (#ECEEF6; oscuro #0D0E1A): fondo de la app y de la barra superior (al 82% con desenfoque de 12px). También el fondo del ítem activo del dock y del botón "+".
- **Tile** (#FFFFFF; oscuro #171933): todos los tiles, el cajón y los grupos de filtros.
- **Tile alterno** (#F5F6FB; oscuro #13152A): superficies secundarias heredadas.
- **Hundido** (#E4E7F2; oscuro #232646): campos, botones de control, pestañas, pista de la rueda y de las barras.
- **Línea** (#DFE2EE; oscuro #2A2D4D): divisiones internas, como las de la franja de indicadores. **Borde fuerte** (#C6CADD; oscuro #3A3E66): contorno del botón secundario.
- **Tinta media** (#5B5E78, 5.6:1 sobre lavanda; oscuro #A3A6C4, 7:1 sobre tile): etiquetas, horas del dial, texto secundario. **Tinta tenue** (#9497B3; oscuro #6E7191): marcas del dial y botones deshabilitados.
- **Ember** (#C82030; oscuro #FF6B73): error y acciones destructivas.
- **Dock** (#12122A; oscuro #262948) con texto #C9CCE6.

### Named Rules
**The One Job Rule.** Cada acento tiene un solo oficio: sol es dinero, coral es en vivo, violeta es foco. Si algo no es dinero, no es amarillo; si no está corriendo, no es coral.

**The Live Only While Running Rule.** El arco coral y su punto existen solo mientras hay tiempo en el cronómetro. Corriendo: arco pleno con punto al final. En pausa: el arco queda al 40% de opacidad y sin punto. Detenido o registrado: desaparece y la actividad pasa a ser un arco del color de su cliente.

**The Sun Is Fixed Rule.** Los tiles de dinero son amarillo sol con texto tinta en claro y en oscuro; no se oscurecen con el tema.

## Typography

**Display Font:** Brygada 1918 (con Onest, sans-serif)
**Body Font:** Onest (con -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif)

**Character:** Brygada 1918 es ancha y geométrica; carga las cifras (tiempo, dinero, horas) y los títulos con presencia de tablero. Onest es una sans humanista tranquila que sostiene la interfaz sin competir. Ambas se cargan de Google Fonts (Brygada 1918 500–800, Onest 400–700).

### Hierarchy
- **Display** (Brygada 1918 700, 40px, 1.05, -0.03em; 30px en celular): títulos de página.
- **Cifra de dinero** (Brygada 1918 800, 44px, -0.04em; 56px en el presupuesto de administración, 44px en celular): el saldo y el presupuesto.
- **Cifra de reloj** (Brygada 1918 800, clamp(30px, 3.4vw, 44px), 1, -0.04em): el tiempo en el centro de la rueda.
- **Cifra de indicador** (Brygada 1918 700, 30px, -0.04em; total de la rueda del equipo 800): indicadores de la franja de administración.
- **Headline** (Brygada 1918 700, 24px, 1.15, -0.03em): la actividad en curso ("Ahora") junto a la rueda.
- **Title** (Brygada 1918 600, 18px, -0.02em; 16px en títulos de tile de saldo y semana): títulos de tile y de sección. El saludo del colaborador va en Brygada 1918 700 clamp(22px, 2vw, 28px).
- **Body** (Onest 400, 14px, 1.43): interfaz general; filas de leyenda en 600.
- **Label** (Onest 600, 12px, tinta media): etiquetas de campo, horas del dial, subtextos.
- **Cabeza de leyenda** (Onest 700, 12px, 0.06em, mayúsculas): solo la cabecera de la leyenda de la rueda, que siempre lleva un dato ("Hoy · 3,0 h").

### Named Rules
**The 11px Floor Rule.** Ningún texto baja de 11px; los `text-[9px]` y `text-[10px]` heredados se elevan a 11px dentro del tablero.

**The Tracking Floor Rule.** El tracking negativo nunca pasa de -0.04em, ni siquiera en las cifras más grandes.

**The Tabular Figures Rule.** Toda cifra que cambia (cronómetro, tablas, totales de leyenda) usa `font-variant-numeric: tabular-nums`.

## Layout

**Mosaico.** El contenido principal llega hasta 1480px y deja 130px abajo para el dock. Los tiles se separan 18px.

- **Colaborador, vista "Hoy"** (escritorio): dos columnas (1.9fr / 1fr). Fila 1, el saludo a todo el ancho. Filas 2–3, a la izquierda el tile del cronómetro con la rueda; a la derecha el tile de saldo (fila 2) y el tile de la semana (fila 3). Fila 4, tareas a la izquierda y recordatorio a la derecha (tareas a todo el ancho si no hay recordatorio).
- **Colaborador, vista "Actividad"**: actividades, resumen y tabla semanal a todo el ancho; la vista "Hoy" se oculta. `ui-shell.js` alterna las vistas con `data-wview` en `<html>`, y cualquier navegación hacia una sección cambia primero a su vista.
- **Tile del cronómetro**: desde 1100px, rueda de 400px a la izquierda y a la derecha, en columna con 14px entre filas: "Ahora", selector de colaborador, cliente, descripción, leyenda por cliente y controles (30px entre columnas). Por debajo de 1100px todo se apila con la rueda arriba.
- **Centro de mando**: tile de presupuesto (1.3fr) y rueda del equipo (1fr) lado a lado; debajo, la franja de cuatro indicadores a todo el ancho. El cronómetro de administración no lleva tarjeta propia.
- **Celular y tablet (hasta 1023px)**: una columna en el orden saludo, cronómetro, saldo, semana; el recordatorio sube antes de las tareas; los indicadores pasan a 2 × 2. Hasta 767px la rueda se limita a 320px, los controles van en 2 columnas y el tile del cronómetro usa 18px × 16px de relleno.

**Navegación.** Un dock flotante (`#mobileTabbar`) en todos los anchos: Tracker, Actividad, +, Cobro, Más. En escritorio se centra a 18px del borde inferior con etiquetas en fila; hasta 1023px ocupa el ancho con 12px de margen (más el área segura) e ícono sobre etiqueta. El menú completo (`#appSidebar`) es un cajón de 300px que se abre desde "Más" o el botón superior izquierdo y se cierra al elegir destino. La barra superior lleva los filtros de período y la TRM.

## Elevation & Depth

Profundidad por sombra suave difusa: los tiles flotan apenas sobre el lavanda y los elementos que mandan (cronómetro, presupuesto, cajón, dock) flotan un poco más. No hay bordes alrededor de los tiles; la sombra y el contraste tile/fondo hacen el trabajo.

### Shadow Vocabulary
- **Tile** (`box-shadow: 0 1px 2px rgba(18,18,42,0.04), 0 16px 32px -24px rgba(18,18,42,0.35)`; oscuro `0 1px 2px rgba(0,0,0,0.4), 0 16px 32px -22px rgba(0,0,0,0.75)`): todos los tiles, grupos de filtros, TRM, franja de indicadores.
- **Elevado** (`box-shadow: 0 2px 4px rgba(18,18,42,0.06), 0 24px 48px -24px rgba(18,18,42,0.5)`; oscuro `0 2px 4px rgba(0,0,0,0.45), 0 26px 50px -24px rgba(0,0,0,0.85)`): tile del cronómetro, tile de presupuesto, alerta de sobretiempo.
- **Dock** (`box-shadow: 0 18px 40px -16px rgba(18,18,42,0.6)`): el dock flotante.
- **Cajón** (`box-shadow: 0 24px 60px -20px rgba(18,18,42,0.5)`): el menú abierto en escritorio.

### Named Rules
**The No Tile In Tile Rule.** Un tile no contiene otro tile: dentro del saldo y del presupuesto las cifras se separan con filas rayadas, no con recuadros, y el cronómetro de administración se queda sin tarjeta.

## Shapes

Esquinas generosas y concéntricas: tile 28px, dock 22px, controles 14px, campos y anidados 12px, botones dentro del filtro de período 10px, barras de la semana 8px, muestras de leyenda 4px. La rueda es un anillo perfecto (pista de 30px en la rueda del día, 44px en la del equipo), con 3px de separación entre arcos, marcas de hora redondeadas y el punto en vivo de 10px de radio con borde del color del tile. Los bordes visibles son pocos y tienen función: el contorno del botón secundario (1.5px), las filas rayadas sobre el sol (1.5px tinta al 22%), las divisiones de la franja de indicadores (1px línea) y los contornos de estado.

## Components

### Buttons
Sólidos y táctiles, sin bordes salvo el secundario.
- **Shape:** esquinas de control (14px).
- **Primary (Registrar):** tinta sobre texto tile, 54px de alto, Onest 700 16px. Hover a tinta suave.
- **En vivo (Iniciar):** coral con texto tinta, 48px. Hover #FF7A7E.
- **Control (Pausar, Detener, + Horas / Artes):** hundido con texto tinta, 48px, Onest 700 15px; hover al color de línea. Deshabilitado: hundido al 60% con texto tenue, sin bajar la opacidad del botón. Los controles van en una rejilla de 3 columnas más una de 1.25 para "+ Horas / Artes" (2 columnas en celular; 3 en administración, donde ese botón no aparece).
- **Secundario:** tile con contorno de 1.5px borde fuerte; hover, contorno tinta.
- **Fantasma:** fondo hundido.

### Filtros y pestañas
- **Filtro de período:** grupo en un tile de 14px con 4px de relleno y sombra de tile; cada opción con esquinas de 10px y peso 600; la activa en tinta.
- **Pestañas:** riel hundido de 14px; pestaña de 12px, activa en tinta con texto tile, sin sombra.
- **Filtros de estado:** punto de 9px con la forma del estado (pendiente con contorno discontinuo).

### Estado (forma y color a la vez)
- **Pendiente:** fondo #FFF4CC, borde discontinuo 1.5px #B38600, texto #5A4500 (oscuro: sol al 14%, borde #FFC83A, texto #FFE08A).
- **Aprobada:** fondo #D7F5EE, borde continuo 1.5px #0B8A7C, texto #0B5C53 (oscuro: teal al 16%, borde #12B5A6, texto #7FE6DA).
- **Rechazada:** fondo #FFE3E4, borde continuo 1.5px #D63A40, texto #A1222A tachado (oscuro: coral al 16%, borde #FF5A5F, texto #FFA3A6).
- Insignia en Onest 700 con 2px × 10px de relleno.

### Cards / Containers
- **Corner Style:** 28px.
- **Background:** tile (#FFFFFF / #171933), sin borde.
- **Shadow Strategy:** sombra de tile; el cronómetro y el presupuesto, elevada.
- **Internal Padding:** 22px × 24px (cronómetro 22px × 26px).

### Inputs / Fields
- **Style:** fondo hundido, sin borde, esquinas de 12px; etiqueta Onest 600 12px en tinta media.
- **Focus:** el campo pasa a fondo tile con un anillo de 2px violeta.

### Navigation
- **Dock:** cápsula tinta de 22px, 8px de relleno y 4px entre ítems. Ítems Onest 600 14px en #C9CCE6, esquinas de 14px; hover blanco al 8% con texto blanco; activo en lavanda con texto tinta. El botón "+" es un cuadrado lavanda de 46px (48px en celular), hover blanco; en administración es amarillo sol porque registra un pago. Hasta 1023px las etiquetas bajan a 11px.
- **Rueda de navegación (sin barra lateral):** "Más" en el dock o Ctrl/⌘+K abre un velo azul noche con desenfoque y, encima, un buscador "Ir a…" (tile de 18px, foco violeta), la rueda y una fila de píldoras (Modo claro/oscuro, Cerrar sesión en rojo, Cerrar). La rueda (hasta 560px, 94vw en celular) tiene un aro translúcido, el disco central blanco de 168px con el avatar tinta, el nombre y el rol (abre Mi perfil), y los destinos repartidos en círculo: íconos en cuadros blancos de 56px (46px en celular) con su nombre debajo; el destino actual va en tinta, el hover en sol, los de administración con círculo. Los destinos salen del centro escalonados (460ms, 28ms entre cada uno) y se respetan las preferencias de movimiento reducido. El buscador atenúa lo que no coincide y Enter abre el primero; flechas y Tab recorren la rueda y Esc la cierra. Cada destino hace clic en el enlace original del menú (oculto), así que la navegación no cambia.

### La rueda del día (signature)
Un SVG que dibuja `ui-shell.js` dentro del centro del cronómetro (`#dayWheel`), hasta 400px.
- Un arco por actividad registrada hoy (sin rechazadas), en el orden de registro, del color de su cliente; el título de cada arco dice cliente, descripción y duración.
- Capacidad del dial: la jornada mínima de 8 h, que crece de 2 en 2 si el día se pasa. Marcas cada hora (mayores cada 2 h, en tinta tenue) y horas rotuladas cada 2 h en Onest 600 12px tinta media ("8 h" arriba).
- La pista es hundida; el tiempo en el centro en cifra de reloj, con el costo en vivo (Onest 700 17px) y su COP debajo.
- Leyenda a la derecha: cabeza con el total del día y una fila por cliente (muestra de 12px con esquinas de 4px, nombre, horas tabulares), más la fila "En curso" o "En pausa" cuando aplica.

### Centro de mando (administración)
Lo arma `admin-shell.js` sobre las secciones originales, que siguen en la página (con sus ids y botones) dentro de desplegables "Ver la tabla…". El antiguo `#teamWheelTile` queda oculto.

- **Vistas:** pestañas Inicio, Aprobar, Nómina, Clientes y Equipo en el encabezado (`#adminViewTabs`, `data-aview` en `<html>` y en cada sección). Cualquier `scrollIntoView` hacia una sección cambia primero a su vista, así el menú, el dock y los accesos existentes siguen llegando a su destino.
- **Personas en tinta, clientes en color:** las personas se marcan siempre con una placa tinta con iniciales (`.person-badge`); la paleta de color queda solo para clientes.
- **El río del dinero (`#moneyRiver`):** cinco columnas — Recaudo (sol), Nómina causada (violeta), Pagado (teal), Por pagar (rayado con borde tinta) y Disponible (tinta con cifra en sol; en oscuro, tile elevado #262948) — con alturas proporcionales al monto (64px + proporción de 150px), conectores entre columnas y subida escalonada de 720ms al entrar a Inicio. Lee los valores que app.js ya pintó en la página.
- **Los carriles del equipo (`#teamLanes`):** una columna por colaborador con anillo de su semana hacia la meta (por cliente), saldo por pagar (sol si hay deuda) con Pagar, sus tiquetes por aprobar y "Asignar tarea".
- **La constelación (`#teamConstellation`):** un anillo concéntrico por persona (hasta 6), segmentado por cliente hacia su meta semanal, con la persona marcada por un punto tinta con iniciales y el total del equipo al centro; entra con un giro breve.
- **Tiquetes:** pendientes en amarillo punteado con un arco de horas en el color del cliente; al aprobar pasan a teal sólido 420ms antes de salir.
- **Aprobar:** tablero de tiquetes agrupado por persona (`#approvalBoard`) y franja semanal (`#weekStrip`): siete celdas por persona con bloques apilados por cliente, lo pendiente rayado en amarillo y hoy en violeta; sigue las flechas de semana de la sección.
- **Nómina:** libro por persona (`#payrollLedger`) con barras Causado (violeta) y Pagado (teal), saldo y acciones Cuenta de cobro y Pagar.
- **Clientes:** tarjetas por cliente (`#clientBoard`) teñidas con su color: barra del paquete de horas (rayada en rojo si se pasa) y barra partida costo (violeta) / margen (teal) con las cifras; y el campo de burbujas por margen (`#marginBubbles`).
- **Equipo:** tarjetas de personas (`#peopleCards`) con estado de cuenta (sólido "Con cuenta", punteado "Solo datos"), anillo de la semana, tarifa editable y Perfil; el monto del registro de pago va en Brygada 1918 24px sobre sol.
- **Formato de cifras:** en todo el Centro de mando, el mismo de la app: $1,000.00 y 7.0 h.

### Registrar horas (página propia)
`registro.js` arma `#registroHorasView`: formulario a la izquierda y "Así quedará" a la derecha (sticky). Se abre desde la rueda de navegación (`data-nav="registro"`), `#btnOpenManualEntry`, `#btnWorkerOpenManualEntry` y `window.openManualEntryModal(id)`.
- **Personas** como fichas con iniciales en tinta y tarifa (nunca un `<select>`: en iOS no se podía elegir); buscador cuando hay más de 6. El colaborador solo se ve a sí mismo.
- **Día** en siete fichas de la semana + "Otra fecha" (date input invisible encima). **Horas** con − / + de 0.25, cifra en Brygada 52px (46px en celular) que acepta "2,5", y valores rápidos 0.5–8.
- **Cliente** y **Categoría** en fichas; los clientes llevan su color. **Dinero** en Brygada 48px con una regla de sol de 4px debajo (no una tarjeta amarilla dentro de otra).
- **Estado**: admin → "Quedará aprobada" (teal sólido); colaborador → "Quedará pendiente" (amarillo punteado). La barra del día suma lo ya registrado por cliente más el tramo nuevo con ese estado.
- **Guardar** no escribe datos: llena `#formManualEntry` y lo envía, así validaciones, estado y avisos siguen siendo los de app.js. En celular una barra fija sobre el dock muestra valor y "Guardar".

### Barras de la semana
Siete columnas de 150px de alto, una por día (Lu–Do), apiladas por cliente con esquinas de 8px sobre pista hundida; el total del día en Onest 700 11px encima y el día de hoy en tinta.

### Tile de saldo
Tile amarillo sol (mismo en ambos temas): título en Brygada 1918 16px, saldo en cifra de dinero a todo el ancho con una fila rayada debajo, tres cifras secundarias en Brygada 1918 700 18px en tres columnas, y el botón de cuenta de cobro en tinta al final.

### Tile de presupuesto (administración)
Amarillo sol con sombra elevada. Cifra principal de 56px; los subtotales y los pasos del recorrido son filas rayadas (borde superior 1.5px tinta al 22%, sin fondo ni radio), y el paso final es una placa tinta con su subtexto en sol.

### Franja-libro de indicadores (administración)
Los cuatro indicadores viven en un solo tile de 28px dividido por líneas verticales de 1px (2 × 2 en tablet y celular, con línea horizontal), sin íconos ni insignias, con la cifra en Brygada 1918 30px.

### Isla del tiempo activo
Cápsula tinta flotante (96px sobre el borde, por encima del dock) que muestra el tiempo en curso fuera del tile, con acentos coral y sol sobre la tinta.

## Do's and Don'ts

### Do:
- **Do** mantener cada acento en su oficio: tinta para acciones, sol (#FFC83A) solo para dinero, coral (#FF5A5F) solo para lo que corre, violeta (#6D4BFF) para foco.
- **Do** dibujar el tiempo del día como arcos del color de su cliente, en orden de registro, con el arco coral solo mientras el cronómetro tiene tiempo (al 40% en pausa).
- **Do** usar un foco visible de 2px violeta con 2px de separación en todos los controles.
- **Do** comunicar el estado por forma y color a la vez: pendiente discontinuo, aprobada continua, rechazada tachada.
- **Do** respetar `prefers-reduced-motion`: el pulso del punto en vivo (1.4s) y el deslizamiento del cajón (220ms, cubic-bezier(0.22, 1, 0.36, 1)) se apagan.
- **Do** añadir clases solo de estilo cuando haga falta; los ids, clases y atributos `data-*` que usa `app.js` nunca se renombran ni se quitan. `ui-shell.js` lee el estado solo por `window.__tt` (solo lectura) y nunca escribe datos.
- **Do** registrar todo archivo nuevo del front en `.github/workflows/deploy.yml` (copia y parámetro de versión) y en `ASSETS_TO_CACHE` de `sw.js`.
- **Do** mantener AA en claro y en oscuro; la tinta media está calibrada para eso (5.6:1 y 7:1).

### Don't:
- **Don't** volver a una barra lateral fija ni a la columna larga de tarjetas; la navegación es dock + cajón.
- **Don't** poner rótulos ni etiquetas en mayúsculas encima de los títulos; el título va solo.
- **Don't** usar amarillo para algo que no sea dinero ni coral para algo que no esté en vivo (el "+" del colaborador es lavanda, no coral).
- **Don't** meter tiles dentro de tiles ni recuadros dentro de los tiles amarillos.
- **Don't** bajar de 11px ni cerrar el tracking más allá de -0.04em.
- **Don't** poner texto blanco sobre coral o sol; sobre ellos el texto es tinta.
- **Don't** reintroducir "Cartulina de plaza" ni "Clinical Blueprint on Frosted Paper".
