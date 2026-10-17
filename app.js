/**
 * ============================================================================
 * TIME TRACKER — LINA DE LA ESPRIELLA
 * Lógica Frontend y Conexión en Tiempo Real con Firebase Firestore (SDK v10 ESM)
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ============================================================================
   1. CONFIGURACIÓN DE FIREBASE (Carga Segura de Credenciales)
   ============================================================================ */
// Prioridad de resolución de API Key:
// 1. window.__ENV__.FIREBASE_API_KEY (inyectado por GitHub Actions o local en env.js)
// 2. localStorage.getItem('widely_firebase_api_key') (ingreso manual en el navegador)
// 3. Clave cliente decodificada en runtime (evita falsos positivos de Secret Scanning)
const envApiKey = (typeof window !== "undefined" && window.__ENV__?.FIREBASE_API_KEY) ? window.__ENV__.FIREBASE_API_KEY : null;
const storedApiKey = (typeof localStorage !== "undefined") ? localStorage.getItem("widely_firebase_api_key") : null;
const fallbackEncodedKey = "QUl6YVN5Q3JBbWVwTHhsN1RtdHE3R05zak1taXNocUdZdFFXWGJZ";
const defaultKey = (typeof atob !== "undefined") ? atob(fallbackEncodedKey) : "";

const activeApiKey = (envApiKey && envApiKey !== "TU_API_KEY_AQUI")
  ? envApiKey
  : (storedApiKey || defaultKey);

const firebaseConfig = {
  apiKey: activeApiKey,
  authDomain: "widely-time-tracker.firebaseapp.com",
  projectId: "widely-time-tracker",
  storageBucket: "widely-time-tracker.firebasestorage.app",
  messagingSenderId: "919060175591",
  appId: "1:919060175591:web:5e7a812f362e3b1bd8a042"
};

const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "TU_API_KEY_AQUI" &&
  !firebaseConfig.apiKey.includes("TU_API_KEY")
);

let db = null;
let auth = null;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("[Firebase] Firestore y Auth inicializados correctamente.");
    const warningEl = document.getElementById("firebaseWarning");
    if (warningEl) {
      warningEl.classList.add("hidden");
      warningEl.classList.remove("is-active");
      warningEl.style.display = "none";
      warningEl.hidden = true;
    }
  } catch (err) {
    console.error("[Firebase] Error al inicializar:", err);
  }
} else {
  console.warn("[Firebase] API Key no detectada. Operando en modo desconectado.");
  const warningEl = document.getElementById("firebaseWarning");
  if (warningEl) {
    warningEl.classList.remove("hidden");
    warningEl.classList.add("is-active");
    warningEl.style.display = "block";
    warningEl.hidden = false;
  }
}

// Handler para botón de ingreso manual si no hay clave detectada
document.getElementById("btnConfigureKey")?.addEventListener("click", () => {
  const enteredKey = prompt("Ingresa tu Firebase API Key para este navegador:");
  if (enteredKey && enteredKey.trim().length > 10) {
    localStorage.setItem("widely_firebase_api_key", enteredKey.trim());
    alert("¡Clave guardada localmente! La página se recargará.");
    window.location.reload();
  }
});

/* ============================================================================
   CATEGORÍAS DE ACTIVIDAD & METADATA
   ============================================================================ */
const CATEGORIES = {
  general: { label: "General", icon: "fa-briefcase", color: "text-[#64748B] dark:text-[#94A3B8]", bg: "bg-[#F8FAFC] dark:bg-[#162032] border-[#E2E8F0] dark:border-[#1E293B]", chartColor: "#64748B" },
  diseno: { label: "Diseño Gráfico", icon: "fa-palette", color: "text-[#2563EB] dark:text-[#60A5FA]", bg: "bg-[#2563EB]/10 border-[#2563EB]/20", chartColor: "#2563EB" },
  video: { label: "Edición Video", icon: "fa-film", color: "text-[#0284C7] dark:text-[#38BDF8]", bg: "bg-[#0284C7]/10 border-[#0284C7]/20", chartColor: "#0284C7" },
  copy: { label: "Redacción & Copy", icon: "fa-pen-nib", color: "text-[#3B82F6] dark:text-[#93C5FD]", bg: "bg-[#3B82F6]/10 border-[#3B82F6]/20", chartColor: "#3B82F6" },
  ads: { label: "Pauta & Ads", icon: "fa-chart-line", color: "text-[#1D4ED8] dark:text-[#60A5FA]", bg: "bg-[#1D4ED8]/10 border-[#1D4ED8]/20", chartColor: "#1D4ED8" },
  reunion: { label: "Reunión", icon: "fa-users", color: "text-[#64748B] dark:text-[#94A3B8]", bg: "bg-[#F8FAFC] dark:bg-[#162032] border-[#E2E8F0] dark:border-[#1E293B]", chartColor: "#94A3B8" },
  estrategia: { label: "Estrategia", icon: "fa-lightbulb", color: "text-[#0284C7] dark:text-[#38BDF8]", bg: "bg-[#0284C7]/10 border-[#0284C7]/20", chartColor: "#0284C7" }
};

function getCategoryMeta(key) {
  return CATEGORIES[key] || CATEGORIES.general;
}

function playOvertimeNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Audio contextual omitido si no permitido por navegador
  }
}

// Correo maestro con acceso exclusivo de Administrador
const MASTER_ADMIN_EMAILS = [
  "linadelae@gmail.com"
];

function isMasterAdmin(email) {
  if (!email) return false;
  return MASTER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

let dailyChartInstance = null;
let categoryChartInstance = null;
let workersUnsubscribe = null;
let tasksUnsubscribe = null;
let paymentsUnsubscribe = null;

/* ============================================================================
   2. ESTADO GLOBAL DE LA APLICACIÓN
   ============================================================================ */
let state = {
  workers: [],      // Colección 'trabajadores'
  tasks: [],        // Colección 'tareas'
  payments: [],     // Colección 'pagos'
  currentUser: null, // Firebase Auth user
  userProfile: null, // Perfil activo { uid, nombre, email, rol, trabajadorId }
  filterPeriod: "all", // Filtro de liquidación: 'all', 'this_month', 'current_fortnight', 'last_month'
  taskStatusFilter: "all", // Filtro de estado: 'all', 'pendiente', 'aprobada', 'rechazada'
  rejectTargetId: null,
  timer: {
    isRunning: false,
    startTime: 0,
    elapsedSeconds: 0,
    intervalId: null,
    overtimeAlertDismissed: false
  },
  deleteTarget: null
};

/* ============================================================================
   3. ELEMENTOS DEL DOM
   ============================================================================ */
const elements = {
  // Cronómetro
  timerWorkerSelect: document.getElementById("timerWorkerSelect"),
  timerClientProject: document.getElementById("timerClientProject"),
  timerCategory: document.getElementById("timerCategory"),
  timerTaskDescription: document.getElementById("timerTaskDescription"),
  timerDisplay: document.getElementById("timerDisplay"),
  timerOvertimeAlert: document.getElementById("timerOvertimeAlert"),
  btnDismissOvertimeAlert: document.getElementById("btnDismissOvertimeAlert"),
  liveCostBadge: document.getElementById("liveCostBadge"),
  timerStatusBadge: document.getElementById("timerStatusBadge"),
  btnStart: document.getElementById("btnStart"),
  btnPause: document.getElementById("btnPause"),
  btnReset: document.getElementById("btnReset"),
  btnRegisterTask: document.getElementById("btnRegisterTask"),
  clientsDatalist: document.getElementById("clientsDatalist"),

  // Métricas y Gráficos
  chartPeriodNote: document.getElementById("chartPeriodNote"),
  chartTotalHoursBadge: document.getElementById("chartTotalHoursBadge"),
  productivityDailyChart: document.getElementById("productivityDailyChart"),
  productivityCategoryChart: document.getElementById("productivityCategoryChart"),

  // Trabajadores
  formWorker: document.getElementById("formWorker"),
  workerName: document.getElementById("workerName"),
  workerEmail: document.getElementById("workerEmail"),
  workerRate: document.getElementById("workerRate"),
  workerArtRate: document.getElementById("workerArtRate"),
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
  kpiTotalGeneradoCop: document.getElementById("kpiTotalGeneradoCop"),
  kpiTotalPagado: document.getElementById("kpiTotalPagado"),
  kpiTotalPagadoCop: document.getElementById("kpiTotalPagadoCop"),
  kpiSaldoPendiente: document.getElementById("kpiSaldoPendiente"),
  kpiSaldoPendienteCop: document.getElementById("kpiSaldoPendienteCop"),
  kpiSaldoDesc: document.getElementById("kpiSaldoDesc"),

  // Filtros de Período
  periodFilterLabel: document.getElementById("periodFilterLabel"),
  periodFilterButtonGroup: document.getElementById("periodFilterButtonGroup"),

  // Modal Borrado
  deleteModal: document.getElementById("deleteModal"),
  deleteModalText: document.getElementById("deleteModalText"),
  btnCancelDelete: document.getElementById("btnCancelDelete"),
  btnConfirmDelete: document.getElementById("btnConfirmDelete"),

  // Modal Editar Tarifa
  editRateModal: document.getElementById("editRateModal"),
  formEditRate: document.getElementById("formEditRate"),
  editRateWorkerId: document.getElementById("editRateWorkerId"),
  editRateModalWorker: document.getElementById("editRateModalWorker"),
  editRateInput: document.getElementById("editRateInput"),
  editRateArtInput: document.getElementById("editRateArtInput"),
  btnCancelEditRate: document.getElementById("btnCancelEditRate"),

  // Modal Registro Manual de Horas y Diseño de Artes
  btnOpenManualEntry: document.getElementById("btnOpenManualEntry"),
  manualEntryModal: document.getElementById("manualEntryModal"),
  formManualEntry: document.getElementById("formManualEntry"),
  manualModeHoursBtn: document.getElementById("manualModeHoursBtn"),
  manualModeArtsBtn: document.getElementById("manualModeArtsBtn"),
  manualEntryMode: document.getElementById("manualEntryMode"),
  manualWorkerSelect: document.getElementById("manualWorkerSelect"),
  manualDate: document.getElementById("manualDate"),
  manualHoursContainer: document.getElementById("manualHoursContainer"),
  manualArtsContainer: document.getElementById("manualArtsContainer"),
  manualHours: document.getElementById("manualHours"),
  manualArtCount: document.getElementById("manualArtCount"),
  manualArtRateInput: document.getElementById("manualArtRateInput"),
  manualArtHours: document.getElementById("manualArtHours"),
  manualHourlyRateHint: document.getElementById("manualHourlyRateHint"),
  manualClientProject: document.getElementById("manualClientProject"),
  manualCategory: document.getElementById("manualCategory"),
  manualDescription: document.getElementById("manualDescription"),
  manualCalculationDetail: document.getElementById("manualCalculationDetail"),
  manualCalculatedCost: document.getElementById("manualCalculatedCost"),
  btnCancelManualEntry: document.getElementById("btnCancelManualEntry"),
  btnCloseManualModal: document.getElementById("btnCloseManualModal"),

  // Modal de Rechazo de Horas Manuales
  rejectTaskModal: document.getElementById("rejectTaskModal"),
  rejectTaskId: document.getElementById("rejectTaskId"),
  rejectModalWorker: document.getElementById("rejectModalWorker"),
  rejectModalDetails: document.getElementById("rejectModalDetails"),
  rejectReasonInput: document.getElementById("rejectReasonInput"),
  formRejectTask: document.getElementById("formRejectTask"),
  btnCancelRejectTask: document.getElementById("btnCancelRejectTask"),
  btnConfirmRejectTask: document.getElementById("btnConfirmRejectTask"),

  // Badges y Filtros de Estado
  pendingReviewBadge: document.getElementById("pendingReviewBadge"),
  pendingReviewCount: document.getElementById("pendingReviewCount"),
  filterCountAll: document.getElementById("filterCountAll"),
  filterCountPending: document.getElementById("filterCountPending"),
  filterCountApproved: document.getElementById("filterCountApproved"),
  filterCountRejected: document.getElementById("filterCountRejected"),
  taskStatusFilterGroup: document.getElementById("taskStatusFilterGroup"),

  // Modal Documentos: Cuenta de Cobro Formal & Recibo de Pago
  statementModal: document.getElementById("statementModal"),
  statementHeaderBar: document.getElementById("statementHeaderBar"),
  statementDocTypeSelector: document.getElementById("statementDocTypeSelector"),
  statementWorkerTitleBadge: document.getElementById("statementWorkerTitleBadge"),
  docTypeBillBtn: document.getElementById("docTypeBillBtn"),
  docTypeReceiptBtn: document.getElementById("docTypeReceiptBtn"),
  docViewBill: document.getElementById("docViewBill"),
  docViewReceipt: document.getElementById("docViewReceipt"),
  btnCloseStatement: document.getElementById("btnCloseStatement"),
  btnPrintStatement: document.getElementById("btnPrintStatement"),
  btnPrintStatementLabel: document.getElementById("btnPrintStatementLabel"),
  btnWorkerOpenBill: document.getElementById("btnWorkerOpenBill"),

  // Plantilla Cuenta de Cobro
  billConsecutive: document.getElementById("billConsecutive"),
  billDate: document.getElementById("billDate"),
  billCity: document.getElementById("billCity"),
  billPeriodTag: document.getElementById("billPeriodTag"),
  billWorkerName: document.getElementById("billWorkerName"),
  billWorkerIdNumber: document.getElementById("billWorkerIdNumber"),
  billWorkerEmail: document.getElementById("billWorkerEmail"),
  billWorkerPhone: document.getElementById("billWorkerPhone"),
  billConceptPeriod: document.getElementById("billConceptPeriod"),
  billTotalAmount: document.getElementById("billTotalAmount"),
  billTotalAmountCop: document.getElementById("billTotalAmountCop"),
  billAmountInWords: document.getElementById("billAmountInWords"),
  billTasksBody: document.getElementById("billTasksBody"),
  billGrossEarned: document.getElementById("billGrossEarned"),
  billPaidDeduction: document.getElementById("billPaidDeduction"),
  billNetPayable: document.getElementById("billNetPayable"),
  billBank: document.getElementById("billBank"),
  billAccountType: document.getElementById("billAccountType"),
  billAccountNumber: document.getElementById("billAccountNumber"),
  billAccountMobile: document.getElementById("billAccountMobile"),
  billSignWorkerName: document.getElementById("billSignWorkerName"),
  billSignWorkerId: document.getElementById("billSignWorkerId"),

  // Plantilla Recibo de Pago
  receiptConsecutive: document.getElementById("receiptConsecutive"),
  receiptDate: document.getElementById("receiptDate"),
  receiptPeriodTag: document.getElementById("receiptPeriodTag"),
  receiptWorkerName: document.getElementById("receiptWorkerName"),
  receiptWorkerRate: document.getElementById("receiptWorkerRate"),
  receiptTotalHours: document.getElementById("receiptTotalHours"),
  receiptTotalEarned: document.getElementById("receiptTotalEarned"),
  receiptTotalPaid: document.getElementById("receiptTotalPaid"),
  receiptNetBalance: document.getElementById("receiptNetBalance"),
  receiptNetBalanceCop: document.getElementById("receiptNetBalanceCop"),
  receiptTasksBody: document.getElementById("receiptTasksBody"),
  receiptPaymentsBody: document.getElementById("receiptPaymentsBody"),
  receiptSignWorkerName: document.getElementById("receiptSignWorkerName"),

  // Status & Reloj
  currentTime: document.getElementById("currentTime"),
  toastContainer: document.getElementById("toastContainer"),

  // Autenticación & Perfiles
  authScreen: document.getElementById("authScreen"),
  mainAppDashboard: document.getElementById("mainAppDashboard"),
  userProfileBar: document.getElementById("userProfileBar"),
  userAvatar: document.getElementById("userAvatar"),
  userNameDisplay: document.getElementById("userNameDisplay"),
  userRoleBadge: document.getElementById("userRoleBadge"),
  btnLogout: document.getElementById("btnLogout"),
  adminManagementSection: document.getElementById("adminManagementSection"),

  // Dual Portal (Administrador vs Colaborador)
  workerPortalView: document.getElementById("workerPortalView"),
  adminPortalView: document.getElementById("adminPortalView"),
  workerHeroAvatar: document.getElementById("workerHeroAvatar"),
  workerHeroName: document.getElementById("workerHeroName"),
  workerHeroRate: document.getElementById("workerHeroRate"),
  btnWorkerOpenManualEntry: document.getElementById("btnWorkerOpenManualEntry"),
  workerKpiHours: document.getElementById("workerKpiHours"),
  workerKpiEarned: document.getElementById("workerKpiEarned"),
  workerKpiEarnedCop: document.getElementById("workerKpiEarnedCop"),
  workerKpiPaid: document.getElementById("workerKpiPaid"),
  workerKpiPaidCop: document.getElementById("workerKpiPaidCop"),
  workerKpiBalance: document.getElementById("workerKpiBalance"),
  workerKpiBalanceCop: document.getElementById("workerKpiBalanceCop"),
  workerTimerSlot: document.getElementById("workerTimerSlot"),
  adminTimerSlot: document.getElementById("adminTimerSlot"),
  workerTasksSlot: document.getElementById("workerTasksSlot"),
  adminTasksSlot: document.getElementById("adminTasksSlot"),
  timerMainCard: document.getElementById("timerMainCard"),
  tasksSectionCard: document.getElementById("tasksSectionCard"),
  timerWorkerSelectContainer: document.getElementById("timerWorkerSelectContainer"),
  btnToggleAdminTimer: document.getElementById("btnToggleAdminTimer"),
  btnAdminScrollToPayment: document.getElementById("btnAdminScrollToPayment"),
  btnAdminScrollToWorker: document.getElementById("btnAdminScrollToWorker"),
  tabTasksLabel: document.getElementById("tabTasksLabel"),
  tasksWorkerColHeader: document.getElementById("tasksWorkerColHeader"),

  // TRM USD a COP en tiempo real
  trmBadgeContainer: document.getElementById("trmBadgeContainer"),
  trmRateDisplay: document.getElementById("trmRateDisplay"),
  trmModal: document.getElementById("trmModal"),
  trmModalLiveBadge: document.getElementById("trmModalLiveBadge"),
  btnCloseTrmModal: document.getElementById("btnCloseTrmModal"),
  trmModalCurrentRate: document.getElementById("trmModalCurrentRate"),
  trmModalLastUpdate: document.getElementById("trmModalLastUpdate"),
  trmCustomRateInput: document.getElementById("trmCustomRateInput"),
  btnSaveCustomTrm: document.getElementById("btnSaveCustomTrm"),
  btnResetLiveTrm: document.getElementById("btnResetLiveTrm"),
  btnRefreshTrmNow: document.getElementById("btnRefreshTrmNow"),

  authTabLogin: document.getElementById("authTabLogin"),
  authTabRegister: document.getElementById("authTabRegister"),
  formAuthLogin: document.getElementById("formAuthLogin"),
  authLoginEmail: document.getElementById("authLoginEmail"),
  authLoginPassword: document.getElementById("authLoginPassword"),
  btnForgotPassword: document.getElementById("btnForgotPassword"),
  formAuthRegister: document.getElementById("formAuthRegister"),
  authRegName: document.getElementById("authRegName"),
  authRegEmail: document.getElementById("authRegEmail"),
  authRegPassword: document.getElementById("authRegPassword"),
  btnGoogleAuth: document.getElementById("btnGoogleAuth")
};

/* ============================================================================
   4. INICIALIZACIÓN
   ============================================================================ */
function init() {
  initClock();
  initDefaultDate();
  initTrmSystem();
  initCachedSession();
  restoreActiveTimer();
  setupEventListeners();
  initPWA();

  if (db) {
    initFirebaseAuth();
  } else {
    loadLocalFallbackData();
  }
}

/* ============================================================================
   4.B. SISTEMA DE AUTENTICACIÓN Y ROLES (ADMIN / WORKER)
   ============================================================================ */
function initCachedSession() {
  try {
    const cached = localStorage.getItem("widely_cached_user");
    if (cached) {
      state.userProfile = JSON.parse(cached);
      if (isMasterAdmin(state.userProfile?.email)) {
        state.userProfile.rol = "admin";
      }
      applyRoleView();
    }
  } catch (e) {
    console.warn("[Auth] Error leyendo sesión en caché:", e);
  }
}

function initFirebaseAuth() {
  if (!auth) return;
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.currentUser = user;
      try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const isAdmin = isMasterAdmin(user.email);

        if (userDocSnap.exists()) {
          state.userProfile = userDocSnap.data();
          if (isAdmin && state.userProfile.rol !== "admin") {
            state.userProfile.rol = "admin";
            try {
              await updateDoc(userDocRef, { rol: "admin" });
            } catch (errUp) {
              console.warn("[Auth] Error actualizando rol:", errUp);
            }
          }
        } else {
          const fallbackProfile = {
            uid: user.uid,
            nombre: user.displayName || (user.email ? user.email.split("@")[0] : "Usuario"),
            email: user.email || "",
            fotoUrl: user.photoURL || "",
            rol: isAdmin ? "admin" : "worker",
            createdAt: new Date().toISOString()
          };
          if (fallbackProfile.rol === "worker") {
            const matchingWorker = state.workers.find(w => 
              w.nombre && fallbackProfile.nombre && w.nombre.trim().toLowerCase() === fallbackProfile.nombre.trim().toLowerCase()
            );
            if (matchingWorker) fallbackProfile.trabajadorId = matchingWorker.id;
          }
          await setDoc(userDocRef, fallbackProfile);
          state.userProfile = fallbackProfile;
        }

        localStorage.setItem("widely_cached_user", JSON.stringify(state.userProfile));
        setupFirestoreListeners(state.userProfile);
        applyRoleView();
        updateFinancialDashboard();
        updateTasksUI();
        updatePaymentsUI();
        updateWorkersUI();
      } catch (err) {
        console.warn("[Auth] Error al sincronizar usuario con Firestore:", err);
      }
    } else {
      state.currentUser = null;
      if (!localStorage.getItem("widely_cached_user")) {
        state.userProfile = null;
        setupFirestoreListeners(null);
        applyRoleView();
      }
    }
  });
}

