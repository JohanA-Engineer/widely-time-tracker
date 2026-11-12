# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Administradora (Lina De La Espriella, agencia Widely Social):** aprueba o rechaza las horas registradas, asigna tareas y recordatorios a cada colaborador, registra pagos y anticipos, controla el presupuesto semanal, los clientes y el margen de la agencia.
- **Colaboradores freelance:** registran su tiempo por cliente y categoría (cronómetro en vivo o registro manual), ven sus tareas por hacer y su meta semanal, y cobran honorarios en USD con el equivalente en COP mediante una cuenta de cobro en PDF.

## Product Purpose

Time Tracker convierte el tiempo trabajado por el equipo de la agencia en nómina clara: cada hora registrada queda asociada a un cliente, pasa por aprobación y se traduce en lo que se le debe a cada colaborador y en la rentabilidad de cada cliente. El éxito es que nadie pierda horas, que la aprobación sea rápida y que el cobro salga sin cálculos manuales.

## Operating Context

- Uso mixto: computador durante la jornada (el cronómetro corre en segundo plano, con ventana flotante PiP sobre otras apps) y celular para revisar, aprobar y registrar rápido (barra inferior móvil, PWA instalable).
- Moneda: tarifas y pagos en USD con conversión a COP según la TRM del día.
- Ciclos de liquidación por semana, quincena y mes.

## Capabilities and Constraints

- Una sola página por rol (portal de colaborador y portal de administración) con navegación por secciones; app estática (HTML + Tailwind precompilado + styles.css + app.js) desplegada en GitHub Pages, datos en Firebase.
- El JavaScript depende de ids, clases y atributos `data-*` del HTML; los cambios visuales no pueden renombrarlos ni alterar la lógica.
- Modo claro y oscuro con selector manual (clase `dark` en `<html>`).
- Exportaciones a Excel/CSV, cuentas de cobro en PDF, cronómetro libre y Pomodoro.

## Brand Commitments

- Nombre del producto: "Time Tracker", operado por Lina De La Espriella para Widely Social.
- Idioma de la interfaz: español (Colombia).

## Evidence on Hand

- Datos reales de colaboradores, clientes y pagos viven en Firebase; nunca se usan en capturas ni documentación. Las capturas usan datos ficticios.
- Guía de uso del Time Tracker (documento en Claude Docs) que debe actualizarse con cada cambio visible.

## Product Principles

1. Ninguna hora se pierde: registrar tiempo debe ser lo más fácil y visible de la app.
2. El dinero siempre es legible: USD y COP, saldo y estado de aprobación se leen de un vistazo.
3. Cada rol ve primero lo que le toca hacer hoy.
4. Los cambios visuales nunca rompen el flujo de trabajo existente.

## Accessibility & Inclusion

Contraste mínimo WCAG AA en ambos temas, foco visible en todos los controles y texto de tamaño cómodo.
