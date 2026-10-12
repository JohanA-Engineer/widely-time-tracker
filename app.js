/**
 * ============================================================================
 * WIDELY TIME TRACKER & FINANCIAL DASHBOARD
 * Lógica Frontend y Conexión en Tiempo Real con Firebase Firestore (SDK v10 ESM)
 * Refactorizado bajo principios de Emil Kowalski / Vercel Design Engineering
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ============================================================================
   1. CONFIGURACIÓN DE FIREBASE (Credenciales Activas)
   ============================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCrAmepLxl7Tmtq7GNsjMmishqGYtQWXbY",
  authDomain: "widely-time-tracker.firebaseapp.com",
  projectId: "widely-time-tracker",
  storageBucket: "widely-time-tracker.firebasestorage.app",
  messagingSenderId: "919060175591",
  appId: "1:919060175591:web:5e7a812f362e3b1bd8a042"
};

const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY_AQUI" && !firebaseConfig.apiKey.includes("TU_API_KEY");

let db = null;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("[Firebase] Inicializado correctamente en modo producción/tiempo real.");
    document.getElementById("firebaseWarning")?.classList.add("hidden");
  } catch (err) {
    console.error("[Firebase] Error de conexión:", err);
    updateDbStatus(false, "Error de Conexión");
  }
} else {
  console.warn("[Firebase] Modo local activado temporalmente.");
  document.getElementById("firebaseWarning")?.classList.remove("hidden");
  updateDbStatus(false, "Credenciales Pendientes");
}

/* ============================================================================
   2. ESTADO GLOBAL DE LA APLICACIÓN
   ============================================================================ */
let state = {
  workers: [],      // Colección 'trabajadores'
  tasks: [],        // Colección 'tareas'
  payments: [],     // Colección 'pagos'
  timer: {
    isRunning: false,
    startTime: 0,
    elapsedSeconds: 0,
    intervalId: null
  },
  deleteTarget: null
};

/* ============================================================================
   3. ELEMENTOS DEL DOM
   ============================================================================ */
const elements = {
  // Cronómetro
  timerWorkerSelect: document.getElementById("timerWorkerSelect"),
  timerTaskDescription: document.getElementById("timerTaskDescription"),
  timerDisplay: document.getElementById("timerDisplay"),
  liveCostBadge: document.getElementById("liveCostBadge"),
  timerStatusBadge: document.getElementById("timerStatusBadge"),
  btnStart: document.getElementById("btnStart"),
  btnPause: document.getElementById("btnPause"),
  btnReset: document.getElementById("btnReset"),
  btnRegisterTask: document.getElementById("btnRegisterTask"),

  // Trabajadores
  formWorker: document.getElementById("formWorker"),
  workerName: document.getElementById("workerName"),
  workerRate: document.getElementById("workerRate"),
  workersList: document.getElementById("workersList"),
  workerCount: document.getElementById("workerCount"),

  // Pagos
  formPayment: document.getElementById("formPayment"),
  paymentWorkerSelect: document.getElementById("paymentWorkerSelect"),
  paymentAmount: document.getElementById("paymentAmount"),
  paymentDate: document.getElementById("paymentDate"),
  paymentReference: document.getElementById("paymentReference"),

  // Dashboard & Tablas
  financialTableBody: document.getElementById("financialTableBody"),
  tasksTableBody: document.getElementById("tasksTableBody"),
  paymentsTableBody: document.getElementById("paymentsTableBody"),
  taskCount: document.getElementById("taskCount"),
  paymentCount: document.getElementById("paymentCount"),

  // Pestañas Segmented Control
  tabTasks: document.getElementById("tabTasks"),
  tabPayments: document.getElementById("tabPayments"),
  tasksView: document.getElementById("tasksView"),
  paymentsView: document.getElementById("paymentsView"),

  // Métricas / KPIs
  kpiTotalHoras: document.getElementById("kpiTotalHoras"),
  kpiTotalHorasFormatted: document.getElementById("kpiTotalHorasFormatted"),
  kpiTotalGenerado: document.getElementById("kpiTotalGenerado"),
  kpiTotalPagado: document.getElementById("kpiTotalPagado"),
  kpiSaldoPendiente: document.getElementById("kpiSaldoPendiente"),
  kpiSaldoDesc: document.getElementById("kpiSaldoDesc"),

  // Modal Borrado
  deleteModal: document.getElementById("deleteModal"),
  deleteModalText: document.getElementById("deleteModalText"),
  btnCancelDelete: document.getElementById("btnCancelDelete"),
  btnConfirmDelete: document.getElementById("btnConfirmDelete"),

  // Tema, Status & Reloj
  currentTime: document.getElementById("currentTime"),
  dbStatus: document.getElementById("dbStatus"),
  toastContainer: document.getElementById("toastContainer"),
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon")
};