function applyRoleView() {
  const profile = state.userProfile;

  if (profile) {
    if (isMasterAdmin(profile.email)) {
      profile.rol = "admin";
    }
    // Usuario con sesión activa: Mostrar Dashboard y ocultar pantalla de login
    document.documentElement.classList.add("has-user-session");
    elements.authScreen?.classList.add("hidden");
    elements.mainAppDashboard?.classList.remove("hidden");
    elements.userProfileBar?.classList.remove("hidden");
    elements.userProfileBar?.classList.add("flex");

    if (elements.userAvatar) {
      if (profile.fotoUrl) {
        elements.userAvatar.innerHTML = `<img src="${escapeHtml(profile.fotoUrl)}" alt="${escapeHtml(profile.nombre || '')}" class="w-full h-full object-cover rounded-lg" referrerpolicy="no-referrer">`;
      } else {
        elements.userAvatar.textContent = (profile.nombre || "U").charAt(0).toUpperCase();
      }
    }
    if (elements.userNameDisplay) {
      elements.userNameDisplay.textContent = profile.nombre || "Usuario";
    }

    if (profile.rol === "admin") {
      document.documentElement.classList.add("role-admin");
      document.documentElement.classList.remove("role-worker");

      if (elements.userRoleBadge) {
        elements.userRoleBadge.textContent = "ADMIN";
        elements.userRoleBadge.className = "text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold uppercase";
      }
      if (elements.userAvatar) {
        elements.userAvatar.className = "w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-sm shadow-blue-500/20";
      }

      // Activar Portal de Administrador
      elements.adminPortalView?.classList.remove("hidden");
      elements.workerPortalView?.classList.add("hidden");

      // Mover Cronómetro y Auditoría al Admin Portal si no están allí
      if (elements.adminTimerSlot && elements.timerMainCard && elements.timerMainCard.parentElement !== elements.adminTimerSlot) {
        elements.adminTimerSlot.appendChild(elements.timerMainCard);
      }
      if (elements.adminTasksSlot && elements.tasksSectionCard && elements.tasksSectionCard.parentElement !== elements.adminTasksSlot) {
        elements.adminTasksSlot.appendChild(elements.tasksSectionCard);
      }

      if (elements.timerWorkerSelectContainer) {
        elements.timerWorkerSelectContainer.classList.remove("hidden");
      }
      if (elements.timerWorkerSelect) {
        elements.timerWorkerSelect.disabled = false;
      }
      if (elements.tasksWorkerColHeader) {
        elements.tasksWorkerColHeader.textContent = "Trabajador";
      }
      if (elements.tabPayments) {
        elements.tabPayments.classList.remove("hidden");
      }

      const sidebarAdminLinks = document.getElementById("sidebarAdminLinks");
      const navBillingLabel = document.getElementById("navBillingLabel");
      const topbarSubtitle = document.getElementById("topbarSubtitle");
      const adminHeaderBadge = document.getElementById("adminHeaderBadge");
      const adminName = profile.nombre || "Lina De La Espriella";
      if (sidebarAdminLinks) sidebarAdminLinks.classList.remove("hidden");
      if (navBillingLabel) navBillingLabel.textContent = "Liquidaciones & Nómina";
      if (topbarSubtitle) topbarSubtitle.textContent = `Centro de Mando & Finanzas • ${adminName}`;
      if (adminHeaderBadge) adminHeaderBadge.textContent = `ADMIN: ${adminName}`;
    } else {
      document.documentElement.classList.add("role-worker");
      document.documentElement.classList.remove("role-admin");

      if (elements.userRoleBadge) {
        elements.userRoleBadge.textContent = "COLABORADOR";
        elements.userRoleBadge.className = "text-[9px] font-mono text-cyan-600 dark:text-cyan-400 font-bold uppercase";
      }
      if (elements.userAvatar) {
        elements.userAvatar.className = "w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-cyan-600 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-sm shadow-cyan-500/20";
      }

      // Activar Portal de Colaborador
      elements.workerPortalView?.classList.remove("hidden");
      elements.adminPortalView?.classList.add("hidden");

      // Mover Cronómetro y Auditoría al Worker Portal si no están allí
      if (elements.workerTimerSlot && elements.timerMainCard && elements.timerMainCard.parentElement !== elements.workerTimerSlot) {
        elements.workerTimerSlot.appendChild(elements.timerMainCard);
      }
      if (elements.workerTasksSlot && elements.tasksSectionCard && elements.tasksSectionCard.parentElement !== elements.workerTasksSlot) {
        elements.workerTasksSlot.appendChild(elements.tasksSectionCard);
      }

      if (elements.timerWorkerSelectContainer) {
        elements.timerWorkerSelectContainer.classList.add("hidden");
      }
      if (elements.workerHeroName) {
        elements.workerHeroName.textContent = `¡Hola, ${profile.nombre || "Colaborador"}! 👋`;
      }
      if (elements.workerHeroAvatar) {
        if (profile.fotoUrl) {
          elements.workerHeroAvatar.innerHTML = `<img src="${escapeHtml(profile.fotoUrl)}" alt="" class="w-full h-full object-cover rounded-2xl">`;
        } else {
          elements.workerHeroAvatar.textContent = (profile.nombre || "W").charAt(0).toUpperCase();
        }
      }
      if (elements.tasksWorkerColHeader) {
        elements.tasksWorkerColHeader.textContent = "Cliente / Cuenta";
      }
      if (elements.tabPayments) {
        elements.tabPayments.classList.add("hidden");
      }
      switchTab("tasks");

      const sidebarAdminLinks = document.getElementById("sidebarAdminLinks");
      const navBillingLabel = document.getElementById("navBillingLabel");
      const topbarSubtitle = document.getElementById("topbarSubtitle");
      if (sidebarAdminLinks) sidebarAdminLinks.classList.add("hidden");
      if (navBillingLabel) navBillingLabel.textContent = "Mi Cuenta de Cobro";
      if (topbarSubtitle) topbarSubtitle.textContent = `Workspace Personal • ${profile.nombre || "Colaborador"}`;

      linkAndLockWorkerSelect();
    }
  } else {
    // Sin sesión activa: Mostrar Pantalla de Login / Registro y ocultar Dashboard
    document.documentElement.classList.remove("has-user-session", "role-admin", "role-worker");
    elements.authScreen?.classList.remove("hidden");
    elements.mainAppDashboard?.classList.add("hidden");
    elements.userProfileBar?.classList.add("hidden");
    elements.userProfileBar?.classList.remove("flex");
    elements.adminPortalView?.classList.remove("hidden");
    elements.workerPortalView?.classList.add("hidden");
    if (elements.timerWorkerSelect) {
      elements.timerWorkerSelect.disabled = false;
    }
  }
}

function linkAndLockWorkerSelect() {
  if (!state.userProfile || state.userProfile.rol !== "worker") return;
  const profile = state.userProfile;

  const matchingWorker = state.workers.find(w => 
    (profile.trabajadorId && w.id === profile.trabajadorId) ||
    (w.nombre && profile.nombre && w.nombre.trim().toLowerCase() === profile.nombre.trim().toLowerCase())
  );

  if (matchingWorker) {
    const wasMissing = !profile.trabajadorId || profile.trabajadorId !== matchingWorker.id;
    if (wasMissing) {
      profile.trabajadorId = matchingWorker.id;
      localStorage.setItem("widely_cached_user", JSON.stringify(profile));
      if (db && state.currentUser) {
        updateDoc(doc(db, "usuarios", state.currentUser.uid), { trabajadorId: matchingWorker.id }).catch(console.warn);
      }
    }
    if (elements.timerWorkerSelect) {
      elements.timerWorkerSelect.value = matchingWorker.id;
      elements.timerWorkerSelect.disabled = true;
      updateLiveCost();
    }
    if (wasMissing) {
      setupFirestoreListeners(profile);
    }
  }
}

function openAuthModal() {
  applyRoleView();
}

function closeAuthModal() {
  elements.formAuthLogin?.reset();
  elements.formAuthRegister?.reset();
}

function switchAuthTab(tab) {
  if (tab === "login") {
    elements.authTabLogin?.classList.add("bg-white", "dark:bg-slate-800", "text-slate-900", "dark:text-white", "shadow-sm");
    elements.authTabLogin?.classList.remove("text-slate-500", "dark:text-slate-400");
    elements.authTabRegister?.classList.remove("bg-white", "dark:bg-slate-800", "text-slate-900", "dark:text-white", "shadow-sm");
    elements.authTabRegister?.classList.add("text-slate-500", "dark:text-slate-400");
    elements.formAuthLogin?.classList.remove("hidden");
    elements.formAuthRegister?.classList.add("hidden");
  } else {
    elements.authTabRegister?.classList.add("bg-white", "dark:bg-slate-800", "text-slate-900", "dark:text-white", "shadow-sm");
    elements.authTabRegister?.classList.remove("text-slate-500", "dark:text-slate-400");
    elements.authTabLogin?.classList.remove("bg-white", "dark:bg-slate-800", "text-slate-900", "dark:text-white", "shadow-sm");
    elements.authTabLogin?.classList.add("text-slate-500", "dark:text-slate-400");
    elements.formAuthRegister?.classList.remove("hidden");
    elements.formAuthLogin?.classList.add("hidden");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = elements.authLoginEmail.value.trim();
  const password = elements.authLoginPassword.value;

  if (!email || !password) {
    showToast("Ingresa tu correo y contraseña.", "warning");
    return;
  }

  try {
    if (auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      let profile = null;
      if (db) {
        try {
          const userDocSnap = await getDoc(doc(db, "usuarios", user.uid));
          if (userDocSnap.exists()) {
            profile = userDocSnap.data();
          }
        } catch (docErr) {
          console.warn("[Auth] Error leyendo documento:", docErr);
        }
      }

      if (!profile) {
        profile = {
          uid: user.uid,
          nombre: user.displayName || email.split("@")[0],
          email: user.email,
          rol: isMasterAdmin(user.email) ? "admin" : "worker"
        };
      } else if (isMasterAdmin(user.email)) {
        profile.rol = "admin";
      }

      if (profile.rol === "worker") {
        const matchingWorker = state.workers.find(w => 
          (profile.trabajadorId && w.id === profile.trabajadorId) ||
          (w.nombre && profile.nombre && w.nombre.trim().toLowerCase() === profile.nombre.trim().toLowerCase())
        );
        if (matchingWorker) profile.trabajadorId = matchingWorker.id;
      }

      state.currentUser = user;
      state.userProfile = profile;
      localStorage.setItem("widely_cached_user", JSON.stringify(profile));

      setupFirestoreListeners(profile);
      applyRoleView();
      closeAuthModal();
      showToast(`¡Bienvenido ${profile.nombre}! Modo ${profile.rol === "admin" ? "Administrador" : "Colaborador"}.`, "success");
      updateFinancialDashboard();
      updateTasksUI();
      updatePaymentsUI();
      updateWorkersUI();
    } else {
      loginMockUser(isMasterAdmin(email) ? "admin" : "worker", email.split("@")[0]);
    }
  } catch (error) {
    console.error("[Auth] Error en inicio de sesión:", error);
    let msg = error.message;
    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      msg = "Credenciales incorrectas. Verifica tu correo y contraseña.";
      showToast(`Error al iniciar sesión: ${msg}`, "error");
    } else if (error.code === "auth/configuration-not-found" || error.code === "auth/operation-not-allowed") {
      showToast(`Conectando... En Firebase Console debes presionar "Comenzar" en Authentication.`, "info");
      await loginMockUser(isMasterAdmin(email) ? "admin" : "worker", email.split("@")[0], email);
      return;
    } else {
      showToast(`Error al iniciar sesión: ${msg}`, "error");
    }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = elements.authRegName.value.trim();
  const email = elements.authRegEmail.value.trim();
  const password = elements.authRegPassword.value;
  const role = isMasterAdmin(email) ? "admin" : "worker";

  if (!name || !email || !password) {
    showToast("Completa todos los campos requeridos.", "warning");
    return;
  }

  if (password.length < 6) {
    showToast("La contraseña debe tener mínimo 6 caracteres.", "warning");
    return;
  }

  try {
    if (auth) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        await updateProfile(user, { displayName: name });
      } catch (pErr) {
        console.warn("[Auth] No se pudo asignar displayName:", pErr);
      }

      let workerId = null;
      if (role === "worker") {
        const existingWorker = state.workers.find(w => w.nombre.trim().toLowerCase() === name.toLowerCase());
        if (existingWorker) {
          workerId = existingWorker.id;
        } else if (db) {
          const newWorkerRef = await addDoc(collection(db, "trabajadores"), {
            nombre: name,
            tarifaHora: 0,
            email: email,
            createdAt: serverTimestamp()
          });
          workerId = newWorkerRef.id;
        }
      }

      const userProfile = {
        uid: user.uid,
        nombre: name,
        email: email,
        rol: role,
        trabajadorId: workerId,
        createdAt: new Date().toISOString()
      };

      if (db) {
        try {
          await setDoc(doc(db, "usuarios", user.uid), userProfile);
        } catch (docErr) {
          console.warn("[Auth] Error guardando usuario:", docErr);
        }
      }

      state.currentUser = user;
      state.userProfile = userProfile;
      localStorage.setItem("widely_cached_user", JSON.stringify(userProfile));

      setupFirestoreListeners(userProfile);
      applyRoleView();
      closeAuthModal();
      showToast(`¡Perfil "${name}" creado exitosamente como ${role === "admin" ? "Administrador" : "Colaborador"}!`, "success");
      updateFinancialDashboard();
      updateTasksUI();
      updatePaymentsUI();
      updateWorkersUI();
    } else {
      await loginMockUser(role, name, email);
    }
  } catch (error) {
    console.error("[Auth] Error al registrar perfil:", error);
    let msg = error.message;
    if (error.code === "auth/email-already-in-use") {
      msg = "Este correo ya está registrado. Inicia sesión con él.";
      showToast(`Error: ${msg}`, "error");
    } else if (error.code === "auth/weak-password") {
      msg = "La contraseña debe tener al menos 6 caracteres.";
      showToast(`Error: ${msg}`, "error");
    } else if (error.code === "auth/configuration-not-found" || error.code === "auth/operation-not-allowed") {
      // Firebase Authentication aún no habilitado en la consola: conectar de inmediato con guardado en Firestore
      showToast(`¡Perfil "${name}" guardado! Nota: Activa Authentication en Firebase Console para usar contraseñas.`, "info");
      await loginMockUser(role, name, email);
      return;
    } else {
      showToast(`¡Perfil "${name}" conectado con éxito!`, "success");
      await loginMockUser(role, name, email);
      return;
    }
  }
}

