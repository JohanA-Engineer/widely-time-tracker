/**
 * ============================================================================
 * WIDELY TIME TRACKER & FINANCIAL DASHBOARD
 * Lógica Frontend y Conexión en Tiempo Real con Firebase Firestore (SDK v10 ESM)
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
   1. CONFIGURACIÓN DE FIREBASE
   ¡REEMPLAZA ESTOS VALORES CON LOS DE TU CONSOLA DE FIREBASE!
   (En la sección de configuración de tu proyecto web en Firebase Console)
   ============================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCrAmepLxl7Tmtq7GNsjMmishqGYtQWXbY",
  authDomain: "widely-time-tracker.firebaseapp.com",
  projectId: "widely-time-tracker",
  storageBucket: "widely-time-tracker.firebasestorage.app",
  messagingSenderId: "919060175591",
  appId: "1:919060175591:web:5e7a812f362e3b1bd8a042"
};

// Verificación de configuración inicial
const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY_AQUI" && !firebaseConfig.apiKey.includes("TU_API_KEY");

let db = null;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase inicializado correctamente.");
    document.getElementById("firebaseWarning")?.classList.add("hidden");
  } catch (err) {
    console.error("Error al conectar con Firebase:", err);
    updateDbStatus(false, "Error de Conexión");
  }
} else {
  console.warn("Firebase no configurado. Usando modo de demostración local.");
  document.getElementById("firebaseWarning")?.classList.remove("hidden");
  updateDbStatus(false, "Credenciales Pendientes");
}

/* ============================================================================
   2. ESTADO GLOBAL DE LA APLICACIÓN
   ============================================================================ */
let state = {
  workers: [],      // Lista de trabajadores
  tasks: [],        // Lista de tareas
  payments: [],     // Lista de pagos
  // Cronómetro
  timer: {
    isRunning: false,
    startTime: 0,
    elapsedSeconds: 0,
    intervalId: null
  },
  // Modal de borrado
  deleteTarget: null // { collection: 'trabajadores'|'tareas'|'pagos', id: string, name: string }
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

  // Pestañas
  tabTasks: document.getElementById("tabTasks"),
  tabPayments: document.getElementById("tabPayments"),
  tasksView: document.getElementById("tasksView"),
  paymentsView: document.getElementById("paymentsView"),

  // KPIs
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

  // Status & Reloj
  currentTime: document.getElementById("currentTime"),
  dbStatus: document.getElementById("dbStatus"),
  toastContainer: document.getElementById("toastContainer")
};

/* ============================================================================
   4. INICIALIZACIÓN
   ============================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initClock();
  initDefaultDate();
  setupEventListeners();

  if (db) {
    listenToFirestore();
  } else {
    // Si aún no han colocado las llaves, proveer datos mock para poder explorar la UI
    loadLocalFallbackData();
  }
});

/* ============================================================================
   5. LISTENERS EN TIEMPO REAL CON FIRESTORE (onSnapshot)
   ============================================================================ */
function listenToFirestore() {
  // A. Colección: trabajadores
  const workersCol = collection(db, "trabajadores");
  onSnapshot(workersCol, (snapshot) => {
    state.workers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a, b) => a.nombre.localeCompare(b.nombre));

    updateWorkersUI();
    updateFinancialDashboard();
  }, (error) => {
    console.error("Error en listener trabajadores:", error);
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
    console.error("Error en listener tareas:", error);
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
    console.error("Error en listener pagos:", error);
    showToast("Error al sincronizar pagos: " + error.message, "error");
  });
}

/* ============================================================================
   6. LÓGICA DEL CRONÓMETRO DE TAREAS
   ============================================================================ */