/* ============================================================================
   4. INICIALIZACIÓN
   ============================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initClock();
  initDefaultDate();
  setupEventListeners();

  if (db) {
    listenToFirestore();
  } else {
    loadLocalFallbackData();
  }
});

/* ============================================================================
   5. GESTIÓN DE TEMA CLARO / OSCURO (Emil Kowalski Taste)
   ============================================================================ */
function initTheme() {
  const savedTheme = localStorage.getItem("widely_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme ? savedTheme === "dark" : prefersDark;

  applyTheme(isDark);
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add("dark");
    if (elements.themeIcon) {
      elements.themeIcon.className = "fa-regular fa-sun text-sm transition-transform duration-200 rotate-0";
    }
  } else {
    document.documentElement.classList.remove("dark");
    if (elements.themeIcon) {
      elements.themeIcon.className = "fa-regular fa-moon text-sm transition-transform duration-200 -rotate-12";
    }
  }
  localStorage.setItem("widely_theme", isDark ? "dark" : "light");
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  applyTheme(!isDark);
}

/* ============================================================================
   6. LISTENERS EN TIEMPO REAL CON FIRESTORE (onSnapshot)
   ============================================================================ */
function listenToFirestore() {
  // A. Colección: trabajadores
  const workersCol = collection(db, "trabajadores");
  onSnapshot(workersCol, (snapshot) => {
    state.workers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

    updateWorkersUI();
    updateFinancialDashboard();
  }, (error) => {
    console.error("Error en trabajadores:", error);
    showToast("Error al sincronizar trabajadores: " + error.message, "error");
  });

  // B. Colección: tareas
  const tasksQuery = query(collection(db, "tareas"), orderBy("createdAt", "desc"));
  onSnapshot(tasksQuery, (snapshot) => {
    state.tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    updateTasksUI();
    updateFinancialDashboard();
  }, (error) => {
    console.error("Error en tareas:", error);
    showToast("Error al sincronizar tareas: " + error.message, "error");
  });

  // C. Colección: pagos
  const paymentsQuery = query(collection(db, "pagos"), orderBy("createdAt", "desc"));
  onSnapshot(paymentsQuery, (snapshot) => {
    state.payments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    updatePaymentsUI();
    updateFinancialDashboard();
  }, (error) => {
    console.error("Error en pagos:", error);
    showToast("Error al sincronizar pagos: " + error.message, "error");
  });
}

/* ============================================================================
   7. LÓGICA DEL CRONÓMETRO DE TAREAS (Hero Visual)
   ============================================================================ */
