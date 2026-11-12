---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Dashboard principal (colaborador y administración)

Scope: index.html portal de colaborador (#workerPortalView) y Centro de mando (#adminPortalView); la paleta aplica a toda la app vía tokens. Mode: Operate.
Audience/job: colaboradores registran tiempo por cliente y cobran; Lina aprueba, paga y controla margen. Uso mitad computador, mitad celular.
Constraints: ningún id, clase o data-* usado por app.js cambia; solo estilos y estructura visual. AA en claro y oscuro, foco visible.

## Direction contract

THESIS: El tiempo que corre se anuncia como el precio del día en la plaza: una cartulina fluorescente escrita a marcador. Rechaza el dashboard gris de tarjetas idénticas con un acento.
OWN-WORLD: Tinta violeta-negra #17131F (sidebar y placas invertidas), fondo violeta pálido #F4F1F8, magenta #D4136F como color de acción, amarillo cartulina #F4EA2A para el cronómetro y el héroe admin, verde #3FD86A y naranja #FF8A1F como acentos de estado/datos. Archivo con eje de ancho: UI a ancho normal, cifras a ancho condensado y peso 800-900 como marcador. Estado con forma además de color: pendiente punteado, aprobado sólido, rechazado tachado.
STORY: El colaborador abre y ve primero su cronómetro como cartel amarillo; registra con un botón magenta; lee su saldo en la placa tinta. Lina ve su presupuesto como cartulina y las aprobaciones con estados inconfundibles.
FIRST VIEWPORT: Sidebar tinta con ítem activo magenta. Colaborador: saludo condensado grande; debajo, la cartulina del cronómetro a todo el ancho: a la izquierda campos y controles, a la derecha la cámara con la cifra condensada 96-120px y la etiqueta magenta del costo; luego los KPIs con el saldo invertido. Admin: título condensado, héroe de presupuesto en cartulina amarilla, KPIs en módulos con filete.
FORM: Cartulina de plaza, posición 6 de 7 en la lista propia. seed:958f3c428a32e60c
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