function startTimer() {
  const workerId = elements.timerWorkerSelect.value;
  if (!workerId) {
    showToast("Por favor, selecciona un trabajador primero.", "warning");
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

  // Actualizar UI
  elements.btnStart.disabled = true;
  elements.btnPause.disabled = false;
  elements.btnReset.disabled = false;
  elements.timerDisplay.classList.add("timer-active");

  elements.timerStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5";
  elements.timerStatusBadge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span> Activo`;
}

function pauseTimer() {
  if (!state.timer.isRunning) return;

  state.timer.isRunning = false;
  clearInterval(state.timer.intervalId);

  elements.btnStart.disabled = false;
  elements.btnPause.disabled = true;
  elements.timerDisplay.classList.remove("timer-active");

  elements.timerStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30";
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

  elements.timerStatusBadge.className = "text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700";
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
    showToast("Selecciona el trabajador para registrar la tarea.", "warning");
    elements.timerWorkerSelect.focus();
    return;
  }

  if (seconds < 1) {
    showToast("El cronómetro debe haber corrido al menos 1 segundo para registrar.", "warning");
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

  // Deshabilitar botón durante el guardado
  elements.btnRegisterTask.disabled = true;
  elements.btnRegisterTask.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;

  try {
    if (db) {
      await addDoc(collection(db, "tareas"), taskData);
    } else {
      // Modo local fallback
      taskData.id = "local_task_" + Date.now();
      state.tasks.unshift(taskData);
      updateTasksUI();
      updateFinancialDashboard();
    }

    showToast(`¡Tarea registrada con éxito! Costo: $${totalCost.toFixed(2)}`, "success");

    // Limpiar formulario y reiniciar cronómetro
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
   7. GESTIÓN DE TRABAJADORES
   ============================================================================ */
async function handleSaveWorker(e) {
  e.preventDefault();

  const name = elements.workerName.value.trim();
  const rate = parseFloat(elements.workerRate.value);

  if (!name || isNaN(rate) || rate < 0) {
    showToast("Ingresa un nombre válido y una tarifa mayor o igual a 0.", "warning");
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

    showToast(`Trabajador "${name}" agregado exitosamente.`, "success");
    elements.formWorker.reset();
  } catch (error) {
    console.error("Error al guardar trabajador:", error);
    showToast("Error al guardar trabajador: " + error.message, "error");
  }
}

/* ============================================================================
   8. REGISTRO DE PAGOS
   ============================================================================ */
async function handleSavePayment(e) {
  e.preventDefault();

  const workerId = elements.paymentWorkerSelect.value;
  const amount = parseFloat(elements.paymentAmount.value);
  const date = elements.paymentDate.value;
  const reference = elements.paymentReference.value.trim();

  if (!workerId) {
    showToast("Selecciona un trabajador para el pago.", "warning");
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showToast("Ingresa un monto de pago válido.", "warning");
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
   9. ACTUALIZACIÓN DE INTERFAZ (UI) Y RENDERIZADO
   ============================================================================ */

// A. Actualizar Desplegables y Lista de Trabajadores
function updateWorkersUI() {
  const currentTimerVal = elements.timerWorkerSelect.value;
  const currentPayVal = elements.paymentWorkerSelect.value;

  // Actualizar selector de Cronómetro
  elements.timerWorkerSelect.innerHTML = `<option value="">-- Selecciona un trabajador --</option>` +
    state.workers.map(w => `
      <option value="${w.id}" data-rate="${w.tarifaHora}">
        ${w.nombre} ($${Number(w.tarifaHora).toFixed(2)}/h)
      </option>
    `).join("");

  // Actualizar selector de Pagos
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

  // Contador
  elements.workerCount.textContent = state.workers.length;

  // Lista lateral de trabajadores con botón para eliminar
  if (state.workers.length === 0) {
    elements.workersList.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">No hay trabajadores registrados aún.</div>`;
  } else {
    elements.workersList.innerHTML = state.workers.map(w => `
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all text-xs">
        <div>
          <div class="font-medium text-slate-200">${escapeHtml(w.nombre)}</div>
          <div class="text-[11px] text-cyan-400 font-mono font-medium">$${Number(w.tarifaHora).toFixed(2)} / hora</div>
        </div>
        <button 
          onclick="window.requestDelete('trabajadores', '${w.id}', '${escapeHtml(w.nombre)}')"
          title="Eliminar trabajador" 
          class="text-slate-500 hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-500/10 transition-colors">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `).join("");
  }

  updateLiveCost();
}