function startTimer() {
  const workerId = elements.timerWorkerSelect.value;
  if (!workerId) {
    showToast("Selecciona un trabajador antes de iniciar.", "warning");
    elements.timerWorkerSelect.focus();
    return;
  }

  if (state.timer.isRunning) return;

  state.timer.isRunning = true;
  state.timer.startTime = Date.now() - (state.timer.elapsedSeconds * 1000);

  state.timer.intervalId = setInterval(() => {
    state.timer.elapsedSeconds = Math.floor((Date.now() - state.timer.startTime) / 1000);
    renderTimerDisplay();
    updateLiveCost();
  }, 1000);

  // Estados visuales y micro-interacciones
  elements.btnStart.disabled = true;
  elements.btnPause.disabled = false;
  elements.btnReset.disabled = false;
  elements.timerDisplay.classList.add("timer-active");

  elements.timerStatusBadge.className = "text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5";
  elements.timerStatusBadge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Activo`;
}

function pauseTimer() {
  if (!state.timer.isRunning) return;

  state.timer.isRunning = false;
  clearInterval(state.timer.intervalId);

  elements.btnStart.disabled = false;
  elements.btnPause.disabled = true;
  elements.timerDisplay.classList.remove("timer-active");

  elements.timerStatusBadge.className = "text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
  elements.timerStatusBadge.textContent = "Pausado";
}

function resetTimer() {
  if (state.timer.elapsedSeconds === 0) return;

  pauseTimer();
  state.timer.elapsedSeconds = 0;
  renderTimerDisplay();
  updateLiveCost();

  elements.btnStart.disabled = false;
  elements.btnPause.disabled = true;
  elements.btnReset.disabled = true;

  elements.timerStatusBadge.className = "text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 border border-zinc-300/60 dark:border-white/[0.08]";
  elements.timerStatusBadge.textContent = "Detenido";
}

function renderTimerDisplay() {
  elements.timerDisplay.textContent = formatSecondsToTime(state.timer.elapsedSeconds);
}

function updateLiveCost() {
  const workerId = elements.timerWorkerSelect.value;
  const worker = state.workers.find(w => w.id === workerId);
  const rate = worker ? Number(worker.tarifaHora || 0) : 0;
  const hours = state.timer.elapsedSeconds / 3600;
  const cost = hours * rate;

  elements.liveCostBadge.textContent = `$${cost.toFixed(2)}`;
}

// Registrar tarea finalizada en Firebase
async function handleRegisterTask() {
  const workerId = elements.timerWorkerSelect.value;
  const description = elements.timerTaskDescription.value.trim();
  const seconds = state.timer.elapsedSeconds;

  if (!workerId) {
    showToast("Selecciona un trabajador para registrar la tarea.", "warning");
    elements.timerWorkerSelect.focus();
    return;
  }

  if (seconds < 1) {
    showToast("El cronómetro debe correr al menos 1 segundo.", "warning");
    return;
  }

  const worker = state.workers.find(w => w.id === workerId);
  if (!worker) {
    showToast("El trabajador seleccionado no existe.", "error");
    return;
  }

  const rate = Number(worker.tarifaHora || 0);
  const hours = seconds / 3600;
  const totalCost = Number((hours * rate).toFixed(2));
  const today = new Date().toISOString().split("T")[0];

  const taskData = {
    fecha: today,
    trabajadorId: worker.id,
    trabajadorNombre: worker.nombre,
    descripcion: description || "Tarea sin descripción",
    segundos: seconds,
    horas: Number(hours.toFixed(4)),
    tarifaHora: rate,
    costoTotal: totalCost,
    createdAt: db ? serverTimestamp() : new Date().toISOString()
  };

  elements.btnRegisterTask.disabled = true;
  elements.btnRegisterTask.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>Guardando...</span>`;

  try {
    if (db) {
      await addDoc(collection(db, "tareas"), taskData);
    } else {
      taskData.id = "local_task_" + Date.now();
      state.tasks.unshift(taskData);
      updateTasksUI();
      updateFinancialDashboard();
    }

    showToast(`Tarea registrada ($${totalCost.toFixed(2)})`, "success");
    elements.timerTaskDescription.value = "";
    resetTimer();
  } catch (error) {
    console.error("Error al registrar tarea:", error);
    showToast("Error al guardar en Firebase: " + error.message, "error");
  } finally {
    elements.btnRegisterTask.disabled = false;
    elements.btnRegisterTask.innerHTML = `
      <i class="fa-solid fa-cloud-arrow-up"></i>
      <span>Registrar Tarea y Guardar Costo</span>
    `;
  }
}

/* ============================================================================
   8. GESTIÓN DE TRABAJADORES
   ============================================================================ */
async function handleSaveWorker(e) {
  e.preventDefault();

  const name = elements.workerName.value.trim();
  const rate = parseFloat(elements.workerRate.value);

  if (!name || isNaN(rate) || rate < 0) {
    showToast("Ingresa un nombre válido y una tarifa igual o mayor a 0.", "warning");
    return;
  }

  const workerData = {
    nombre: name,
    tarifaHora: Number(rate.toFixed(2)),
    createdAt: db ? serverTimestamp() : new Date().toISOString()
  };

  try {
    if (db) {
      await addDoc(collection(db, "trabajadores"), workerData);
    } else {
      workerData.id = "local_worker_" + Date.now();
      state.workers.push(workerData);
      updateWorkersUI();
      updateFinancialDashboard();
    }

    showToast(`Trabajador "${name}" agregado.`, "success");
    elements.formWorker.reset();
  } catch (error) {
    console.error("Error al guardar trabajador:", error);
    showToast("Error al guardar: " + error.message, "error");
  }
}

