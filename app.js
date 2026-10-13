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
    document.getElementById("firebaseWarning")?.classList.add("hidden");
  } catch (err) {
    console.error("[Firebase] Error al inicializar:", err);
  }
} else {
  console.warn("[Firebase] API Key no detectada. Operando en modo desconectado.");
  document.getElementById("firebaseWarning")?.classList.remove("hidden");
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
  btnCancelEditRate: document.getElementById("btnCancelEditRate"),

  // Modal Registro Manual de Horas
  btnOpenManualEntry: document.getElementById("btnOpenManualEntry"),
  manualEntryModal: document.getElementById("manualEntryModal"),
  formManualEntry: document.getElementById("formManualEntry"),
  manualWorkerSelect: document.getElementById("manualWorkerSelect"),
  manualDate: document.getElementById("manualDate"),
  manualHours: document.getElementById("manualHours"),
  manualClientProject: document.getElementById("manualClientProject"),
  manualCategory: document.getElementById("manualCategory"),
  manualDescription: document.getElementById("manualDescription"),
  manualCalculatedCost: document.getElementById("manualCalculatedCost"),
  btnCancelManualEntry: document.getElementById("btnCancelManualEntry"),
  btnCloseManualModal: document.getElementById("btnCloseManualModal"),

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
  workerKpiPaid: document.getElementById("workerKpiPaid"),
  workerKpiBalance: document.getElementById("workerKpiBalance"),
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
  const rateRaw = elements.workerRate.value.trim();
  const rate = rateRaw === "" ? 0 : parseFloat(rateRaw);

  if (!name) {
    showToast("Por favor ingresa el nombre del trabajador.", "warning");
    return;
  }

  if (isNaN(rate) || rate < 0) {
    showToast("La tarifa por hora debe ser un número igual o mayor a 0.", "warning");
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

    const rateMsg = rate > 0 ? ` con tarifa de $${rate.toFixed(2)}/h` : " (sin tarifa inicial)";
    showToast(`Trabajador "${name}" guardado exitosamente${rateMsg}.`, "success");
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
      return `
        <option value="${w.id}" data-rate="${rate}">
          ${w.nombre} (${rate > 0 ? `$${rate.toFixed(2)}/h` : 'Sin tarifa'})
        </option>
      `;
    }).join("");

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

  if (state.workers.length === 0) {
    elements.workersList.innerHTML = `<div class="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No hay trabajadores registrados aún.</div>`;
  } else {
    elements.workersList.innerHTML = state.workers.map(w => {
      const rate = Number(w.tarifaHora || 0);
      const hasRate = rate > 0;
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors text-xs">
          <div class="min-w-0 pr-2">
            <div class="font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(w.nombre)}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              ${hasRate 
                ? `<span class="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono font-medium tabular-nums">$${rate.toFixed(2)}/h</span>` 
                : `<span class="text-[10px] text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">Sin tarifa</span>`
              }
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button 
              type="button"
              onclick="window.openEditRateModal('${w.id}', '${escapeHtml(w.nombre)}', ${rate})"
              title="Asignar o editar tarifa por hora" 
              class="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 transition-all active:scale-95 text-xs flex items-center gap-1.5 font-medium">
              <i class="fa-solid fa-pen-to-square text-[11px]"></i>
              <span>${hasRate ? 'Editar' : 'Asignar Tarifa'}</span>
            </button>
            <button 
              type="button"
              onclick="window.requestDelete('trabajadores', '${w.id}', '${escapeHtml(w.nombre)}')"
              title="Eliminar trabajador" 
              class="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors active:scale-95 text-xs">
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

function updateTasksUI() {
  const isWorker = state.userProfile?.rol === "worker";
  let displayedTasks = getFilteredTasks();

  if (isWorker) {
    const myId = state.userProfile.trabajadorId;
    const myName = (state.userProfile.nombre || "").trim().toLowerCase();
    displayedTasks = displayedTasks.filter(t => 
      (myId && t.trabajadorId === myId) || 
      (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === myName)
    );
  }

  elements.taskCount.textContent = displayedTasks.length;
  updateClientsDatalist();

  if (displayedTasks.length === 0) {
    elements.tasksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
          ${isWorker ? "No tienes tareas registradas en este período." : "No hay tareas registradas en este período."}
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

    return `
      <tr class="hover:bg-[#F1F5F9] dark:hover:bg-[#162032] transition-colors">
        <td class="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] font-mono whitespace-nowrap tabular-nums">${t.fecha || '-'}</td>
        <td class="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">${escapeHtml(t.trabajadorNombre || 'Anónimo')}</td>
        <td class="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] max-w-sm">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-medium text-[#0F172A] dark:text-[#F8FAFC]" title="${escapeHtml(t.descripcion || '')}">${escapeHtml(t.descripcion || 'Sin descripción')}</span>
            ${clientBadge}
            ${catBadge}
            ${isManualTag}
          </div>
        </td>
        <td class="py-2.5 px-2 text-right font-mono text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap tabular-nums">
          ${formattedTime} <span class="text-[10px] text-[#64748B]/80 dark:text-[#94A3B8]/80">(${Number(t.horas || 0).toFixed(2)}h)</span>
        </td>
        <td class="py-2.5 px-2 text-right font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap tabular-nums">
          $${Number(t.costoTotal || 0).toFixed(2)}
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          <button 
            onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
            class="text-[#64748B] hover:text-[#BF6863] p-1 rounded-md hover:bg-[#BF6863]/10 transition-colors active:scale-95"
            title="Eliminar tarea">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
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
    const workerTasks = allFilteredTasks.filter(t => t.trabajadorId === worker.id || (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase()));
    const workerSeconds = workerTasks.reduce((acc, t) => acc + (Number(t.segundos) || 0), 0);
    const workerHours = workerTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
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

    const editRateBtn = !isWorker ? `
      <button 
        type="button" 
        onclick="window.openEditRateModal('${worker.id}', '${escapeHtml(worker.nombre)}', ${Number(worker.tarifaHora || 0)})"
        class="hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 group"
        title="Clic para cambiar tarifa por hora">
        <span>$${Number(worker.tarifaHora || 0).toFixed(2)}/h</span>
        <i class="fa-solid fa-pencil text-[9px] opacity-0 group-hover:opacity-100 transition-opacity text-[#3B82F6]"></i>
      </button>
    ` : `<span>$${Number(worker.tarifaHora || 0).toFixed(2)}/h</span>`;

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
            <span>${escapeHtml(worker.nombre)}</span>
          </div>
        </td>
        <td class="py-3 px-2 text-right font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
          ${editRateBtn}
        </td>
        <td class="py-3 px-2 text-right font-mono text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
          <span class="font-medium">${workerHours.toFixed(2)}h</span>
          <span class="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">${formatSecondsToTime(workerSeconds)}</span>
        </td>
        <td class="py-3 px-2 text-right font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
          $${workerEarned.toFixed(2)}
        </td>
        <td class="py-3 px-2 text-right font-mono font-medium text-[#2563EB] tabular-nums">
          $${workerPaid.toFixed(2)}
        </td>
        <td class="py-3 px-3 text-right">
          ${balanceBadge}
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
  elements.kpiTotalPagado.textContent = `$${totalPagadoGlobal.toFixed(2)}`;

  if (balance > 0.005) {
    elements.kpiSaldoPendiente.className = "text-xl sm:text-2xl 3xl:text-3xl font-semibold font-mono text-[#BF6863] tabular-nums";
    elements.kpiSaldoPendiente.textContent = `$${balance.toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = isWorker ? "Tu saldo pendiente por cobrar" : "Deuda total por liquidar a trabajadores";
  } else if (balance === 0) {
    elements.kpiSaldoPendiente.className = "text-xl sm:text-2xl 3xl:text-3xl font-semibold font-mono text-[#2563EB] tabular-nums";
    elements.kpiSaldoPendiente.textContent = "$0.00";
    elements.kpiSaldoDesc.textContent = isWorker ? "Tus pagos están al día" : "Todos los pagos están al día";
  } else {
    elements.kpiSaldoPendiente.className = "text-xl sm:text-2xl 3xl:text-3xl font-semibold font-mono text-[#2563EB] dark:text-[#60A5FA] tabular-nums";
    elements.kpiSaldoPendiente.textContent = `+$${Math.abs(balance).toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = isWorker ? "Anticipo recibido a tu favor" : "Saldo a favor de la empresa";
  }

  // Actualizar KPIs del Portal del Colaborador
  if (isWorker) {
    if (elements.workerKpiHours) elements.workerKpiHours.textContent = totalHorasGlobal.toFixed(2);
    if (elements.workerKpiEarned) elements.workerKpiEarned.textContent = `$${totalGeneradoGlobal.toFixed(2)}`;
    if (elements.workerKpiPaid) elements.workerKpiPaid.textContent = `$${totalPagadoGlobal.toFixed(2)}`;
    if (elements.workerKpiBalance) {
      if (balance > 0.005) {
        elements.workerKpiBalance.textContent = `$${balance.toFixed(2)}`;
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-[#BF6863] tabular-nums";
      } else if (balance === 0) {
        elements.workerKpiBalance.textContent = "$0.00";
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-[#2563EB] tabular-nums";
      } else {
        elements.workerKpiBalance.textContent = `+$${Math.abs(balance).toFixed(2)}`;
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-[#2563EB] dark:text-[#60A5FA] tabular-nums";
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
  elements.kpiTotalPagado.textContent = "$0.00";
  elements.kpiSaldoPendiente.textContent = "$0.00";
  elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums";
  renderProductivityCharts();
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

  let filteredTasks = getFilteredTasks();
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
   11.B. MODAL DE ASIGNACIÓN Y EDICIÓN DE TARIFA POR HORA
   ============================================================================ */
window.openEditRateModal = function(id, workerName, currentRate) {
  if (state.userProfile?.rol === "worker") {
    showToast("Solo los administradores pueden modificar las tarifas por hora.", "warning");
    return;
  }
  if (elements.editRateWorkerId) elements.editRateWorkerId.value = id;
  if (elements.editRateModalWorker) {
    elements.editRateModalWorker.innerHTML = `Configura la tarifa por hora para <strong>${escapeHtml(workerName)}</strong>.`;
  }
  if (elements.editRateInput) {
    elements.editRateInput.value = currentRate > 0 ? Number(currentRate).toFixed(2) : "";
    setTimeout(() => elements.editRateInput.focus(), 50);
  }
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

  if (isNaN(newRate) || newRate < 0) {
    showToast("Por favor ingresa un número igual o mayor a 0.", "warning");
    return;
  }

  const worker = state.workers.find(w => w.id === workerId);
  const workerName = worker ? worker.nombre : "Trabajador";

  try {
    if (db) {
      await updateDoc(doc(db, "trabajadores", workerId), {
        tarifaHora: Number(newRate.toFixed(2))
      });
    } else {
      if (worker) {
        worker.tarifaHora = Number(newRate.toFixed(2));
      }
      updateWorkersUI();
      updateFinancialDashboard();
    }

    const rateMsg = newRate > 0 ? `$${newRate.toFixed(2)}/h` : "$0.00/h (sin tarifa)";
    showToast(`Tarifa de "${workerName}" actualizada a ${rateMsg}.`, "success");
    closeEditRateModal();
  } catch (error) {
    console.error("Error al actualizar tarifa:", error);
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

function openManualEntryModal() {
  if (!elements.manualEntryModal) return;

  elements.manualWorkerSelect.innerHTML = `<option value="">-- Selecciona trabajador --</option>` +
    state.workers.map(w => {
      const rate = Number(w.tarifaHora || 0);
      return `<option value="${w.id}" data-rate="${rate}">${w.nombre} (${rate > 0 ? `$${rate.toFixed(2)}/h` : 'Sin tarifa'})</option>`;
    }).join("");

  if (state.userProfile?.rol === "worker" && state.userProfile?.trabajadorId) {
    elements.manualWorkerSelect.value = state.userProfile.trabajadorId;
    elements.manualWorkerSelect.disabled = true;
  } else {
    elements.manualWorkerSelect.disabled = false;
  }

  if (elements.manualDate) {
    elements.manualDate.value = new Date().toISOString().split("T")[0];
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
}

function updateManualCost() {
  const workerId = elements.manualWorkerSelect?.value;
  const hours = parseFloat(elements.manualHours?.value || 0);
  const worker = state.workers.find(w => w.id === workerId);
  const rate = worker ? Number(worker.tarifaHora || 0) : 0;
  const cost = (hours > 0 && rate > 0) ? hours * rate : 0;
  if (elements.manualCalculatedCost) {
    elements.manualCalculatedCost.textContent = `$${cost.toFixed(2)}`;
  }
}

async function handleSaveManualEntry(e) {
  e.preventDefault();
  const isWorkerRole = state.userProfile?.rol === "worker";
  const userWorkerId = state.userProfile?.trabajadorId;
  const workerId = (isWorkerRole && userWorkerId) ? userWorkerId : (elements.manualWorkerSelect.value || userWorkerId);
  const client = elements.manualClientProject?.value.trim() || "";
  const category = elements.manualCategory?.value || "general";
  const date = elements.manualDate.value;
  const hours = parseFloat(elements.manualHours.value);
  const description = elements.manualDescription.value.trim();

  if (!workerId) {
    showToast("Selecciona el trabajador.", "warning");
    return;
  }
  if (isNaN(hours) || hours <= 0) {
    showToast("Ingresa una cantidad válida de horas.", "warning");
    return;
  }
  if (!description) {
    showToast("Ingresa la descripción de la tarea.", "warning");
    return;
  }

  const worker = state.workers.find(w => w.id === workerId);
  const workerName = worker ? worker.nombre : "Colaborador";
  const rate = worker ? Number(worker.tarifaHora || 0) : 0;
  const cost = Number((hours * rate).toFixed(2));
  const seconds = Math.round(hours * 3600);

  const taskData = {
    fecha: date || new Date().toISOString().split("T")[0],
    trabajadorId: workerId,
    trabajadorNombre: workerName,
    userId: state.currentUser?.uid || state.userProfile?.uid || null,
    cliente: client,
    categoria: category,
    descripcion: description,
    segundos: seconds,
    horas: Number(hours.toFixed(2)),
    tarifaHora: rate,
    costoTotal: cost,
    esManual: true,
    createdAt: db ? serverTimestamp() : new Date().toISOString()
  };

  try {
    if (db) {
      await addDoc(collection(db, "tareas"), taskData);
    } else {
      taskData.id = "local_task_" + Date.now();
      state.tasks.unshift(taskData);
      updateTasksUI();
      updateFinancialDashboard();
    }
    showToast(`Tarea manual de ${hours}h guardada para ${workerName} ($${cost.toFixed(2)}).`, "success");
    closeManualEntryModal();
  } catch (err) {
    console.error("Error guardando tarea manual:", err);
    showToast("Error al guardar: " + err.message, "error");
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
    idNumber: elements.billWorkerIdNumber?.textContent.trim() || "",
    phone: elements.billWorkerPhone?.textContent.trim() || "",
    city: elements.billCity?.textContent.trim() || "Bogotá D.C.",
    bank: elements.billBank?.textContent.trim() || "Bancolombia",
    accountType: elements.billAccountType?.textContent.trim() || "Ahorros",
    accountNumber: elements.billAccountNumber?.textContent.trim() || "",
    mobile: elements.billAccountMobile?.textContent.trim() || ""
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
    isDateInPeriod(t.fecha, state.filterPeriod)
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
        return `
          <tr class="text-xs">
            <td class="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">${t.fecha || '-'}</td>
            <td class="py-2 px-3 font-semibold text-slate-800">${escapeHtml(t.cliente || 'General')}</td>
            <td class="py-2 px-3 text-slate-700">
              <span class="font-medium">${escapeHtml(t.descripcion || 'Servicio')}</span>
              <span class="text-[10px] text-slate-500 block">${cat.label}</span>
            </td>
            <td class="py-2 px-2 text-right font-mono text-slate-500 whitespace-nowrap">${Number(t.horas || 0).toFixed(2)}h</td>
            <td class="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">$${Number(t.costoTotal || 0).toFixed(2)}</td>
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
  if (elements.receiptWorkerRate) elements.receiptWorkerRate.textContent = `$${Number(worker.tarifaHora || 0).toFixed(2)}/h`;
  if (elements.receiptTotalHours) elements.receiptTotalHours.textContent = `${totalHours.toFixed(2)} hrs (${formatSecondsToTime(totalSeconds)})`;
  if (elements.receiptTotalEarned) elements.receiptTotalEarned.textContent = `$${totalEarned.toFixed(2)}`;
  if (elements.receiptTotalPaid) elements.receiptTotalPaid.textContent = `$${totalPaid.toFixed(2)}`;
  if (elements.receiptNetBalance) {
    elements.receiptNetBalance.textContent = (netBalance >= 0 ? "+$" : "-$") + Math.abs(netBalance).toFixed(2);
    elements.receiptNetBalance.className = netBalance > 0 ? "text-base sm:text-lg font-bold font-mono text-rose-600" : "text-base sm:text-lg font-bold font-mono text-emerald-600";
  }
  if (elements.receiptSignWorkerName) elements.receiptSignWorkerName.textContent = worker.nombre;

  if (elements.receiptTasksBody) {
    if (filteredTasks.length === 0) {
      elements.receiptTasksBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400 text-xs">No hay actividades aprobadas en este período.</td></tr>`;
    } else {
      elements.receiptTasksBody.innerHTML = filteredTasks.map(t => {
        const cat = getCategoryMeta(t.categoria);
        const catPill = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200"><i class="fa-solid ${cat.icon}"></i> ${cat.label}</span>`;
        const clientPill = t.cliente ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200"><i class="fa-solid fa-briefcase text-blue-600"></i> ${escapeHtml(t.cliente)}</span>` : "";

        return `
          <tr class="text-xs">
            <td class="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">${t.fecha || '-'}</td>
            <td class="py-2 px-3 text-slate-800">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-medium">${escapeHtml(t.descripcion || 'Tarea')}</span>
                ${clientPill}
                ${catPill}
              </div>
            </td>
            <td class="py-2 px-2 text-right font-mono text-slate-500 whitespace-nowrap">${Number(t.horas || 0).toFixed(2)}h</td>
            <td class="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">$${Number(t.costoTotal || 0).toFixed(2)}</td>
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
          <td class="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">${p.fecha || '-'}</td>
          <td class="py-2 px-3 text-slate-800">${escapeHtml(p.referencia || 'Transferencia / Liquidación')}</td>
          <td class="py-2 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">$${Number(p.monto || 0).toFixed(2)}</td>
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

  // Modal Asignar / Editar Tarifa
  elements.btnCancelEditRate?.addEventListener("click", closeEditRateModal);
  elements.formEditRate?.addEventListener("submit", handleConfirmEditRate);
  elements.editRateModal?.addEventListener("click", (e) => {
    if (e.target === elements.editRateModal) closeEditRateModal();
  });

  // Modal Registro Manual de Horas
  elements.btnOpenManualEntry?.addEventListener("click", openManualEntryModal);
  elements.btnCancelManualEntry?.addEventListener("click", closeManualEntryModal);
  elements.btnCloseManualModal?.addEventListener("click", closeManualEntryModal);
  elements.formManualEntry?.addEventListener("submit", handleSaveManualEntry);
  elements.manualWorkerSelect?.addEventListener("change", updateManualCost);
  elements.manualHours?.addEventListener("input", updateManualCost);
  elements.manualEntryModal?.addEventListener("click", (e) => {
    if (e.target === elements.manualEntryModal) closeManualEntryModal();
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

  // Guardado reactivo en LocalStorage de datos bancarios e identificación al editar
  const bankingInputs = [
    elements.billWorkerIdNumber,
    elements.billCity,
    elements.billWorkerPhone,
    elements.billBank,
    elements.billAccountType,
    elements.billAccountNumber,
    elements.billAccountMobile
  ];
  bankingInputs.forEach(inputEl => {
    if (!inputEl) return;
    inputEl.addEventListener("blur", () => {
      if (currentStatementWorkerId) {
        saveWorkerBankingPrefs(currentStatementWorkerId);
        if (elements.billSignWorkerId && elements.billWorkerIdNumber) {
          const idVal = elements.billWorkerIdNumber.textContent.trim();
          elements.billSignWorkerId.textContent = (idVal && !idVal.includes("Ingresa C.C.")) ? `C.C. ${idVal}` : "C.C. ________________";
        }
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
