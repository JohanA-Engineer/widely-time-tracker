---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Dashboard principal (colaborador y administración)

Scope: index.html portal de colaborador (#workerPortalView) y Centro de mando (#adminPortalView), más la navegación global; la paleta aplica a toda la app vía tokens. Mode: Operate.
Audience/job: colaboradores registran tiempo por cliente y cobran; Lina aprueba, paga y controla margen. Uso mitad computador, mitad celular.
Constraints: ningún id, clase o data-* usado por app.js cambia; app.js solo expone su estado en solo lectura (window.__tt) y ui-shell.js dibuja encima. AA en claro y oscuro, foco visible.
History: "Cartulina de plaza" se publicó y el usuario la rechazó por ser solo un cambio de color; una segunda tanda de catálogo también fue rechazada ("algo diferente, sé creativo"). Esta dirección es propia y fue aprobada en boceto.

## Direction contract

THESIS: El día de trabajo es una rueda: cada actividad registrada es un arco del color de su cliente y el cronómetro vive en el centro. Rechaza la columna larga de tarjetas con menú lateral fijo.
OWN-WORLD: Fondo lavanda frío #ECEEF6, tiles blancos de 28px con sombra suave, tinta azul noche #12122A para acciones, amarillo sol #FFC83A solo para dinero (saldo y presupuesto), coral #FF5A5F solo para lo que está en vivo, violeta/teal/naranja y demás como colores de cliente. Unbounded para cifras y títulos, Onest para la interfaz.
STORY: El colaborador ve su día como rueda, inicia o registra desde el mismo tile, lee su saldo en el tile amarillo y su semana en barras por cliente. Lina ve el presupuesto en amarillo y la semana del equipo como rueda por cliente.
FIRST VIEWPORT: Barra superior con filtros de período y TRM; mosaico: tile grande del cronómetro (rueda de 400px a la izquierda con el tiempo en el centro; a la derecha "Ahora", campos, leyenda por cliente, controles y Registrar), a la derecha tile amarillo de saldo y tile de semana con barras. Dock flotante abajo (Tracker, Actividad, +, Cobro, Más) y el menú completo como cajón.
FORM: La rueda del día, dirección propia fuera de la lista sorteada tras dos rechazos. seed:958f3c428a32e60c
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