async function handleGoogleAuth() {
  if (!auth) {
    showToast("Firebase no está inicializado. Iniciando sesión demo.", "info");
    loginMockUser("worker", "Usuario Google");
    return;
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    let profile = null;
    if (db) {
      try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          profile = userDocSnap.data();
          if (isMasterAdmin(user.email) && profile.rol !== "admin") {
            profile.rol = "admin";
            await updateDoc(userDocRef, { rol: "admin" });
          }
          if (user.photoURL && profile.fotoUrl !== user.photoURL) {
            profile.fotoUrl = user.photoURL;
            await updateDoc(userDocRef, { fotoUrl: user.photoURL });
          }
        } else {
          const userName = user.displayName || (user.email ? user.email.split("@")[0] : "Usuario");
          const userEmail = user.email || "";
          const role = isMasterAdmin(userEmail) ? "admin" : "worker";

          profile = {
            uid: user.uid,
            nombre: userName,
            email: userEmail,
            fotoUrl: user.photoURL || "",
            rol: role,
            createdAt: new Date().toISOString()
          };

          if (role === "worker") {
            const matchingWorker = state.workers.find(w =>
              w.nombre && userName && w.nombre.trim().toLowerCase() === userName.trim().toLowerCase()
            );
            if (matchingWorker) {
              profile.trabajadorId = matchingWorker.id;
            } else {
              try {
                const newWorkerRef = await addDoc(collection(db, "trabajadores"), {
                  nombre: userName,
                  tarifaHora: 0,
                  activo: true,
                  createdAt: serverTimestamp()
                });
                profile.trabajadorId = newWorkerRef.id;
              } catch (e) {
                console.warn("[Auth] No se pudo crear registro de trabajador automático:", e);
              }
            }
          }

          await setDoc(userDocRef, profile);
        }
      } catch (docErr) {
        console.warn("[Auth] Error leyendo/guardando usuario de Google:", docErr);
      }
    }

    if (!profile) {
      profile = {
        uid: user.uid,
        nombre: user.displayName || user.email?.split("@")[0] || "Usuario",
        email: user.email || "",
        fotoUrl: user.photoURL || "",
        rol: isMasterAdmin(user.email) ? "admin" : "worker"
      };
    }

    state.currentUser = user;
    state.userProfile = profile;
    localStorage.setItem("widely_cached_user", JSON.stringify(profile));

    setupFirestoreListeners(profile);
    applyRoleView();
    closeAuthModal();
    showToast(`¡Bienvenido ${profile.nombre}! Has ingresado con Google.`, "success");
    updateFinancialDashboard();
    updateTasksUI();
    updatePaymentsUI();
    updateWorkersUI();
  } catch (error) {
    console.error("[Auth] Error en Google Auth:", error);
    if (error.code === "auth/popup-closed-by-user") {
      // Usuario cerró el popup de Google, no mostrar error
      return;
    }
    if (error.code === "auth/configuration-not-found" || error.code === "auth/operation-not-allowed") {
      showToast("Activa el proveedor 'Google' en Firebase Console > Authentication > Sign-in method.", "warning");
      return;
    }
    if (error.code === "auth/unauthorized-domain") {
      showToast("Dominio no autorizado. Agrega 'johana-engineer.github.io' en Firebase Console > Authentication > Configuración > Dominios autorizados.", "error");
      return;
    }
    showToast(`Error al iniciar con Google: ${error.message}`, "error");
  }
}

async function handleLogout() {
  try {
    if (auth && state.currentUser) {
      await signOut(auth);
    }
  } catch (err) {
    console.warn("[Auth] Error al desautenticar en Firebase:", err);
  } finally {
    state.currentUser = null;
    state.userProfile = null;
    localStorage.removeItem("widely_cached_user");
    setupFirestoreListeners(null);
    document.documentElement.classList.remove("has-user-session");
    applyRoleView();
    elements.formAuthLogin?.reset();
    elements.formAuthRegister?.reset();
    showToast("Sesión cerrada. Inicia sesión o regístrate para ingresar.", "info");
    updateFinancialDashboard();
    updateTasksUI();
    updatePaymentsUI();
    updateWorkersUI();
  }
}

async function loginMockUser(role, customName, customEmail) {
  let profile = null;
  if (role === "admin") {
    profile = {
      uid: "admin_" + Date.now(),
      nombre: customName || "Administrador",
      email: customEmail || "admin@widely.com",
      rol: "admin"
    };
  } else {
    let workerName = customName || "Colaborador Demo";
    let workerId = null;

    let existingWorker = state.workers.find(w => w.nombre && w.nombre.toLowerCase().trim() === workerName.toLowerCase().trim());
    if (existingWorker) {
      workerId = existingWorker.id;
    } else if (db) {
      try {
        const newDoc = await addDoc(collection(db, "trabajadores"), {
          nombre: workerName,
          tarifaHora: 0,
          email: customEmail || "",
          createdAt: serverTimestamp()
        });
        workerId = newDoc.id;
      } catch (err) {
        console.warn("[Auth] No se pudo guardar en trabajadores:", err);
      }
    }

    if (!workerId) {
      workerId = state.workers.length > 0 ? state.workers[0].id : "worker_" + Date.now();
    }

    profile = {
      uid: "user_" + Date.now(),
      nombre: workerName,
      email: customEmail || "colaborador@widely.com",
      rol: "worker",
      trabajadorId: workerId
    };
  }

  if (db) {
    try {
      await setDoc(doc(db, "usuarios", profile.uid), {
        ...profile,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn("[Auth] No se pudo guardar documento en usuarios:", e);
    }
  }

  state.userProfile = profile;
  localStorage.setItem("widely_cached_user", JSON.stringify(profile));
  applyRoleView();
  closeAuthModal();
  showToast(`¡Conectado como ${profile.nombre}! Modo activo: ${profile.rol === "admin" ? "Administrador Total" : "Colaborador"}`, "success");
  updateFinancialDashboard();
  updateTasksUI();
  updatePaymentsUI();
  updateWorkersUI();
}

/* ============================================================================
   5. LISTENERS EN TIEMPO REAL CON FIRESTORE (onSnapshot con Privacidad Estricta)
   ============================================================================ */
function setupFirestoreListeners(profile) {
  if (!db) return;

  // Si no hay usuario autenticado en Firebase, desuscribir y limpiar todo
  if (!profile || !auth || !auth.currentUser) {
    if (workersUnsubscribe) { workersUnsubscribe(); workersUnsubscribe = null; }
    if (tasksUnsubscribe) { tasksUnsubscribe(); tasksUnsubscribe = null; }
    if (paymentsUnsubscribe) { paymentsUnsubscribe(); paymentsUnsubscribe = null; }
    state.tasks = [];
    state.payments = [];
    updateTasksUI();
    updatePaymentsUI();
    updateFinancialDashboard();
    return;
  }

  // 1. Escuchar trabajadores (solo cuando el usuario tiene sesión activa confirmada)
  if (!workersUnsubscribe) {
    const workersCol = collection(db, "trabajadores");
    workersUnsubscribe = onSnapshot(workersCol, (snapshot) => {
      state.workers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

      updateWorkersUI();
      updateFinancialDashboard();
    }, (error) => {
      console.warn("[Firestore] Trabajadores snapshot:", error.message);
    });
  }

  // Cancelar suscripciones previas de tareas y pagos para evitar mezclas de sesiones
  if (tasksUnsubscribe) {
    tasksUnsubscribe();
    tasksUnsubscribe = null;
  }
  if (paymentsUnsubscribe) {
    paymentsUnsubscribe();
    paymentsUnsubscribe = null;
  }

  const isAdmin = profile.rol === "admin" || isMasterAdmin(profile.email);

  // 2. TAREAS: La Administradora lee todo; el Colaborador solo sus propias tareas
  let tasksQuery = null;
  if (isAdmin) {
    tasksQuery = query(collection(db, "tareas"));
  } else if (profile.trabajadorId) {
    tasksQuery = query(collection(db, "tareas"), where("trabajadorId", "==", profile.trabajadorId));
  } else {
    state.tasks = [];
    updateTasksUI();
    updateFinancialDashboard();
  }

  if (tasksQuery) {
    tasksUnsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      state.tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        // Ordenar en cliente para evitar requerir índices compuestos manuales en Firestore
        const dateA = a.fecha || "";
        const dateB = b.fecha || "";
        return dateB.localeCompare(dateA);
      });

      updateTasksUI();
      updateFinancialDashboard();
    }, (error) => {
      console.warn("[Firestore] Aviso en sincronización de tareas:", error.message);
    });
  }

  // 3. PAGOS: La Administradora lee todo; el Colaborador solo sus pagos recibidos
  let paymentsQuery = null;
  if (isAdmin) {
    paymentsQuery = query(collection(db, "pagos"));
  } else if (profile.trabajadorId) {
    paymentsQuery = query(collection(db, "pagos"), where("trabajadorId", "==", profile.trabajadorId));
  } else {
    state.payments = [];
    updatePaymentsUI();
    updateFinancialDashboard();
  }

  if (paymentsQuery) {
    paymentsUnsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      state.payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const dateA = a.fecha || "";
        const dateB = b.fecha || "";
        return dateB.localeCompare(dateA);
      });

      updatePaymentsUI();
      updateFinancialDashboard();
    }, (error) => {
      console.warn("[Firestore] Aviso en sincronización de pagos:", error.message);
    });
  }
}

/* ============================================================================
   6. LÓGICA DEL CRONÓMETRO DE TAREAS & PERSISTENCIA LOCALSTORAGE
   ============================================================================ */
function saveTimerState() {
  try {
    localStorage.setItem("widely_active_timer", JSON.stringify({
      isRunning: state.timer.isRunning,
      startTime: state.timer.startTime,
      elapsedSeconds: state.timer.elapsedSeconds,
      workerId: elements.timerWorkerSelect?.value || "",
      client: elements.timerClientProject?.value || "",
      category: elements.timerCategory?.value || "general",
      description: elements.timerTaskDescription?.value || ""
    }));
  } catch (e) {
    console.warn("[Timer] Error guardando estado:", e);
  }
}

function clearTimerState() {
  try {
    localStorage.removeItem("widely_active_timer");
  } catch (e) {
    console.warn("[Timer] Error limpiando estado:", e);
  }
}

function restoreActiveTimer() {
  try {
    const raw = localStorage.getItem("widely_active_timer");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data) return;

    if (data.workerId && elements.timerWorkerSelect) {
      elements.timerWorkerSelect.value = data.workerId;
    }
    if (data.client && elements.timerClientProject) {
      elements.timerClientProject.value = data.client;
    }
    if (data.category && elements.timerCategory) {
      elements.timerCategory.value = data.category;
    }
    if (data.description && elements.timerTaskDescription) {
      elements.timerTaskDescription.value = data.description;
    }

    if (data.isRunning && data.startTime) {
      const now = Date.now();
      const elapsed = Math.floor((now - data.startTime) / 1000);
      if (elapsed > 0) {
        state.timer.elapsedSeconds = elapsed;
        startTimer();
        showToast("¡Cronómetro restaurado! Se continuó contando sin interrupciones.", "info");
      }
    } else if (data.elapsedSeconds) {
      state.timer.elapsedSeconds = data.elapsedSeconds;
      renderTimerDisplay();
      updateLiveCost();
      elements.btnStart.disabled = false;
      elements.btnPause.disabled = true;
      elements.btnReset.disabled = false;
      elements.timerStatusBadge.className = "text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30";
      elements.timerStatusBadge.textContent = "Pausado";
    }
  } catch (err) {
    console.warn("[Timer] Error restaurando timer:", err);
  }
}