/* ============================================================================
   9. REGISTRO DE PAGOS
   ============================================================================ */
async function handleSavePayment(e) {
  e.preventDefault();

  const workerId = elements.paymentWorkerSelect.value;
  const amount = parseFloat(elements.paymentAmount.value);
  const date = elements.paymentDate.value;
  const reference = elements.paymentReference.value.trim();

  if (!workerId) {
    showToast("Selecciona el trabajador para registrar el pago.", "warning");
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showToast("Ingresa un monto válido mayor a 0.", "warning");
    return;
  }

  const worker = state.workers.find(w => w.id === workerId);
  if (!worker) {
    showToast("Trabajador no encontrado.", "error");
    return;
  }

  const paymentData = {
    fecha: date || new Date().toISOString().split("T")[0],
    trabajadorId: worker.id,
    trabajadorNombre: worker.nombre,
    monto: Number(amount.toFixed(2)),
    referencia: reference || "Pago registrado",
    createdAt: db ? serverTimestamp() : new Date().toISOString()
  };

  try {
    if (db) {
      await addDoc(collection(db, "pagos"), paymentData);
    } else {
      paymentData.id = "local_pay_" + Date.now();
      state.payments.unshift(paymentData);
      updatePaymentsUI();
      updateFinancialDashboard();
    }

    showToast(`Pago de $${amount.toFixed(2)} registrado para ${worker.nombre}.`, "success");
    elements.formPayment.reset();
    initDefaultDate();
  } catch (error) {
    console.error("Error al registrar pago:", error);
    showToast("Error al registrar pago: " + error.message, "error");
  }
}

/* ============================================================================
   10. ACTUALIZACIÓN VISUAL (UI) Y COMPONENTES REFACTORIZADOS
   ============================================================================ */

function updateWorkersUI() {
  const currentTimerVal = elements.timerWorkerSelect.value;
  const currentPayVal = elements.paymentWorkerSelect.value;

  elements.timerWorkerSelect.innerHTML = `<option value="">-- Selecciona un trabajador --</option>` +
    state.workers.map(w => `
      <option value="${w.id}" data-rate="${w.tarifaHora}">
        ${w.nombre} ($${Number(w.tarifaHora).toFixed(2)}/h)
      </option>
    `).join("");

  elements.paymentWorkerSelect.innerHTML = `<option value="">-- Selecciona un trabajador --</option>` +
    state.workers.map(w => `
      <option value="${w.id}">
        ${w.nombre}
      </option>
    `).join("");

  if (currentTimerVal && state.workers.some(w => w.id === currentTimerVal)) {
    elements.timerWorkerSelect.value = currentTimerVal;
  }
  if (currentPayVal && state.workers.some(w => w.id === currentPayVal)) {
    elements.paymentWorkerSelect.value = currentPayVal;
  }

  elements.workerCount.textContent = state.workers.length;

  // Lista minimalista de trabajadores con micro-interacciones
  if (state.workers.length === 0) {
    elements.workersList.innerHTML = `<div class="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">No hay trabajadores registrados.</div>`;
  } else {
    elements.workersList.innerHTML = state.workers.map(w => `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-zinc-200/50 dark:bg-white/[0.03] border border-zinc-300/50 dark:border-white/[0.06] hover:border-zinc-400/50 dark:hover:border-white/[0.12] transition-colors text-xs group">
        <div>
          <div class="font-medium text-zinc-900 dark:text-zinc-200">${escapeHtml(w.nombre)}</div>
          <div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">$${Number(w.tarifaHora).toFixed(2)} / hora</div>
        </div>
        <button 
          onclick="window.requestDelete('trabajadores', '${w.id}', '${escapeHtml(w.nombre)}')"
          title="Eliminar trabajador" 
          class="text-zinc-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors active:scale-95">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </div>
    `).join("");
  }

  updateLiveCost();
}