// B. Actualizar Tabla de Tareas
function updateTasksUI() {
  elements.taskCount.textContent = state.tasks.length;

  if (state.tasks.length === 0) {
    elements.tasksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-slate-500 text-xs">No hay tareas registradas todavía.</td>
      </tr>
    `;
    return;
  }

  elements.tasksTableBody.innerHTML = state.tasks.map(t => {
    const formattedTime = formatSecondsToTime(t.segundos || 0);
    return `
      <tr class="hover:bg-slate-800/30 transition-colors">
        <td class="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">${t.fecha || '-'}</td>
        <td class="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">${escapeHtml(t.trabajadorNombre || 'Anónimo')}</td>
        <td class="py-2.5 px-3 text-slate-300 max-w-xs truncate" title="${escapeHtml(t.descripcion || '')}">
          ${escapeHtml(t.descripcion || 'Sin descripción')}
        </td>
        <td class="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
          ${formattedTime} <span class="text-[10px] text-slate-500">(${Number(t.horas || 0).toFixed(2)}h)</span>
        </td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-cyan-400 whitespace-nowrap">
          $${Number(t.costoTotal || 0).toFixed(2)}
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          <button 
            onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
            class="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
            title="Eliminar tarea">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// C. Actualizar Tabla de Pagos
function updatePaymentsUI() {
  elements.paymentCount.textContent = state.payments.length;

  if (state.payments.length === 0) {
    elements.paymentsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-slate-500 text-xs">No hay pagos registrados.</td>
      </tr>
    `;
    return;
  }

  elements.paymentsTableBody.innerHTML = state.payments.map(p => `
    <tr class="hover:bg-slate-800/30 transition-colors">
      <td class="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">${p.fecha || '-'}</td>
      <td class="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">${escapeHtml(p.trabajadorNombre || '')}</td>
      <td class="py-2.5 px-3 text-slate-300 max-w-xs truncate" title="${escapeHtml(p.referencia || '')}">
        ${escapeHtml(p.referencia || 'Pago')}
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
        $${Number(p.monto || 0).toFixed(2)}
      </td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        <button 
          onclick="window.requestDelete('pagos', '${p.id}', 'Pago de $${Number(p.monto || 0).toFixed(2)} a ${escapeHtml(p.trabajadorNombre || '')}')"
          class="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
          title="Eliminar pago">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

/* ============================================================================
   10. CÁLCULO DINÁMICO: DASHBOARD FINANCIERO Y KPIS
   ============================================================================ */
function updateFinancialDashboard() {
  if (state.workers.length === 0) {
    elements.financialTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-500 text-xs">
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
    // 1. Filtrar tareas del trabajador
    const workerTasks = state.tasks.filter(t => t.trabajadorId === worker.id);
    const workerSeconds = workerTasks.reduce((acc, t) => acc + (Number(t.segundos) || 0), 0);
    const workerHours = workerTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
    const workerEarned = workerTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);

    // 2. Filtrar pagos del trabajador
    const workerPayments = state.payments.filter(p => p.trabajadorId === worker.id);
    const workerPaid = workerPayments.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    // 3. Saldo Pendiente: (Generado - Pagado)
    const pendingBalance = Number((workerEarned - workerPaid).toFixed(2));

    // Acumuladores globales
    totalSegundosGlobal += workerSeconds;
    totalHorasGlobal += workerHours;
    totalGeneradoGlobal += workerEarned;
    totalPagadoGlobal += workerPaid;

    // Badge y estilo de saldo pendiente
    let balanceBadge = "";
    if (pendingBalance > 0.005) {
      // Se le debe dinero (ROJO DESTACADO según el requerimiento)
      balanceBadge = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
          <i class="fa-solid fa-triangle-exclamation text-[10px]"></i>
          +$${pendingBalance.toFixed(2)}
        </span>
      `;
    } else if (pendingBalance === 0) {
      // Al día
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <i class="fa-solid fa-check text-[10px]"></i>
          $0.00
        </span>
      `;
    } else {
      // Saldo negativo: Pagado más de lo generado (A favor de la empresa)
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <i class="fa-solid fa-arrow-down text-[10px]"></i>
          -$${Math.abs(pendingBalance).toFixed(2)} (A favor)
        </span>
      `;
    }

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="py-3 px-4 font-semibold text-white">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
              ${worker.nombre.charAt(0).toUpperCase()}
            </div>
            <span>${escapeHtml(worker.nombre)}</span>
          </div>
        </td>
        <td class="py-3 px-3 text-right font-mono text-slate-300">
          $${Number(worker.tarifaHora || 0).toFixed(2)}/h
        </td>
        <td class="py-3 px-3 text-right font-mono text-slate-200">
          <span class="font-bold">${workerHours.toFixed(2)}</span>
          <span class="text-xs text-slate-500 block">${formatSecondsToTime(workerSeconds)}</span>
        </td>
        <td class="py-3 px-3 text-right font-mono font-bold text-cyan-400">
          $${workerEarned.toFixed(2)}
        </td>
        <td class="py-3 px-3 text-right font-mono font-bold text-emerald-400">
          $${workerPaid.toFixed(2)}
        </td>
        <td class="py-3 px-4 text-right">
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
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-rose-400";
    elements.kpiSaldoPendiente.textContent = `$${globalBalance.toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = "Deuda total por liquidar a trabajadores";
  } else if (globalBalance === 0) {
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-emerald-400";
    elements.kpiSaldoPendiente.textContent = "$0.00";
    elements.kpiSaldoDesc.textContent = "Todos los pagos están al día";
  } else {
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-cyan-400";
    elements.kpiSaldoPendiente.textContent = `+$${Math.abs(globalBalance).toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = "Anticipos a favor de la empresa";
  }
}

function resetKPIs() {
  elements.kpiTotalHoras.textContent = "0.00";
  elements.kpiTotalHorasFormatted.textContent = "0h 0m 0s en total";
  elements.kpiTotalGenerado.textContent = "$0.00";
  elements.kpiTotalPagado.textContent = "$0.00";
  elements.kpiSaldoPendiente.textContent = "$0.00";
  elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-rose-400";
}

/* ============================================================================
   11. GESTIÓN DE ELIMINACIONES CON MODAL
   ============================================================================ */
window.requestDelete = function(collectionName, id, label) {
  state.deleteTarget = { collection: collectionName, id, label };
  elements.deleteModalText.innerHTML = `¿Seguro que deseas eliminar <strong>${label}</strong>? Se recalcularán los saldos de inmediato.`;
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
      // Local fallback
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
   12. EVENT LISTENERS Y UTILIDADES
   ============================================================================ */
function setupEventListeners() {
  // Cronómetro
  elements.btnStart.addEventListener("click", startTimer);
  elements.btnPause.addEventListener("click", pauseTimer);
  elements.btnReset.addEventListener("click", resetTimer);
  elements.btnRegisterTask.addEventListener("click", handleRegisterTask);
  elements.timerWorkerSelect.addEventListener("change", updateLiveCost);

  // Formularios
  elements.formWorker.addEventListener("submit", handleSaveWorker);
  elements.formPayment.addEventListener("submit", handleSavePayment);

  // Pestañas Historial
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
      <span class="text-slate-300 font-medium">${text || "Firestore Conectado"}</span>
    `;
  } else {
    elements.dbStatus.innerHTML = `
      <span class="relative flex h-2 w-2">
        <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
      </span>
      <span class="text-amber-300 font-medium">${text || "Modo Local"}</span>
    `;
  }
}

// Formatear segundos en formato HH:MM:SS
function formatSecondsToTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Escapar texto contra XSS en inserciones dinámicas
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Sistema de Notificaciones Toast
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast";

  let icon = "fa-circle-info text-blue-400";
  let border = "border-slate-800";
  if (type === "success") {
    icon = "fa-circle-check text-emerald-400";
    border = "border-emerald-500/40";
  } else if (type === "warning") {
    icon = "fa-triangle-exclamation text-amber-400";
    border = "border-amber-500/40";
  } else if (type === "error") {
    icon = "fa-circle-xmark text-rose-400";
    border = "border-rose-500/40";
  }

  toast.classList.add(border);
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-base flex-shrink-0"></i>
    <span class="text-slate-200 text-xs sm:text-sm font-medium flex-1">${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Datos de demostración iniciales (se usan si aún no se ha colocado la API key)
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