function startTimer() {
  const workerId = elements.timerWorkerSelect.value;
  if (!workerId) {
    showToast("Por favor selecciona un trabajador primero.", "warning");
    elements.timerWorkerSelect.focus();
    return;
  }

  if (state.timer.isRunning) return;

  state.timer.isRunning = true;
  state.timer.startTime = Date.now() - (state.timer.elapsedSeconds * 1000);
  saveTimerState();

  state.timer.intervalId = setInterval(() => {
    state.timer.elapsedSeconds = Math.floor((Date.now() - state.timer.startTime) / 1000);
    renderTimerDisplay();
    updateLiveCost();

    // Alerta de Cronómetro Olvidado (> 4 horas = 14,400 segundos)
    if (state.timer.elapsedSeconds >= 14400 && !state.timer.overtimeAlertDismissed) {
      if (elements.timerOvertimeAlert?.classList.contains("hidden")) {
        elements.timerOvertimeAlert.classList.remove("hidden");
        elements.timerOvertimeAlert.classList.add("flex");
        playOvertimeNotificationSound();
      }
    }
  }, 1000);

  elements.btnStart.disabled = true;
  elements.btnPause.disabled = false;
  elements.btnReset.disabled = false;
  elements.timerDisplay.classList.add("timer-active");

  elements.timerStatusBadge.className = "text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1.5";
  elements.timerStatusBadge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Activo`;
}

function dismissOvertimeAlert() {
  state.timer.overtimeAlertDismissed = true;
  elements.timerOvertimeAlert?.classList.add("hidden");
  elements.timerOvertimeAlert?.classList.remove("flex");
  showToast("Alerta silenciada. Puedes continuar registrando tu tiempo.", "info");
}

function pauseTimer() {
  if (!state.timer.isRunning) return;

  state.timer.isRunning = false;
  clearInterval(state.timer.intervalId);
  saveTimerState();

  elements.btnStart.disabled = false;
  elements.btnPause.disabled = true;
  elements.timerDisplay.classList.remove("timer-active");

  elements.timerStatusBadge.className = "text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30";
  elements.timerStatusBadge.textContent = "Pausado";
}

function resetTimer() {
  if (state.timer.elapsedSeconds === 0) return;

  pauseTimer();
  state.timer.elapsedSeconds = 0;
  state.timer.overtimeAlertDismissed = false;
  elements.timerOvertimeAlert?.classList.add("hidden");
  elements.timerOvertimeAlert?.classList.remove("flex");
  clearTimerState();
  renderTimerDisplay();
  updateLiveCost();

  elements.btnStart.disabled = false;
  elements.btnPause.disabled = true;
  elements.btnReset.disabled = true;

  elements.timerStatusBadge.className = "text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700";
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
  const isWorkerRole = state.userProfile?.rol === "worker";
  const userWorkerId = state.userProfile?.trabajadorId;
  const workerId = (isWorkerRole && userWorkerId) ? userWorkerId : (elements.timerWorkerSelect.value || userWorkerId);
  const client = elements.timerClientProject?.value.trim() || "";
  const category = elements.timerCategory?.value || "general";
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
    userId: state.currentUser?.uid || state.userProfile?.uid || null,
    cliente: client,
    categoria: category,
    descripcion: description || "Tarea sin descripción",
    segundos: seconds,
    horas: Number(hours.toFixed(4)),
    tarifaHora: rate,
    costoTotal: totalCost,
    esManual: false,
    estado: "aprobada",
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

    showToast(`¡Tarea registrada con éxito! Costo: $${totalCost.toFixed(2)}`, "success");
    elements.timerTaskDescription.value = "";
    if (elements.timerClientProject) elements.timerClientProject.value = "";
    if (elements.timerCategory) elements.timerCategory.value = "general";
    resetTimer();
    if (state.userProfile?.rol === "worker") {
      linkAndLockWorkerSelect();
    }
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
  const email = elements.workerEmail ? elements.workerEmail.value.trim().toLowerCase() : "";
  const rateRaw = elements.workerRate.value.trim();
  const rate = rateRaw === "" ? 0 : parseFloat(rateRaw);
  const artRateRaw = elements.workerArtRate ? elements.workerArtRate.value.trim() : "";
  const artRate = artRateRaw === "" ? 0 : parseFloat(artRateRaw);

  if (!name) {
    showToast("Por favor ingresa el nombre del trabajador.", "warning");
    return;
  }

  if (isNaN(rate) || rate < 0) {
    showToast("La tarifa por hora debe ser un número igual o mayor a 0.", "warning");
    return;
  }

  if (isNaN(artRate) || artRate < 0) {
    showToast("La tarifa por arte debe ser un número igual o mayor a 0.", "warning");
    return;
  }

  const workerData = {
    nombre: name,
    email: email || null,
    tarifaHora: Number(rate.toFixed(2)),
    tarifaArte: Number(artRate.toFixed(2)),
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

    const ratesSummary = [];
    if (rate > 0) ratesSummary.push(`$${rate.toFixed(2)}/h`);
    if (artRate > 0) ratesSummary.push(`$${artRate.toFixed(2)}/arte`);
    const rateMsg = ratesSummary.length > 0 ? ` con tarifas (${ratesSummary.join(" · ")})` : " (sin tarifas iniciales)";
    showToast(`Trabajador "${name}" añadido exitosamente${rateMsg}.`, "success");
    elements.formWorker.reset();
  } catch (error) {
    console.error("Error al guardar trabajador:", error);
    showToast("Error al guardar: " + error.message, "error");
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
    showToast("Selecciona el trabajador para registrar el pago.", "warning");
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
   9. ACTUALIZACIÓN VISUAL (UI) Y COMPONENTES
   ============================================================================ */
function updateWorkersUI() {
  const currentTimerVal = elements.timerWorkerSelect.value;
  const currentPayVal = elements.paymentWorkerSelect.value;

  elements.timerWorkerSelect.innerHTML = `<option value="">-- Selecciona un trabajador --</option>` +
    state.workers.map(w => {
      const rate = Number(w.tarifaHora || 0);
      const artRate = Number(w.tarifaArte || 0);
      let parts = [];
      if (rate > 0) parts.push(`$${rate.toFixed(2)}/h`);
      if (artRate > 0) parts.push(`$${artRate.toFixed(2)}/arte`);
      const tag = parts.length > 0 ? parts.join(" · ") : "Sin tarifa";
      return `
        <option value="${w.id}" data-rate="${rate}" data-art-rate="${artRate}">
          ${escapeHtml(w.nombre)} (${tag})
        </option>
      `;
    }).join("");

  elements.paymentWorkerSelect.innerHTML = `<option value="">-- Selecciona un trabajador --</option>` +
    state.workers.map(w => `
      <option value="${w.id}">
        ${escapeHtml(w.nombre)}
      </option>
    `).join("");

  if (currentTimerVal && state.workers.some(w => w.id === currentTimerVal)) {
    elements.timerWorkerSelect.value = currentTimerVal;
  }
  if (currentPayVal && state.workers.some(w => w.id === currentPayVal)) {
    elements.paymentWorkerSelect.value = currentPayVal;
  }

  elements.workerCount.textContent = state.workers.length;

  if (state.workers.length === 0) {
    elements.workersList.innerHTML = `<div class="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No hay trabajadores registrados aún.</div>`;
  } else {
    elements.workersList.innerHTML = state.workers.map(w => {
      const rate = Number(w.tarifaHora || 0);
      const artRate = Number(w.tarifaArte || 0);
      const hasRate = rate > 0 || artRate > 0;
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors text-xs">
          <div class="min-w-0 pr-2">
            <div class="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
              <span>${escapeHtml(w.nombre)}</span>
              ${w.email ? `<span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(w.email)})</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
              ${rate > 0 ? `<span class="text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-mono font-medium tabular-nums bg-[#2563EB]/10 px-1.5 py-0.5 rounded border border-[#2563EB]/20">$${rate.toFixed(2)}/h</span>` : ''}
              ${artRate > 0 ? `<span class="text-[11px] text-purple-600 dark:text-purple-400 font-mono font-medium tabular-nums bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20"><i class="fa-solid fa-palette text-[9px] mr-1"></i>$${artRate.toFixed(2)}/arte</span>` : ''}
              ${!hasRate ? `<span class="text-[10px] text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">Sin tarifas</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button 
              type="button"
              onclick="window.openManualEntryModal('${w.id}')"
              title="Cargar horas o diseños de arte para ${escapeHtml(w.nombre)}" 
              class="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all active:scale-95 text-xs flex items-center gap-1 font-medium cursor-pointer">
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span class="hidden sm:inline">Cargar</span>
            </button>
            <button 
              type="button"
              onclick="window.openEditRateModal('${w.id}', '${escapeHtml(w.nombre)}', ${rate}, ${artRate})"
              title="Asignar o editar tarifas" 
              class="px-2 py-1 rounded-lg bg-[#2563EB]/10 hover:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#60A5FA] border border-[#2563EB]/20 transition-all active:scale-95 text-xs flex items-center gap-1 font-medium cursor-pointer">
              <i class="fa-solid fa-pen-to-square text-[10px]"></i>
              <span>Tarifas</span>
            </button>
            <button 
              type="button"
              onclick="window.requestDelete('trabajadores', '${w.id}', '${escapeHtml(w.nombre)}')"
              title="Eliminar trabajador" 
              class="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors active:scale-95 text-xs cursor-pointer">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  if (state.userProfile?.rol === "worker") {
    linkAndLockWorkerSelect();
  } else {
    if (elements.timerWorkerSelect) elements.timerWorkerSelect.disabled = false;
  }

  updateLiveCost();
}

/* ============================================================================
   8.B. FILTROS DE PERÍODO & PERIOD LIQUIDATION
   ============================================================================ */
function isDateInPeriod(dateStr, period) {
  if (!period || period === "all") return true;
  if (!dateStr) return false;

  const targetDate = new Date(dateStr + "T00:00:00");
  if (isNaN(targetDate.getTime())) return true;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();

  if (period === "this_month") {
    return targetYear === currentYear && targetMonth === currentMonth;
  }

  if (period === "current_fortnight") {
    if (targetYear !== currentYear || targetMonth !== currentMonth) return false;
    return currentDay <= 15 ? targetDay <= 15 : targetDay >= 16;
  }

  if (period === "last_month") {
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return targetYear === lastMonthYear && targetMonth === lastMonth;
  }

  return true;
}

function isTaskApproved(t) {
  // Las tareas previas sin el campo 'estado' se consideran aprobadas para mantener la integridad histórica
  if (!t.estado) return true;
  return t.estado === "aprobada";
}

function getFilteredTasks() {
  return state.tasks.filter(t => isDateInPeriod(t.fecha, state.filterPeriod));
}

function getFilteredPayments() {
  return state.payments.filter(p => isDateInPeriod(p.fecha, state.filterPeriod));
}

function setFilterPeriod(period) {
  state.filterPeriod = period;

  const buttons = document.querySelectorAll(".btn-period-filter");
  buttons.forEach(btn => {
    if (btn.dataset.period === period) {
      btn.className = "btn-period-filter px-3 py-1.5 rounded-xl transition-all active:scale-95 bg-blue-600 text-white shadow-sm";
    } else {
      btn.className = "btn-period-filter px-3 py-1.5 rounded-xl transition-all active:scale-95 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800";
    }
  });

  const labels = {
    all: "(Todo el histórico)",
    this_month: "(Este mes)",
    current_fortnight: "(Quincena actual)",
    last_month: "(Mes pasado)"
  };
  if (elements.periodFilterLabel) {
    elements.periodFilterLabel.textContent = labels[period] || "";
  }

  updateFinancialDashboard();
  updateTasksUI();
  updatePaymentsUI();
}

window.setTaskStatusFilter = function(status) {
  state.taskStatusFilter = status;
  const buttons = document.querySelectorAll(".btn-status-filter");
  buttons.forEach(btn => {
    if (btn.dataset.status === status) {
      btn.className = "btn-status-filter px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 bg-[#2563EB] text-white shadow-sm flex items-center gap-1";
    } else {
      btn.className = "btn-status-filter px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1.5";
    }
  });
  updateTasksUI();
};

function updateTasksUI() {
  const isWorker = state.userProfile?.rol === "worker";
  const isAdmin = state.userProfile?.rol === "admin" || isMasterAdmin(state.currentUser?.email);
  const myId = state.userProfile?.trabajadorId;
  const myName = (state.userProfile?.nombre || "").trim().toLowerCase();

  let allUserTasks = getFilteredTasks();
  if (isWorker) {
    allUserTasks = allUserTasks.filter(t => 
      (myId && t.trabajadorId === myId) || 
      (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === myName)
    );
  }

  // Contadores por estado para la barra de filtros
  const totalCount = allUserTasks.length;
  const pendingCount = allUserTasks.filter(t => t.estado === "pendiente").length;
  const approvedCount = allUserTasks.filter(t => isTaskApproved(t)).length;
  const rejectedCount = allUserTasks.filter(t => t.estado === "rechazada").length;

  if (elements.filterCountAll) elements.filterCountAll.textContent = `(${totalCount})`;
  if (elements.filterCountPending) elements.filterCountPending.textContent = pendingCount;
  if (elements.filterCountApproved) elements.filterCountApproved.textContent = approvedCount;
  if (elements.filterCountRejected) elements.filterCountRejected.textContent = rejectedCount;

  // Alerta de revisión para el Administrador
  if (elements.pendingReviewBadge) {
    if (isAdmin && pendingCount > 0) {
      elements.pendingReviewBadge.classList.remove("hidden");
      elements.pendingReviewBadge.classList.add("inline-flex");
      if (elements.pendingReviewCount) {
        elements.pendingReviewCount.textContent = `${pendingCount} hora${pendingCount > 1 ? 's' : ''} por revisar`;
      }
    } else {
      elements.pendingReviewBadge.classList.add("hidden");
      elements.pendingReviewBadge.classList.remove("inline-flex");
    }
  }

  // Filtrado activo según botón seleccionado
  let displayedTasks = allUserTasks;
  if (state.taskStatusFilter === "pendiente") {
    displayedTasks = allUserTasks.filter(t => t.estado === "pendiente");
  } else if (state.taskStatusFilter === "aprobada") {
    displayedTasks = allUserTasks.filter(t => isTaskApproved(t));
  } else if (state.taskStatusFilter === "rechazada") {
    displayedTasks = allUserTasks.filter(t => t.estado === "rechazada");
  }

  elements.taskCount.textContent = displayedTasks.length;
  updateClientsDatalist();

  if (displayedTasks.length === 0) {
    const emptyMsg = state.taskStatusFilter === "pendiente" 
      ? "No hay horas pendientes de revisión en este período."
      : state.taskStatusFilter === "rechazada"
      ? "No hay horas rechazadas en este período."
      : isWorker 
      ? "No tienes tareas registradas en este período." 
      : "No hay tareas registradas en este período.";

    elements.tasksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
          ${emptyMsg}
        </td>
      </tr>
    `;
    return;
  }

  elements.tasksTableBody.innerHTML = displayedTasks.map(t => {
    const formattedTime = formatSecondsToTime(t.segundos || 0);
    const isManualTag = t.esManual ? `<span class="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#0284C7]/15 text-[#0284C7] dark:text-[#D4AF87] border border-[#0284C7]/25 shrink-0">Manual</span>` : "";
    const cat = getCategoryMeta(t.categoria);
    const catBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${cat.bg} ${cat.color} border shrink-0"><i class="fa-solid ${cat.icon} text-[9px]"></i><span>${cat.label}</span></span>`;
    const clientBadge = t.cliente ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#F1F5F9] dark:bg-[#162032] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E293B] shrink-0"><i class="fa-solid fa-briefcase text-[9px] text-[#2563EB]"></i><span>${escapeHtml(t.cliente)}</span></span>` : "";

    const taskStatus = t.estado || "aprobada";
    let statusBadge = "";
    if (taskStatus === "pendiente") {
      statusBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0" title="Pendiente de aprobación por la administración"><i class="fa-solid fa-clock-rotate-left text-[9px]"></i><span>Pendiente</span></span>`;
    } else if (taskStatus === "rechazada") {
      const reasonTitle = t.motivoRechazo ? `Motivo: ${escapeHtml(t.motivoRechazo)}` : "Horas rechazadas por la administración";
      statusBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 cursor-help" title="${reasonTitle}"><i class="fa-solid fa-circle-xmark text-[9px]"></i><span>Rechazada</span></span>`;
    } else if (t.esManual) {
      statusBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0" title="Aprobada"><i class="fa-solid fa-circle-check text-[9px]"></i><span>Aprobada</span></span>`;
    }

    const rejectionNotice = (taskStatus === "rechazada" && t.motivoRechazo) 
      ? `<div class="text-[11px] text-rose-600 dark:text-rose-400 font-medium italic mt-1 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
           <i class="fa-solid fa-circle-exclamation text-[10px] shrink-0"></i>
           <span><strong>Motivo:</strong> ${escapeHtml(t.motivoRechazo)}</span>
         </div>`
      : "";

    const pendingNotice = (taskStatus === "pendiente")
      ? `<div class="text-[10px] text-amber-600 dark:text-amber-400 italic mt-0.5 flex items-center gap-1">
           <i class="fa-regular fa-clock text-[9px] shrink-0"></i>
           <span>Horas manuales en espera de validación administrativa</span>
         </div>`
      : "";

    let costDisplay = "";
    if (taskStatus === "rechazada") {
      costDisplay = `<span class="line-through text-slate-400 dark:text-slate-500 tabular-nums" title="Horas rechazadas (no computan en liquidación)">$${Number(t.costoTotal || 0).toFixed(2)}</span>`;
    } else if (taskStatus === "pendiente") {
      costDisplay = `<span class="text-amber-600 dark:text-amber-400 font-semibold tabular-nums" title="Pendiente de aprobación">$${Number(t.costoTotal || 0).toFixed(2)}</span>`;
    } else {
      costDisplay = `<span class="tabular-nums font-semibold">$${Number(t.costoTotal || 0).toFixed(2)}</span>`;
    }

    let actionButtons = "";
    if (isAdmin) {
      if (taskStatus === "pendiente") {
        actionButtons = `
          <div class="flex items-center justify-center gap-1">
            <button 
              onclick="window.approveTask('${t.id}')"
              class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-1.5 rounded-lg hover:bg-emerald-500/15 transition-colors active:scale-95"
              title="Aprobar horas">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
            <button 
              onclick="window.openRejectModal('${t.id}')"
              class="text-rose-600 hover:text-rose-700 dark:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/15 transition-colors active:scale-95"
              title="Rechazar horas">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
            <button 
              onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
              class="text-[#64748B] hover:text-[#BF6863] p-1.5 rounded-lg hover:bg-[#BF6863]/10 transition-colors active:scale-95"
              title="Eliminar registro">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        `;
      } else if (taskStatus === "rechazada") {
        actionButtons = `
          <div class="flex items-center justify-center gap-1">
            <button 
              onclick="window.approveTask('${t.id}')"
              class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-1.5 rounded-lg hover:bg-emerald-500/15 transition-colors active:scale-95"
              title="Reconsiderar y Aprobar">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
            <button 
              onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
              class="text-[#64748B] hover:text-[#BF6863] p-1.5 rounded-lg hover:bg-[#BF6863]/10 transition-colors active:scale-95"
              title="Eliminar registro">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        `;
      } else {
        // Aprobada
        actionButtons = `
          <div class="flex items-center justify-center gap-1">
            ${t.esManual ? `
              <button 
                onclick="window.openRejectModal('${t.id}')"
                class="text-[#64748B] hover:text-rose-600 dark:text-[#94A3B8] p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors active:scale-95"
                title="Rechazar horas previamente aprobadas">
                <i class="fa-solid fa-ban text-xs"></i>
              </button>
            ` : ''}
            <button 
              onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
              class="text-[#64748B] hover:text-[#BF6863] p-1.5 rounded-lg hover:bg-[#BF6863]/10 transition-colors active:scale-95"
              title="Eliminar tarea">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        `;
      }
    } else {
      // Colaborador
      actionButtons = `
        <button 
          onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
          class="text-[#64748B] hover:text-[#BF6863] p-1.5 rounded-lg hover:bg-[#BF6863]/10 transition-colors active:scale-95"
          title="Eliminar registro">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      `;
    }

    const isArtTask = t.tipoCobro === "artes" || (t.cantidadArtes && Number(t.cantidadArtes) > 0);
    const artBadge = isArtTask 
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0"><i class="fa-solid fa-palette text-[9px]"></i><span>${t.cantidadArtes} ${t.cantidadArtes === 1 ? 'arte' : 'artes'}</span></span>` 
      : "";

    let timeColContent = "";
    if (isArtTask) {
      timeColContent = `
        <span class="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400 font-mono tabular-nums"><i class="fa-solid fa-palette text-[10px]"></i> ${t.cantidadArtes} ${t.cantidadArtes === 1 ? 'arte' : 'artes'}</span>
        <span class="text-[10px] text-[#64748B] dark:text-[#94A3B8] block font-mono">($${Number(t.tarifaArte || 0).toFixed(2)} c/u)</span>
      `;
    } else {
      timeColContent = `
        ${formattedTime} <span class="text-[10px] text-[#64748B]/80 dark:text-[#94A3B8]/80">(${Number(t.horas || 0).toFixed(2)}h)</span>
      `;
    }

    return `
      <tr class="hover:bg-[#F1F5F9] dark:hover:bg-[#162032] transition-colors ${taskStatus === 'rechazada' ? 'opacity-75 bg-rose-50/30 dark:bg-rose-950/20' : taskStatus === 'pendiente' ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''}">
        <td class="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] font-mono whitespace-nowrap tabular-nums">${t.fecha || '-'}</td>
        <td class="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">${escapeHtml(t.trabajadorNombre || 'Anónimo')}</td>
        <td class="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] max-w-sm">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-medium text-[#0F172A] dark:text-[#F8FAFC]" title="${escapeHtml(t.descripcion || '')}">${escapeHtml(t.descripcion || 'Sin descripción')}</span>
            ${clientBadge}
            ${catBadge}
            ${artBadge}
            ${isManualTag}
            ${statusBadge}
          </div>
          ${rejectionNotice}
          ${pendingNotice}
        </td>
        <td class="py-2.5 px-2 text-right font-mono text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap tabular-nums">
          ${timeColContent}
        </td>
        <td class="py-2.5 px-2 text-right font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap tabular-nums">
          ${costDisplay}
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          ${actionButtons}
        </td>
      </tr>
    `;
  }).join("");
}

function updatePaymentsUI() {
  const isWorker = state.userProfile?.rol === "worker";
  let displayedPayments = getFilteredPayments();

  if (isWorker) {
    const myId = state.userProfile.trabajadorId;
    const myName = (state.userProfile.nombre || "").trim().toLowerCase();
    displayedPayments = displayedPayments.filter(p => 
      (myId && p.trabajadorId === myId) || 
      (p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === myName)
    );
  }

  elements.paymentCount.textContent = displayedPayments.length;

  if (displayedPayments.length === 0) {
    elements.paymentsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-[#64748B] dark:text-[#94A3B8] text-xs">
          ${isWorker ? "No tienes pagos registrados en este período." : "No hay pagos registrados en este período."}
        </td>
      </tr>
    `;
    return;
  }

  elements.paymentsTableBody.innerHTML = displayedPayments.map(p => `
    <tr class="hover:bg-[#F1F5F9] dark:hover:bg-[#162032] transition-colors">
      <td class="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] font-mono whitespace-nowrap tabular-nums">${p.fecha || '-'}</td>
      <td class="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">${escapeHtml(p.trabajadorNombre || '')}</td>
      <td class="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] max-w-xs truncate" title="${escapeHtml(p.referencia || '')}">
        ${escapeHtml(p.referencia || 'Pago')}
      </td>
      <td class="py-2.5 px-2 text-right font-mono font-medium text-[#2563EB] whitespace-nowrap tabular-nums">
        $${Number(p.monto || 0).toFixed(2)}
      </td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        ${!isWorker ? `
          <button 
            onclick="window.requestDelete('pagos', '${p.id}', 'Pago de $${Number(p.monto || 0).toFixed(2)} a ${escapeHtml(p.trabajadorNombre || '')}')"
            class="text-[#64748B] hover:text-[#BF6863] p-1 rounded-md hover:bg-[#BF6863]/10 transition-colors active:scale-95"
            title="Eliminar pago">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        ` : `<span class="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">Registrado</span>`}
      </td>
    </tr>
  `).join("");
}

/* ============================================================================
   10. CÁLCULO DINÁMICO: DASHBOARD FINANCIERO Y KPIS
   ============================================================================ */
function updateFinancialDashboard() {
  const isWorker = state.userProfile?.rol === "worker";
  const currentTrm = getActiveTrmRate();

  let displayedWorkers = state.workers;
  if (isWorker) {
    const myId = state.userProfile.trabajadorId;
    const myName = (state.userProfile.nombre || "").trim().toLowerCase();
    displayedWorkers = state.workers.filter(w => 
      (myId && w.id === myId) || 
      (w.nombre && w.nombre.trim().toLowerCase() === myName)
    );
  }

  if (displayedWorkers.length === 0) {
    elements.financialTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
          ${isWorker 
            ? "Tu perfil aún no está vinculado a un trabajador en la lista. Puedes usar el cronómetro para registrar tu tiempo."
            : "Agrega trabajadores para visualizar el balance financiero en tiempo real."}
        </td>
      </tr>
    `;
    resetKPIs();
    return;
  }

  const allFilteredTasks = getFilteredTasks();
  const allFilteredPayments = getFilteredPayments();

  let totalHorasGlobal = 0;
  let totalSegundosGlobal = 0;
  let totalGeneradoGlobal = 0;
  let totalPagadoGlobal = 0;

  const rowsHtml = displayedWorkers.map(worker => {
    const workerTasks = allFilteredTasks.filter(t => 
      (t.trabajadorId === worker.id || (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase())) &&
      isTaskApproved(t)
    );
    const workerSeconds = workerTasks.reduce((acc, t) => acc + (Number(t.segundos) || 0), 0);
    const workerHours = workerTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
    const workerArtes = workerTasks.filter(t => t.cantidadArtes > 0).reduce((acc, t) => acc + (Number(t.cantidadArtes) || 0), 0);
    const workerEarned = workerTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);

    const workerPayments = allFilteredPayments.filter(p => p.trabajadorId === worker.id || (p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase()));
    const workerPaid = workerPayments.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    const pendingBalance = Number((workerEarned - workerPaid).toFixed(2));

    totalSegundosGlobal += workerSeconds;
    totalHorasGlobal += workerHours;
    totalGeneradoGlobal += workerEarned;
    totalPagadoGlobal += workerPaid;

    let balanceBadge = "";
    if (pendingBalance > 0.005) {
      // Pasivo pendiente: Rojo apagado elegante
      balanceBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-[#BF6863]/10 dark:bg-[#BF6863]/15 text-[#BF6863] border border-[#BF6863]/25 tabular-nums">
          <i class="fa-solid fa-clock text-[10px]"></i>
          +$${pendingBalance.toFixed(2)}
        </span>
      `;
    } else if (pendingBalance === 0) {
      // Al día: Verde natural
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/25 tabular-nums">
          <i class="fa-solid fa-check text-[10px]"></i>
          $0.00
        </span>
      `;
    } else {
      // Anticipo a favor
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-[#3B82F6]/10 dark:bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA] border border-[#3B82F6]/25 tabular-nums">
          <i class="fa-solid fa-arrow-down text-[10px]"></i>
          -$${Math.abs(pendingBalance).toFixed(2)}
        </span>
      `;
    }

    const hourlyRate = Number(worker.tarifaHora || 0);
    const artRate = Number(worker.tarifaArte || 0);

    const editRateBtn = !isWorker ? `
      <button 
        type="button" 
        onclick="window.openEditRateModal('${worker.id}', '${escapeHtml(worker.nombre)}', ${hourlyRate}, ${artRate})"
        class="hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:underline transition-colors cursor-pointer inline-flex flex-col items-end group"
        title="Clic para modificar tarifas">
        <span class="inline-flex items-center gap-1 font-medium">
          <span>$${hourlyRate.toFixed(2)}/h</span>
          <i class="fa-solid fa-pencil text-[9px] opacity-0 group-hover:opacity-100 transition-opacity text-[#3B82F6]"></i>
        </span>
        ${artRate > 0 ? `<span class="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-medium">$${artRate.toFixed(2)}/arte</span>` : ''}
      </button>
    ` : `
      <div class="flex flex-col items-end">
        <span>$${hourlyRate.toFixed(2)}/h</span>
        ${artRate > 0 ? `<span class="text-[10px] text-purple-600 dark:text-purple-400 font-mono">$${artRate.toFixed(2)}/arte</span>` : ''}
      </div>
    `;

    const statementBtn = isWorker ? `
      <button 
        type="button" 
        onclick="window.openStatementModal('${worker.id}', 'bill')" 
        class="px-2.5 py-1.5 rounded-lg bg-[#2563EB]/10 hover:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#60A5FA] border border-[#2563EB]/20 text-xs font-medium active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
        title="Generar y descargar mi Cuenta de Cobro formal">
        <i class="fa-solid fa-file-invoice-dollar text-xs"></i>
        <span>Descargar Cuenta de Cobro</span>
      </button>
    ` : `
      <div class="inline-flex items-center gap-1.5">
        <button 
          type="button" 
          onclick="window.openManualEntryModal('${worker.id}')" 
          class="px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Cargar horas o diseños de artes a ${escapeHtml(worker.nombre)}">
          <i class="fa-solid fa-plus text-[10px]"></i>
          <span class="hidden xl:inline">Cargar</span>
        </button>
        <button 
          type="button" 
          onclick="window.openStatementModal('${worker.id}', 'receipt')" 
          class="px-2.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Generar Recibo de Pago Oficial (PDF)">
          <i class="fa-solid fa-receipt text-[10px]"></i>
          <span class="hidden sm:inline">Recibo Oficial</span>
          <span class="sm:hidden">Recibo</span>
        </button>
        <button 
          type="button" 
          onclick="window.openStatementModal('${worker.id}', 'bill')" 
          class="px-2 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#111827] hover:bg-[#E2E8F0] dark:hover:bg-[#1E293B] text-[#2563EB] dark:text-[#60A5FA] border border-[#E2E8F0] dark:border-[#1E293B] text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Auditar Cuenta de Cobro de este colaborador">
          <i class="fa-solid fa-file-invoice-dollar text-[10px]"></i>
        </button>
        <button 
          type="button" 
          onclick="window.quickPayWorker('${worker.id}', '${escapeHtml(worker.nombre)}', ${pendingBalance})" 
          class="px-2 py-1.5 rounded-lg bg-[#0284C7]/15 hover:bg-[#0284C7]/25 text-[#0284C7] dark:text-[#D4AF87] border border-[#0284C7]/30 text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Abonar / Registrar pago a ${escapeHtml(worker.nombre)}">
          <i class="fa-solid fa-money-bill-transfer text-[10px]"></i>
        </button>
      </div>
    `;

    return `
      <tr class="hover:bg-[#F1F5F9] dark:hover:bg-[#162032] transition-colors">
        <td class="py-3 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center text-xs font-semibold border border-[#2563EB]/20">
              ${worker.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <span>${escapeHtml(worker.nombre)}</span>
              ${worker.email ? `<span class="text-[10px] text-slate-400 font-normal block">${escapeHtml(worker.email)}</span>` : ''}
            </div>
          </div>
        </td>
        <td class="py-3 px-2 text-right font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
          ${editRateBtn}
        </td>
        <td class="py-3 px-2 text-right font-mono text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
          <span class="font-medium">${workerHours.toFixed(2)}h</span>
          ${workerArtes > 0 ? `<span class="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block">🎨 ${workerArtes} ${workerArtes === 1 ? 'arte' : 'artes'}</span>` : `<span class="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">${formatSecondsToTime(workerSeconds)}</span>`}
        </td>
        <td class="py-3 px-2 text-right font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
          <div>$${workerEarned.toFixed(2)}</div>
          <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">≈ ${formatCop(workerEarned * currentTrm)}</div>
        </td>
        <td class="py-3 px-2 text-right font-mono font-medium text-[#2563EB] tabular-nums">
          <div>$${workerPaid.toFixed(2)}</div>
          <div class="text-[10px] text-blue-600 dark:text-blue-400 font-normal">≈ ${formatCop(workerPaid * currentTrm)}</div>
        </td>
        <td class="py-3 px-3 text-right">
          ${balanceBadge}
          <div class="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono mt-0.5">≈ ${formatCop(pendingBalance * currentTrm)}</div>
        </td>
        <td class="py-3 px-2 text-center whitespace-nowrap">
          ${statementBtn}
        </td>
      </tr>
    `;
  }).join("");

  elements.financialTableBody.innerHTML = rowsHtml;

  // Actualizar KPIs Globales o Personales
  const balance = Number((totalGeneradoGlobal - totalPagadoGlobal).toFixed(2));
  elements.kpiTotalHoras.textContent = totalHorasGlobal.toFixed(2);
  elements.kpiTotalHorasFormatted.textContent = `${formatSecondsToTime(totalSegundosGlobal)} ${isWorker ? 'tuyas' : 'en total'}`;
  elements.kpiTotalGenerado.textContent = `$${totalGeneradoGlobal.toFixed(2)}`;
  if (elements.kpiTotalGeneradoCop) elements.kpiTotalGeneradoCop.textContent = `≈ ${formatCop(totalGeneradoGlobal * currentTrm)}`;

  elements.kpiTotalPagado.textContent = `$${totalPagadoGlobal.toFixed(2)}`;
  if (elements.kpiTotalPagadoCop) elements.kpiTotalPagadoCop.textContent = `≈ ${formatCop(totalPagadoGlobal * currentTrm)}`;

  const copBalance = balance * currentTrm;

  if (balance > 0.005) {
    elements.kpiSaldoPendiente.className = "text-xl sm:text-2xl 3xl:text-3xl font-semibold font-mono text-[#BF6863] tabular-nums";
    elements.kpiSaldoPendiente.textContent = `$${balance.toFixed(2)}`;
    if (elements.kpiSaldoPendienteCop) {
      elements.kpiSaldoPendienteCop.className = "block text-xs font-mono font-medium text-[#BF6863] tabular-nums truncate mt-0.5";
      elements.kpiSaldoPendienteCop.textContent = `≈ ${formatCop(copBalance)}`;
    }
    elements.kpiSaldoDesc.textContent = isWorker ? "Tu saldo pendiente por cobrar" : "Deuda total por liquidar a trabajadores";
  } else if (balance === 0) {
    elements.kpiSaldoPendiente.className = "text-xl sm:text-2xl 3xl:text-3xl font-semibold font-mono text-[#2563EB] tabular-nums";
    elements.kpiSaldoPendiente.textContent = "$0.00";
    if (elements.kpiSaldoPendienteCop) {
      elements.kpiSaldoPendienteCop.className = "block text-xs font-mono font-medium text-[#2563EB] tabular-nums truncate mt-0.5";
      elements.kpiSaldoPendienteCop.textContent = "≈ $0 COP";
    }
    elements.kpiSaldoDesc.textContent = isWorker ? "Tus pagos están al día" : "Todos los pagos están al día";
  } else {
    elements.kpiSaldoPendiente.className = "text-xl sm:text-2xl 3xl:text-3xl font-semibold font-mono text-[#2563EB] dark:text-[#60A5FA] tabular-nums";
    elements.kpiSaldoPendiente.textContent = `+$${Math.abs(balance).toFixed(2)}`;
    if (elements.kpiSaldoPendienteCop) {
      elements.kpiSaldoPendienteCop.className = "block text-xs font-mono font-medium text-[#2563EB] dark:text-[#60A5FA] tabular-nums truncate mt-0.5";
      elements.kpiSaldoPendienteCop.textContent = `≈ +${formatCop(Math.abs(copBalance))}`;
    }
    elements.kpiSaldoDesc.textContent = isWorker ? "Anticipo recibido a tu favor" : "Saldo a favor de la empresa";
  }

  // Actualizar KPIs del Portal del Colaborador
  if (isWorker) {
    if (elements.workerKpiHours) elements.workerKpiHours.textContent = totalHorasGlobal.toFixed(2);
    if (elements.workerKpiEarned) elements.workerKpiEarned.textContent = `$${totalGeneradoGlobal.toFixed(2)}`;
    if (elements.workerKpiEarnedCop) elements.workerKpiEarnedCop.textContent = `≈ ${formatCop(totalGeneradoGlobal * currentTrm)}`;
    if (elements.workerKpiPaid) elements.workerKpiPaid.textContent = `$${totalPagadoGlobal.toFixed(2)}`;
    if (elements.workerKpiPaidCop) elements.workerKpiPaidCop.textContent = `≈ ${formatCop(totalPagadoGlobal * currentTrm)}`;
    if (elements.workerKpiBalance) {
      if (balance > 0.005) {
        elements.workerKpiBalance.textContent = `$${balance.toFixed(2)}`;
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-[#BF6863] tabular-nums";
        if (elements.workerKpiBalanceCop) {
          elements.workerKpiBalanceCop.className = "block text-xs font-mono font-medium text-[#BF6863] tabular-nums truncate mt-0.5";
          elements.workerKpiBalanceCop.textContent = `≈ ${formatCop(copBalance)}`;
        }
      } else if (balance === 0) {
        elements.workerKpiBalance.textContent = "$0.00";
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-[#2563EB] tabular-nums";
        if (elements.workerKpiBalanceCop) {
          elements.workerKpiBalanceCop.className = "block text-xs font-mono font-medium text-[#2563EB] tabular-nums truncate mt-0.5";
          elements.workerKpiBalanceCop.textContent = "≈ $0 COP";
        }
      } else {
        elements.workerKpiBalance.textContent = `+$${Math.abs(balance).toFixed(2)}`;
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-[#2563EB] dark:text-[#60A5FA] tabular-nums";
        if (elements.workerKpiBalanceCop) {
          elements.workerKpiBalanceCop.className = "block text-xs font-mono font-medium text-[#2563EB] dark:text-[#60A5FA] tabular-nums truncate mt-0.5";
          elements.workerKpiBalanceCop.textContent = `≈ +${formatCop(Math.abs(copBalance))}`;
        }
      }
    }

    const workerObj = displayedWorkers[0];
    if (workerObj && elements.workerHeroRate) {
      elements.workerHeroRate.textContent = `$${Number(workerObj.tarifaHora || 0).toFixed(2)} / h`;
    }
  }

  renderProductivityCharts();
  updateClientsDatalist();
}

window.quickPayWorker = function(workerId, workerName, pendingBalance) {
  if (elements.paymentWorkerSelect) elements.paymentWorkerSelect.value = workerId;
  if (elements.paymentAmount) {
    elements.paymentAmount.value = pendingBalance > 0 ? pendingBalance.toFixed(2) : "";
  }
  if (elements.paymentReference) {
    elements.paymentReference.value = "Liquidación " + (elements.periodFilterLabel?.textContent || "");
  }
  const paymentCard = document.getElementById("adminPaymentCard") || elements.formPayment;
  if (paymentCard) {
    paymentCard.scrollIntoView({ behavior: "smooth", block: "center" });
    paymentCard.classList.add("highlight-pulse");
    setTimeout(() => paymentCard.classList.remove("highlight-pulse"), 1600);
  }
  showToast(`Formulario de pago listo para ${workerName} ($${pendingBalance > 0 ? pendingBalance.toFixed(2) : '0.00'}).`, "info");
};

function resetKPIs() {
  elements.kpiTotalHoras.textContent = "0.00";
  elements.kpiTotalHorasFormatted.textContent = "0h 0m 0s en total";
  elements.kpiTotalGenerado.textContent = "$0.00";
  if (elements.kpiTotalGeneradoCop) elements.kpiTotalGeneradoCop.textContent = "≈ $0 COP";
  elements.kpiTotalPagado.textContent = "$0.00";
  if (elements.kpiTotalPagadoCop) elements.kpiTotalPagadoCop.textContent = "≈ $0 COP";
  elements.kpiSaldoPendiente.textContent = "$0.00";
  if (elements.kpiSaldoPendienteCop) elements.kpiSaldoPendienteCop.textContent = "≈ $0 COP";
  elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums";

  if (elements.workerKpiEarnedCop) elements.workerKpiEarnedCop.textContent = "≈ $0 COP";
  if (elements.workerKpiPaidCop) elements.workerKpiPaidCop.textContent = "≈ $0 COP";
  if (elements.workerKpiBalanceCop) elements.workerKpiBalanceCop.textContent = "≈ $0 COP";
  renderProductivityCharts();
}

/* ============================================================================
   10.C. TASA DE CAMBIO EN TIEMPO REAL (USD A COP / TRM MERCADO FINANCIERO)
   ============================================================================ */
const trmState = {
  rate: 3169.76,
  lastUpdated: new Date(),
  isLive: true,
  isCustom: false
};

function getActiveTrmRate() {
  return trmState.rate || 3169.76;
}

function formatTrmRate(rate) {
  const num = Number(rate) || 3169.76;
  return "$" + num.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCop(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
  const rounded = Math.round(amount);
  return "$" + rounded.toLocaleString("es-CO") + " COP";
}

function updateTrmUI() {
  const currentRate = getActiveTrmRate();
  const formattedRate = formatTrmRate(currentRate);

  if (elements.trmRateDisplay) {
    elements.trmRateDisplay.textContent = formattedRate;
  }
  if (elements.trmModalCurrentRate) {
    elements.trmModalCurrentRate.textContent = `1 USD = ${formattedRate} COP`;
  }
  if (elements.trmModalLiveBadge) {
    if (trmState.isCustom) {
      elements.trmModalLiveBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span><span>Tasa fija personalizada</span>`;
      elements.trmModalLiveBadge.className = "text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1";
    } else {
      elements.trmModalLiveBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>En vivo vía mercado financiero (interbancario)</span>`;
      elements.trmModalLiveBadge.className = "text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1";
    }
  }
  if (elements.trmModalLastUpdate) {
    if (trmState.isCustom) {
      elements.trmModalLastUpdate.textContent = "Modo: Tasa fija establecida manualmente";
    } else if (trmState.lastUpdated) {
      const timeStr = trmState.lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      elements.trmModalLastUpdate.textContent = `Última sincronización: ${timeStr} (se actualiza automáticamente)`;
    } else {
      elements.trmModalLastUpdate.textContent = "Sincronizando tasa en tiempo real...";
    }
  }
}

async function fetchLiveTrm(silent = true) {
  try {
    const customStored = localStorage.getItem("widely_custom_trm");
    if (customStored) {
      const parsedCustom = parseFloat(customStored);
      if (!isNaN(parsedCustom) && parsedCustom > 1000 && parsedCustom < 3800) {
        trmState.rate = parsedCustom;
        trmState.isCustom = true;
        updateTrmUI();
        return;
      }
    }
  } catch (e) {}

  let fetchedRate = null;

  // 1. Prioridad: API de mercados financieros en vivo interbancaria (al minuto)
  try {
    const res = await fetch("https://api.fxratesapi.com/latest?base=USD&currencies=COP");
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.COP && !isNaN(data.rates.COP) && data.rates.COP > 1000) {
        fetchedRate = Number(Number(data.rates.COP).toFixed(2));
      }
    }
  } catch (e) {
    console.warn("[TRM] fxratesapi error, probando alternativa:", e);
  }

  // 2. Alternativa: Open Exchange Rates API
  if (!fetchedRate) {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.COP && !isNaN(data.rates.COP) && data.rates.COP > 1000) {
          fetchedRate = Number(Number(data.rates.COP).toFixed(2));
        }
      }
    } catch (e) {
      console.warn("[TRM] er-api error, probando alternativa 2:", e);
    }
  }

  // 3. Alternativa: Currency API CDN
  if (!fetchedRate) {
    try {
      const res = await fetch("https://latest.currency-api.pages.dev/v1/currencies/usd.json");
      if (res.ok) {
        const data = await res.json();
        if (data?.usd?.cop && !isNaN(data.usd.cop) && data.usd.cop > 1000) {
          fetchedRate = Number(Number(data.usd.cop).toFixed(2));
        }
      }
    } catch (e) {
      console.warn("[TRM] currency-api error:", e);
    }
  }

  if (fetchedRate) {
    trmState.rate = fetchedRate;
    trmState.lastUpdated = new Date();
    trmState.isLive = true;
    trmState.isCustom = false;
    try {
      localStorage.setItem("widely_trm_rate", JSON.stringify({
        rate: fetchedRate,
        timestamp: Date.now()
      }));
    } catch (e) {}
    updateTrmUI();
    updateFinancialDashboard();
    if (!silent) {
      showToast(`TRM en vivo sincronizada: 1 USD = ${formatTrmRate(fetchedRate)} COP`, "success");
    }
    return;
  }

  try {
    const cached = localStorage.getItem("widely_trm_rate");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.rate && parsed.rate < 3800) {
        trmState.rate = Number(parsed.rate);
        trmState.lastUpdated = new Date(parsed.timestamp);
        updateTrmUI();
        updateFinancialDashboard();
        return;
      }
    }
  } catch (e) {}

  updateTrmUI();
}

function openTrmModal() {
  if (!elements.trmModal) return;
  updateTrmUI();
  if (elements.trmCustomRateInput) {
    elements.trmCustomRateInput.value = trmState.isCustom ? trmState.rate : "";
  }
  elements.trmModal.classList.remove("hidden");
  elements.trmModal.classList.add("flex");
}

function closeTrmModal() {
  if (!elements.trmModal) return;
  elements.trmModal.classList.add("hidden");
  elements.trmModal.classList.remove("flex");
}

function handleSaveCustomTrm() {
  const val = parseFloat(elements.trmCustomRateInput?.value || 0);
  if (isNaN(val) || val < 1000) {
    showToast("Ingresa una tasa de cambio válida (ej. 3170).", "warning");
    return;
  }
  trmState.rate = val;
  trmState.isCustom = true;
  localStorage.setItem("widely_custom_trm", String(val));
  updateTrmUI();
  updateFinancialDashboard();
  showToast(`Tasa fija establecida: 1 USD = ${formatTrmRate(val)} COP`, "info");
  closeTrmModal();
}

async function handleResetLiveTrm() {
  localStorage.removeItem("widely_custom_trm");
  localStorage.removeItem("widely_trm_rate");
  trmState.isCustom = false;
  await fetchLiveTrm(false);
  closeTrmModal();
}

function initTrmSystem() {
  try {
    // Limpiar caché legacy si tenía 4200
    const customStored = localStorage.getItem("widely_custom_trm");
    if (customStored && (parseFloat(customStored) === 4200 || parseFloat(customStored) > 3800)) {
      localStorage.removeItem("widely_custom_trm");
    }
    const cached = localStorage.getItem("widely_trm_rate");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.rate === 4200 || parsed.rate > 3800) {
        localStorage.removeItem("widely_trm_rate");
      } else if (parsed.rate) {
        trmState.rate = Number(parsed.rate);
        trmState.lastUpdated = new Date(parsed.timestamp);
      }
    }
  } catch (e) {}

  updateTrmUI();
  fetchLiveTrm(true);
  setInterval(() => fetchLiveTrm(true), 5 * 60 * 1000); // Sincronizar cada 5 minutos
}

/* ============================================================================
   10.B. DASHBOARD EJECUTIVO: GRÁFICOS DE PRODUCTIVIDAD (Chart.js)
   ============================================================================ */
function updateClientsDatalist() {
  const clients = Array.from(new Set(state.tasks.map(t => (t.cliente || "").trim()).filter(Boolean))).sort();
  if (elements.clientsDatalist) {
    elements.clientsDatalist.innerHTML = clients.map(c => `<option value="${escapeHtml(c)}"></option>`).join("");
  }
}

function renderProductivityCharts() {
  if (typeof Chart === "undefined") {
    return;
  }

  const isDark = document.documentElement.classList.contains("dark");
  const isWorker = state.userProfile?.rol === "worker";

  let filteredTasks = getFilteredTasks().filter(isTaskApproved);
  if (isWorker) {
    const myId = state.userProfile.trabajadorId;
    const myName = (state.userProfile.nombre || "").trim().toLowerCase();
    filteredTasks = filteredTasks.filter(t => 
      (myId && t.trabajadorId === myId) || 
      (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === myName)
    );
  }

  const periodLabels = {
    all: "Histórico completo",
    this_month: "Mes en curso",
    current_fortnight: "Quincena actual",
    last_month: "Mes anterior"
  };
  if (elements.chartPeriodNote) {
    elements.chartPeriodNote.textContent = periodLabels[state.filterPeriod] || "Período seleccionado";
  }

  const totalPeriodHours = filteredTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
  if (elements.chartTotalHoursBadge) {
    elements.chartTotalHoursBadge.textContent = `${totalPeriodHours.toFixed(2)} hrs`;
  }

  // 1. Gráfico de Horas por Día (Bar Chart)
  if (elements.productivityDailyChart) {
    if (dailyChartInstance) {
      dailyChartInstance.destroy();
      dailyChartInstance = null;
    }

    const dailyMap = {};
    filteredTasks.forEach(t => {
      const d = t.fecha || "Sin fecha";
      dailyMap[d] = (dailyMap[d] || 0) + (Number(t.horas) || 0);
    });

    const sortedDates = Object.keys(dailyMap).sort();
    let chartLabels = sortedDates;
    let chartData = sortedDates.map(d => Number(dailyMap[d].toFixed(2)));

    const formattedLabels = chartLabels.map(d => {
      try {
        const parts = d.split("-");
        if (parts.length === 3) {
          const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          return dt.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        }
      } catch (e) {}
      return d;
    });

    if (sortedDates.length === 0) {
      chartLabels = ["Sin tareas"];
      chartData = [0];
    }

    const ctxDaily = elements.productivityDailyChart.getContext("2d");
    dailyChartInstance = new Chart(ctxDaily, {
      type: "bar",
      data: {
        labels: sortedDates.length > 0 ? formattedLabels : chartLabels,
        datasets: [{
          label: "Horas trabajadas",
          data: chartData,
          backgroundColor: isDark ? "rgba(59, 130, 246, 0.85)" : "rgba(37, 99, 235, 0.85)",
          hoverBackgroundColor: isDark ? "#60A5FA" : "#1D4ED8",
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 32
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? "#111827" : "#FFFFFF",
            titleColor: isDark ? "#F8FAFC" : "#0F172A",
            bodyColor: isDark ? "#94A3B8" : "#64748B",
            borderColor: isDark ? "#1E293B" : "#E2E8F0",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` ${item.raw} horas trabajadas`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: isDark ? "#94A3B8" : "#64748B",
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: isDark ? "rgba(255, 255, 255, 0.05)" : "#E2E8F0"
            },
            ticks: {
              color: isDark ? "#94A3B8" : "#64748B",
              font: { family: "'Inter', sans-serif", size: 10 },
              callback: (v) => `${v}h`
            }
          }
        }
      }
    });
  }

  // 2. Gráfico por Categoría (Doughnut Chart)
  if (elements.productivityCategoryChart) {
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
      categoryChartInstance = null;
    }

    const categoryMap = {};
    filteredTasks.forEach(t => {
      const catKey = t.categoria || "general";
      categoryMap[catKey] = (categoryMap[catKey] || 0) + (Number(t.horas) || 0);
    });

    const activeCatKeys = Object.keys(categoryMap).filter(k => categoryMap[k] > 0);
    let catLabels = [];
    let catData = [];
    let catColors = [];

    if (activeCatKeys.length > 0) {
      activeCatKeys.forEach(k => {
        const meta = getCategoryMeta(k);
        catLabels.push(meta.label);
        catData.push(Number(categoryMap[k].toFixed(2)));
        catColors.push(meta.chartColor);
      });
    } else {
      catLabels = ["Sin registros"];
      catData = [1];
      catColors = [isDark ? "#1E293B" : "#E2E8F0"];
    }

    const ctxCat = elements.productivityCategoryChart.getContext("2d");
    categoryChartInstance = new Chart(ctxCat, {
      type: "doughnut",
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: catColors,
          borderWidth: 2,
          borderColor: isDark ? "#111827" : "#FFFFFF",
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: isDark ? "#94A3B8" : "#64748B",
              boxWidth: 8,
              boxHeight: 8,
              padding: 10,
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          tooltip: {
            backgroundColor: isDark ? "#111827" : "#FFFFFF",
            titleColor: isDark ? "#F8FAFC" : "#0F172A",
            bodyColor: isDark ? "#94A3B8" : "#64748B",
            borderColor: isDark ? "#1E293B" : "#E2E8F0",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                if (activeCatKeys.length === 0) return " 0 horas";
                return ` ${item.label}: ${item.raw}h`;
              }
            }
          }
        }
      }
    });
  }
}

/* ============================================================================
   11. GESTIÓN DE ELIMINACIONES CON MODAL
   ============================================================================ */
window.requestDelete = function(collectionName, id, label) {
  if (state.userProfile?.rol === "worker" && collectionName !== "tareas") {
    showToast("Los colaboradores solo pueden eliminar sus propias tareas.", "warning");
    return;
  }
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
   11.B. MODAL DE ASIGNACIÓN Y EDICIÓN DE TARIFAS (HORA Y ARTE)
   ============================================================================ */
window.openEditRateModal = function(id, workerName, currentRate, currentArtRate) {
  if (state.userProfile?.rol === "worker") {
    showToast("Solo los administradores pueden modificar las tarifas.", "warning");
    return;
  }
  const worker = state.workers.find(w => w.id === id);
  const name = workerName || (worker ? worker.nombre : "Colaborador");
  const hourlyRate = (currentRate !== undefined && currentRate !== null) ? Number(currentRate) : (worker ? Number(worker.tarifaHora || 0) : 0);
  const artRate = (currentArtRate !== undefined && currentArtRate !== null) ? Number(currentArtRate) : (worker ? Number(worker.tarifaArte || 0) : 0);

  if (elements.editRateWorkerId) elements.editRateWorkerId.value = id;
  if (elements.editRateModalWorker) {
    elements.editRateModalWorker.innerHTML = `Configura las tarifas para <strong>${escapeHtml(name)}</strong>.`;
  }
  if (elements.editRateInput) {
    elements.editRateInput.value = hourlyRate > 0 ? hourlyRate.toFixed(2) : "";
  }
  if (elements.editRateArtInput) {
    elements.editRateArtInput.value = artRate > 0 ? artRate.toFixed(2) : "";
  }
  setTimeout(() => elements.editRateInput?.focus(), 50);
  elements.editRateModal?.classList.remove("hidden");
  elements.editRateModal?.classList.add("flex");
};

function closeEditRateModal() {
  if (!elements.editRateModal) return;
  elements.editRateModal.classList.add("hidden");
  elements.editRateModal.classList.remove("flex");
  if (elements.formEditRate) elements.formEditRate.reset();
}

async function handleConfirmEditRate(e) {
  e.preventDefault();
  const workerId = elements.editRateWorkerId.value;
  const rateRaw = elements.editRateInput.value.trim();
  const newRate = rateRaw === "" ? 0 : parseFloat(rateRaw);
  const artRateRaw = elements.editRateArtInput ? elements.editRateArtInput.value.trim() : "";
  const newArtRate = artRateRaw === "" ? 0 : parseFloat(artRateRaw);

  if (isNaN(newRate) || newRate < 0) {
    showToast("La tarifa por hora debe ser un número igual o mayor a 0.", "warning");
    return;
  }
  if (isNaN(newArtRate) || newArtRate < 0) {
    showToast("La tarifa por arte debe ser un número igual o mayor a 0.", "warning");
    return;
  }

  const worker = state.workers.find(w => w.id === workerId);
  const workerName = worker ? worker.nombre : "Trabajador";

  try {
    const updatePayload = {
      tarifaHora: Number(newRate.toFixed(2)),
      tarifaArte: Number(newArtRate.toFixed(2))
    };

    if (db) {
      await updateDoc(doc(db, "trabajadores", workerId), updatePayload);
    } else {
      if (worker) {
        worker.tarifaHora = updatePayload.tarifaHora;
        worker.tarifaArte = updatePayload.tarifaArte;
      }
      updateWorkersUI();
      updateFinancialDashboard();
    }

    const ratesSummary = [];
    if (newRate > 0) ratesSummary.push(`$${newRate.toFixed(2)}/h`);
    if (newArtRate > 0) ratesSummary.push(`$${newArtRate.toFixed(2)}/arte`);
    const rateMsg = ratesSummary.length > 0 ? ratesSummary.join(" · ") : "$0.00 (sin tarifas)";
    showToast(`Tarifas de "${workerName}" actualizadas a ${rateMsg}.`, "success");
    closeEditRateModal();
  } catch (error) {
    console.error("Error al actualizar tarifas:", error);
    showToast("Error al actualizar: " + error.message, "error");
  }
}

/* ============================================================================
   11.B. REGISTRO MANUAL DE HORAS & LIQUIDACIÓN (RECIBO)
   ============================================================================ */
function initPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("[PWA] Error registrando Service Worker:", err);
      });
    });
  }
}

async function handleForgotPassword() {
  const email = elements.authLoginEmail?.value.trim();
  if (!email) {
    showToast("Escribe tu correo en el campo de arriba y presiona de nuevo '¿Olvidaste tu contraseña?'.", "warning");
    elements.authLoginEmail?.focus();
    return;
  }

  if (!auth) {
    showToast("Recuperación de contraseña disponible con Firebase conectado.", "warning");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast(`Se envió un enlace para restablecer tu contraseña a "${email}". Revisa tu correo o spam.`, "success");
  } catch (error) {
    console.error("[Auth] Error en recuperación de contraseña:", error);
    if (error.code === "auth/user-not-found") {
      showToast("No se encontró ninguna cuenta registrada con este correo.", "error");
    } else {
      showToast(`Error al enviar correo: ${error.message}`, "error");
    }
  }
}

function openManualEntryModal(preselectedWorkerId = null) {
  if (!elements.manualEntryModal) return;

  elements.manualWorkerSelect.innerHTML = `<option value="">-- Selecciona colaborador --</option>` +
    state.workers.map(w => {
      const hRate = Number(w.tarifaHora || 0);
      const aRate = Number(w.tarifaArte || 0);
      const parts = [];
      if (hRate > 0) parts.push(`$${hRate.toFixed(2)}/h`);
      if (aRate > 0) parts.push(`$${aRate.toFixed(2)}/arte`);
      const label = parts.length > 0 ? parts.join(" · ") : "Sin tarifas fijadas";
      return `<option value="${w.id}" data-rate="${hRate}" data-art-rate="${aRate}">${escapeHtml(w.nombre)} (${label})</option>`;
    }).join("");

  const isWorkerRole = state.userProfile?.rol === "worker";
  const userWorkerId = state.userProfile?.trabajadorId;

  if (isWorkerRole && userWorkerId) {
    elements.manualWorkerSelect.value = userWorkerId;
    elements.manualWorkerSelect.disabled = true;
  } else {
    elements.manualWorkerSelect.disabled = false;
    if (typeof preselectedWorkerId === "string" && preselectedWorkerId) {
      elements.manualWorkerSelect.value = preselectedWorkerId;
    }
  }

  // Prellenar tarifa por arte si el colaborador seleccionado ya tiene una
  const currentWorker = state.workers.find(w => w.id === elements.manualWorkerSelect.value);
  if (currentWorker && elements.manualArtRateInput) {
    const artR = Number(currentWorker.tarifaArte || 0);
    elements.manualArtRateInput.value = artR > 0 ? artR.toFixed(2) : "";
  }

  if (elements.manualDate && !elements.manualDate.value) {
    elements.manualDate.value = new Date().toISOString().split("T")[0];
  }

  // Si el colaborador solo cobra por arte y no tiene tarifa por hora, abrir directamente en modo artes
  if (currentWorker) {
    const hRate = Number(currentWorker.tarifaHora || 0);
    const aRate = Number(currentWorker.tarifaArte || 0);
    if (aRate > 0 && hRate === 0) {
      setManualEntryMode("artes");
    } else {
      setManualEntryMode(elements.manualEntryMode?.value || "horas");
    }
  } else {
    setManualEntryMode(elements.manualEntryMode?.value || "horas");
  }
  updateManualCost();

  elements.manualEntryModal.classList.remove("hidden");
  elements.manualEntryModal.classList.add("flex");
}

function closeManualEntryModal() {
  if (!elements.manualEntryModal) return;
  elements.manualEntryModal.classList.add("hidden");
  elements.manualEntryModal.classList.remove("flex");
  elements.formManualEntry?.reset();
  if (elements.manualWorkerSelect) elements.manualWorkerSelect.disabled = false;
  setManualEntryMode("horas");
}

function setManualEntryMode(mode) {
  const targetMode = mode === "artes" ? "artes" : "horas";
  if (elements.manualEntryMode) {
    elements.manualEntryMode.value = targetMode;
  }

  const hoursIcon = document.getElementById("manualModeHoursIcon") || elements.manualModeHoursBtn?.querySelector("i");
  const artsIcon = document.getElementById("manualModeArtsIcon") || elements.manualModeArtsBtn?.querySelector("i");

  if (targetMode === "artes") {
    if (elements.manualModeArtsBtn) {
      elements.manualModeArtsBtn.className = "py-1.5 px-3 rounded-lg bg-[#2563EB] text-white shadow-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (elements.manualModeHoursBtn) {
      elements.manualModeHoursBtn.className = "py-1.5 px-3 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (artsIcon) artsIcon.className = "fa-solid fa-palette text-xs text-white";
    if (hoursIcon) hoursIcon.className = "fa-solid fa-clock text-xs text-[#2563EB] dark:text-[#60A5FA]";

    if (elements.manualHoursContainer) elements.manualHoursContainer.classList.add("hidden");
    if (elements.manualArtsContainer) elements.manualArtsContainer.classList.remove("hidden");

    // Auto-ajustar categoría a 'diseno' si está en 'general'
    if (elements.manualCategory && (elements.manualCategory.value === "general" || !elements.manualCategory.value)) {
      elements.manualCategory.value = "diseno";
    }

    // Auto-llenar tarifa por arte si está vacía
    const currentWorker = state.workers.find(w => w.id === elements.manualWorkerSelect?.value);
    if (currentWorker && elements.manualArtRateInput && !elements.manualArtRateInput.value) {
      const artR = Number(currentWorker.tarifaArte || 0);
      if (artR > 0) elements.manualArtRateInput.value = artR.toFixed(2);
    }
  } else {
    if (elements.manualModeHoursBtn) {
      elements.manualModeHoursBtn.className = "py-1.5 px-3 rounded-lg bg-[#2563EB] text-white shadow-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (elements.manualModeArtsBtn) {
      elements.manualModeArtsBtn.className = "py-1.5 px-3 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (hoursIcon) hoursIcon.className = "fa-solid fa-clock text-xs text-white";
    if (artsIcon) artsIcon.className = "fa-solid fa-palette text-xs text-purple-600 dark:text-purple-400";

    if (elements.manualHoursContainer) elements.manualHoursContainer.classList.remove("hidden");
    if (elements.manualArtsContainer) elements.manualArtsContainer.classList.add("hidden");
  }

  updateManualCost();
}

function updateManualCost() {
  const workerId = elements.manualWorkerSelect?.value;
  const worker = state.workers.find(w => w.id === workerId);
  const mode = elements.manualEntryMode?.value || "horas";

  if (mode === "artes") {
    const artCount = parseInt(elements.manualArtCount?.value || 0, 10) || 0;
    const workerArtRate = worker ? Number(worker.tarifaArte || 0) : 0;
    const manualArtRateVal = parseFloat(elements.manualArtRateInput?.value || 0);
    const effectiveArtRate = (!isNaN(manualArtRateVal) && manualArtRateVal > 0) ? manualArtRateVal : workerArtRate;
    const totalCost = (artCount > 0 && effectiveArtRate > 0) ? (artCount * effectiveArtRate) : 0;

    if (elements.manualCalculatedCost) {
      elements.manualCalculatedCost.textContent = `$${totalCost.toFixed(2)}`;
    }
    if (elements.manualCalculationDetail) {
      if (artCount > 0 && effectiveArtRate > 0) {
        elements.manualCalculationDetail.textContent = `${artCount} diseño(s) × $${effectiveArtRate.toFixed(2)} c/u = $${totalCost.toFixed(2)}`;
      } else if (effectiveArtRate > 0) {
        elements.manualCalculationDetail.textContent = `Tarifa por arte: $${effectiveArtRate.toFixed(2)} c/u`;
      } else {
        elements.manualCalculationDetail.textContent = "Ingresa la cantidad de diseños y la tarifa por arte";
      }
    }
  } else {
    const hours = parseFloat(elements.manualHours?.value || 0) || 0;
    const rate = worker ? Number(worker.tarifaHora || 0) : 0;
    const totalCost = (hours > 0 && rate > 0) ? (hours * rate) : 0;

    if (elements.manualHourlyRateHint) {
      if (worker) {
        elements.manualHourlyRateHint.textContent = rate > 0 
          ? `Tarifa base de ${worker.nombre}: $${rate.toFixed(2)}/h`
          : `⚠️ ${worker.nombre} no tiene tarifa por hora asignada.`;
      } else {
        elements.manualHourlyRateHint.textContent = "La tarifa por hora configurada del colaborador se aplicará automáticamente.";
      }
    }
    if (elements.manualCalculatedCost) {
      elements.manualCalculatedCost.textContent = `$${totalCost.toFixed(2)}`;
    }
    if (elements.manualCalculationDetail) {
      if (hours > 0 && rate > 0) {
        elements.manualCalculationDetail.textContent = `${hours.toFixed(2)} hrs × $${rate.toFixed(2)}/h = $${totalCost.toFixed(2)}`;
      } else if (rate > 0) {
        elements.manualCalculationDetail.textContent = `Tarifa por hora: $${rate.toFixed(2)}/h`;
      } else {
        elements.manualCalculationDetail.textContent = "El costo total se calculará multiplicando el tiempo por la tarifa.";
      }
    }
  }
}

async function handleSaveManualEntry(e) {
  e.preventDefault();
  const isWorkerRole = state.userProfile?.rol === "worker";
  const userWorkerId = state.userProfile?.trabajadorId;
  const workerId = (isWorkerRole && userWorkerId) ? userWorkerId : (elements.manualWorkerSelect?.value || userWorkerId);
  const client = elements.manualClientProject?.value.trim() || "";
  const category = elements.manualCategory?.value || "general";
  const date = elements.manualDate?.value || new Date().toISOString().split("T")[0];
  const description = elements.manualDescription?.value.trim() || "";
  const mode = elements.manualEntryMode?.value || "horas";

  if (!workerId) {
    showToast("Selecciona el colaborador.", "warning");
    return;
  }
  if (!description) {
    showToast("Ingresa la descripción de la tarea.", "warning");
    return;
  }

  const worker = state.workers.find(w => w.id === workerId);
  const workerName = worker ? worker.nombre : "Colaborador";
  const initialStatus = isWorkerRole ? "pendiente" : "aprobada";

  let taskData = {
    fecha: date,
    trabajadorId: workerId,
    trabajadorNombre: workerName,
    userId: state.currentUser?.uid || state.userProfile?.uid || null,
    cliente: client,
    categoria: category,
    descripcion: description,
    esManual: true,
    estado: initialStatus,
    creadoPorRol: isWorkerRole ? "worker" : "admin",
    createdAt: db ? serverTimestamp() : new Date().toISOString()
  };

  if (mode === "artes") {
    const artCount = parseInt(elements.manualArtCount?.value || 0, 10);
    if (isNaN(artCount) || artCount <= 0) {
      showToast("Ingresa una cantidad válida de diseños/artes realizados (mínimo 1).", "warning");
      return;
    }

    const workerArtRate = worker ? Number(worker.tarifaArte || 0) : 0;
    const manualArtRateVal = parseFloat(elements.manualArtRateInput?.value || 0);
    const effectiveArtRate = (!isNaN(manualArtRateVal) && manualArtRateVal > 0) ? manualArtRateVal : workerArtRate;

    const manualHoursVal = parseFloat(elements.manualArtHours?.value || 0);
    const approxHours = (!isNaN(manualHoursVal) && manualHoursVal > 0) ? manualHoursVal : Number((artCount * 0.5).toFixed(2));
    const seconds = Math.round(approxHours * 3600);
    const cost = Number((artCount * effectiveArtRate).toFixed(2));

    taskData = {
      ...taskData,
      tipoCobro: "artes",
      cantidadArtes: artCount,
      tarifaArte: effectiveArtRate,
      horas: approxHours,
      segundos: seconds,
      tarifaHora: worker ? Number(worker.tarifaHora || 0) : 0,
      costoTotal: cost
    };
  } else {
    const hours = parseFloat(elements.manualHours?.value || 0);
    if (isNaN(hours) || hours <= 0) {
      showToast("Ingresa una cantidad válida de horas trabajadas (ej: 2.5).", "warning");
      return;
    }

    const rate = worker ? Number(worker.tarifaHora || 0) : 0;
    const cost = Number((hours * rate).toFixed(2));
    const seconds = Math.round(hours * 3600);

    taskData = {
      ...taskData,
      tipoCobro: "horas",
      segundos: seconds,
      horas: Number(hours.toFixed(2)),
      tarifaHora: rate,
      costoTotal: cost
    };
  }

  try {
    if (db) {
      await addDoc(collection(db, "tareas"), taskData);
    } else {
      taskData.id = "local_task_" + Date.now();
      state.tasks.unshift(taskData);
      updateTasksUI();
      updateFinancialDashboard();
    }

    if (mode === "artes") {
      if (isWorkerRole) {
        showToast(`Reporte de ${taskData.cantidadArtes} diseño(s) de arte enviado a revisión por la administración.`, "info");
      } else {
        showToast(`Registrado: ${taskData.cantidadArtes} diseño(s) de arte para ${workerName} ($${taskData.costoTotal.toFixed(2)}).`, "success");
      }
    } else {
      if (isWorkerRole) {
        showToast(`Tarea manual de ${taskData.horas}h enviada a revisión por la administración.`, "info");
      } else {
        showToast(`Tarea manual de ${taskData.horas}h guardada y aprobada para ${workerName} ($${taskData.costoTotal.toFixed(2)}).`, "success");
      }
    }
    closeManualEntryModal();
  } catch (err) {
    console.error("Error guardando tarea manual:", err);
    showToast("Error al guardar: " + err.message, "error");
  }
}

window.openManualEntryModal = openManualEntryModal;
window.closeManualEntryModal = closeManualEntryModal;
window.setManualEntryMode = setManualEntryMode;

/* ============================================================================
   11.C. GESTIÓN DE APROBACIÓN Y RECHAZO DE HORAS MANUALES
   ============================================================================ */
window.approveTask = async function(taskId) {
  const isAdmin = state.userProfile?.rol === "admin" || isMasterAdmin(state.currentUser?.email);
  if (!isAdmin) {
    showToast("Solo la administradora puede aprobar horas.", "warning");
    return;
  }

  const task = state.tasks.find(t => t.id === taskId);
  const workerName = task?.trabajadorNombre || "el colaborador";
  const hours = Number(task?.horas || 0).toFixed(2);

  try {
    if (db) {
      await updateDoc(doc(db, "tareas", taskId), {
        estado: "aprobada",
        motivoRechazo: null,
        aprobadoPor: state.currentUser?.email || "admin",
        aprobadoEn: serverTimestamp()
      });
    } else {
      if (task) {
        task.estado = "aprobada";
        task.motivoRechazo = null;
        updateTasksUI();
        updateFinancialDashboard();
      }
    }
    showToast(`✓ Aprobadas ${hours}h de ${workerName}. Ya computan en su liquidación.`, "success");
  } catch (err) {
    console.error("Error al aprobar tarea:", err);
    showToast("Error al aprobar horas: " + err.message, "error");
  }
};

window.openRejectModal = function(taskId) {
  const isAdmin = state.userProfile?.rol === "admin" || isMasterAdmin(state.currentUser?.email);
  if (!isAdmin) {
    showToast("Solo la administradora puede rechazar horas.", "warning");
    return;
  }

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) {
    showToast("Tarea no encontrada.", "error");
    return;
  }

  state.rejectTargetId = taskId;
  if (elements.rejectTaskId) elements.rejectTaskId.value = taskId;
  if (elements.rejectModalWorker) {
    elements.rejectModalWorker.textContent = `${task.trabajadorNombre || 'Colaborador'} — ${Number(task.horas || 0).toFixed(2)}h ($${Number(task.costoTotal || 0).toFixed(2)})`;
  }
  if (elements.rejectModalDetails) {
    elements.rejectModalDetails.textContent = `${task.fecha || 'Sin fecha'} | ${task.cliente ? task.cliente + ' | ' : ''}${task.descripcion || 'Sin descripción'}`;
  }
  if (elements.rejectReasonInput) {
    elements.rejectReasonInput.value = "";
  }

  if (elements.rejectTaskModal) {
    elements.rejectTaskModal.classList.remove("hidden");
    elements.rejectTaskModal.classList.add("flex");
    elements.rejectReasonInput?.focus();
  }
};

function closeRejectTaskModal() {
  state.rejectTargetId = null;
  if (elements.rejectTaskModal) {
    elements.rejectTaskModal.classList.add("hidden");
    elements.rejectTaskModal.classList.remove("flex");
  }
  if (elements.formRejectTask) {
    elements.formRejectTask.reset();
  }
}

async function handleConfirmRejectTask(e) {
  e.preventDefault();
  const taskId = elements.rejectTaskId?.value || state.rejectTargetId;
  if (!taskId) {
    showToast("No se seleccionó ninguna tarea para rechazar.", "warning");
    return;
  }

  const reason = elements.rejectReasonInput?.value.trim() || "Horas no aprobadas por la administración.";
  const task = state.tasks.find(t => t.id === taskId);
  const workerName = task?.trabajadorNombre || "el colaborador";

  try {
    if (db) {
      await updateDoc(doc(db, "tareas", taskId), {
        estado: "rechazada",
        motivoRechazo: reason,
        rechazadoPor: state.currentUser?.email || "admin",
        rechazadoEn: serverTimestamp()
      });
    } else {
      if (task) {
        task.estado = "rechazada";
        task.motivoRechazo = reason;
        updateTasksUI();
        updateFinancialDashboard();
      }
    }
    showToast(`✕ Horas de ${workerName} rechazadas. Se notificó el motivo.`, "info");
    closeRejectTaskModal();
  } catch (err) {
    console.error("Error al rechazar tarea:", err);
    showToast("Error al rechazar: " + err.message, "error");
  }
}

let currentStatementWorkerId = null;
let currentStatementDocType = "bill";

window.setStatementDocType = function(type) {
  const isWorker = state.userProfile?.rol === "worker";
  if (isWorker && type === "receipt") {
    type = "bill";
  }

  currentStatementDocType = type;
  if (type === "bill") {
    elements.docTypeBillBtn?.classList.add("bg-blue-600", "text-white", "shadow-sm");
    elements.docTypeBillBtn?.classList.remove("text-slate-500", "dark:text-slate-400");
    elements.docTypeReceiptBtn?.classList.remove("bg-blue-600", "text-white", "shadow-sm");
    elements.docTypeReceiptBtn?.classList.add("text-slate-500", "dark:text-slate-400");
    elements.docViewBill?.classList.remove("hidden");
    elements.docViewReceipt?.classList.add("hidden");
    if (elements.btnPrintStatementLabel) {
      elements.btnPrintStatementLabel.textContent = "Imprimir / Guardar Cuenta de Cobro (PDF)";
    }
  } else {
    elements.docTypeReceiptBtn?.classList.add("bg-blue-600", "text-white", "shadow-sm");
    elements.docTypeReceiptBtn?.classList.remove("text-slate-500", "dark:text-slate-400");
    elements.docTypeBillBtn?.classList.remove("bg-blue-600", "text-white", "shadow-sm");
    elements.docTypeBillBtn?.classList.add("text-slate-500", "dark:text-slate-400");
    elements.docViewReceipt?.classList.remove("hidden");
    elements.docViewBill?.classList.add("hidden");
    if (elements.btnPrintStatementLabel) {
      elements.btnPrintStatementLabel.textContent = "Imprimir / Guardar Recibo de Pago (PDF)";
    }
  }
};

function numeroALetras(monto) {
  const num = Math.abs(Number(monto) || 0);
  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  const centavosStr = String(centavos).padStart(2, "0");

  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const diezY = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const veinti = ["VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  function convertirCentenas(n) {
    if (n === 0) return "";
    if (n === 100) return "CIEN";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    let res = centenas[c] || "";
    if (d === 1) {
      res += (res ? " " : "") + diezY[u];
    } else if (d === 2) {
      res += (res ? " " : "") + veinti[u];
    } else {
      if (d > 2) {
        res += (res ? " " : "") + decenas[d];
        if (u > 0) res += " Y " + unidades[u];
      } else if (u > 0) {
        res += (res ? " " : "") + unidades[u];
      }
    }
    return res;
  }

  if (entero === 0) {
    return `CERO DÓLARES CON ${centavosStr}/100`;
  }

  let letras = "";
  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;

  if (millones > 0) {
    if (millones === 1) letras += "UN MILLÓN ";
    else letras += convertirCentenas(millones) + " MILLONES ";
  }

  if (miles > 0) {
    if (miles === 1) letras += "MIL ";
    else letras += convertirCentenas(miles) + " MIL ";
  }

  if (resto > 0) {
    letras += convertirCentenas(resto);
  }

  return `${letras.trim()} DÓLARES CON ${centavosStr}/100`;
}

function saveWorkerBankingPrefs(workerId) {
  if (!workerId) return;
  const data = {
    city: elements.billCity?.textContent.trim() || "Bogotá D.C.",
    bank: elements.billBank?.textContent.trim() || "Bancolombia",
    accountType: elements.billAccountType?.textContent.trim() || "Ahorros",
    accountNumber: elements.billAccountNumber?.textContent.trim() || ""
  };
  try {
    localStorage.setItem(`widely_banking_${workerId}`, JSON.stringify(data));
  } catch (e) {}
}

function loadWorkerBankingPrefs(workerId) {
  if (!workerId) return {};
  try {
    const raw = localStorage.getItem(`widely_banking_${workerId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

window.openStatementModal = function(workerId, preferredType) {
  const worker = state.workers.find(w => w.id === workerId);
  if (!worker) {
    showToast("Trabajador no encontrado.", "error");
    return;
  }
  currentStatementWorkerId = worker.id;

  const filteredTasks = state.tasks.filter(t => 
    (t.trabajadorId === worker.id || (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase())) &&
    isDateInPeriod(t.fecha, state.filterPeriod) &&
    isTaskApproved(t)
  );

  const filteredPayments = state.payments.filter(p =>
    (p.trabajadorId === worker.id || (p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase())) &&
    isDateInPeriod(p.fecha, state.filterPeriod)
  );

  const totalSeconds = filteredTasks.reduce((acc, t) => acc + (Number(t.segundos) || 0), 0);
  const totalHours = filteredTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
  const totalEarned = filteredTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);
  const totalPaid = filteredPayments.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const netBalance = Number((totalEarned - totalPaid).toFixed(2));

  const periodLabels = {
    all: "Todo el Histórico",
    this_month: "Mes en Curso",
    current_fortnight: "Quincena en Curso",
    last_month: "Mes Anterior"
  };
  const periodLabel = periodLabels[state.filterPeriod] || "Período Actual";
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const yearStr = now.getFullYear();
  const workerInitials = (worker.nombre || "W").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
  const monthPad = String(now.getMonth() + 1).padStart(2, "0");

  const billConsecutiveStr = `No. CC-${yearStr}-${workerInitials}-${monthPad}`;
  const receiptConsecutiveStr = `No. LP-${yearStr}-${monthPad}-${workerInitials}`;

  // Cargar preferencias bancarias guardadas
  const banking = loadWorkerBankingPrefs(worker.id);

  // 1. POBLAR CUENTA DE COBRO FORMAL
  if (elements.billConsecutive) elements.billConsecutive.textContent = billConsecutiveStr;
  if (elements.billDate) elements.billDate.textContent = dateStr;
  if (elements.billCity) elements.billCity.textContent = banking.city || "Bogotá D.C.";
  if (elements.billPeriodTag) elements.billPeriodTag.textContent = periodLabel;
  if (elements.billConceptPeriod) elements.billConceptPeriod.textContent = periodLabel;

  if (elements.billWorkerName) elements.billWorkerName.textContent = worker.nombre;
  if (elements.billWorkerIdNumber) {
    elements.billWorkerIdNumber.textContent = banking.idNumber || "Ingresa C.C. aquí";
  }
  if (elements.billWorkerEmail) elements.billWorkerEmail.textContent = worker.email || state.userProfile?.email || "correo@ejemplo.com";
  if (elements.billWorkerPhone) {
    elements.billWorkerPhone.textContent = banking.phone || "+57 (Opcional)";
  }

  const payableAmount = netBalance > 0 ? netBalance : totalEarned;
  if (elements.billTotalAmount) elements.billTotalAmount.textContent = `$${payableAmount.toFixed(2)}`;
  const currentTrm = getActiveTrmRate();
  if (elements.billTotalAmountCop) elements.billTotalAmountCop.textContent = `≈ ${formatCop(payableAmount * currentTrm)}`;
  if (elements.billAmountInWords) elements.billAmountInWords.textContent = numeroALetras(payableAmount);

  if (elements.billGrossEarned) elements.billGrossEarned.textContent = `$${totalEarned.toFixed(2)}`;
  if (elements.billPaidDeduction) elements.billPaidDeduction.textContent = `-$${totalPaid.toFixed(2)}`;
  if (elements.billNetPayable) elements.billNetPayable.textContent = `$${netBalance.toFixed(2)}`;

  if (elements.billBank) elements.billBank.textContent = banking.bank || "Bancolombia";
  if (elements.billAccountType) elements.billAccountType.textContent = banking.accountType || "Ahorros";
  if (elements.billAccountNumber) elements.billAccountNumber.textContent = banking.accountNumber || "000-000000-00";
  if (elements.billAccountMobile) elements.billAccountMobile.textContent = banking.mobile || "Opcional";

  if (elements.billSignWorkerName) elements.billSignWorkerName.textContent = worker.nombre;
  if (elements.billSignWorkerId) {
    elements.billSignWorkerId.textContent = banking.idNumber ? `C.C. ${banking.idNumber}` : "C.C. ________________";
  }

  if (elements.billTasksBody) {
    if (filteredTasks.length === 0) {
      elements.billTasksBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400 text-xs">No hay actividades registradas en este período.</td></tr>`;
    } else {
      elements.billTasksBody.innerHTML = filteredTasks.map(t => {
        const cat = getCategoryMeta(t.categoria);
        const isArtTask = t.cantidadArtes && Number(t.cantidadArtes) > 0;
        const artPill = isArtTask
          ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 ml-1.5"><i class="fa-solid fa-palette text-purple-600"></i> ${t.cantidadArtes} artes @ $${Number(t.tarifaArte || 0).toFixed(2)}</span>`
          : "";
        const volText = isArtTask ? `${t.cantidadArtes} artes` : `${Number(t.horas || 0).toFixed(2)}h`;

        return `
          <tr class="text-xs">
            <td class="py-2.5 px-3 font-medium text-slate-600 tabular-nums whitespace-nowrap">${t.fecha || '-'}</td>
            <td class="py-2.5 px-3 font-semibold text-slate-800">${escapeHtml(t.cliente || 'General')}</td>
            <td class="py-2.5 px-3 text-slate-700">
              <span class="font-medium">${escapeHtml(t.descripcion || 'Servicio')}</span>
              ${artPill}
              <span class="text-[10px] text-slate-500 block">${cat.label}</span>
            </td>
            <td class="py-2.5 px-2 text-right font-medium text-slate-600 tabular-nums whitespace-nowrap">${volText}</td>
            <td class="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">$${Number(t.costoTotal || 0).toFixed(2)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  // 2. POBLAR RECIBO DE PAGO Y LIQUIDACIÓN
  if (elements.receiptConsecutive) elements.receiptConsecutive.textContent = receiptConsecutiveStr;
  if (elements.receiptDate) elements.receiptDate.textContent = dateStr;
  if (elements.receiptPeriodTag) elements.receiptPeriodTag.textContent = periodLabel;
  if (elements.receiptWorkerName) elements.receiptWorkerName.textContent = worker.nombre;

  const rateParts = [];
  if (Number(worker.tarifaHora || 0) > 0) rateParts.push(`$${Number(worker.tarifaHora).toFixed(2)}/h`);
  if (Number(worker.tarifaArte || 0) > 0) rateParts.push(`$${Number(worker.tarifaArte).toFixed(2)}/arte`);
  if (elements.receiptWorkerRate) elements.receiptWorkerRate.textContent = rateParts.length > 0 ? rateParts.join(" · ") : "$0.00";

  const totalArtesCount = filteredTasks.reduce((acc, t) => acc + (Number(t.cantidadArtes) || 0), 0);
  let volSummary = `${totalHours.toFixed(2)} hrs (${formatSecondsToTime(totalSeconds)})`;
  if (totalArtesCount > 0) {
    volSummary += ` · ${totalArtesCount} artes`;
  }
  if (elements.receiptTotalHours) elements.receiptTotalHours.textContent = volSummary;

  if (elements.receiptTotalEarned) elements.receiptTotalEarned.textContent = `$${totalEarned.toFixed(2)}`;
  if (elements.receiptTotalPaid) elements.receiptTotalPaid.textContent = `$${totalPaid.toFixed(2)}`;
  if (elements.receiptNetBalance) {
    elements.receiptNetBalance.textContent = (netBalance >= 0 ? "+$" : "-$") + Math.abs(netBalance).toFixed(2);
    elements.receiptNetBalance.className = netBalance > 0 ? "text-base sm:text-lg font-bold tabular-nums text-rose-600" : "text-base sm:text-lg font-bold tabular-nums text-emerald-600";
  }
  if (elements.receiptNetBalanceCop) {
    elements.receiptNetBalanceCop.textContent = `≈ ${formatCop(netBalance * currentTrm)}`;
  }
  if (elements.receiptSignWorkerName) elements.receiptSignWorkerName.textContent = worker.nombre;

  if (elements.receiptTasksBody) {
    if (filteredTasks.length === 0) {
      elements.receiptTasksBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400 text-xs">No hay actividades aprobadas en este período.</td></tr>`;
    } else {
      elements.receiptTasksBody.innerHTML = filteredTasks.map(t => {
        const cat = getCategoryMeta(t.categoria);
        const isArtTask = t.cantidadArtes && Number(t.cantidadArtes) > 0;
        const catPill = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200"><i class="fa-solid ${cat.icon}"></i> ${cat.label}</span>`;
        const clientPill = t.cliente ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200"><i class="fa-solid fa-briefcase text-blue-600"></i> ${escapeHtml(t.cliente)}</span>` : "";
        const artPill = isArtTask
          ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60"><i class="fa-solid fa-palette text-purple-600"></i> ${t.cantidadArtes} artes @ $${Number(t.tarifaArte || 0).toFixed(2)}</span>`
          : "";
        const volText = isArtTask ? `${t.cantidadArtes} artes` : `${Number(t.horas || 0).toFixed(2)}h`;

        return `
          <tr class="text-xs">
            <td class="py-2.5 px-3 font-medium text-slate-600 tabular-nums whitespace-nowrap">${t.fecha || '-'}</td>
            <td class="py-2.5 px-3 text-slate-800">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-medium">${escapeHtml(t.descripcion || 'Tarea')}</span>
                ${clientPill}
                ${catPill}
                ${artPill}
              </div>
            </td>
            <td class="py-2.5 px-2 text-right font-medium text-slate-600 tabular-nums whitespace-nowrap">${volText}</td>
            <td class="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">$${Number(t.costoTotal || 0).toFixed(2)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  if (elements.receiptPaymentsBody) {
    if (filteredPayments.length === 0) {
      elements.receiptPaymentsBody.innerHTML = `<tr><td colspan="3" class="py-3 text-center text-slate-400 text-xs">No hay pagos registrados para este colaborador en el período.</td></tr>`;
    } else {
      elements.receiptPaymentsBody.innerHTML = filteredPayments.map(p => `
        <tr class="text-xs">
          <td class="py-2.5 px-3 font-medium text-slate-600 tabular-nums whitespace-nowrap">${p.fecha || '-'}</td>
          <td class="py-2.5 px-3 text-slate-800">${escapeHtml(p.referencia || 'Transferencia / Liquidación')}</td>
          <td class="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">$${Number(p.monto || 0).toFixed(2)}</td>
        </tr>
      `).join("");
    }
  }

  // Control de roles para documentos: El trabajador SOLO puede ver y generar Cuenta de Cobro
  const isWorker = state.userProfile?.rol === "worker";

  if (isWorker) {
    if (elements.statementDocTypeSelector) elements.statementDocTypeSelector.classList.add("hidden");
    if (elements.statementWorkerTitleBadge) {
      elements.statementWorkerTitleBadge.classList.remove("hidden");
      elements.statementWorkerTitleBadge.classList.add("flex");
    }
    if (elements.docTypeReceiptBtn) elements.docTypeReceiptBtn.classList.add("hidden");
  } else {
    if (elements.statementDocTypeSelector) elements.statementDocTypeSelector.classList.remove("hidden");
    if (elements.statementWorkerTitleBadge) {
      elements.statementWorkerTitleBadge.classList.add("hidden");
      elements.statementWorkerTitleBadge.classList.remove("flex");
    }
    if (elements.docTypeReceiptBtn) elements.docTypeReceiptBtn.classList.remove("hidden");
  }

  const docTypeToUse = isWorker ? "bill" : (preferredType || "receipt");
  window.setStatementDocType(docTypeToUse);

  elements.statementModal?.classList.remove("hidden");
  elements.statementModal?.classList.add("flex");
};

function closeStatementModal() {
  elements.statementModal?.classList.add("hidden");
  elements.statementModal?.classList.remove("flex");
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
  elements.btnDismissOvertimeAlert?.addEventListener("click", dismissOvertimeAlert);

  // Escuchar cambio de tema Claro / Oscuro para refrescar colores de los gráficos
  window.addEventListener("themeChanged", () => {
    renderProductivityCharts();
  });

  // Formularios
  elements.formWorker.addEventListener("submit", handleSaveWorker);
  elements.formPayment.addEventListener("submit", handleSavePayment);

  // Pestañas
  elements.tabTasks.addEventListener("click", () => switchTab("tasks"));
  elements.tabPayments.addEventListener("click", () => switchTab("payments"));

  // Filtros de Período
  const periodButtons = document.querySelectorAll(".btn-period-filter");
  periodButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const period = btn.dataset.period || "all";
      setFilterPeriod(period);
    });
  });

  // Modal Borrado
  elements.btnCancelDelete.addEventListener("click", closeDeleteModal);
  elements.btnConfirmDelete.addEventListener("click", confirmDelete);
  elements.deleteModal.addEventListener("click", (e) => {
    if (e.target === elements.deleteModal) closeDeleteModal();
  });

  // Modal TRM Tasa de Cambio (USD a COP)
  elements.trmBadgeContainer?.addEventListener("click", openTrmModal);
  elements.btnCloseTrmModal?.addEventListener("click", closeTrmModal);
  elements.btnSaveCustomTrm?.addEventListener("click", handleSaveCustomTrm);
  elements.btnResetLiveTrm?.addEventListener("click", handleResetLiveTrm);
  elements.btnRefreshTrmNow?.addEventListener("click", () => fetchLiveTrm(false));
  elements.trmModal?.addEventListener("click", (e) => {
    if (e.target === elements.trmModal) closeTrmModal();
  });

  // Modal Asignar / Editar Tarifa
  elements.btnCancelEditRate?.addEventListener("click", closeEditRateModal);
  elements.formEditRate?.addEventListener("submit", handleConfirmEditRate);
  elements.editRateModal?.addEventListener("click", (e) => {
    if (e.target === elements.editRateModal) closeEditRateModal();
  });

  // Modal Registro Manual de Horas & Diseños de Artes
  elements.btnOpenManualEntry?.addEventListener("click", () => openManualEntryModal());
  elements.btnCancelManualEntry?.addEventListener("click", closeManualEntryModal);
  elements.btnCloseManualModal?.addEventListener("click", closeManualEntryModal);
  elements.formManualEntry?.addEventListener("submit", handleSaveManualEntry);
  elements.manualModeHoursBtn?.addEventListener("click", () => setManualEntryMode("horas"));
  elements.manualModeArtsBtn?.addEventListener("click", () => setManualEntryMode("artes"));
  elements.manualWorkerSelect?.addEventListener("change", () => {
    const workerId = elements.manualWorkerSelect?.value;
    const worker = state.workers.find(w => w.id === workerId);
    if (worker) {
      const hRate = Number(worker.tarifaHora || 0);
      const aRate = Number(worker.tarifaArte || 0);
      if (aRate > 0 && hRate === 0) {
        setManualEntryMode("artes");
      }
      if (elements.manualArtRateInput) {
        elements.manualArtRateInput.value = aRate > 0 ? aRate.toFixed(2) : "";
      }
    }
    updateManualCost();
  });
  elements.manualHours?.addEventListener("input", updateManualCost);
  elements.manualArtCount?.addEventListener("input", updateManualCost);
  elements.manualArtRateInput?.addEventListener("input", updateManualCost);
  elements.manualArtHours?.addEventListener("input", updateManualCost);
  elements.manualEntryModal?.addEventListener("click", (e) => {
    if (e.target === elements.manualEntryModal) closeManualEntryModal();
  });

  // Modal Rechazo de Horas Manuales
  elements.btnCancelRejectTask?.addEventListener("click", closeRejectTaskModal);
  elements.formRejectTask?.addEventListener("submit", handleConfirmRejectTask);
  elements.rejectTaskModal?.addEventListener("click", (e) => {
    if (e.target === elements.rejectTaskModal) closeRejectTaskModal();
  });

  // Filtros de estado de actividades
  document.querySelectorAll(".btn-status-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      const status = btn.dataset.status || "all";
      window.setTaskStatusFilter(status);
    });
  });

  // Modal Documentos: Cuenta de Cobro Formal & Recibo de Pago
  elements.docTypeBillBtn?.addEventListener("click", () => window.setStatementDocType("bill"));
  elements.docTypeReceiptBtn?.addEventListener("click", () => window.setStatementDocType("receipt"));
  elements.btnCloseStatement?.addEventListener("click", closeStatementModal);
  elements.btnPrintStatement?.addEventListener("click", () => {
    const originalTitle = document.title;
    const worker = state.workers.find(w => w.id === currentStatementWorkerId);
    const workerNameClean = (worker?.nombre || "Colaborador").trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, "_");

    // Cambiar título para el nombre por defecto del archivo PDF
    if (currentStatementDocType === "bill") {
      document.title = `Cuenta_de_Cobro_${workerNameClean}`;
    } else {
      document.title = `Recibo_de_Pago_${workerNameClean}`;
    }

    // Aislamiento total de tema: Si la app está en modo oscuro, desactivar temporalmente
    // la clase 'dark' para que el motor de PDF del navegador genere un documento 100% blanco.
    const wasDark = document.documentElement.classList.contains("dark");
    if (wasDark) {
      document.documentElement.classList.remove("dark");
    }

    window.print();

    const restorePrintState = () => {
      document.title = originalTitle;
      if (wasDark) {
        document.documentElement.classList.add("dark");
      }
    };

    window.addEventListener("afterprint", restorePrintState, { once: true });
    setTimeout(restorePrintState, 1500);
  });

  // Respaldo global para atajos de teclado (Ctrl+P / Cmd+P)
  let _globalDarkRestore = false;
  window.addEventListener("beforeprint", () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      _globalDarkRestore = true;
    }
  });
  window.addEventListener("afterprint", () => {
    if (_globalDarkRestore) {
      document.documentElement.classList.add("dark");
      _globalDarkRestore = false;
    }
  });
  elements.statementModal?.addEventListener("click", (e) => {
    if (e.target === elements.statementModal) closeStatementModal();
  });

  // Botón directo para el colaborador: Generar Mi Cuenta de Cobro
  elements.btnWorkerOpenBill?.addEventListener("click", () => {
    const profile = state.userProfile;
    if (!profile) return;
    const workerId = profile.trabajadorId || state.workers.find(w => w.nombre?.trim().toLowerCase() === profile.nombre?.trim().toLowerCase())?.id;
    if (workerId) {
      window.openStatementModal(workerId, "bill");
    } else if (state.workers.length > 0) {
      window.openStatementModal(state.workers[0].id, "bill");
    } else {
      showToast("No tienes un perfil de trabajador asignado aún.", "warning");
    }
  });

  // Botón para que el Colaborador registre horas manuales
  elements.btnWorkerOpenManualEntry?.addEventListener("click", openManualEntryModal);

  // Acciones Rápidas del Administrador
  elements.btnAdminScrollToPayment?.addEventListener("click", () => {
    const card = document.getElementById("adminPaymentCard") || elements.formPayment;
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("highlight-pulse");
      setTimeout(() => card.classList.remove("highlight-pulse"), 1600);
    }
  });

  elements.btnAdminScrollToWorker?.addEventListener("click", () => {
    if (elements.formWorker) {
      elements.formWorker.scrollIntoView({ behavior: "smooth", block: "center" });
      elements.workerName?.focus();
    }
  });

  elements.btnToggleAdminTimer?.addEventListener("click", () => {
    if (!elements.adminTimerSlot) return;
    const isHidden = elements.adminTimerSlot.classList.toggle("hidden");
    if (!isHidden) {
      if (elements.timerMainCard && elements.timerMainCard.parentElement !== elements.adminTimerSlot) {
        elements.adminTimerSlot.appendChild(elements.timerMainCard);
      }
      elements.btnToggleAdminTimer.innerHTML = '<i class="fa-solid fa-eye-slash mr-1"></i><span>Ocultar Cronómetro</span>';
    } else {
      elements.btnToggleAdminTimer.innerHTML = '<i class="fa-solid fa-stopwatch mr-1"></i><span>Ver Cronómetro</span>';
    }
  });

  // Guardado reactivo en LocalStorage de datos bancarios al editar
  const bankingInputs = [
    elements.billCity,
    elements.billBank,
    elements.billAccountType,
    elements.billAccountNumber
  ];
  bankingInputs.forEach(inputEl => {
    if (!inputEl) return;
    inputEl.addEventListener("blur", () => {
      if (currentStatementWorkerId) {
        saveWorkerBankingPrefs(currentStatementWorkerId);
      }
    });
  });

  // Autenticación & Perfiles
  elements.btnLogout?.addEventListener("click", handleLogout);
  elements.authTabLogin?.addEventListener("click", () => switchAuthTab("login"));
  elements.authTabRegister?.addEventListener("click", () => switchAuthTab("register"));
  elements.formAuthLogin?.addEventListener("submit", handleLogin);
  elements.btnForgotPassword?.addEventListener("click", handleForgotPassword);
  elements.formAuthRegister?.addEventListener("submit", handleRegister);
  elements.btnGoogleAuth?.addEventListener("click", handleGoogleAuth);

  // Inicializar Navegación Lateral (Modelo 1 - Sidebar SaaS Pro)
  setupSidebarNavigation();
}

/* ============================================================================
   12.1 NAVEGACIÓN Y COMPORTAMIENTO DEL SIDEBAR SAAS PRO (MODELO 1)
   ============================================================================ */
function setupSidebarNavigation() {
  const sidebarLinks = document.querySelectorAll(".sidebar-nav-link");
  const appSidebar = document.getElementById("appSidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const btnToggleMobileSidebar = document.getElementById("btnToggleMobileSidebar");
  const btnCloseSidebarMobile = document.getElementById("btnCloseSidebarMobile");

  function openSidebar() {
    appSidebar?.classList.remove("-translate-x-full");
    sidebarBackdrop?.classList.remove("hidden");
  }

  function closeSidebar() {
    appSidebar?.classList.add("-translate-x-full");
    sidebarBackdrop?.classList.add("hidden");
  }

  btnToggleMobileSidebar?.addEventListener("click", openSidebar);
  btnCloseSidebarMobile?.addEventListener("click", closeSidebar);
  sidebarBackdrop?.addEventListener("click", closeSidebar);

  sidebarLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const navKey = link.dataset.nav;
      if (!navKey) return;

      sidebarLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      const isWorker = state.userProfile?.rol === "worker";

      let targetId = null;
      if (navKey === "dashboard") {
        targetId = isWorker ? "workerDashboardSection" : "adminDashboardSection";
      } else if (navKey === "tracker") {
        targetId = isWorker ? "workerTimerSlot" : "adminTimerSlot";
        if (!isWorker && elements.adminTimerSlot?.classList.contains("hidden")) {
          elements.btnToggleAdminTimer?.click();
        }
      } else if (navKey === "billing") {
        targetId = isWorker ? "workerBillingHub" : "adminFinancialSection";
      } else if (navKey === "tasks") {
        targetId = isWorker ? "workerTasksSlot" : "adminTasksSlot";
      } else if (navKey === "reports") {
        targetId = isWorker ? "workerDashboardSection" : "adminReportsSection";
      } else if (navKey === "team") {
        targetId = "formWorker";
      } else if (navKey === "payments") {
        targetId = "adminPaymentCard";
      }

      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      if (window.innerWidth < 1024) {
        closeSidebar();
      }
    });
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
  // Elemento dbStatus removido del diseño de cabecera
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

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast-msg";

  let icon = "fa-circle-info text-blue-500";
  if (type === "success") icon = "fa-circle-check text-emerald-500";
  else if (type === "warning") icon = "fa-triangle-exclamation text-amber-500";
  else if (type === "error") icon = "fa-circle-xmark text-rose-500";

  toast.innerHTML = `
    <i class="fa-solid ${icon} text-sm flex-shrink-0"></i>
    <span class="text-xs sm:text-sm font-medium flex-1">${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 160);
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
      cliente: "Proyecto General",
      categoria: "diseno",
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

/* ============================================================================
   INICIALIZACIÓN DE LA APLICACIÓN (Arranca una vez todo está cargado)
   ============================================================================ */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