function updateTasksUI() {
  elements.taskCount.textContent = state.tasks.length;

  if (state.tasks.length === 0) {
    elements.tasksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-zinc-400 dark:text-zinc-500 text-xs">No hay tareas registradas.</td>
      </tr>
    `;
    return;
  }

  elements.tasksTableBody.innerHTML = state.tasks.map(t => {
    const formattedTime = formatSecondsToTime(t.segundos || 0);
    return `
      <tr class="hover:bg-zinc-200/30 dark:hover:bg-white/[0.02] transition-colors">
        <td class="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 font-mono whitespace-nowrap tabular-nums">${t.fecha || '-'}</td>
        <td class="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap">${escapeHtml(t.trabajadorNombre || 'Anónimo')}</td>
        <td class="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 max-w-xs truncate" title="${escapeHtml(t.descripcion || '')}">
          ${escapeHtml(t.descripcion || 'Sin descripción')}
        </td>
        <td class="py-2.5 px-2 text-right font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
          ${formattedTime} <span class="text-[10px] text-zinc-400 dark:text-zinc-500">(${Number(t.horas || 0).toFixed(2)}h)</span>
        </td>
        <td class="py-2.5 px-2 text-right font-mono font-semibold text-zinc-900 dark:text-white whitespace-nowrap tabular-nums">
          $${Number(t.costoTotal || 0).toFixed(2)}
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          <button 
            onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
            class="text-zinc-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-500/10 transition-colors active:scale-95"
            title="Eliminar tarea">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function updatePaymentsUI() {
  elements.paymentCount.textContent = state.payments.length;

  if (state.payments.length === 0) {
    elements.paymentsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-zinc-400 dark:text-zinc-500 text-xs">No hay pagos registrados.</td>
      </tr>
    `;
    return;
  }

  elements.paymentsTableBody.innerHTML = state.payments.map(p => `
    <tr class="hover:bg-zinc-200/30 dark:hover:bg-white/[0.02] transition-colors">
      <td class="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 font-mono whitespace-nowrap tabular-nums">${p.fecha || '-'}</td>
      <td class="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap">${escapeHtml(p.trabajadorNombre || '')}</td>
      <td class="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 max-w-xs truncate" title="${escapeHtml(p.referencia || '')}">
        ${escapeHtml(p.referencia || 'Pago')}
      </td>
      <td class="py-2.5 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
        $${Number(p.monto || 0).toFixed(2)}
      </td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        <button 
          onclick="window.requestDelete('pagos', '${p.id}', 'Pago de $${Number(p.monto || 0).toFixed(2)} a ${escapeHtml(p.trabajadorNombre || '')}')"
          class="text-zinc-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-500/10 transition-colors active:scale-95"
          title="Eliminar pago">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

/* ============================================================================
   11. CÁLCULO DINÁMICO: DASHBOARD FINANCIERO Y KPIS
   ============================================================================ */
function updateFinancialDashboard() {
  if (state.workers.length === 0) {
    elements.financialTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
          Agrega trabajadores para visualizar el balance financiero en tiempo real.
        </td>
      </tr>
    `;
    resetKPIs();
    return;
  }

  let totalHorasGlobal = 0;
  let totalSegundosGlobal = 0;
  let totalGeneradoGlobal = 0;
  let totalPagadoGlobal = 0;

  const rowsHtml = state.workers.map(worker => {
    const workerTasks = state.tasks.filter(t => t.trabajadorId === worker.id);
    const workerSeconds = workerTasks.reduce((acc, t) => acc + (Number(t.segundos) || 0), 0);
    const workerHours = workerTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
    const workerEarned = workerTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);

    const workerPayments = state.payments.filter(p => p.trabajadorId === worker.id);
    const workerPaid = workerPayments.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    const pendingBalance = Number((workerEarned - workerPaid).toFixed(2));

    totalSegundosGlobal += workerSeconds;
    totalHorasGlobal += workerHours;
    totalGeneradoGlobal += workerEarned;
    totalPagadoGlobal += workerPaid;

    // Badges limpios con diseño Vercel
    let balanceBadge = "";
    if (pendingBalance > 0.005) {
      // Deuda activa: Rojo con micro-pulso
      balanceBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 tabular-nums animate-pulse">
          <i class="fa-solid fa-triangle-exclamation text-[10px]"></i>
          +$${pendingBalance.toFixed(2)}
        </span>
      `;
    } else if (pendingBalance === 0) {
      // Al día: Esmeralda suave
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
          <i class="fa-solid fa-check text-[10px]"></i>
          $0.00
        </span>
      `;
    } else {
      // A favor de la empresa: Azul tenue
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 tabular-nums">
          <i class="fa-solid fa-arrow-down text-[10px]"></i>
          -$${Math.abs(pendingBalance).toFixed(2)}
        </span>
      `;
    }

    return `
      <tr class="hover:bg-zinc-200/30 dark:hover:bg-white/[0.02] transition-colors">
        <td class="py-3 px-3 font-semibold text-zinc-900 dark:text-white">
          <div class="flex items-center gap-2.5">
            <div class="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-[10px] font-bold">
              ${worker.nombre.charAt(0).toUpperCase()}
            </div>
            <span>${escapeHtml(worker.nombre)}</span>
          </div>
        </td>
        <td class="py-3 px-2 text-right font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
          $${Number(worker.tarifaHora || 0).toFixed(2)}/h
        </td>
        <td class="py-3 px-2 text-right font-mono text-zinc-900 dark:text-zinc-200 tabular-nums">
          <span class="font-semibold">${workerHours.toFixed(2)}h</span>
          <span class="text-[10px] text-zinc-400 dark:text-zinc-500 block">${formatSecondsToTime(workerSeconds)}</span>
        </td>
        <td class="py-3 px-2 text-right font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">
          $${workerEarned.toFixed(2)}
        </td>
        <td class="py-3 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          $${workerPaid.toFixed(2)}
        </td>
        <td class="py-3 px-3 text-right">
          ${balanceBadge}
        </td>
      </tr>
    `;
  }).join("");

  elements.financialTableBody.innerHTML = rowsHtml;

  // Actualizar KPIs Globales
  const globalBalance = Number((totalGeneradoGlobal - totalPagadoGlobal).toFixed(2));
  elements.kpiTotalHoras.textContent = totalHorasGlobal.toFixed(2);
  elements.kpiTotalHorasFormatted.textContent = `${formatSecondsToTime(totalSegundosGlobal)} en total`;
  elements.kpiTotalGenerado.textContent = `$${totalGeneradoGlobal.toFixed(2)}`;
  elements.kpiTotalPagado.textContent = `$${totalPagadoGlobal.toFixed(2)}`;

  if (globalBalance > 0.005) {
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 tabular-nums";
    elements.kpiSaldoPendiente.textContent = `$${globalBalance.toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = "Deuda total por liquidar";
  } else if (globalBalance === 0) {
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums";
    elements.kpiSaldoPendiente.textContent = "$0.00";
    elements.kpiSaldoDesc.textContent = "Todos los pagos al día";
  } else {
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400 tabular-nums";
    elements.kpiSaldoPendiente.textContent = `+$${Math.abs(globalBalance).toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = "Saldo a favor de la empresa";
  }
}

function resetKPIs() {
  elements.kpiTotalHoras.textContent = "0.00";
  elements.kpiTotalHorasFormatted.textContent = "0h 0m 0s en total";
  elements.kpiTotalGenerado.textContent = "$0.00";
  elements.kpiTotalPagado.textContent = "$0.00";
  elements.kpiSaldoPendiente.textContent = "$0.00";
  elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 tabular-nums";
}

/* ============================================================================
   12. GESTIÓN DE ELIMINACIONES CON MODAL
   ============================================================================ */
window.requestDelete = function(collectionName, id, label) {
  state.deleteTarget = { collection: collectionName, id, label };
  elements.deleteModalText.innerHTML = `¿Seguro que deseas eliminar <strong>${label}</strong>? Se recalcularán los saldos.`;
  elements.deleteModal.classList.remove("hidden");
  elements.deleteModal.classList.add("flex");
};

function closeDeleteModal() {
  elements.deleteModal.classList.add("hidden");
  elements.deleteModal.classList.remove("flex");
  state.deleteTarget = null;
}

async function confirmDelete() {
  if (!state.deleteTarget) return;
  const { collection: colName, id, label } = state.deleteTarget;

  try {
    if (db) {
      await deleteDoc(doc(db, colName, id));
    } else {
      if (colName === "trabajadores") state.workers = state.workers.filter(w => w.id !== id);
      if (colName === "tareas") state.tasks = state.tasks.filter(t => t.id !== id);
      if (colName === "pagos") state.payments = state.payments.filter(p => p.id !== id);
      updateWorkersUI();
      updateTasksUI();
      updatePaymentsUI();
      updateFinancialDashboard();
    }

    showToast(`Eliminado: ${label}`, "info");
  } catch (error) {
    console.error("Error al eliminar documento:", error);
    showToast("Error al eliminar: " + error.message, "error");
  } finally {
    closeDeleteModal();
  }
}

/* ============================================================================
   13. EVENT LISTENERS Y UTILIDADES
   ============================================================================ */
function setupEventListeners() {
  // Cronómetro
  elements.btnStart.addEventListener("click", startTimer);
  elements.btnPause.addEventListener("click", pauseTimer);
  elements.btnReset.addEventListener("click", resetTimer);
  elements.btnRegisterTask.addEventListener("click", handleRegisterTask);
  elements.timerWorkerSelect.addEventListener("change", updateLiveCost);

  // Tema Claro / Oscuro
  elements.themeToggle.addEventListener("click", toggleTheme);

  // Formularios
  elements.formWorker.addEventListener("submit", handleSaveWorker);
  elements.formPayment.addEventListener("submit", handleSavePayment);

  // Pestañas Segmented Control
  elements.tabTasks.addEventListener("click", () => switchTab("tasks"));
  elements.tabPayments.addEventListener("click", () => switchTab("payments"));

  // Modal Borrado
  elements.btnCancelDelete.addEventListener("click", closeDeleteModal);
  elements.btnConfirmDelete.addEventListener("click", confirmDelete);
  elements.deleteModal.addEventListener("click", (e) => {
    if (e.target === elements.deleteModal) closeDeleteModal();
  });
}

function switchTab(tab) {
  if (tab === "tasks") {
    elements.tabTasks.classList.add("active");
    elements.tabPayments.classList.remove("active");
    elements.tasksView.classList.remove("hidden");
    elements.paymentsView.classList.add("hidden");
  } else {
    elements.tabPayments.classList.add("active");
    elements.tabTasks.classList.remove("active");
    elements.paymentsView.classList.remove("hidden");
    elements.tasksView.classList.add("hidden");
  }
}

function initDefaultDate() {
  if (elements.paymentDate) {
    elements.paymentDate.value = new Date().toISOString().split("T")[0];
  }
}

function initClock() {
  function updateTime() {
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleTimeString();
  }
  updateTime();
  setInterval(updateTime, 1000);
}

function updateDbStatus(connected, text) {
  if (!elements.dbStatus) return;
  if (connected) {
    elements.dbStatus.innerHTML = `
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span class="text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">${text || "Firestore Conectado"}</span>
    `;
  } else {
    elements.dbStatus.innerHTML = `
      <span class="relative flex h-2 w-2">
        <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
      </span>
      <span class="text-amber-600 dark:text-amber-300 font-medium text-[11px]">${text || "Modo Local"}</span>
    `;
  }
}

function formatSecondsToTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================================
   14. SISTEMA DE TOASTS ESTILO SONNER (Emil Kowalski)
   ============================================================================ */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "sonner-toast";

  let icon = "fa-circle-info text-blue-500";
  if (type === "success") icon = "fa-circle-check text-emerald-500";
  else if (type === "warning") icon = "fa-triangle-exclamation text-amber-500";
  else if (type === "error") icon = "fa-circle-xmark text-rose-500";

  toast.innerHTML = `
    <i class="fa-solid ${icon} text-sm flex-shrink-0"></i>
    <span class="text-xs sm:text-[13px] font-medium flex-1">${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("sonner-toast-exit");
    setTimeout(() => toast.remove(), 180);
  }, 3200);
}

function loadLocalFallbackData() {
  state.workers = [
    { id: "mock_1", nombre: "Carlos Méndez", tarifaHora: 20.00 },
    { id: "mock_2", nombre: "Lucía Morales", tarifaHora: 25.00 }
  ];
  state.tasks = [
    {
      id: "mock_t1",
      fecha: new Date().toISOString().split("T")[0],
      trabajadorId: "mock_1",
      trabajadorNombre: "Carlos Méndez",
      descripcion: "Desarrollo de landing page",
      segundos: 7200,
      horas: 2.0,
      tarifaHora: 20.00,
      costoTotal: 40.00
    }
  ];
  state.payments = [
    {
      id: "mock_p1",
      fecha: new Date().toISOString().split("T")[0],
      trabajadorId: "mock_1",
      trabajadorNombre: "Carlos Méndez",
      monto: 15.00,
      referencia: "Anticipo de prueba"
    }
  ];

  updateWorkersUI();
  updateTasksUI();
  updatePaymentsUI();
  updateFinancialDashboard();
}
