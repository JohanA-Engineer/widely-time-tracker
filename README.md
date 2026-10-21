# ⏱️ Widely Time Tracker & Financial Dashboard

Una aplicación web moderna y elegante para el control de horas trabajadas, registro de tareas y balance financiero en tiempo real.

## 🚀 Tecnologías Utilizadas

- **Frontend:** HTML5, CSS3 personalizado con el sistema de diseño de `Design.md` (acromático, modo claro y oscuro), Tailwind CSS precompilado en `tailwind.min.css`, Vanilla JavaScript moderno (ES Modules).
  - Los colores son tokens (`ink`, `mid`, `line`, `paper`, `canvas`, `muted`, `primary`, `ember`…) definidos en `styles.css` y `tailwind.config.js`.
  - Después de cambiar clases en `index.html` o `app.js`, regenera los estilos con: `npx tailwindcss@3.4.17 -i src-tailwind.css -o tailwind.min.css --minify`
- **Base de Datos en Tiempo Real:** Firebase Firestore (SDK v10 Modular).
- **Backend (Opcional):** Python con FastAPI & Uvicorn para servir la app y proveer endpoints de monitoreo.
- **Control de Versiones:** Git & GitHub.

---

## 📂 Estructura del Proyecto

```text
time-tracker/
├── index.html                  # Interfaz de usuario interactiva y responsiva (Anybody Font + Dark/Light Mode)
├── styles.css                  # Hoja de estilos de alta gama (Variables CSS, efectos glow y transiciones)
├── app.js                      # Lógica del cronómetro, cálculos y conexión Firestore v10 modular
├── main.py                     # Servidor backend en FastAPI
├── requirements.txt            # Dependencias de Python
├── MANUAL_DE_FUNCIONAMIENTO.md # Manual técnico y de arquitectura completo
└── .gitignore                  # Archivos ignorados por Git
```

> 📖 **Para una documentación detallada de la arquitectura, flujos de datos y fórmulas matemáticas, consulta el [Manual de Funcionamiento](MANUAL_DE_FUNCIONAMIENTO.md).**


---

## ⚡ Instalación y Ejecución Rápida

### Opción 1: Con Python (FastAPI)
```bash
# 1. Crear entorno virtual (opcional pero recomendado)
python -m venv venv

# En Windows:
.\venv\Scripts\activate

# En Mac/Linux:
source venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Iniciar el servidor
python main.py
```
Abre tu navegador en `http://localhost:8000`.

### Opción 2: Sin servidor Python (100% Directo en el Navegador)
Simplemente abre `index.html` con la extensión **Live Server** de VS Code o haciendo doble clic (o montándolo en GitHub Pages o Firebase Hosting).

---

## 🔐 Configuración de Firebase Firestore

1. Ingresa a [Firebase Console](https://console.firebase.google.com/).
2. Crea un proyecto (ej. `widely-time-tracker`).
3. Ve a **Firestore Database** > **Crear base de datos** > Selecciona **Modo de prueba** (o modo producción con reglas de lectura/escritura).
4. En la configuración del proyecto (ícono de engranaje) > **Tus apps** > Añade una app Web (`</>`).
5. Copia el objeto `firebaseConfig` y pégalo en el archivo `app.js`.

---

## 📊 Colecciones en Firestore

- **`trabajadores`**:
  - `nombre` (string)
  - `tarifaHora` (number)
  - `createdAt` (timestamp)
- **`tareas`**:
  - `fecha` (string: YYYY-MM-DD)
  - `trabajadorId` (string)
  - `trabajadorNombre` (string)
  - `descripcion` (string)
  - `segundos` (number)
  - `horas` (number)
  - `tarifaHora` (number)
  - `costoTotal` (number)
  - `createdAt` (timestamp)
- **`pagos`**:
  - `fecha` (string: YYYY-MM-DD)
  - `trabajadorId` (string)
  - `trabajadorNombre` (string)
  - `monto` (number)
  - `referencia` (string)
  - `createdAt` (timestamp)
