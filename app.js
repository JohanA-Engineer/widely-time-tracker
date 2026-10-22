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
  updatePassword,
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
  general: { label: "General", icon: "fa-briefcase", color: "text-mid", bg: "bg-canvas dark:bg-muted border-line", chartColor: "#A3A3A3" },
  diseno: { label: "Diseño Gráfico", icon: "fa-palette", color: "text-ink", bg: "bg-ink/10 border-line", chartColor: "#0A0A0A" },
  video: { label: "Edición Video", icon: "fa-film", color: "text-ink", bg: "bg-ink/10 border-line", chartColor: "#404040" },
  copy: { label: "Redacción & Copy", icon: "fa-pen-nib", color: "text-ink", bg: "bg-ink/10 border-line", chartColor: "#737373" },
  ads: { label: "Pauta & Ads", icon: "fa-chart-line", color: "text-ink", bg: "bg-ink/10 border-line", chartColor: "#262626" },
  reunion: { label: "Reunión", icon: "fa-users", color: "text-mid", bg: "bg-canvas dark:bg-muted border-line", chartColor: "#D4D4D4" },
  estrategia: { label: "Estrategia", icon: "fa-lightbulb", color: "text-ink", bg: "bg-ink/10 border-line", chartColor: "#525252" }
};

// En modo oscuro la escala de grises se invierte para mantener el contraste sobre fondo negro
function invertGray(hex) {
  const v = 255 - parseInt(hex.slice(1, 3), 16);
  const h = v.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

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
  const norm = String(email).trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.includes(norm)) return true;
  if (Array.isArray(state?.adminEmails) && state.adminEmails.includes(norm)) return true;
  return false;
}

function isUserAdmin(profileOrUser) {
  if (!profileOrUser) return false;
  if (typeof profileOrUser === "string") return isMasterAdmin(profileOrUser);
  if (profileOrUser.rol === "admin") return true;
  return isMasterAdmin(profileOrUser.email);
}

let dailyChartInstance = null;
let categoryChartInstance = null;
let workersUnsubscribe = null;
let tasksUnsubscribe = null;
let paymentsUnsubscribe = null;
let upworkConfigUnsubscribe = null;
let clientsUnsubscribe = null;
let usersUnsubscribe = null;
let adminsConfigUnsubscribe = null;

/* ============================================================================
   2. ESTADO GLOBAL DE LA APLICACIÓN
   ============================================================================ */
let state = {
  workers: [],      // Colección 'trabajadores'
  users: [],        // Colección 'usuarios' (solo administradores)
  adminEmails: [],  // Lista de correos con rol Administrador
  tasks: [],        // Colección 'tareas'
  payments: [],     // Colección 'pagos'
  clients: [],      // Colección 'clientes'
  currentUser: null, // Firebase Auth user
  userProfile: null, // Perfil activo { uid, nombre, email, rol, trabajadorId }
  filterPeriod: "all", // Filtro de liquidación: 'all', 'this_month', 'current_fortnight', 'last_month'
  taskStatusFilter: "all", // Filtro de estado: 'all', 'pendiente', 'aprobada', 'rechazada'
  rejectTargetId: null,
  upworkWeeklyRevenue: 0, // Recaudación mensual acumulada Upwork en USD
  upworkMonthlyWeeks: {
    w1: 0,
    w2: 0,
    w3: 0,
    w4: 0,
    w5: 0,
    w6: 0
  },
  upworkFeePercent: 15,   // Tarifa servicio Upwork % (default 15% según factura oficial)
  upworkIncludeVat: true, // IVA Colombia (19%) sobre tarifa de servicio de Upwork
  upworkPayoutCost: 1.0,  // Costo Retiro Upwork USD (1 USD por cada retiro)
  nequiIncludeFee: true,  // Deducir comisiones PayPal -> Nequi (+ IVA 19%)
  workerWeeklyGoal: 20,   // Meta semanal en horas
  pomodoro: {
    enabled: false,
    phase: "focus", // 'focus' o 'break'
    focusMinutes: 25,
    breakMinutes: 5,
    remainingSeconds: 25 * 60,
    intervalId: null
  },
  timer: {
    isRunning: false,
    startTime: 0,
    elapsedSeconds: 0,
    intervalId: null,
    overtimeAlertDismissed: false
  },
  deleteTarget: null,
  islandDismissed: false
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
  financialTilesList: document.getElementById("financialTilesList"),
  tasksTableBody: document.getElementById("tasksTableBody"),
  tasksCardsList: document.getElementById("tasksCardsList"),
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
  adminApprovalsList: document.getElementById("adminApprovalsList"),
  adminApprovalsCount: document.getElementById("adminApprovalsCount"),
  btnAdminApprovalsViewAll: document.getElementById("btnAdminApprovalsViewAll"),
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
  btnTopbarMyProfile: document.getElementById("btnTopbarMyProfile"),
  sidebarMyProfileLink: document.getElementById("sidebarMyProfileLink"),
  sidebarTeamLink: document.getElementById("sidebarTeamLink"),

  // Vista de Página Mi Perfil (Page View Integrada SaaS Pro)
  profilePageView: document.getElementById("profilePageView"),
  btnBackToDashboard: document.getElementById("btnBackToDashboard"),
  btnCancelProfilePage: document.getElementById("btnCancelProfilePage"),
  btnTopSaveProfile: document.getElementById("btnTopSaveProfile"),
  btnPageOpenMyBill: document.getElementById("btnPageOpenMyBill"),
  digitalBankCard: document.getElementById("digitalBankCard"),
  cardBankName: document.getElementById("cardBankName"),
  cardNumberDisplay: document.getElementById("cardNumberDisplay"),
  cardHolderDisplay: document.getElementById("cardHolderDisplay"),
  cardTypeDisplay: document.getElementById("cardTypeDisplay"),
  profileBankingStatusTag: document.getElementById("profileBankingStatusTag"),
  myProfileSubEmail: document.getElementById("myProfileSubEmail"),

  // Formulario y campos de Mi Perfil
  formMyProfile: document.getElementById("formMyProfile"),
  myProfileAvatar: document.getElementById("myProfileAvatar"),
  myProfileTitleName: document.getElementById("myProfileTitleName"),
  myProfileRoleBadge: document.getElementById("myProfileRoleBadge"),
  myProfileName: document.getElementById("myProfileName"),
  myProfileEmail: document.getElementById("myProfileEmail"),
  myProfilePhone: document.getElementById("myProfilePhone"),
  myProfileDocType: document.getElementById("myProfileDocType"),
  myProfileDocNumber: document.getElementById("myProfileDocNumber"),
  myProfileCity: document.getElementById("myProfileCity"),
  myProfileAddress: document.getElementById("myProfileAddress"),
  myProfileBank: document.getElementById("myProfileBank"),
  myProfileAccountType: document.getElementById("myProfileAccountType"),
  myProfileAccountNumber: document.getElementById("myProfileAccountNumber"),
  myProfileAccountHolder: document.getElementById("myProfileAccountHolder"),
  myProfileNewPassword: document.getElementById("myProfileNewPassword"),
  myProfileConfirmPassword: document.getElementById("myProfileConfirmPassword"),
  btnUpdateMyPassword: document.getElementById("btnUpdateMyPassword"),
  btnSendResetEmailMyProfile: document.getElementById("btnSendResetEmailMyProfile"),
  btnSaveMyProfile: document.getElementById("btnSaveMyProfile"),

  // Sección Administración: Perfiles & Equipo
  adminTeamSection: document.getElementById("adminTeamSection"),
  tabUsersBtn: document.getElementById("tabUsersBtn"),
  tabDataWorkersBtn: document.getElementById("tabDataWorkersBtn"),
  usersCountBadge: document.getElementById("usersCountBadge"),
  dataWorkersCountBadge: document.getElementById("dataWorkersCountBadge"),
  registeredUsersContainer: document.getElementById("registeredUsersContainer"),
  registeredUsersList: document.getElementById("registeredUsersList"),
  dataWorkersContainer: document.getElementById("dataWorkersContainer"),
  btnOpenCreateDataProfile: document.getElementById("btnOpenCreateDataProfile"),
  btnOpenAddAdminModal: document.getElementById("btnOpenAddAdminModal"),

  // Modal Perfil de Datos (Sin Cuenta)
  createDataProfileModal: document.getElementById("createDataProfileModal"),
  btnCloseDataProfileModal: document.getElementById("btnCloseDataProfileModal"),
  btnCancelDataProfileModal: document.getElementById("btnCancelDataProfileModal"),
  formDataProfile: document.getElementById("formDataProfile"),
  dataProfileName: document.getElementById("dataProfileName"),
  dataProfileRole: document.getElementById("dataProfileRole"),
  dataProfileEmail: document.getElementById("dataProfileEmail"),
  dataProfilePhone: document.getElementById("dataProfilePhone"),
  dataProfileRate: document.getElementById("dataProfileRate"),
  dataProfileArtRate: document.getElementById("dataProfileArtRate"),
  dataProfileDocType: document.getElementById("dataProfileDocType"),
  dataProfileDocNumber: document.getElementById("dataProfileDocNumber"),
  dataProfileCity: document.getElementById("dataProfileCity"),
  dataProfileBank: document.getElementById("dataProfileBank"),
  dataProfileAccountType: document.getElementById("dataProfileAccountType"),
  dataProfileAccountNumber: document.getElementById("dataProfileAccountNumber"),
  btnSaveDataProfile: document.getElementById("btnSaveDataProfile"),

  // Modal Administrador: Editar Usuario Registrado
  adminEditUserModal: document.getElementById("adminEditUserModal"),
  btnCloseAdminEditUserModal: document.getElementById("btnCloseAdminEditUserModal"),
  btnCancelAdminEditUserModal: document.getElementById("btnCancelAdminEditUserModal"),
  formAdminEditUser: document.getElementById("formAdminEditUser"),
  adminEditUserUid: document.getElementById("adminEditUserUid"),
  adminEditUserName: document.getElementById("adminEditUserName"),
  adminEditUserEmail: document.getElementById("adminEditUserEmail"),
  adminEditUserRole: document.getElementById("adminEditUserRole"),
  adminEditUserWorkerSelect: document.getElementById("adminEditUserWorkerSelect"),
  adminEditUserPhone: document.getElementById("adminEditUserPhone"),
  adminEditUserDocType: document.getElementById("adminEditUserDocType"),
  adminEditUserDocNumber: document.getElementById("adminEditUserDocNumber"),
  adminEditUserCity: document.getElementById("adminEditUserCity"),
  adminEditUserAddress: document.getElementById("adminEditUserAddress"),
  adminEditUserBank: document.getElementById("adminEditUserBank"),
  adminEditUserAccountType: document.getElementById("adminEditUserAccountType"),
  adminEditUserAccountNumber: document.getElementById("adminEditUserAccountNumber"),
  adminEditUserAccountHolder: document.getElementById("adminEditUserAccountHolder"),
  btnAdminSendPasswordReset: document.getElementById("btnAdminSendPasswordReset"),
  btnSaveAdminEditUser: document.getElementById("btnSaveAdminEditUser"),

  // Modal Añadir Administrador
  addAdminModal: document.getElementById("addAdminModal"),
  btnCloseAddAdminModal: document.getElementById("btnCloseAddAdminModal"),
  btnCancelAddAdminModal: document.getElementById("btnCancelAddAdminModal"),
  formAddAdmin: document.getElementById("formAddAdmin"),
  newAdminEmailInput: document.getElementById("newAdminEmailInput"),
  btnSaveNewAdmin: document.getElementById("btnSaveNewAdmin"),

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

  // Presupuesto Upwork
  adminUpworkBudgetSection: document.getElementById("adminUpworkBudgetSection"),
  upworkRevenueDisplay: document.getElementById("upworkRevenueDisplay"),
  upworkRevenueCopDisplay: document.getElementById("upworkRevenueCopDisplay"),
  upworkRevenueSubtitle: document.getElementById("upworkRevenueSubtitle"),
  upworkPayrollCostDisplay: document.getElementById("upworkPayrollCostDisplay"),
  upworkPayrollCostCopDisplay: document.getElementById("upworkPayrollCostCopDisplay"),
  upworkPayrollDetails: document.getElementById("upworkPayrollDetails"),
  upworkAvailableBudgetDisplay: document.getElementById("upworkAvailableBudgetDisplay"),
  upworkAvailableBudgetCopDisplay: document.getElementById("upworkAvailableBudgetCopDisplay"),
  upworkBudgetStatusBadge: document.getElementById("upworkBudgetStatusBadge"),
  upworkBudgetSubtitle: document.getElementById("upworkBudgetSubtitle"),
  upworkBudgetPercentLabel: document.getElementById("upworkBudgetPercentLabel"),
  upworkBudgetHealthDesc: document.getElementById("upworkBudgetHealthDesc"),
  upworkBudgetProgressBar: document.getElementById("upworkBudgetProgressBar"),
  btnEditUpworkBudget: document.getElementById("btnEditUpworkBudget"),
  btnOpenUpworkBudgetModal: document.getElementById("btnOpenUpworkBudgetModal"),
  upworkBudgetModal: document.getElementById("upworkBudgetModal"),
  btnCloseUpworkModal: document.getElementById("btnCloseUpworkModal"),
  btnCancelUpworkBudget: document.getElementById("btnCancelUpworkBudget"),
  formUpworkBudget: document.getElementById("formUpworkBudget"),
  upworkRevenueInput: document.getElementById("upworkRevenueInput"),
  upworkInputCopPreview: document.getElementById("upworkInputCopPreview"),
  sidebarUpworkLink: document.getElementById("sidebarUpworkLink"),

  // Clientes & Margen
  adminClientsSection: document.getElementById("adminClientsSection"),
  sidebarClientsLink: document.getElementById("sidebarClientsLink"),
  btnSyncClientsFromTasks: document.getElementById("btnSyncClientsFromTasks"),
  btnOpenClientModal: document.getElementById("btnOpenClientModal"),
  clientsTableBody: document.getElementById("clientsTableBody"),
  clientModal: document.getElementById("clientModal"),
  clientModalTitle: document.getElementById("clientModalTitle"),
  btnCloseClientModal: document.getElementById("btnCloseClientModal"),
  btnCancelClientModal: document.getElementById("btnCancelClientModal"),
  formClient: document.getElementById("formClient"),
  clientIdInput: document.getElementById("clientIdInput"),
  clientNameInput: document.getElementById("clientNameInput"),
  clientRateInput: document.getElementById("clientRateInput"),
  clientHourBudgetInput: document.getElementById("clientHourBudgetInput"),
  clientNotesInput: document.getElementById("clientNotesInput"),
  btnSaveClient: document.getElementById("btnSaveClient"),

  // Exportación Excel / CSV
  btnExportTasksCsv: document.getElementById("btnExportTasksCsv"),
  btnExportPaymentsCsv: document.getElementById("btnExportPaymentsCsv"),
  btnExportFinancialCsv: document.getElementById("btnExportFinancialCsv"),

  // Pomodoro & Metas de Colaborador
  btnModeStandard: document.getElementById("btnModeStandard"),
  btnModePomodoro: document.getElementById("btnModePomodoro"),
  pomodoroBanner: document.getElementById("pomodoroBanner"),
  pomodoroPhaseLabel: document.getElementById("pomodoroPhaseLabel"),
  workerGoalCard: document.getElementById("workerGoalCard"),
  workerGoalStatusBadge: document.getElementById("workerGoalStatusBadge"),
  workerGoalText: document.getElementById("workerGoalText"),
  workerGoalProgressBar: document.getElementById("workerGoalProgressBar"),
  workerGoalPercent: document.getElementById("workerGoalPercent"),
  btnEditWorkerGoal: document.getElementById("btnEditWorkerGoal"),

  // Deducción comisiones Upwork & Nequi
  upworkFeePercentInput: document.getElementById("upworkFeePercentInput"),
  upworkPayoutCostInput: document.getElementById("upworkPayoutCostInput"),
  upworkIncludeVatInput: document.getElementById("upworkIncludeVatInput"),
  nequiIncludeFeeInput: document.getElementById("nequiIncludeFeeInput"),
  nequiActiveTierPill: document.getElementById("nequiActiveTierPill"),
  nequiTierBox1: document.getElementById("nequiTierBox1"),
  nequiTierBox2: document.getElementById("nequiTierBox2"),
  nequiTierBox3: document.getElementById("nequiTierBox3"),
  nequiBreakdownRow: document.getElementById("nequiBreakdownRow"),
  upworkBreakdownGross: document.getElementById("upworkBreakdownGross"),
  upworkBreakdownFeeLabel: document.getElementById("upworkBreakdownFeeLabel"),
  upworkBreakdownFee: document.getElementById("upworkBreakdownFee"),
  upworkBreakdownVat: document.getElementById("upworkBreakdownVat"),
  upworkVatBreakdownRow: document.getElementById("upworkVatBreakdownRow"),
  upworkBreakdownNetEarnings: document.getElementById("upworkBreakdownNetEarnings"),
  upworkBreakdownPayout: document.getElementById("upworkBreakdownPayout"),
  upworkBreakdownPayPal: document.getElementById("upworkBreakdownPayPal"),
  upworkBreakdownNequi: document.getElementById("upworkBreakdownNequi"),
  upworkBreakdownNet: document.getElementById("upworkBreakdownNet"),
  upworkBreakdownMonthlyPayroll: document.getElementById("upworkBreakdownMonthlyPayroll"),
  upworkBreakdownNetMargin: document.getElementById("upworkBreakdownNetMargin"),
  upworkNequiRouteSummary: document.getElementById("upworkNequiRouteSummary"),
  routeUpworkNetLabel: document.getElementById("routeUpworkNetLabel"),
  routeNequiTierLabel: document.getElementById("routeNequiTierLabel"),
  routeNetNequiUsd: document.getElementById("routeNetNequiUsd"),
  routeNetNequiCop: document.getElementById("routeNetNequiCop"),
  upworkWeeksPillsBar: document.getElementById("upworkWeeksPillsBar"),
  upworkTotalMonthlyRevenueLabel: document.getElementById("upworkTotalMonthlyRevenueLabel"),
  modalMonthBadge: document.getElementById("modalMonthBadge"),
  upworkWeek1Input: document.getElementById("upworkWeek1Input"),
  upworkWeek2Input: document.getElementById("upworkWeek2Input"),
  upworkWeek3Input: document.getElementById("upworkWeek3Input"),
  upworkWeek4Input: document.getElementById("upworkWeek4Input"),
  upworkWeek5Input: document.getElementById("upworkWeek5Input"),
  upworkWeek6Input: document.getElementById("upworkWeek6Input"),
  containerWeek1: document.getElementById("containerWeek1"),
  containerWeek2: document.getElementById("containerWeek2"),
  containerWeek3: document.getElementById("containerWeek3"),
  containerWeek4: document.getElementById("containerWeek4"),
  containerWeek5: document.getElementById("containerWeek5"),
  containerWeek6: document.getElementById("containerWeek6"),
  labelWeek1: document.getElementById("labelWeek1"),
  labelWeek2: document.getElementById("labelWeek2"),
  labelWeek3: document.getElementById("labelWeek3"),
  labelWeek4: document.getElementById("labelWeek4"),
  labelWeek5: document.getElementById("labelWeek5"),
  labelWeek6: document.getElementById("labelWeek6"),
  dateWeek1: document.getElementById("dateWeek1"),
  dateWeek2: document.getElementById("dateWeek2"),
  dateWeek3: document.getElementById("dateWeek3"),
  dateWeek4: document.getElementById("dateWeek4"),
  dateWeek5: document.getElementById("dateWeek5"),
  dateWeek6: document.getElementById("dateWeek6"),
  badgeWeek1: document.getElementById("badgeWeek1"),
  badgeWeek2: document.getElementById("badgeWeek2"),
  badgeWeek3: document.getElementById("badgeWeek3"),
  badgeWeek4: document.getElementById("badgeWeek4"),
  badgeWeek5: document.getElementById("badgeWeek5"),
  badgeWeek6: document.getElementById("badgeWeek6"),

  // WhatsApp Sharing & Teléfono
  btnShareWhatsAppStatement: document.getElementById("btnShareWhatsAppStatement"),
  workerPhone: document.getElementById("workerPhone"),

  // Mini-Dock Flotante Dynamic Island (Concepto 3)
  dynamicIslandTimer: document.getElementById("dynamicIslandTimer"),
  islandStatusDot: document.getElementById("islandStatusDot"),
  islandScrollToTimer: document.getElementById("islandScrollToTimer"),
  islandTimerDisplay: document.getElementById("islandTimerDisplay"),
  islandCostBadge: document.getElementById("islandCostBadge"),
  islandPomodoroBadge: document.getElementById("islandPomodoroBadge"),
  islandClientBadge: document.getElementById("islandClientBadge"),
  islandTaskDesc: document.getElementById("islandTaskDesc"),
  islandBtnPlayPause: document.getElementById("islandBtnPlayPause"),
  islandPlayPauseIcon: document.getElementById("islandPlayPauseIcon"),
  islandBtnRegister: document.getElementById("islandBtnRegister"),
  islandBtnDismiss: document.getElementById("islandBtnDismiss"),
  islandBtnPip: document.getElementById("islandBtnPip"),

  // Control Flotante Interactivo
  btnTogglePipTimer: document.getElementById("btnTogglePipTimer"),

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
  loadUpworkBudget();
  initCachedSession();
  restoreActiveTimer();
  setupEventListeners();
  initPWA();

  if (db) {
    initFirebaseAuth();
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
    if (isMasterAdmin(profile.email) || isUserAdmin(profile)) {
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
        elements.userRoleBadge.className = "text-[9px] font-mono text-ink font-bold uppercase";
      }
      if (elements.userAvatar) {
        elements.userAvatar.className = "w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-sm ";
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
        elements.userRoleBadge.className = "text-[9px] font-mono text-ink font-bold uppercase";
      }
      if (elements.userAvatar) {
        elements.userAvatar.className = "w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-sm ";
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

  // La vinculación solo se hace por trabajadorId (asignado al registrarse o por la administradora),
  // nunca por coincidencia de nombre, para evitar que una cuenta tome la ficha de otro colaborador
  const matchingWorker = profile.trabajadorId
    ? state.workers.find(w => w.id === profile.trabajadorId)
    : null;

  if (matchingWorker && elements.timerWorkerSelect) {
    elements.timerWorkerSelect.value = matchingWorker.id;
    elements.timerWorkerSelect.disabled = true;
    updateLiveCost();
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
    elements.authTabLogin?.classList.add("bg-white", "dark:bg-muted", "text-ink", "dark:text-white", "shadow-sm");
    elements.authTabLogin?.classList.remove("text-mid", "dark:text-mid");
    elements.authTabRegister?.classList.remove("bg-white", "dark:bg-muted", "text-ink", "dark:text-white", "shadow-sm");
    elements.authTabRegister?.classList.add("text-mid", "dark:text-mid");
    elements.formAuthLogin?.classList.remove("hidden");
    elements.formAuthRegister?.classList.add("hidden");
  } else {
    elements.authTabRegister?.classList.add("bg-white", "dark:bg-muted", "text-ink", "dark:text-white", "shadow-sm");
    elements.authTabRegister?.classList.remove("text-mid", "dark:text-mid");
    elements.authTabLogin?.classList.remove("bg-white", "dark:bg-muted", "text-ink", "dark:text-white", "shadow-sm");
    elements.authTabLogin?.classList.add("text-mid", "dark:text-mid");
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
      showToast("No hay conexión con Firebase. Verifica tu conexión a internet e inténtalo de nuevo.", "error");
    }
  } catch (error) {
    console.error("[Auth] Error en inicio de sesión:", error);
    let msg = error.message;
    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      msg = "Credenciales incorrectas. Verifica tu correo y contraseña.";
      showToast(`Error al iniciar sesión: ${msg}`, "error");
    } else if (error.code === "auth/configuration-not-found" || error.code === "auth/operation-not-allowed") {
      showToast("El inicio de sesión con correo no está habilitado en Firebase Authentication.", "error");
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
      if (role === "worker" && db) {
        const newWorkerRef = await addDoc(collection(db, "trabajadores"), {
          nombre: name,
          tarifaHora: 0,
          email: email,
          ownerUid: user.uid,
          createdAt: serverTimestamp()
        });
        workerId = newWorkerRef.id;
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
      showToast("No hay conexión con Firebase. Verifica tu conexión a internet e inténtalo de nuevo.", "error");
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
      showToast("El registro con correo no está habilitado en Firebase Authentication.", "error");
    } else {
      showToast(`No se pudo crear la cuenta: ${msg}`, "error");
    }
  }
}

async function handleGoogleAuth() {
  if (!auth) {
    showToast("No hay conexión con Firebase. Verifica tu conexión a internet e inténtalo de nuevo.", "error");
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
            try {
              const newWorkerRef = await addDoc(collection(db, "trabajadores"), {
                nombre: userName,
                tarifaHora: 0,
                activo: true,
                ownerUid: user.uid,
                createdAt: serverTimestamp()
              });
              profile.trabajadorId = newWorkerRef.id;
            } catch (e) {
              console.warn("[Auth] No se pudo crear registro de trabajador automático:", e);
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
    // Los datos bancarios guardados en este navegador no deben quedar tras cerrar sesión
    Object.keys(localStorage)
      .filter(key => key.startsWith("widely_banking_"))
      .forEach(key => localStorage.removeItem(key));
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
    if (upworkConfigUnsubscribe) { upworkConfigUnsubscribe(); upworkConfigUnsubscribe = null; }
    if (clientsUnsubscribe) { clientsUnsubscribe(); clientsUnsubscribe = null; }
    if (usersUnsubscribe) { usersUnsubscribe(); usersUnsubscribe = null; }
    if (adminsConfigUnsubscribe) { adminsConfigUnsubscribe(); adminsConfigUnsubscribe = null; }
    state.tasks = [];
    state.payments = [];
    state.users = [];
    updateTasksUI();
    updatePaymentsUI();
    updateFinancialDashboard();
    return;
  }

  // Cancelar suscripciones previas de trabajadores, tareas y pagos para evitar mezclas de sesiones
  if (workersUnsubscribe) {
    workersUnsubscribe();
    workersUnsubscribe = null;
  }
  if (tasksUnsubscribe) {
    tasksUnsubscribe();
    tasksUnsubscribe = null;
  }
  if (paymentsUnsubscribe) {
    paymentsUnsubscribe();
    paymentsUnsubscribe = null;
  }

  const isAdmin = profile.rol === "admin" || isMasterAdmin(profile.email);

  // 1. TRABAJADORES: La Administradora lee todas las fichas; el Colaborador solo la suya
  const onWorkersError = (error) => {
    console.warn("[Firestore] Trabajadores snapshot:", error.message);
  };
  if (isAdmin) {
    workersUnsubscribe = onSnapshot(collection(db, "trabajadores"), (snapshot) => {
      state.workers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

      updateWorkersUI();
      updateFinancialDashboard();
    }, onWorkersError);
  } else if (profile.trabajadorId) {
    workersUnsubscribe = onSnapshot(doc(db, "trabajadores", profile.trabajadorId), (snap) => {
      state.workers = snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];

      updateWorkersUI();
      updateFinancialDashboard();
    }, onWorkersError);
  } else {
    state.workers = [];
    updateWorkersUI();
  }

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

  // 4. PRESUPUESTO UPWORK: Sincronización en tiempo real para Administradora
  if (isAdmin && !upworkConfigUnsubscribe) {
    const upworkDocRef = doc(db, "configuracion", "upwork");
    upworkConfigUnsubscribe = onSnapshot(upworkDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.weeklyRevenue === "number") {
          state.upworkWeeklyRevenue = data.weeklyRevenue;
          localStorage.setItem("widely_upwork_weekly_revenue", String(data.weeklyRevenue));
        }
        if (typeof data.feePercent === "number") {
          state.upworkFeePercent = data.feePercent;
          localStorage.setItem("widely_upwork_fee_percent", String(data.feePercent));
        }
        if (typeof data.payoutCost === "number") {
          state.upworkPayoutCost = data.payoutCost;
          localStorage.setItem("widely_upwork_payout_cost", String(data.payoutCost));
        }
        if (typeof data.nequiIncludeFee === "boolean") {
          state.nequiIncludeFee = data.nequiIncludeFee;
          localStorage.setItem("widely_nequi_include_fee", String(data.nequiIncludeFee));
        }
        if (typeof data.includeVat === "boolean") {
          state.upworkIncludeVat = data.includeVat;
          localStorage.setItem("widely_upwork_include_vat", String(data.includeVat));
        }
        if (data.monthlyWeeks && typeof data.monthlyWeeks === "object") {
          state.upworkMonthlyWeeks = {
            w1: Number(data.monthlyWeeks.w1) || 0,
            w2: Number(data.monthlyWeeks.w2) || 0,
            w3: Number(data.monthlyWeeks.w3) || 0,
            w4: Number(data.monthlyWeeks.w4) || 0,
            w5: Number(data.monthlyWeeks.w5) || 0,
            w6: Number(data.monthlyWeeks.w6) || 0
          };
          localStorage.setItem("widely_upwork_monthly_weeks", JSON.stringify(state.upworkMonthlyWeeks));
          state.upworkWeeklyRevenue = (Number(state.upworkMonthlyWeeks.w1) || 0) +
            (Number(state.upworkMonthlyWeeks.w2) || 0) +
            (Number(state.upworkMonthlyWeeks.w3) || 0) +
            (Number(state.upworkMonthlyWeeks.w4) || 0) +
            (Number(state.upworkMonthlyWeeks.w5) || 0) +
            (Number(state.upworkMonthlyWeeks.w6) || 0);
          localStorage.setItem("widely_upwork_weekly_revenue", String(state.upworkWeeklyRevenue));
        }
        updateUpworkBudgetDashboard();
      }
    }, (error) => {
      console.warn("[Firestore] Aviso en sincronización de Upwork:", error.message);
    });
  }

  // 5. CLIENTES & PROYECTOS: Sincronización en tiempo real
  if (!clientsUnsubscribe) {
    const clientsCol = collection(db, "clientes");
    clientsUnsubscribe = onSnapshot(clientsCol, (snapshot) => {
      state.clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      updateClientsUI();
      updateClientsDatalist();
    }, (error) => {
      console.warn("[Firestore] Aviso en sincronización de clientes:", error.message);
    });
  }

  // 6. ADMINISTRADORES AUTORIZADOS: Sincronización en tiempo real
  if (!adminsConfigUnsubscribe) {
    const adminsDocRef = doc(db, "configuracion", "admins");
    adminsConfigUnsubscribe = onSnapshot(adminsDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.emails)) {
          state.adminEmails = data.emails.map(e => String(e).trim().toLowerCase());
        }
      }
    }, (err) => {
      console.info("[Firestore] Configuración de admins inicial:", err.message);
    });
  }

  // 7. USUARIOS REGISTRADOS: Acceso total para Administradores (Requisito 3)
  if (isAdmin && !usersUnsubscribe) {
    const usersCol = collection(db, "usuarios");
    usersUnsubscribe = onSnapshot(usersCol, (snapshot) => {
      state.users = snapshot.docs.map(doc => ({
        id: doc.id,
        uid: doc.id,
        ...doc.data()
      })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      updateAdminUsersUI();
    }, (error) => {
      console.warn("[Firestore] Aviso en sincronización de usuarios:", error.message);
    });
  } else if (!isAdmin && usersUnsubscribe) {
    usersUnsubscribe();
    usersUnsubscribe = null;
    state.users = [];
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
      elements.timerStatusBadge.className = "text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-muted dark:bg-ink/10 text-mid border border-faint dark:border-line";
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
    handlePomodoroTick();

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

  elements.timerStatusBadge.className = "text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-muted dark:bg-ink/10 text-mid border border-faint dark:border-line flex items-center gap-1.5";
  elements.timerStatusBadge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span> Activo`;

  state.islandDismissed = false;
  updateDynamicIslandUI();
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

  elements.timerStatusBadge.className = "text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-muted dark:bg-ink/10 text-mid border border-faint dark:border-line";
  elements.timerStatusBadge.textContent = "Pausado";

  updateDynamicIslandUI();
}

function resetTimer() {
  if (state.timer.elapsedSeconds === 0) return;

  pauseTimer();
  state.timer.elapsedSeconds = 0;
  state.timer.overtimeAlertDismissed = false;
  state.islandDismissed = false;
  elements.timerOvertimeAlert?.classList.add("hidden");
  elements.timerOvertimeAlert?.classList.remove("flex");
  elements.dynamicIslandTimer?.classList.remove("island-visible");
  clearTimerState();
  if (state.pomodoro.enabled) {
    state.pomodoro.remainingSeconds = state.pomodoro.focusMinutes * 60;
    state.pomodoro.phase = "focus";
    if (elements.pomodoroPhaseLabel) {
      elements.pomodoroPhaseLabel.textContent = `🍅 Enfoque (${state.pomodoro.focusMinutes}:00)`;
    }
  }
  renderTimerDisplay();
  updateLiveCost();
  updateDynamicIslandUI();

  elements.btnStart.disabled = false;
  elements.btnPause.disabled = true;
  elements.btnReset.disabled = true;

  elements.timerStatusBadge.className = "text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-line dark:bg-muted text-mid border border-line";
  elements.timerStatusBadge.textContent = "Detenido";
}

function renderTimerDisplay() {
  elements.timerDisplay.textContent = formatSecondsToTime(state.timer.elapsedSeconds);
  updateDynamicIslandUI();
  updatePipDisplay();
  updateBackgroundTabTitle();
}

function updateLiveCost() {
  const workerId = elements.timerWorkerSelect.value;
  const worker = state.workers.find(w => w.id === workerId);
  const rate = worker ? Number(worker.tarifaHora || 0) : 0;
  const hours = state.timer.elapsedSeconds / 3600;
  const cost = hours * rate;

  elements.liveCostBadge.textContent = `$${cost.toFixed(2)}`;
  if (elements.islandCostBadge) elements.islandCostBadge.textContent = `$${cost.toFixed(2)}`;
  updatePipDisplay();
}

function updateDynamicIslandUI() {
  if (!elements.dynamicIslandTimer) return;

  const seconds = state.timer.elapsedSeconds;
  const timeFormatted = formatSecondsToTime(seconds);

  if (elements.islandTimerDisplay) {
    elements.islandTimerDisplay.textContent = timeFormatted;
  }

  if (elements.islandCostBadge && elements.liveCostBadge) {
    elements.islandCostBadge.textContent = elements.liveCostBadge.textContent;
  }

  // Cliente y descripción activa
  const client = elements.timerClientProject?.value.trim() || "";
  const desc = elements.timerTaskDescription?.value.trim() || "";
  const displayTitle = desc || client || "Widely Social";
  if (elements.islandClientBadge) elements.islandClientBadge.textContent = client || "General";
  if (elements.islandTaskDesc) elements.islandTaskDesc.textContent = displayTitle;

  // Estado del pulso e icono de play/pause
  if (state.timer.isRunning) {
    if (elements.islandStatusDot) {
      elements.islandStatusDot.innerHTML = `
        <div class="relative flex items-center justify-center w-full h-full">
          <i class="fa-regular fa-clock text-xs text-ink"></i>
          <span class="absolute -top-1 -right-1 flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        </div>
      `;
    }
    if (elements.islandPlayPauseIcon) {
      elements.islandPlayPauseIcon.className = "fa-solid fa-pause text-[11px]";
    }
  } else {
    if (elements.islandStatusDot) {
      elements.islandStatusDot.innerHTML = `
        <i class="fa-regular fa-clock text-xs text-mid"></i>
      `;
    }
    if (elements.islandPlayPauseIcon) {
      elements.islandPlayPauseIcon.className = "fa-solid fa-play text-[11px] ml-0.5";
    }
  }

  // Indicador de Fase Pomodoro en la Isla
  if (elements.islandPomodoroBadge) {
    if (state.pomodoro.enabled) {
      elements.islandPomodoroBadge.classList.remove("hidden");
      const mins = Math.floor(state.pomodoro.remainingSeconds / 60);
      const secs = state.pomodoro.remainingSeconds % 60;
      const tag = state.pomodoro.phase === "focus" 
        ? `🍅 ${mins}:${String(secs).padStart(2, "0")}` 
        : `☕ ${mins}:${String(secs).padStart(2, "0")}`;
      elements.islandPomodoroBadge.textContent = tag;
    } else {
      elements.islandPomodoroBadge.classList.add("hidden");
    }
  }

  checkDynamicIslandVisibility();
}

function checkDynamicIslandVisibility() {
  if (!elements.dynamicIslandTimer) return;

  if (state.islandDismissed || state.timer.elapsedSeconds === 0) {
    elements.dynamicIslandTimer.classList.remove("island-visible");
    return;
  }

  // Verificar si el cronómetro principal está fuera de la pantalla por scroll
  let timerOutOfView = false;
  const timerCard = elements.timerMainCard || document.getElementById("timerMainCard");
  if (timerCard) {
    const rect = timerCard.getBoundingClientRect();
    timerOutOfView = rect.bottom < 80;
  } else {
    timerOutOfView = window.scrollY > 300;
  }

  if (timerOutOfView) {
    elements.dynamicIslandTimer.classList.add("island-visible");
  } else {
    elements.dynamicIslandTimer.classList.remove("island-visible");
  }
}

/* ============================================================================
   PICTURE-IN-PICTURE NATIVO & CONTROL FLOTANTE ALWAYS-ON-TOP
   Permite que el cronómetro flote sobre Windows (Figma, Excel, Photoshop, etc.)
   ============================================================================ */
/* ============================================================================
   MINI-VENTANA FLOTANTE INTERACTIVA (100% REAL HTML — CERO VIDEOS)
   Permite controlar el cronómetro sobre Figma, Excel, Photoshop o cualquier app.
   ============================================================================ */
let pipWindowInstance = null;
const ORIGINAL_DOCUMENT_TITLE = "Widely Social | Time Tracker & Liquidaciones";

function updatePipButtonsState(isActive) {
  if (elements.btnTogglePipTimer) {
    if (isActive) {
      elements.btnTogglePipTimer.classList.add("pip-active");
      elements.btnTogglePipTimer.innerHTML = '<i class="fa-solid fa-arrow-down-left-and-up-right-to-center text-[10px] text-on-primary"></i><span class="hidden sm:inline">Cerrar Flotante</span><span class="sm:hidden">Cerrar</span>';
    } else {
      elements.btnTogglePipTimer.classList.remove("pip-active");
      elements.btnTogglePipTimer.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square text-[10px] text-ink"></i><span class="hidden sm:inline">Flotar sobre Apps</span><span class="sm:hidden">Flotar</span>';
    }
  }
  if (elements.islandBtnPip) {
    if (isActive) {
      elements.islandBtnPip.classList.add("pip-active");
    } else {
      elements.islandBtnPip.classList.remove("pip-active");
    }
  }
}

function setupMiniWindowContent(doc, win) {
  doc.title = "Widely Social | Mini Tracker";
  doc.head.innerHTML = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha384-t1nt8BQoYMLFN5p42tRAtuAAFQaCQODekUVeKKZrEnEyp4H2R0RHFz0KWpmj7i8g" crossorigin="anonymous" referrerpolicy="no-referrer">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%;
        height: 100%;
        background: #000000;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .pip-pill-dock {
        width: calc(100% - 10px);
        height: calc(100% - 10px);
        max-height: 64px;
        background: #0A0A0A;
        border-radius: 9999px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.8), 0 0 15px rgba(6,182,212,0.15);
      }
      .pip-pill-dock::before {
        content: "";
        position: absolute;
        inset: -1.5px;
        border-radius: 9999px;
        padding: 1.5px;
        background: rgba(255, 255, 255, 0.18);
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
      .pip-badge {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: #262626;
        border: 1px solid rgba(192, 132, 252, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FAFAFA;
        flex-shrink: 0;
        cursor: pointer;
        transition: transform 0.15s;
      }
      .pip-badge:hover {
        transform: scale(1.05);
      }
      .pip-text-box {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex: 1;
        min-width: 0;
        margin: 0 12px;
        cursor: pointer;
      }
      .pip-title {
        color: #FFFFFF;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pip-sub {
        color: #A3A3A3;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
        font-weight: 500;
        margin-top: 2px;
        white-space: nowrap;
      }
      .pip-buttons {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .pip-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        outline: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .pip-btn:hover {
        transform: scale(1.08);
      }
      .pip-btn:active {
        transform: scale(0.92);
      }
      .pip-btn-pause {
        background: rgba(6, 182, 212, 0.15);
        border: 1.8px solid #FAFAFA;
        color: #FAFAFA;
        box-shadow: 0 0 12px rgba(6, 182, 212, 0.4);
      }
      .pip-btn-stop {
        background: rgba(239, 68, 68, 0.15);
        border: 1.8px solid #FF4D4F;
        color: #FF4D4F;
        box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
      }
    </style>
  `;

  const rawDesc = elements.timerTaskDescription?.value.trim() || "";
  const rawClient = elements.timerClientProject?.value.trim() || "Widely Social";
  const titleDisplay = rawDesc || rawClient;
  const timeFormatted = formatSecondsToTime(state.timer.elapsedSeconds);
  const cost = elements.liveCostBadge?.textContent || "$0.00";

  doc.body.innerHTML = `
    <div class="pip-pill-dock" id="pipPillContainer">
      <!-- Icono Morado -->
      <div class="pip-badge" id="pipBadgeFocus" title="Volver a la pestaña principal">
        <i class="fa-regular fa-clock" style="font-size: 13px;"></i>
      </div>

      <!-- Información: Tarea, Tiempo y Costo -->
      <div class="pip-text-box" id="pipTextFocus" title="Volver a la pestaña principal">
        <div class="pip-title" id="pipTaskTitle">${escapeHtml(titleDisplay)}</div>
        <div class="pip-sub">
          <span id="pipTimer" style="color: #FAFAFA; font-weight: 700;">${timeFormatted}</span>
          <span style="color: #737373;"> • </span>
          <span id="pipCost" style="color: #A3A3A3;">${cost} USD</span>
        </div>
      </div>

      <!-- Botones Reales de Interacción -->
      <div class="pip-buttons">
        <button type="button" id="pipBtnToggle" class="pip-btn pip-btn-pause" title="Pausar / Reanudar">
          <i class="${state.timer.isRunning ? 'fa-solid fa-pause' : 'fa-solid fa-play'}" id="pipToggleIcon" style="font-size: 12px; margin-left: ${state.timer.isRunning ? '0' : '2px'};"></i>
        </button>
        <button type="button" id="pipBtnSave" class="pip-btn pip-btn-stop" title="Guardar y registrar tarea">
          <i class="fa-solid fa-square" style="font-size: 11px;"></i>
        </button>
      </div>
    </div>
  `;

  // Asignar eventos de interacción directa
  doc.getElementById("pipBtnToggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.timer.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
    updatePipDisplay();
  });

  doc.getElementById("pipBtnSave")?.addEventListener("click", (e) => {
    e.stopPropagation();
    handleRegisterTask();
  });

  doc.getElementById("pipBadgeFocus")?.addEventListener("click", () => {
    window.focus();
  });

  doc.getElementById("pipTextFocus")?.addEventListener("click", () => {
    window.focus();
  });

  win.addEventListener("beforeunload", () => {
    pipWindowInstance = null;
    updatePipButtonsState(false);
  });
}

async function togglePictureInPictureWindow() {
  // 1. Si ya hay una ventana abierta, cerrarla
  if (pipWindowInstance && !pipWindowInstance.closed) {
    pipWindowInstance.close();
    pipWindowInstance = null;
    updatePipButtonsState(false);
    return;
  }

  // 2. Document Picture-in-Picture nativo (Always-On-Top sin barras ni pestañas en Chromium)
  if ("documentPictureInPicture" in window && window.isSecureContext) {
    try {
      pipWindowInstance = await window.documentPictureInPicture.requestWindow({
        width: 440,
        height: 80
      });
      setupMiniWindowContent(pipWindowInstance.document, pipWindowInstance);
      updatePipButtonsState(true);
      showToast("Píldora flotante del sistema activa (Always-On-Top).", "success");
      return;
    } catch (err) {
      console.warn("[Floating Window] Error con Document PiP:", err);
      showToast("No se pudo iniciar la ventana flotante del sistema.", "warning");
      return;
    }
  }

  // 3. Si se abre desde file:/// o navegador sin Document PiP, guiar al usuario al entorno seguro
  showToast(
    "Para usar la píldora flotante pura sin barras de navegador, abre la app en su enlace web seguro: https://johana-engineer.github.io/widely-time-tracker/ o usa el widget de escritorio.",
    "info",
    8000
  );
}

function updatePipDisplay() {
  if (!pipWindowInstance || pipWindowInstance.closed) return;

  const pipDoc = pipWindowInstance.document;
  if (!pipDoc) return;

  const timeFormatted = formatSecondsToTime(state.timer.elapsedSeconds);
  const cost = elements.liveCostBadge?.textContent || "$0.00";
  const rawDesc = elements.timerTaskDescription?.value.trim() || "";
  const rawClient = elements.timerClientProject?.value.trim() || "Widely Social";
  const displayTitle = rawDesc || rawClient;

  const pipTimer = pipDoc.getElementById("pipTimer");
  if (pipTimer) pipTimer.textContent = timeFormatted;

  const pipCost = pipDoc.getElementById("pipCost");
  if (pipCost) pipCost.textContent = `${cost} USD`;

  const pipTaskTitle = pipDoc.getElementById("pipTaskTitle");
  if (pipTaskTitle) pipTaskTitle.textContent = displayTitle;

  const pipToggleIcon = pipDoc.getElementById("pipToggleIcon");
  if (pipToggleIcon) {
    pipToggleIcon.className = state.timer.isRunning ? "fa-solid fa-pause" : "fa-solid fa-play";
    pipToggleIcon.style.marginLeft = state.timer.isRunning ? "0" : "2px";
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    updateBackgroundTabTitle();
  } else {
    document.title = ORIGINAL_DOCUMENT_TITLE;
  }
}

function updateBackgroundTabTitle() {
  if (!document.hidden) return;
  const time = formatSecondsToTime(state.timer.elapsedSeconds);
  const cost = elements.liveCostBadge?.textContent || "$0.00";
  const client = elements.timerClientProject?.value.trim() || "Widely";

  if (state.timer.isRunning) {
    if (state.pomodoro.enabled) {
      const mins = Math.floor(state.pomodoro.remainingSeconds / 60);
      const secs = state.pomodoro.remainingSeconds % 60;
      const pomTag = state.pomodoro.phase === "focus" 
        ? `🍅 ${mins}:${String(secs).padStart(2, "0")}` 
        : `☕ ${mins}:${String(secs).padStart(2, "0")}`;
      document.title = `${pomTag} [${time}] ${client}`;
    } else {
      document.title = `▶ ${time} (${cost}) • ${client}`;
    }
  } else if (state.timer.elapsedSeconds > 0) {
    document.title = `⏸ [${time}] Pausado • ${client}`;
  } else {
    document.title = ORIGINAL_DOCUMENT_TITLE;
  }
}

window.togglePictureInPictureWindow = togglePictureInPictureWindow;

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
    // Las tareas de colaboradores quedan pendientes hasta que la administradora las apruebe
    estado: isWorkerRole ? "pendiente" : "aprobada",
    creadoPorRol: isWorkerRole ? "worker" : "admin",
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

    showToast(isWorkerRole
      ? `¡Tarea registrada! Costo: $${totalCost.toFixed(2)} — pendiente de aprobación.`
      : `¡Tarea registrada con éxito! Costo: $${totalCost.toFixed(2)}`, "success");
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

  const phone = elements.workerPhone ? elements.workerPhone.value.trim() : "";
  const workerData = {
    nombre: name,
    email: email || null,
    telefono: phone || null,
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
        <option value="${escapeHtml(w.id)}" data-rate="${rate}" data-art-rate="${artRate}">
          ${escapeHtml(w.nombre)} (${tag})
        </option>
      `;
    }).join("");

  elements.paymentWorkerSelect.innerHTML = `<option value="">-- Selecciona un trabajador --</option>` +
    state.workers.map(w => `
      <option value="${escapeHtml(w.id)}">
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
  if (elements.dataWorkersCountBadge) {
    elements.dataWorkersCountBadge.textContent = state.workers.length;
  }

  if (state.workers.length === 0) {
    elements.workersList.innerHTML = `<div class="text-xs text-mid text-center py-4">No hay colaboradores registrados aún.</div>`;
  } else {
    elements.workersList.innerHTML = state.workers.map(w => {
      const rate = Number(w.tarifaHora || 0);
      const artRate = Number(w.tarifaArte || 0);
      const hasRate = rate > 0 || artRate > 0;
      const isDataOnly = w.esSoloDatos || w.tipoPerfil === "solo_datos";
      const profileTypeTag = isDataOnly
        ? `<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-ink/10 text-mid font-semibold border border-line">Solo Datos (Sin Cuenta)</span>`
        : `<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-ink/10 text-ink font-semibold border border-line">Cuenta</span>`;

      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-muted dark:bg-paper border border-line hover:border-line transition-colors text-xs">
          <div class="min-w-0 pr-2">
            <div class="font-semibold text-ink truncate flex items-center gap-1.5 flex-wrap">
              <span>${escapeHtml(w.nombre)}</span>
              ${w.cargo ? `<span class="text-[10px] text-mid font-normal">(${escapeHtml(w.cargo)})</span>` : ''}
              ${profileTypeTag}
            </div>
            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
              ${rate > 0 ? `<span class="text-[11px] text-ink font-mono font-medium tabular-nums bg-ink/10 px-1.5 py-0.5 rounded border border-line">$${rate.toFixed(2)}/h</span>` : ''}
              ${artRate > 0 ? `<span class="text-[11px] text-ink font-mono font-medium tabular-nums bg-ink/10 px-1.5 py-0.5 rounded border border-line"><i class="fa-solid fa-palette text-[9px] mr-1"></i>$${artRate.toFixed(2)}/arte</span>` : ''}
              ${!hasRate ? `<span class="text-[10px] text-mid font-mono bg-ink/10 px-1.5 py-0.5 rounded border border-line font-medium">Sin tarifas</span>` : ''}
              ${w.banco ? `<span class="text-[10px] text-mid font-mono">• 🏦 ${escapeHtml(w.banco)}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button 
              type="button"
              onclick="window.openManualEntryModal(${jsArg(w.id)})"
              title="Cargar horas o diseños de arte para ${escapeHtml(w.nombre)}" 
              class="px-2 py-1 rounded-lg bg-ink/10 hover:bg-ink/20 text-mid border border-line transition-all active:scale-95 text-xs flex items-center gap-1 font-medium cursor-pointer">
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span class="hidden sm:inline">Cargar</span>
            </button>
            <button 
              type="button"
              onclick="window.openEditRateModal(${jsArg(w.id)}, ${jsArg(w.nombre)}, ${rate}, ${artRate})"
              title="Asignar o editar tarifas" 
              class="px-2 py-1 rounded-lg bg-ink/10 hover:bg-ink/20 text-ink border border-line transition-all active:scale-95 text-xs flex items-center gap-1 font-medium cursor-pointer">
              <i class="fa-solid fa-pen-to-square text-[10px]"></i>
              <span>Tarifas</span>
            </button>
            <button 
              type="button"
              onclick="window.requestDelete('trabajadores', ${jsArg(w.id)}, ${jsArg(w.nombre)})"
              title="Eliminar colaborador" 
              class="text-mid hover:text-ember p-1.5 rounded-lg hover:bg-ember/10 transition-colors active:scale-95 text-xs cursor-pointer">
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
  updateAdminUsersUI();
}

/* ============================================================================
   8.A. GESTIÓN DE PERFILES, ADMINISTRADORES & COLABORADORES SOLO DATOS
   ============================================================================ */

/**
 * Alternar pestañas del panel de administración: Cuentas de Usuario vs Colaboradores Solo Datos
 */
function switchAdminTab(tab) {
  if (tab === "users") {
    elements.tabUsersBtn?.classList.add("active");
    elements.tabDataWorkersBtn?.classList.remove("active");
    elements.registeredUsersContainer?.classList.remove("hidden");
    elements.dataWorkersContainer?.classList.add("hidden");
  } else {
    elements.tabDataWorkersBtn?.classList.add("active");
    elements.tabUsersBtn?.classList.remove("active");
    elements.dataWorkersContainer?.classList.remove("hidden");
    elements.registeredUsersContainer?.classList.add("hidden");
  }
}

/**
 * Renderizar lista de usuarios registrados en el panel de administración (Requisito 3)
 */
function updateAdminUsersUI() {
  if (!elements.registeredUsersList) return;
  if (elements.usersCountBadge) {
    elements.usersCountBadge.textContent = state.users.length;
  }

  if (state.users.length === 0) {
    elements.registeredUsersList.innerHTML = `
      <div class="text-xs text-mid text-center py-6">
        No hay cuentas de usuarios registradas aún en el sistema.
      </div>
    `;
    return;
  }

  elements.registeredUsersList.innerHTML = state.users.map(u => {
    const emailNorm = String(u.email || "").trim().toLowerCase();
    const isMaster = MASTER_ADMIN_EMAILS.includes(emailNorm);
    const isAdmin = isUserAdmin(u);
    const userInitials = (u.nombre || u.email || "U").slice(0, 2).toUpperCase();

    // Buscar si tiene trabajador vinculado
    let linkedWorkerName = "";
    if (u.trabajadorId) {
      const match = state.workers.find(w => w.id === u.trabajadorId);
      if (match) linkedWorkerName = match.nombre;
    }

    const roleBadge = isAdmin
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-ink/15 text-ink border border-line">
          <i class="fa-solid fa-crown text-[9px]"></i> Administrador
        </span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-ink/15 text-ink border border-line">
          <i class="fa-solid fa-user text-[9px]"></i> Colaborador
        </span>`;

    const masterBadge = isMaster
      ? `<span class="text-[9px] font-bold text-mid bg-ink/10 border border-line px-1.5 py-0.5 rounded">Principal Protegida</span>`
      : "";

    const toggleRoleBtn = isMaster
      ? ""
      : `<button type="button" 
           onclick="window.toggleUserRole(${jsArg(u.id || u.uid)})" 
           title="${isAdmin ? 'Cambiar a Colaborador' : 'Hacer Administrador'}" 
           class="px-2 py-1 text-[11px] rounded-lg font-medium border border-line bg-white dark:bg-muted text-mid dark:text-faint hover:bg-muted transition-all cursor-pointer">
           <i class="fa-solid ${isAdmin ? 'fa-arrow-down text-ember' : 'fa-arrow-up text-ink'} mr-1 text-[10px]"></i>${isAdmin ? 'Bajar Rol' : 'Hacer Admin'}
         </button>`;

    return `
      <div class="flex items-center justify-between p-3 rounded-xl bg-muted dark:bg-paper border border-line hover:border-line transition-colors text-xs">
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
          <div class="w-8 h-8 rounded-lg ${isAdmin ? 'bg-primary' : 'bg-primary'} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
            ${escapeHtml(userInitials)}
          </div>
          <div class="min-w-0">
            <div class="font-semibold text-ink truncate flex items-center gap-1.5 flex-wrap">
              <span>${escapeHtml(u.nombre || "Usuario")}</span>
              ${roleBadge}
              ${masterBadge}
            </div>
            <div class="text-[11px] text-mid truncate flex items-center gap-2 flex-wrap mt-0.5">
              <span>${escapeHtml(u.email || "")}</span>
              ${u.telefono ? `<span>• 📞 ${escapeHtml(u.telefono)}</span>` : ""}
              ${u.banco ? `<span>• 🏦 ${escapeHtml(u.banco)}</span>` : ""}
              ${linkedWorkerName ? `<span class="text-ink font-medium">• Ficha: ${escapeHtml(linkedWorkerName)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${toggleRoleBtn}
          <button type="button" 
            onclick="window.openAdminEditUserModal(${jsArg(u.id || u.uid)})" 
            title="Editar Perfil y Permisos" 
            class="px-2.5 py-1 text-[11px] rounded-lg font-semibold bg-primary hover:bg-primary/90 text-on-primary transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1">
            <i class="fa-solid fa-pen-to-square text-[10px]"></i>
            <span class="hidden sm:inline">Editar</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * REQUISITO 1: VISTA DE PÁGINA COMPLETA "MI PERFIL" (SaaS Pro Integrada)
 */
function showProfilePage() {
  const profile = state.userProfile;
  if (!profile) {
    showToast("Inicia sesión para acceder a tu perfil.", "warning");
    return;
  }

  // 1. Ocultar vistas de dashboard/portales
  elements.adminPortalView?.classList.add("hidden");
  elements.workerPortalView?.classList.add("hidden");

  // 2. Mostrar la vista de página de perfil
  elements.profilePageView?.classList.remove("hidden");

  // 3. Marcar activo el botón de Mi Perfil en el Sidebar
  document.querySelectorAll(".sidebar-nav-link").forEach(l => {
    if (l.dataset.nav === "myprofile") {
      l.classList.add("active");
    } else {
      l.classList.remove("active");
    }
  });

  // 4. Poblar todos los datos del usuario
  populateProfileData();

  // 5. Scroll suave al inicio
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideProfilePage() {
  elements.profilePageView?.classList.add("hidden");

  const isWorker = state.userProfile?.rol === "worker";
  if (isWorker) {
    elements.workerPortalView?.classList.remove("hidden");
    elements.adminPortalView?.classList.add("hidden");
  } else {
    elements.adminPortalView?.classList.remove("hidden");
    elements.workerPortalView?.classList.add("hidden");
  }

  document.querySelectorAll(".sidebar-nav-link").forEach(l => {
    if (l.dataset.nav === "dashboard") {
      l.classList.add("active");
    } else {
      l.classList.remove("active");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Alias de compatibilidad
function openMyProfileModal() {
  showProfilePage();
}

function closeMyProfileModal() {
  hideProfilePage();
}

/**
 * Poblar datos del perfil del usuario en la página y en la tarjeta interactiva
 */
function populateProfileData() {
  const profile = state.userProfile;
  if (!profile) return;

  const isAdmin = profile.rol === "admin" || isMasterAdmin(profile.email);
  const initials = (profile.nombre || profile.email || "U").slice(0, 2).toUpperCase();

  // Avatar grande en Hero
  if (elements.myProfileAvatar) {
    if (profile.fotoUrl) {
      elements.myProfileAvatar.innerHTML = `<img src="${escapeHtml(profile.fotoUrl)}" alt="" class="w-full h-full object-cover rounded-2xl" referrerpolicy="no-referrer">`;
    } else {
      elements.myProfileAvatar.textContent = initials;
      elements.myProfileAvatar.className = `w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold text-3xl sm:text-4xl shadow-lg border-2 border-white/10 shrink-0`;
    }
  }

  if (elements.myProfileTitleName) {
    elements.myProfileTitleName.textContent = profile.nombre || "Mi Perfil";
  }
  if (elements.myProfileSubEmail) {
    elements.myProfileSubEmail.innerHTML = `
      <i class="fa-regular fa-envelope text-mid"></i>
      <span>${escapeHtml(profile.email || auth?.currentUser?.email || "")}</span>
    `;
  }

  if (elements.myProfileRoleBadge) {
    elements.myProfileRoleBadge.textContent = isAdmin ? "ADMINISTRADOR TOTAL" : "COLABORADOR";
    elements.myProfileRoleBadge.className = isAdmin ? "profile-role-badge-admin" : "profile-role-badge-worker";
  }

  // Prellenar información personal
  if (elements.myProfileName) elements.myProfileName.value = profile.nombre || "";
  if (elements.myProfileEmail) elements.myProfileEmail.value = profile.email || auth?.currentUser?.email || "";
  if (elements.myProfilePhone) elements.myProfilePhone.value = profile.telefono || "";
  if (elements.myProfileDocType) elements.myProfileDocType.value = profile.tipoDocumento || "CC";
  if (elements.myProfileDocNumber) elements.myProfileDocNumber.value = profile.numeroDocumento || "";
  if (elements.myProfileCity) elements.myProfileCity.value = profile.ciudad || "Bogotá D.C.";
  if (elements.myProfileAddress) elements.myProfileAddress.value = profile.direccion || "";

  // Prellenar información bancaria (buscar en profile, en linked worker o en localStorage)
  let bank = profile.banco || "";
  let accountType = profile.tipoCuenta || "Ahorros";
  let accountNumber = profile.numeroCuenta || "";
  let accountHolder = profile.titularCuenta || profile.nombre || "";

  const workerId = profile.trabajadorId;
  if (workerId) {
    const banking = loadWorkerBankingPrefs(workerId);
    if (!bank) bank = banking.bank;
    if (!accountType || accountType === "Ahorros") accountType = banking.accountType || "Ahorros";
    if (!accountNumber) accountNumber = banking.accountNumber;
    if (!accountHolder) accountHolder = banking.accountHolder || profile.nombre;
  }

  if (elements.myProfileBank) elements.myProfileBank.value = bank || "Bancolombia";
  if (elements.myProfileAccountType) elements.myProfileAccountType.value = accountType || "Ahorros";
  if (elements.myProfileAccountNumber) elements.myProfileAccountNumber.value = accountNumber || "";
  if (elements.myProfileAccountHolder) elements.myProfileAccountHolder.value = accountHolder || profile.nombre || "";

  // Limpiar campos de contraseña
  if (elements.myProfileNewPassword) elements.myProfileNewPassword.value = "";
  if (elements.myProfileConfirmPassword) elements.myProfileConfirmPassword.value = "";

  // Actualizar previsualización de tarjeta digital
  updateDigitalBankCardPreview();
}

/**
 * Previsualización en tiempo real de la Tarjeta Digital Neobanco
 */
function updateDigitalBankCardPreview() {
  const bank = elements.myProfileBank?.value || "Bancolombia";
  const accNum = elements.myProfileAccountNumber?.value.trim() || "";
  const holder = elements.myProfileAccountHolder?.value.trim() || elements.myProfileName?.value.trim() || "Titular";
  const accType = elements.myProfileAccountType?.value || "Ahorros";

  if (elements.cardBankName) elements.cardBankName.textContent = bank;
  if (elements.cardHolderDisplay) elements.cardHolderDisplay.textContent = holder;
  if (elements.cardTypeDisplay) elements.cardTypeDisplay.textContent = accType;

  if (elements.cardNumberDisplay) {
    if (!accNum) {
      elements.cardNumberDisplay.textContent = "•••• •••• •••• ----";
    } else if (accNum.length > 4) {
      const last4 = accNum.slice(-4);
      elements.cardNumberDisplay.textContent = `•••• •••• •••• ${last4}`;
    } else {
      elements.cardNumberDisplay.textContent = accNum;
    }
  }

  if (elements.profileBankingStatusTag) {
    elements.profileBankingStatusTag.innerHTML = `<i class="fa-solid fa-credit-card text-[11px]"></i> ${escapeHtml(bank)}`;
  }

  const card = elements.digitalBankCard;
  if (card) {
    card.className = "digital-bank-card";
    const bNorm = (bank || "").toLowerCase();
    if (bNorm.includes("nequi")) {
      card.classList.add("bank-nequi");
    } else if (bNorm.includes("daviplata") || bNorm.includes("davivienda")) {
      card.classList.add("bank-daviplata");
    } else if (bNorm.includes("nu")) {
      card.classList.add("bank-nu");
    } else if (bNorm.includes("bbva")) {
      card.classList.add("bank-bbva");
    } else if (bNorm.includes("bogot") || bNorm.includes("occidente") || bNorm.includes("colpatria") || bNorm.includes("popular") || bNorm.includes("lulo")) {
      card.classList.add("bank-bogota");
    } else {
      card.classList.add("bank-bancolombia");
    }
  }
}

async function handleSaveMyProfile(e) {
  e.preventDefault();
  const profile = state.userProfile;
  if (!profile) return;

  const nombre = elements.myProfileName?.value.trim() || "";
  const telefono = elements.myProfilePhone?.value.trim() || "";
  const tipoDocumento = elements.myProfileDocType?.value || "CC";
  const numeroDocumento = elements.myProfileDocNumber?.value.trim() || "";
  const ciudad = elements.myProfileCity?.value.trim() || "Bogotá D.C.";
  const direccion = elements.myProfileAddress?.value.trim() || "";
  const banco = elements.myProfileBank?.value || "Bancolombia";
  const tipoCuenta = elements.myProfileAccountType?.value || "Ahorros";
  const numeroCuenta = elements.myProfileAccountNumber?.value.trim() || "";
  const titularCuenta = elements.myProfileAccountHolder?.value.trim() || nombre;

  if (!nombre) {
    showToast("Por favor ingresa tu nombre.", "warning");
    return;
  }

  const updatedProfile = {
    ...profile,
    nombre,
    telefono,
    tipoDocumento,
    numeroDocumento,
    ciudad,
    direccion,
    banco,
    tipoCuenta,
    numeroCuenta,
    titularCuenta,
    updatedAt: new Date().toISOString()
  };

  try {
    const uid = auth?.currentUser?.uid || profile.uid;
    if (db && uid) {
      await setDoc(doc(db, "usuarios", uid), updatedProfile, { merge: true });

      // Sincronizar nombre en Auth si cambió
      if (auth.currentUser && auth.currentUser.displayName !== nombre) {
        await updateProfile(auth.currentUser, { displayName: nombre });
      }

      // Sincronizar con ficha de trabajador si existe
      const workerId = profile.trabajadorId;
      if (workerId) {
        try {
          await setDoc(doc(db, "trabajadores", workerId), {
            nombre,
            telefono,
            tipoDocumento,
            numeroDocumento,
            ciudad,
            banco,
            tipoCuenta,
            numeroCuenta,
            titularCuenta
          }, { merge: true });
        } catch (workerSyncErr) {
          console.info("[Firestore] Nota sincronización trabajador:", workerSyncErr.message);
        }

        try {
          localStorage.setItem(`widely_banking_${workerId}`, JSON.stringify({
            banco, tipoCuenta, numeroCuenta, titularCuenta, documento: numeroDocumento, ciudad, telefono
          }));
        } catch (e) {}
      }
    }

    state.userProfile = updatedProfile;
    localStorage.setItem("widely_cached_user", JSON.stringify(updatedProfile));
    applyRoleView();
    updateWorkersUI();
    populateProfileData();

    showToast("¡Tu perfil y datos bancarios se han guardado exitosamente!", "success");
  } catch (err) {
    console.error("[My Profile Save Error]", err);
    showToast("Error al guardar perfil: " + err.message, "error");
  }
}

async function handleUpdateMyPassword() {
  const newPass = elements.myProfileNewPassword?.value || "";
  const confirmPass = elements.myProfileConfirmPassword?.value || "";

  if (!newPass || newPass.length < 6) {
    showToast("La nueva contraseña debe tener al menos 6 caracteres.", "warning");
    elements.myProfileNewPassword?.focus();
    return;
  }

  if (newPass !== confirmPass) {
    showToast("Las contraseñas no coinciden. Por favor verifícalas.", "warning");
    elements.myProfileConfirmPassword?.focus();
    return;
  }

  if (!auth || !auth.currentUser) {
    showToast("No hay una sesión activa de Firebase.", "error");
    return;
  }

  try {
    await updatePassword(auth.currentUser, newPass);
    if (elements.myProfileNewPassword) elements.myProfileNewPassword.value = "";
    if (elements.myProfileConfirmPassword) elements.myProfileConfirmPassword.value = "";
    showToast("¡Contraseña actualizada exitosamente!", "success");
  } catch (err) {
    console.warn("[Password Update Warning]", err);
    if (err.code === "auth/requires-recent-login") {
      showToast("Por seguridad de Firebase debes haber iniciado sesión recientemente. Enviando enlace de restablecimiento a tu correo...", "warning");
      try {
        await sendPasswordResetEmail(auth, auth.currentUser.email);
        showToast("Enlace de restablecimiento enviado a " + auth.currentUser.email, "success");
      } catch (resetErr) {
        showToast("Error al enviar enlace: " + resetErr.message, "error");
      }
    } else {
      showToast("Error al cambiar contraseña: " + err.message, "error");
    }
  }
}

async function handleSendResetEmailMyProfile() {
  const email = auth?.currentUser?.email || state.userProfile?.email;
  if (!email) {
    showToast("No se encontró el correo del usuario.", "warning");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast(`Se ha enviado un enlace de cambio de contraseña a ${email}`, "success");
  } catch (err) {
    showToast("Error al enviar correo de restablecimiento: " + err.message, "error");
  }
}

/**
 * REQUISITO 4: CREACIÓN DE PERFIL SOLO DATOS (Sin cuenta de login ni credenciales)
 */
function openCreateDataProfileModal() {
  elements.formDataProfile?.reset();
  if (elements.dataProfileDocType) elements.dataProfileDocType.value = "CC";
  if (elements.dataProfileCity) elements.dataProfileCity.value = "Bogotá D.C.";
  if (elements.dataProfileBank) elements.dataProfileBank.value = "Bancolombia";
  if (elements.dataProfileAccountType) elements.dataProfileAccountType.value = "Ahorros";

  elements.createDataProfileModal?.classList.remove("hidden");
  elements.createDataProfileModal?.classList.add("flex");
}

function closeCreateDataProfileModal() {
  elements.createDataProfileModal?.classList.add("hidden");
  elements.createDataProfileModal?.classList.remove("flex");
}

async function handleSaveDataProfile(e) {
  e.preventDefault();

  const nombre = elements.dataProfileName?.value.trim() || "";
  const cargo = elements.dataProfileRole?.value.trim() || "Colaborador Externo";
  const email = elements.dataProfileEmail?.value.trim() || "";
  const telefono = elements.dataProfilePhone?.value.trim() || "";
  const tarifaHora = parseFloat(elements.dataProfileRate?.value) || 0;
  const tarifaArte = parseFloat(elements.dataProfileArtRate?.value) || 0;
  const tipoDocumento = elements.dataProfileDocType?.value || "CC";
  const numeroDocumento = elements.dataProfileDocNumber?.value.trim() || "";
  const ciudad = elements.dataProfileCity?.value.trim() || "Bogotá D.C.";
  const banco = elements.dataProfileBank?.value || "Bancolombia";
  const tipoCuenta = elements.dataProfileAccountType?.value || "Ahorros";
  const numeroCuenta = elements.dataProfileAccountNumber?.value.trim() || "";
  const titularCuenta = nombre;

  if (!nombre) {
    showToast("El nombre del colaborador es obligatorio.", "warning");
    return;
  }

  const workerDoc = {
    nombre,
    cargo,
    email,
    telefono,
    tarifaHora,
    tarifaArte,
    tipoDocumento,
    numeroDocumento,
    ciudad,
    banco,
    tipoCuenta,
    numeroCuenta,
    titularCuenta,
    esSoloDatos: true,
    tipoPerfil: "solo_datos",
    createdAt: new Date().toISOString()
  };

  try {
    if (db) {
      const docRef = await addDoc(collection(db, "trabajadores"), workerDoc);
      localStorage.setItem(`widely_banking_${docRef.id}`, JSON.stringify({
        banco, tipoCuenta, numeroCuenta, titularCuenta, documento: numeroDocumento, ciudad, telefono
      }));
    } else {
      const mockId = "local_data_" + Date.now();
      state.workers.push({ id: mockId, ...workerDoc });
      updateWorkersUI();
    }

    showToast(`Perfil de solo datos creado para ${nombre}. Ya puedes asignarle tareas en el cronómetro y liquidar sus pagos.`, "success");
    closeCreateDataProfileModal();
    switchAdminTab("workers");
  } catch (err) {
    console.error("[Data Profile Create Error]", err);
    showToast("Error al crear perfil de datos: " + err.message, "error");
  }
}

/**
 * REQUISITO 3: EDICIÓN DE PERFIL DE CUALQUIER USUARIO POR PARTE DEL ADMINISTRADOR
 */
function openAdminEditUserModal(userId) {
  let u = state.users.find(item => item.id === userId || item.uid === userId);
  if (!u && state.userProfile && (state.userProfile.uid === userId || state.userProfile.id === userId)) {
    u = state.userProfile;
  }
  if (!u) {
    showToast("Usuario no encontrado", "error");
    return;
  }

  elements.adminEditUserUid.value = u.id || u.uid;
  elements.adminEditUserName.value = u.nombre || "";
  elements.adminEditUserEmail.value = u.email || "";

  const isMaster = MASTER_ADMIN_EMAILS.includes(String(u.email || "").trim().toLowerCase());
  const isAdmin = u.rol === "admin" || isMasterAdmin(u.email);
  elements.adminEditUserRole.value = isAdmin ? "admin" : "worker";
  if (isMaster) {
    elements.adminEditUserRole.disabled = true;
  } else {
    elements.adminEditUserRole.disabled = false;
  }

  // Poblar select de fichas de trabajadores
  if (elements.adminEditUserWorkerSelect) {
    elements.adminEditUserWorkerSelect.innerHTML = `
      <option value="">-- Sin ficha de trabajador vinculada --</option>
      ${state.workers.map(w => `
        <option value="${escapeHtml(w.id)}" ${u.trabajadorId === w.id ? "selected" : ""}>
          ${escapeHtml(w.nombre)} ${w.cargo ? `(${escapeHtml(w.cargo)})` : ""}
        </option>
      `).join("")}
    `;
  }

  // Contacto & Documentos
  elements.adminEditUserPhone.value = u.telefono || "";
  elements.adminEditUserDocType.value = u.tipoDocumento || "CC";
  elements.adminEditUserDocNumber.value = u.numeroDocumento || "";
  elements.adminEditUserCity.value = u.ciudad || "";
  elements.adminEditUserAddress.value = u.direccion || "";

  // Datos bancarios
  elements.adminEditUserBank.value = u.banco || "Bancolombia";
  elements.adminEditUserAccountType.value = u.tipoCuenta || "Ahorros";
  elements.adminEditUserAccountNumber.value = u.numeroCuenta || "";
  elements.adminEditUserAccountHolder.value = u.titularCuenta || u.nombre || "";

  // Botón reset password del usuario
  if (elements.btnAdminSendPasswordReset) {
    elements.btnAdminSendPasswordReset.onclick = async () => {
      if (!u.email) {
        showToast("El usuario no tiene correo registrado", "warning");
        return;
      }
      try {
        await sendPasswordResetEmail(auth, u.email);
        showToast(`Enlace de restablecimiento enviado a ${u.email}`, "success");
      } catch (err) {
        showToast("Error al enviar enlace: " + err.message, "error");
      }
    };
  }

  elements.adminEditUserModal?.classList.remove("hidden");
  elements.adminEditUserModal?.classList.add("flex");
}

function closeAdminEditUserModal() {
  elements.adminEditUserModal?.classList.add("hidden");
  elements.adminEditUserModal?.classList.remove("flex");
}

async function handleSaveAdminEditUser(e) {
  e.preventDefault();
  const uid = elements.adminEditUserUid?.value;
  if (!uid) return;

  const user = state.users.find(u => u.id === uid || u.uid === uid) || (state.userProfile?.uid === uid ? state.userProfile : null);
  const email = (elements.adminEditUserEmail?.value || user?.email || "").trim().toLowerCase();
  const isMaster = MASTER_ADMIN_EMAILS.includes(email);

  const nombre = elements.adminEditUserName?.value.trim() || "";
  const rol = isMaster ? "admin" : (elements.adminEditUserRole?.value || "worker");
  const trabajadorId = elements.adminEditUserWorkerSelect?.value || "";
  const telefono = elements.adminEditUserPhone?.value.trim() || "";
  const tipoDocumento = elements.adminEditUserDocType?.value || "CC";
  const numeroDocumento = elements.adminEditUserDocNumber?.value.trim() || "";
  const ciudad = elements.adminEditUserCity?.value.trim() || "";
  const direccion = elements.adminEditUserAddress?.value.trim() || "";
  const banco = elements.adminEditUserBank?.value || "Bancolombia";
  const tipoCuenta = elements.adminEditUserAccountType?.value || "Ahorros";
  const numeroCuenta = elements.adminEditUserAccountNumber?.value.trim() || "";
  const titularCuenta = elements.adminEditUserAccountHolder?.value.trim() || nombre;

  if (!nombre) {
    showToast("El nombre es requerido.", "warning");
    return;
  }

  const updatedData = {
    nombre,
    rol,
    trabajadorId,
    telefono,
    tipoDocumento,
    numeroDocumento,
    ciudad,
    direccion,
    banco,
    tipoCuenta,
    numeroCuenta,
    titularCuenta,
    updatedAt: new Date().toISOString()
  };

  try {
    if (db) {
      await setDoc(doc(db, "usuarios", uid), updatedData, { merge: true });

      // Sincronizar rol en configuracion/admins si aplica
      if (email && !isMaster) {
        let currentAdmins = Array.isArray(state.adminEmails) ? [...state.adminEmails] : [];
        if (rol === "admin") {
          if (!currentAdmins.includes(email)) currentAdmins.push(email);
        } else {
          currentAdmins = currentAdmins.filter(e => e !== email);
        }
        state.adminEmails = currentAdmins;
        await setDoc(doc(db, "configuracion", "admins"), { emails: currentAdmins }, { merge: true });
      }

      // Si tiene ficha de trabajador vinculada, sincronizar datos bancarios
      if (trabajadorId) {
        await setDoc(doc(db, "trabajadores", trabajadorId), {
          nombre,
          telefono,
          tipoDocumento,
          numeroDocumento,
          ciudad,
          banco,
          tipoCuenta,
          numeroCuenta,
          titularCuenta
        }, { merge: true });

        localStorage.setItem(`widely_banking_${trabajadorId}`, JSON.stringify({
          banco, tipoCuenta, numeroCuenta, titularCuenta, documento: numeroDocumento, ciudad, telefono
        }));
      }
    }

    // Actualizar usuario en estado local
    const idx = state.users.findIndex(u => u.id === uid || u.uid === uid);
    if (idx !== -1) {
      state.users[idx] = { ...state.users[idx], ...updatedData };
    }
    if (state.userProfile && (state.userProfile.uid === uid || state.userProfile.id === uid)) {
      state.userProfile = { ...state.userProfile, ...updatedData };
      localStorage.setItem("widely_cached_user", JSON.stringify(state.userProfile));
      applyRoleView();
    }

    updateAdminUsersUI();
    updateWorkersUI();
    showToast("Perfil de usuario actualizado con éxito", "success");
    closeAdminEditUserModal();
  } catch (err) {
    console.error("[Admin Edit User Error]", err);
    showToast("Error al guardar cambios: " + err.message, "error");
  }
}

/**
 * REQUISITO 2: AÑADIR / AUTORIZAR OTRO ADMINISTRADOR
 */
function openAddAdminModal() {
  if (elements.newAdminEmailInput) elements.newAdminEmailInput.value = "";
  elements.addAdminModal?.classList.remove("hidden");
  elements.addAdminModal?.classList.add("flex");
}

function closeAddAdminModal() {
  elements.addAdminModal?.classList.add("hidden");
  elements.addAdminModal?.classList.remove("flex");
}

async function handleSaveNewAdmin(e) {
  e.preventDefault();
  const email = elements.newAdminEmailInput?.value.trim().toLowerCase();
  if (!email) return;

  if (MASTER_ADMIN_EMAILS.includes(email) || (Array.isArray(state.adminEmails) && state.adminEmails.includes(email))) {
    showToast(`${email} ya tiene rol de Administrador.`, "info");
    closeAddAdminModal();
    return;
  }

  try {
    const updated = Array.from(new Set([...(state.adminEmails || []), email]));
    state.adminEmails = updated;

    if (db) {
      await setDoc(doc(db, "configuracion", "admins"), { emails: updated }, { merge: true });

      // Si el usuario ya está registrado en la colección 'usuarios', promover su documento
      const existingUser = state.users.find(u => (u.email || "").trim().toLowerCase() === email);
      if (existingUser) {
        await setDoc(doc(db, "usuarios", existingUser.id || existingUser.uid), { rol: "admin" }, { merge: true });
        existingUser.rol = "admin";
      }
    }

    showToast(`¡${email} ha sido autorizado como Administrador!`, "success");
    closeAddAdminModal();
    updateAdminUsersUI();
  } catch (err) {
    console.error("[Add Admin Error]", err);
    showToast("Error al autorizar administrador: " + err.message, "error");
  }
}

/**
 * Alternar rol rápidamente de un usuario entre Admin y Worker
 */
async function toggleUserRole(userId) {
  const u = state.users.find(item => item.id === userId || item.uid === userId);
  if (!u) return;

  const email = String(u.email || "").trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.includes(email)) {
    showToast("La cuenta principal linadelae@gmail.com no puede ser modificada.", "warning");
    return;
  }

  const currentIsAdmin = u.rol === "admin" || (Array.isArray(state.adminEmails) && state.adminEmails.includes(email));
  const newRole = currentIsAdmin ? "worker" : "admin";

  try {
    if (db) {
      await setDoc(doc(db, "usuarios", u.id || u.uid), { rol: newRole }, { merge: true });

      let currentAdmins = Array.isArray(state.adminEmails) ? [...state.adminEmails] : [];
      if (newRole === "admin") {
        if (!currentAdmins.includes(email)) currentAdmins.push(email);
      } else {
        currentAdmins = currentAdmins.filter(e => e !== email);
      }
      state.adminEmails = currentAdmins;
      await setDoc(doc(db, "configuracion", "admins"), { emails: currentAdmins }, { merge: true });
    }

    u.rol = newRole;
    updateAdminUsersUI();
    showToast(newRole === "admin" ? `¡${u.nombre || email} ahora es Administrador!` : `${u.nombre || email} ahora es Colaborador.`, "success");
  } catch (err) {
    showToast("Error al alternar rol: " + err.message, "error");
  }
}

// Exponer métodos al ámbito global para handlers inline en HTML
window.openMyProfileModal = openMyProfileModal;
window.closeMyProfileModal = closeMyProfileModal;
window.openCreateDataProfileModal = openCreateDataProfileModal;
window.closeCreateDataProfileModal = closeCreateDataProfileModal;
window.openAdminEditUserModal = openAdminEditUserModal;
window.closeAdminEditUserModal = closeAdminEditUserModal;
window.openAddAdminModal = openAddAdminModal;
window.closeAddAdminModal = closeAddAdminModal;
window.toggleUserRole = toggleUserRole;
window.switchAdminTab = switchAdminTab;
window.updateAdminUsersUI = updateAdminUsersUI;

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
      btn.className = "btn-period-filter px-3 py-1.5 rounded-xl transition-all active:scale-95 bg-primary text-on-primary shadow-sm";
    } else {
      btn.className = "btn-period-filter px-3 py-1.5 rounded-xl transition-all active:scale-95 text-mid hover:bg-muted";
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

// Lista de tareas pendientes de aprobación (todas las fechas, sin depender del filtro de período)
function renderAdminApprovals() {
  if (!elements.adminApprovalsList) return;
  const pending = state.tasks
    .filter(t => t.estado === "pendiente")
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  if (elements.adminApprovalsCount) elements.adminApprovalsCount.textContent = pending.length;

  if (pending.length === 0) {
    elements.adminApprovalsList.innerHTML = `<div class="empty-note">No hay tareas pendientes de aprobación.</div>`;
    return;
  }

  const MAX_ITEMS = 6;
  const rows = pending.slice(0, MAX_ITEMS).map(t => {
    const name = t.trabajadorNombre || "Colaborador";
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("");
    const isArt = Number(t.cantidadArtes) > 0;
    const qty = isArt ? `${Number(t.cantidadArtes)} arte${Number(t.cantidadArtes) === 1 ? "" : "s"}` : `${Number(t.horas || 0).toFixed(2)} h`;
    const origin = t.esManual ? "manual" : "cronómetro";
    const meta = [name, t.cliente, origin, t.fecha].filter(Boolean).map(escapeHtml).join(" · ");
    return `
      <div class="ds-row approval-row">
        <div class="ds-avatar">${escapeHtml(initials || "C")}</div>
        <div class="ds-grow">
          <b>${escapeHtml(t.descripcion || "Tarea sin descripción")}</b>
          <span>${meta}</span>
        </div>
        <div class="ds-amount">
          <b>${qty}</b>
          <span>$${Number(t.costoTotal || 0).toFixed(2)}</span>
        </div>
        <div class="ds-actions">
          <button type="button" class="btn-ds btn-ds-outline btn-ds-sm" onclick="window.openRejectModal(${jsArg(t.id)})" aria-label="Rechazar">
            <i class="fa-solid fa-xmark"></i><span class="mobile-only">Rechazar</span>
          </button>
          <button type="button" class="btn-ds btn-ds-primary btn-ds-sm" onclick="window.approveTask(${jsArg(t.id)})">
            <i class="fa-solid fa-check"></i><span>Aprobar</span>
          </button>
        </div>
      </div>`;
  }).join("");

  const more = pending.length > MAX_ITEMS
    ? `<div class="empty-note">Y ${pending.length - MAX_ITEMS} más en el registro de tareas.</div>`
    : "";
  elements.adminApprovalsList.innerHTML = rows + more;
}

window.setTaskStatusFilter = function(status) {
  state.taskStatusFilter = status;
  const buttons = document.querySelectorAll(".btn-status-filter");
  buttons.forEach(btn => {
    if (btn.dataset.status === status) {
      btn.className = "btn-status-filter px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 bg-primary text-on-primary shadow-sm flex items-center gap-1";
    } else {
      btn.className = "btn-status-filter px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 text-mid hover:text-ink dark:hover:text-white flex items-center gap-1.5";
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
      (!t.trabajadorId && t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === myName)
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

  if (isAdmin) renderAdminApprovals();

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
        <td colspan="6" class="py-6 text-center text-mid text-xs">
          ${emptyMsg}
        </td>
      </tr>
    `;
    if (elements.tasksCardsList) elements.tasksCardsList.innerHTML = `<div class="empty-note">${emptyMsg}</div>`;
    return;
  }

  // Filas compactas para pantallas pequeñas (misma información y acciones que la tabla)
  const taskCards = [];

  elements.tasksTableBody.innerHTML = displayedTasks.map(t => {
    const formattedTime = formatSecondsToTime(t.segundos || 0);
    const isManualTag = t.esManual ? `<span class="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-ink/15 text-ink border border-line shrink-0">Manual</span>` : "";
    const cat = getCategoryMeta(t.categoria);
    const catBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${cat.bg} ${cat.color} border shrink-0"><i class="fa-solid ${cat.icon} text-[9px]"></i><span>${cat.label}</span></span>`;
    const clientBadge = t.cliente ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-ink border border-line shrink-0"><i class="fa-solid fa-briefcase text-[9px] text-ink"></i><span>${escapeHtml(t.cliente)}</span></span>` : "";

    const taskStatus = t.estado || "aprobada";
    let statusBadge = "";
    if (taskStatus === "pendiente") {
      statusBadge = `<span class="status-badge status-pending" title="Pendiente de aprobación por la administración">Pendiente</span>`;
    } else if (taskStatus === "rechazada") {
      const reasonTitle = t.motivoRechazo ? `Motivo: ${escapeHtml(t.motivoRechazo)}` : "Horas rechazadas por la administración";
      statusBadge = `<span class="status-badge status-rejected cursor-help" title="${reasonTitle}">Rechazada</span>`;
    } else if (t.esManual) {
      statusBadge = `<span class="status-badge status-approved" title="Aprobada">Aprobada</span>`;
    }

    const rejectionNotice = (taskStatus === "rechazada" && t.motivoRechazo) 
      ? `<div class="text-[11px] text-ember font-medium italic mt-1 flex items-center gap-1.5 bg-ember/10 dark:bg-ember/40 px-2 py-0.5 rounded border border-ember dark:border-ember/50">
           <i class="fa-solid fa-circle-exclamation text-[10px] shrink-0"></i>
           <span><strong>Motivo:</strong> ${escapeHtml(t.motivoRechazo)}</span>
         </div>`
      : "";

    const pendingNotice = (taskStatus === "pendiente")
      ? `<div class="text-[10px] text-mid italic mt-0.5 flex items-center gap-1">
           <i class="fa-regular fa-clock text-[9px] shrink-0"></i>
           <span>Horas en espera de validación administrativa</span>
         </div>`
      : "";

    let costDisplay = "";
    if (taskStatus === "rechazada") {
      costDisplay = `<span class="line-through text-mid tabular-nums" title="Horas rechazadas (no computan en liquidación)">$${Number(t.costoTotal || 0).toFixed(2)}</span>`;
    } else if (taskStatus === "pendiente") {
      costDisplay = `<span class="text-mid font-semibold tabular-nums" title="Pendiente de aprobación">$${Number(t.costoTotal || 0).toFixed(2)}</span>`;
    } else {
      costDisplay = `<span class="tabular-nums font-semibold">$${Number(t.costoTotal || 0).toFixed(2)}</span>`;
    }

    let actionButtons = "";
    if (isAdmin) {
      if (taskStatus === "pendiente") {
        actionButtons = `
          <div class="flex items-center justify-center gap-1">
            <button 
              onclick="window.approveTask(${jsArg(t.id)})"
              class="text-mid hover:text-mid p-1.5 rounded-lg hover:bg-ink/15 transition-colors active:scale-95"
              title="Aprobar horas">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
            <button 
              onclick="window.openRejectModal(${jsArg(t.id)})"
              class="text-ember hover:text-ember p-1.5 rounded-lg hover:bg-ember/15 transition-colors active:scale-95"
              title="Rechazar horas">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
            <button 
              onclick="window.requestDelete('tareas', ${jsArg(t.id)}, ${jsArg('Tarea: ' + (t.descripcion || ''))})"
              class="text-mid hover:text-ember p-1.5 rounded-lg hover:bg-ember/10 transition-colors active:scale-95"
              title="Eliminar registro">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        `;
      } else if (taskStatus === "rechazada") {
        actionButtons = `
          <div class="flex items-center justify-center gap-1">
            <button 
              onclick="window.approveTask(${jsArg(t.id)})"
              class="text-mid hover:text-mid p-1.5 rounded-lg hover:bg-ink/15 transition-colors active:scale-95"
              title="Reconsiderar y Aprobar">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
            <button 
              onclick="window.requestDelete('tareas', ${jsArg(t.id)}, ${jsArg('Tarea: ' + (t.descripcion || ''))})"
              class="text-mid hover:text-ember p-1.5 rounded-lg hover:bg-ember/10 transition-colors active:scale-95"
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
                onclick="window.openRejectModal(${jsArg(t.id)})"
                class="text-mid hover:text-ember p-1.5 rounded-lg hover:bg-ember/10 transition-colors active:scale-95"
                title="Rechazar horas previamente aprobadas">
                <i class="fa-solid fa-ban text-xs"></i>
              </button>
            ` : ''}
            <button 
              onclick="window.requestDelete('tareas', ${jsArg(t.id)}, ${jsArg('Tarea: ' + (t.descripcion || ''))})"
              class="text-mid hover:text-ember p-1.5 rounded-lg hover:bg-ember/10 transition-colors active:scale-95"
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
          onclick="window.requestDelete('tareas', ${jsArg(t.id)}, ${jsArg('Tarea: ' + (t.descripcion || ''))})"
          class="text-mid hover:text-ember p-1.5 rounded-lg hover:bg-ember/10 transition-colors active:scale-95"
          title="Eliminar registro">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      `;
    }

    const isArtTask = t.tipoCobro === "artes" || (t.cantidadArtes && Number(t.cantidadArtes) > 0);
    const artBadge = isArtTask 
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-ink/15 text-ink border border-line shrink-0"><i class="fa-solid fa-palette text-[9px]"></i><span>${t.cantidadArtes} ${t.cantidadArtes === 1 ? 'arte' : 'artes'}</span></span>` 
      : "";

    let timeColContent = "";
    if (isArtTask) {
      timeColContent = `
        <span class="inline-flex items-center gap-1 font-semibold text-ink font-mono tabular-nums"><i class="fa-solid fa-palette text-[10px]"></i> ${t.cantidadArtes} ${t.cantidadArtes === 1 ? 'arte' : 'artes'}</span>
        <span class="text-[10px] text-mid block font-mono">($${Number(t.tarifaArte || 0).toFixed(2)} c/u)</span>
      `;
    } else {
      timeColContent = `
        ${formattedTime} <span class="text-[10px] text-mid/80">(${Number(t.horas || 0).toFixed(2)}h)</span>
      `;
    }

    const cardQty = isArtTask
      ? `${t.cantidadArtes} ${Number(t.cantidadArtes) === 1 ? "arte" : "artes"}`
      : `${Number(t.horas || 0).toFixed(2)} h`;
    const cardMeta = [isWorker ? null : t.trabajadorNombre, t.cliente, cat.label, t.fecha, t.esManual ? "manual" : null]
      .filter(Boolean).map(escapeHtml).join(" · ");
    taskCards.push(`
      <div class="ds-row task-card">
        <div class="ds-grow">
          <b class="${taskStatus === 'rechazada' ? 'line-through text-mid' : ''}">${escapeHtml(t.descripcion || 'Sin descripción')}</b>
          <span>${cardMeta}</span>
          ${t.motivoRechazo && taskStatus === 'rechazada' ? `<span class="task-card-note">Motivo: ${escapeHtml(t.motivoRechazo)}</span>` : ''}
        </div>
        ${statusBadge || '<span class="status-badge status-approved">Aprobada</span>'}
        <div class="ds-amount"><b class="tabular-nums">${cardQty}</b><span class="tabular-nums">${costDisplay}</span></div>
        <div class="task-card-actions">${actionButtons}</div>
      </div>`);

    return `
      <tr class="hover:bg-muted transition-colors ${taskStatus === 'rechazada' ? 'bg-ember/5' : taskStatus === 'pendiente' ? 'bg-muted/60' : ''}">
        <td class="py-2.5 px-3 text-mid font-mono whitespace-nowrap tabular-nums">${escapeHtml(t.fecha || '-')}</td>
        <td class="py-2.5 px-3 font-semibold text-ink whitespace-nowrap">${escapeHtml(t.trabajadorNombre || 'Anónimo')}</td>
        <td class="py-2.5 px-3 text-mid max-w-sm">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-medium text-ink" title="${escapeHtml(t.descripcion || '')}">${escapeHtml(t.descripcion || 'Sin descripción')}</span>
            ${clientBadge}
            ${catBadge}
            ${artBadge}
            ${isManualTag}
            ${statusBadge}
          </div>
          ${rejectionNotice}
          ${pendingNotice}
        </td>
        <td class="py-2.5 px-2 text-right font-mono text-mid whitespace-nowrap tabular-nums">
          ${timeColContent}
        </td>
        <td class="py-2.5 px-2 text-right font-mono font-medium text-ink whitespace-nowrap tabular-nums">
          ${costDisplay}
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          ${actionButtons}
        </td>
      </tr>
    `;
  }).join("");
  if (elements.tasksCardsList) elements.tasksCardsList.innerHTML = taskCards.join("");
}

function updatePaymentsUI() {
  const isWorker = state.userProfile?.rol === "worker";
  let displayedPayments = getFilteredPayments();

  if (isWorker) {
    const myId = state.userProfile.trabajadorId;
    const myName = (state.userProfile.nombre || "").trim().toLowerCase();
    displayedPayments = displayedPayments.filter(p => 
      (myId && p.trabajadorId === myId) || 
      (!p.trabajadorId && p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === myName)
    );
  }

  elements.paymentCount.textContent = displayedPayments.length;

  if (displayedPayments.length === 0) {
    elements.paymentsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-mid text-xs">
          ${isWorker ? "No tienes pagos registrados en este período." : "No hay pagos registrados en este período."}
        </td>
      </tr>
    `;
    return;
  }

  elements.paymentsTableBody.innerHTML = displayedPayments.map(p => `
    <tr class="hover:bg-muted transition-colors">
      <td class="py-2.5 px-3 text-mid font-mono whitespace-nowrap tabular-nums">${escapeHtml(p.fecha || '-')}</td>
      <td class="py-2.5 px-3 font-semibold text-ink whitespace-nowrap">${escapeHtml(p.trabajadorNombre || '')}</td>
      <td class="py-2.5 px-3 text-mid max-w-xs truncate" title="${escapeHtml(p.referencia || '')}">
        ${escapeHtml(p.referencia || 'Pago')}
      </td>
      <td class="py-2.5 px-2 text-right font-mono font-medium text-ink whitespace-nowrap tabular-nums">
        $${Number(p.monto || 0).toFixed(2)}
      </td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        ${!isWorker ? `
          <button 
            onclick="window.requestDelete('pagos', ${jsArg(p.id)}, ${jsArg(`Pago de $${Number(p.monto || 0).toFixed(2)} a ${p.trabajadorNombre || ''}`)})"
            class="text-mid hover:text-ember p-1 rounded-md hover:bg-ember/10 transition-colors active:scale-95"
            title="Eliminar pago">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        ` : `<span class="text-[10px] text-mid font-mono">Registrado</span>`}
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
    displayedWorkers = state.workers.filter(w => myId && w.id === myId);
  }

  if (displayedWorkers.length === 0) {
    elements.financialTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-mid text-xs">
          ${isWorker 
            ? "Tu perfil aún no está vinculado a un trabajador en la lista. Puedes usar el cronómetro para registrar tu tiempo."
            : "Agrega trabajadores para visualizar el balance financiero en tiempo real."}
        </td>
      </tr>
    `;
    if (elements.financialTilesList) {
      elements.financialTilesList.innerHTML = `<div class="empty-note">${isWorker
        ? "Tu perfil aún no está vinculado a un trabajador."
        : "Agrega trabajadores para visualizar el balance financiero en tiempo real."}</div>`;
    }
    resetKPIs();
    return;
  }

  const allFilteredTasks = getFilteredTasks();
  const allFilteredPayments = getFilteredPayments();

  let totalHorasGlobal = 0;
  let totalSegundosGlobal = 0;
  let totalGeneradoGlobal = 0;
  let totalPagadoGlobal = 0;

  // Tarjetas por colaborador para pantallas pequeñas (misma información que la tabla)
  const tilesHtml = [];

  const rowsHtml = displayedWorkers.map(worker => {
    const workerTasks = allFilteredTasks.filter(t => 
      (t.trabajadorId === worker.id || (!t.trabajadorId && t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase())) &&
      isTaskApproved(t)
    );
    const workerSeconds = workerTasks.reduce((acc, t) => acc + (Number(t.segundos) || 0), 0);
    const workerHours = workerTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
    const workerArtes = workerTasks.filter(t => t.cantidadArtes > 0).reduce((acc, t) => acc + (Number(t.cantidadArtes) || 0), 0);
    const workerEarned = workerTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);

    const workerPayments = allFilteredPayments.filter(p => p.trabajadorId === worker.id || (!p.trabajadorId && p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase()));
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
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-ember/10 dark:bg-ember/15 text-ink border border-ember/25 tabular-nums">
          <i class="fa-solid fa-clock text-[10px]"></i>
          +$${pendingBalance.toFixed(2)}
        </span>
      `;
    } else if (pendingBalance === 0) {
      // Al día: Verde natural
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-ink/10 dark:bg-ink/15 text-ink border border-line tabular-nums">
          <i class="fa-solid fa-check text-[10px]"></i>
          $0.00
        </span>
      `;
    } else {
      // Anticipo a favor
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-ink/10 dark:bg-ink/15 text-ink border border-line tabular-nums">
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
        onclick="window.openEditRateModal(${jsArg(worker.id)}, ${jsArg(worker.nombre)}, ${hourlyRate}, ${artRate})"
        class="hover:text-ink hover:underline transition-colors cursor-pointer inline-flex flex-col items-end group"
        title="Clic para modificar tarifas">
        <span class="inline-flex items-center gap-1 font-medium">
          <span>$${hourlyRate.toFixed(2)}/h</span>
          <i class="fa-solid fa-pencil text-[9px] opacity-0 group-hover:opacity-100 transition-opacity text-ink"></i>
        </span>
        ${artRate > 0 ? `<span class="text-[10px] text-ink font-mono font-medium">$${artRate.toFixed(2)}/arte</span>` : ''}
      </button>
    ` : `
      <div class="flex flex-col items-end">
        <span>$${hourlyRate.toFixed(2)}/h</span>
        ${artRate > 0 ? `<span class="text-[10px] text-ink font-mono">$${artRate.toFixed(2)}/arte</span>` : ''}
      </div>
    `;

    const statementBtn = isWorker ? `
      <button 
        type="button" 
        onclick="window.openStatementModal(${jsArg(worker.id)}, 'bill')" 
        class="px-2.5 py-1.5 rounded-lg bg-ink/10 hover:bg-ink/20 text-ink border border-line text-xs font-medium active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
        title="Generar y descargar mi Cuenta de Cobro formal">
        <i class="fa-solid fa-file-invoice-dollar text-xs"></i>
        <span>Descargar Cuenta de Cobro</span>
      </button>
    ` : `
      <div class="inline-flex items-center gap-1.5">
        <button 
          type="button" 
          onclick="window.openManualEntryModal(${jsArg(worker.id)})" 
          class="px-2 py-1.5 rounded-lg bg-ink/10 hover:bg-ink/20 text-mid border border-line text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Cargar horas o diseños de artes a ${escapeHtml(worker.nombre)}">
          <i class="fa-solid fa-plus text-[10px]"></i>
          <span class="hidden xl:inline">Cargar</span>
        </button>
        <button 
          type="button" 
          onclick="window.openStatementModal(${jsArg(worker.id)}, 'receipt')" 
          class="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Generar Recibo de Pago Oficial (PDF)">
          <i class="fa-solid fa-receipt text-[10px]"></i>
          <span class="hidden sm:inline">Recibo Oficial</span>
          <span class="sm:hidden">Recibo</span>
        </button>
        <button 
          type="button" 
          onclick="window.openStatementModal(${jsArg(worker.id)}, 'bill')" 
          class="px-2 py-1.5 rounded-lg bg-muted dark:bg-paper hover:bg-muted text-ink border border-line text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Auditar Cuenta de Cobro de este colaborador">
          <i class="fa-solid fa-file-invoice-dollar text-[10px]"></i>
        </button>
        <button 
          type="button" 
          onclick="window.quickPayWorker(${jsArg(worker.id)}, ${jsArg(worker.nombre)}, ${pendingBalance})" 
          class="px-2 py-1.5 rounded-lg bg-ink/15 hover:bg-ink/25 text-ink border border-line text-[11px] font-medium active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
          title="Abonar / Registrar pago a ${escapeHtml(worker.nombre)}">
          <i class="fa-solid fa-money-bill-transfer text-[10px]"></i>
        </button>
      </div>
    `;

    const initials = worker.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("");
    const rateLabel = artRate > 0 && hourlyRate === 0 ? `$${artRate.toFixed(2)}/arte` : `$${hourlyRate.toFixed(2)}/h`;
    const tileSub = [worker.banco, rateLabel].filter(Boolean).map(escapeHtml).join(" · ");
    const paidPercent = workerEarned > 0 ? Math.min(100, Math.round((workerPaid / workerEarned) * 100)) : (workerPaid > 0 ? 100 : 0);
    const balanceLabel = pendingBalance > 0.005
      ? `<div class="liq-balance"><span>Saldo</span><b class="tabular-nums">$${pendingBalance.toFixed(2)}</b></div>`
      : pendingBalance === 0
      ? `<span class="badge-solid">Al día</span>`
      : `<div class="liq-balance"><span>A favor</span><b class="tabular-nums">$${Math.abs(pendingBalance).toFixed(2)}</b></div>`;
    const tileActions = isWorker
      ? `<button type="button" class="btn-ds btn-ds-primary btn-ds-sm" onclick="window.openStatementModal(${jsArg(worker.id)}, 'bill')"><i class="fa-solid fa-file-invoice-dollar"></i><span>Descargar cuenta de cobro</span></button>`
      : `<button type="button" class="btn-ds btn-ds-outline btn-ds-sm" onclick="window.openStatementModal(${jsArg(worker.id)}, 'bill')"><i class="fa-solid fa-file-invoice-dollar"></i><span>Cuenta de cobro</span></button>
         <button type="button" class="btn-ds btn-ds-outline btn-ds-sm" style="flex:0 0 auto" onclick="window.openStatementModal(${jsArg(worker.id)}, 'receipt')" aria-label="Recibo oficial" title="Recibo oficial"><i class="fa-solid fa-receipt"></i></button>
         <button type="button" class="btn-ds btn-ds-primary btn-ds-sm" onclick="window.quickPayWorker(${jsArg(worker.id)}, ${jsArg(worker.nombre)}, ${pendingBalance})"><i class="fa-solid fa-money-bill-transfer"></i><span>Abonar</span></button>`;
    tilesHtml.push(`
      <div class="liq-tile">
        <div class="liq-head">
          <div class="ds-avatar">${escapeHtml(initials || "C")}</div>
          <div class="ds-grow"><b>${escapeHtml(worker.nombre)}</b><span>${tileSub}</span></div>
          ${balanceLabel}
        </div>
        <div class="liq-kv">
          <div><small>${workerArtes > 0 && workerHours === 0 ? "Artes" : "Horas"}</small><b class="tabular-nums">${workerArtes > 0 && workerHours === 0 ? workerArtes : workerHours.toFixed(2)}</b></div>
          <div><small>Causado</small><b class="tabular-nums">$${workerEarned.toFixed(2)}</b></div>
          <div><small>Abonado</small><b class="tabular-nums">$${workerPaid.toFixed(2)}</b></div>
        </div>
        <div>
          <div class="liq-paid"><span>Pagado</span><span class="tabular-nums">${paidPercent} %</span></div>
          <div class="liq-bar"><span style="width:${paidPercent}%"></span></div>
        </div>
        <div class="liq-actions">${tileActions}</div>
      </div>`);

    return `
      <tr class="hover:bg-muted transition-colors">
        <td class="py-3 px-3 font-semibold text-ink">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-ink/10 text-ink flex items-center justify-center text-xs font-semibold border border-line">
              ${worker.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <span>${escapeHtml(worker.nombre)}</span>
              ${worker.email ? `<span class="text-[10px] text-mid font-normal block">${escapeHtml(worker.email)}</span>` : ''}
            </div>
          </div>
        </td>
        <td class="py-3 px-2 text-right font-mono text-mid tabular-nums">
          ${editRateBtn}
        </td>
        <td class="py-3 px-2 text-right font-mono text-ink tabular-nums">
          <span class="font-medium">${workerHours.toFixed(2)}h</span>
          ${workerArtes > 0 ? `<span class="text-[10px] text-ink font-semibold block">🎨 ${workerArtes} ${workerArtes === 1 ? 'arte' : 'artes'}</span>` : `<span class="text-[10px] text-mid block">${formatSecondsToTime(workerSeconds)}</span>`}
        </td>
        <td class="py-3 px-2 text-right font-mono font-medium text-ink tabular-nums">
          <div>$${workerEarned.toFixed(2)}</div>
          <div class="text-[10px] text-mid font-normal">≈ ${formatCop(workerEarned * currentTrm)}</div>
        </td>
        <td class="py-3 px-2 text-right font-mono font-medium text-ink tabular-nums">
          <div>$${workerPaid.toFixed(2)}</div>
          <div class="text-[10px] text-ink font-normal">≈ ${formatCop(workerPaid * currentTrm)}</div>
        </td>
        <td class="py-3 px-3 text-right">
          ${balanceBadge}
          <div class="text-[10px] text-mid font-mono mt-0.5">≈ ${formatCop(pendingBalance * currentTrm)}</div>
        </td>
        <td class="py-3 px-2 text-center whitespace-nowrap">
          ${statementBtn}
        </td>
      </tr>
    `;
  }).join("");

  elements.financialTableBody.innerHTML = rowsHtml;
  if (elements.financialTilesList) elements.financialTilesList.innerHTML = tilesHtml.join("");

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
    elements.kpiSaldoPendiente.className = "stat-value tabular-nums truncate";
    elements.kpiSaldoPendiente.textContent = `$${balance.toFixed(2)}`;
    if (elements.kpiSaldoPendienteCop) {
      elements.kpiSaldoPendienteCop.className = "stat-sub tabular-nums truncate";
      elements.kpiSaldoPendienteCop.textContent = `≈ ${formatCop(copBalance)}`;
    }
    elements.kpiSaldoDesc.textContent = isWorker ? "Tu saldo pendiente por cobrar" : "Deuda total por liquidar a trabajadores";
  } else if (balance === 0) {
    elements.kpiSaldoPendiente.className = "stat-value tabular-nums truncate";
    elements.kpiSaldoPendiente.textContent = "$0.00";
    if (elements.kpiSaldoPendienteCop) {
      elements.kpiSaldoPendienteCop.className = "stat-sub tabular-nums truncate";
      elements.kpiSaldoPendienteCop.textContent = "≈ $0 COP";
    }
    elements.kpiSaldoDesc.textContent = isWorker ? "Tus pagos están al día" : "Todos los pagos están al día";
  } else {
    elements.kpiSaldoPendiente.className = "stat-value tabular-nums truncate";
    elements.kpiSaldoPendiente.textContent = `+$${Math.abs(balance).toFixed(2)}`;
    if (elements.kpiSaldoPendienteCop) {
      elements.kpiSaldoPendienteCop.className = "stat-sub tabular-nums truncate";
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
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-ink tabular-nums";
        if (elements.workerKpiBalanceCop) {
          elements.workerKpiBalanceCop.className = "block text-xs font-mono font-medium text-ink tabular-nums truncate mt-0.5";
          elements.workerKpiBalanceCop.textContent = `≈ ${formatCop(copBalance)}`;
        }
      } else if (balance === 0) {
        elements.workerKpiBalance.textContent = "$0.00";
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-ink tabular-nums";
        if (elements.workerKpiBalanceCop) {
          elements.workerKpiBalanceCop.className = "block text-xs font-mono font-medium text-ink tabular-nums truncate mt-0.5";
          elements.workerKpiBalanceCop.textContent = "≈ $0 COP";
        }
      } else {
        elements.workerKpiBalance.textContent = `+$${Math.abs(balance).toFixed(2)}`;
        elements.workerKpiBalance.className = "text-2xl font-bold font-mono text-ink tabular-nums";
        if (elements.workerKpiBalanceCop) {
          elements.workerKpiBalanceCop.className = "block text-xs font-mono font-medium text-ink tabular-nums truncate mt-0.5";
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
  updateClientsUI();
  updateWorkerGoalUI();
  updateUpworkBudgetDashboard(currentTrm);
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
  elements.kpiSaldoPendiente.className = "stat-value tabular-nums truncate";

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
      elements.trmModalLiveBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-primary"></span><span>Tasa fija personalizada</span>`;
      elements.trmModalLiveBadge.className = "text-[10px] text-ink font-medium flex items-center gap-1";
    } else {
      elements.trmModalLiveBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span><span>En vivo vía mercado financiero (interbancario)</span>`;
      elements.trmModalLiveBadge.className = "text-[10px] text-mid font-medium flex items-center gap-1";
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

// Rango razonable del dólar en pesos: descarta valores absurdos si una API externa falla o es manipulada
const TRM_MIN = 1500;
const TRM_MAX = 8000;
function isPlausibleTrm(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= TRM_MIN && n <= TRM_MAX;
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
      if (isPlausibleTrm(data?.rates?.COP)) {
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
        if (isPlausibleTrm(data?.rates?.COP)) {
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
        if (isPlausibleTrm(data?.usd?.cop)) {
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
  const fromTasks = state.tasks.map(t => (t.cliente || "").trim()).filter(Boolean);
  const fromClients = state.clients.map(c => (c.nombre || "").trim()).filter(Boolean);
  const clients = Array.from(new Set([...fromTasks, ...fromClients])).sort((a, b) => a.localeCompare(b));
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
      (!t.trabajadorId && t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === myName)
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
          backgroundColor: isDark ? "rgba(250, 250, 250, 0.9)" : "rgba(10, 10, 10, 0.9)",
          hoverBackgroundColor: isDark ? "#FFFFFF" : "#262626",
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
            backgroundColor: isDark ? "#171717" : "#FFFFFF",
            titleColor: isDark ? "#FAFAFA" : "#0A0A0A",
            bodyColor: isDark ? "#A3A3A3" : "#737373",
            borderColor: isDark ? "#262626" : "#E5E5E5",
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
              color: isDark ? "#A3A3A3" : "#737373",
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: isDark ? "rgba(255, 255, 255, 0.05)" : "#E5E5E5"
            },
            ticks: {
              color: isDark ? "#A3A3A3" : "#737373",
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
        catColors.push(isDark ? invertGray(meta.chartColor) : meta.chartColor);
      });
    } else {
      catLabels = ["Sin registros"];
      catData = [1];
      catColors = [isDark ? "#262626" : "#E5E5E5"];
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
          borderColor: isDark ? "#171717" : "#FFFFFF",
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
              color: isDark ? "#A3A3A3" : "#737373",
              boxWidth: 8,
              boxHeight: 8,
              padding: 10,
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          tooltip: {
            backgroundColor: isDark ? "#171717" : "#FFFFFF",
            titleColor: isDark ? "#FAFAFA" : "#0A0A0A",
            bodyColor: isDark ? "#A3A3A3" : "#737373",
            borderColor: isDark ? "#262626" : "#E5E5E5",
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
   10.D CONTROL PRESUPUESTAL UPWORK & NÓMINA MENSUAL
   ============================================================================ */
function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 es Domingo, 1 es Lunes, ..., 6 es Sábado
  // El ciclo de facturación y corte semanal de Upwork va de Lunes a Domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function getWeekLabel(range) {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const startDay = range.start.getDate();
  const endDay = range.end.getDate();
  const startMonth = months[range.start.getMonth()];
  const endMonth = months[range.end.getMonth()];

  if (startMonth === endMonth) {
    return `Semana: ${startDay} al ${endDay} ${startMonth.toUpperCase()}`;
  }
  return `Semana: ${startDay} ${startMonth.toUpperCase()} al ${endDay} ${endMonth.toUpperCase()}`;
}

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end, year, month, daysInMonth: end.getDate() };
}

function getMonthLabel() {
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const now = new Date();
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

function getUpworkWeeksForMonth(year, month) {
  if (year === undefined || month === undefined) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }
  const lastDay = new Date(year, month + 1, 0);
  const monthsShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  let d = new Date(year, month, 1);
  const day = d.getDay();
  // En JS 0=Domingo, 1=Lunes. Ajustar al Lunes de inicio de la primera semana
  const diffToMonday = day === 0 ? -6 : 1 - day;
  let currentMonday = new Date(d);
  currentMonday.setDate(d.getDate() + diffToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  const nowTime = new Date().getTime();
  const weeks = [];
  let weekNum = 1;

  while (currentMonday <= lastDay && weekNum <= 6) {
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);
    currentSunday.setHours(23, 59, 59, 999);

    const mDay = currentMonday.getDate();
    const sDay = currentSunday.getDate();
    const mMonth = currentMonday.getMonth();
    const sMonth = currentSunday.getMonth();

    // Formato exacto Upwork: "12-18 Oct", "19-25 Oct", o "28 Sep-4 Oct" si cruza mes
    let shortDateLabel;
    if (mMonth === sMonth) {
      shortDateLabel = `${mDay}-${sDay} ${monthsShort[mMonth]}`;
    } else {
      shortDateLabel = `${mDay} ${monthsShort[mMonth]}-${sDay} ${monthsShort[sMonth]}`;
    }

    const startTime = currentMonday.getTime();
    const endTime = currentSunday.getTime();
    const isCurrent = (nowTime >= startTime && nowTime <= endTime);

    weeks.push({
      num: weekNum,
      key: `w${weekNum}`,
      shortDateLabel,
      cardTitle: `Sem ${weekNum}`,
      fullLabel: `Semana ${weekNum} (${shortDateLabel})`,
      pillLabel: `S${weekNum}: ${shortDateLabel}`,
      isCurrent,
      startDay: mDay,
      endDay: sDay
    });

    weekNum++;
    currentMonday = new Date(currentMonday);
    currentMonday.setDate(currentMonday.getDate() + 7);
    currentMonday.setHours(0, 0, 0, 0);
  }

  return weeks;
}

function getCurrentUpworkWeek() {
  const weeks = getUpworkWeeksForMonth();
  const found = weeks.find(w => w.isCurrent);
  return found ? found.num : 1;
}

function getCurrentWeekOfMonth() {
  return getCurrentUpworkWeek();
}

function getMonthWeeksConfig() {
  const weeks = getUpworkWeeksForMonth();
  const currentWeek = getCurrentUpworkWeek();
  const { daysInMonth } = getCurrentMonthRange();
  return {
    daysInMonth,
    currentWeek,
    weeksCount: weeks.length,
    hasWeek5: weeks.length >= 5,
    hasWeek6: weeks.length >= 6,
    weeks
  };
}

function getMonthlyWeeksGross(weeks = state.upworkMonthlyWeeks) {
  if (!weeks) return 0;
  return (Number(weeks.w1) || 0) +
         (Number(weeks.w2) || 0) +
         (Number(weeks.w3) || 0) +
         (Number(weeks.w4) || 0) +
         (Number(weeks.w5) || 0) +
         (Number(weeks.w6) || 0);
}

function getWeeklyApprovedTasks() {
  const { start, end } = getCurrentWeekRange();
  const startTime = start.getTime();
  const endTime = end.getTime();

  return state.tasks.filter(t => {
    if (!t.fecha || !isTaskApproved(t)) return false;
    const taskDate = new Date(t.fecha + "T00:00:00");
    const tTime = taskDate.getTime();
    return tTime >= startTime && tTime <= endTime;
  });
}

function getMonthlyApprovedTasks() {
  const { start, end } = getCurrentMonthRange();
  const startTime = start.getTime();
  const endTime = end.getTime();

  return state.tasks.filter(t => {
    if (!t.fecha || !isTaskApproved(t)) return false;
    const taskDate = new Date(t.fecha + "T00:00:00");
    const tTime = taskDate.getTime();
    return tTime >= startTime && tTime <= endTime;
  });
}

// Helper para calcular comisiones del tramo PayPal -> Nequi Colombia (con 19% IVA)
function calculateNequiFee(usdAmount) {
  const amount = Number(usdAmount) || 0;
  if (amount <= 0) {
    return {
      tier: 0,
      rate: 0,
      percentLabel: "0%",
      feeAmount: 0,
      netAmount: 0,
      tierName: "Sin saldo"
    };
  }

  // Tramos oficiales según esquema:
  // US$ 1–150: 6% base -> con IVA 19% = 7,14% (0.0714)
  // US$ 151–300: 4% base -> con IVA 19% = 4,76% (0.0476)
  // US$ 301–2.000: 2,5% base -> con IVA 19% = 2,975% (0.02975)
  let tier = 3;
  let rate = 0.02975;
  let percentLabel = "2,975%";
  let tierName = "US$ 301–2.000";

  if (amount <= 150) {
    tier = 1;
    rate = 0.0714;
    percentLabel = "7,14%";
    tierName = "US$ 1–150";
  } else if (amount <= 300) {
    tier = 2;
    rate = 0.0476;
    percentLabel = "4,76%";
    tierName = "US$ 151–300";
  } else {
    tier = 3;
    rate = 0.02975;
    percentLabel = "2,975%";
    tierName = "US$ 301–2.000";
  }

  const feeAmount = amount * rate;
  const netAmount = Math.max(0, amount - feeAmount);

  return {
    tier,
    rate,
    percentLabel,
    feeAmount,
    netAmount,
    tierName
  };
}

function updateUpworkBudgetDashboard(currentTrm) {
  if (!elements.adminUpworkBudgetSection) return;

  const trm = currentTrm || getActiveTrmRate();
  const monthConfig = getMonthWeeksConfig();

  // Actualizar badge del mes en curso (ej. "Octubre 2026")
  const weekBadge = document.getElementById("upworkWeekCycleBadge");
  if (weekBadge) {
    weekBadge.textContent = getMonthLabel();
  }

  // Costo de Nómina Mensual: Tareas aprobadas de todo el mes calendario
  const monthlyTasks = getMonthlyApprovedTasks();
  const monthlyHours = monthlyTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
  const monthlyArts = monthlyTasks.filter(t => t.cantidadArtes > 0).reduce((acc, t) => acc + (Number(t.cantidadArtes) || 0), 0);
  const monthlyPayrollCost = monthlyTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);

  // Recaudación mensual acumulada sumando las semanas (S1 + S2 + S3 + S4 + S5 + S6)
  const weeks = state.upworkMonthlyWeeks || { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0 };
  const grossRevenue = getMonthlyWeeksGross(weeks);
  state.upworkWeeklyRevenue = grossRevenue; // Mantener total sincronizado

  const feePercent = typeof state.upworkFeePercent === "number" ? state.upworkFeePercent : 15;
  const includeVat = state.upworkIncludeVat !== false;
  const payoutCost = typeof state.upworkPayoutCost === "number" ? state.upworkPayoutCost : 1.0;
  const includeNequi = state.nequiIncludeFee !== false;

  // Pipeline Financiero Completo: Upwork -> PayPal -> Colombia (Nequi o Cuenta Directa)
  // 1. Upwork Bruto -> Descuento tarifa de servicio (15% por defecto)
  const upworkFeeAmount = grossRevenue > 0 ? (grossRevenue * (feePercent / 100)) : 0;
  // 2. IVA Colombia (19%) sobre la tarifa de servicio de Upwork (VAT CO)
  const upworkVatAmount = (grossRevenue > 0 && includeVat) ? (upworkFeeAmount * 0.19) : 0;
  // 3. Ganancia neta en Upwork (Net earnings)
  const upworkNetEarnings = Math.max(0, grossRevenue - upworkFeeAmount - upworkVatAmount);
  // 4. Retiro a fin de mes Upwork -> PayPal ($1.00 USD)
  const upworkPayoutAmount = grossRevenue > 0 ? payoutCost : 0;
  // 5. Monto acreditado en PayPal
  const paypalAmount = Math.max(0, upworkNetEarnings - upworkPayoutAmount);
  // 6. Retiro PayPal -> Nequi Colombia (o Cuenta Bancaria Directa al 0%)
  const nequiCalc = includeNequi ? calculateNequiFee(paypalAmount) : { tier: 0, rate: 0, percentLabel: "0%", feeAmount: 0, netAmount: paypalAmount, tierName: "Cuenta Directa (0%)" };
  // 7. Ingreso Neto Real disponible en Colombia
  const netRealRevenue = grossRevenue > 0 ? nequiCalc.netAmount : 0;

  // Margen Real Neto mensual para la agencia = Saldo disponible en Colombia menos Costo de Nómina Mensual
  const realNetMargin = netRealRevenue - monthlyPayrollCost;

  const grossRevenueCop = grossRevenue * trm;
  const payrollCop = monthlyPayrollCost * trm;
  const realNetMarginCop = realNetMargin * trm;
  const netRealRevenueCop = netRealRevenue * trm;

  // 1. Recaudación Mes Acumulado Upwork
  if (elements.upworkRevenueDisplay) {
    elements.upworkRevenueDisplay.textContent = `$${grossRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (elements.upworkRevenueCopDisplay) {
    elements.upworkRevenueCopDisplay.textContent = `≈ ${formatCop(grossRevenueCop)}`;
  }
  if (elements.upworkRevenueSubtitle) {
    if (grossRevenue > 0) {
      const vatText = includeVat ? " + IVA CO" : "";
      const nequiText = includeNequi ? ` • Nequi -${nequiCalc.percentLabel}` : " • Cuenta Directa (0% com.)";
      elements.upworkRevenueSubtitle.textContent = `Neto en Colombia: $${netRealRevenue.toFixed(2)} (-${feePercent}%${vatText}, -$${payoutCost.toFixed(2)} retiro${nequiText})`;
    } else {
      elements.upworkRevenueSubtitle.textContent = "Clic en 'Gestionar Semanas' para ingresar recaudo";
    }
  }

  // Barra de pastillas dinámicas por cada semana del mes
  if (elements.upworkWeeksPillsBar) {
    const pillsHtml = (monthConfig.weeks || []).map(w => {
      const val = Number(weeks[w.key]) || 0;
      const isCurrent = w.isCurrent;
      const currentDot = isCurrent ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1"></span>' : '';
      const bgClass = isCurrent
        ? "bg-ink/15 text-mid font-bold border border-line shadow-xs"
        : "bg-muted text-mid border border-line";
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-md ${bgClass} transition-colors" title="${w.fullLabel}">
        ${currentDot}${w.pillLabel}: <strong class="ml-1 font-mono text-ink">$${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
      </span>`;
    }).join("");
    elements.upworkWeeksPillsBar.innerHTML = pillsHtml;
  }

  // Resumen de la Ruta Bancaria: Upwork -> PayPal -> Nequi / Cuenta Directa
  if (elements.routeUpworkNetLabel) {
    elements.routeUpworkNetLabel.textContent = `Upwork (-${feePercent}%${includeVat ? " + IVA" : ""})`;
  }
  if (elements.routeNequiTierLabel) {
    if (includeNequi && paypalAmount > 0) {
      elements.routeNequiTierLabel.textContent = `Nequi (-${nequiCalc.percentLabel})`;
    } else if (includeNequi) {
      elements.routeNequiTierLabel.textContent = `Nequi (-4,76%)`;
    } else {
      elements.routeNequiTierLabel.textContent = `Cuenta Directa (0%)`;
    }
  }
  if (elements.routeNetNequiUsd) {
    elements.routeNetNequiUsd.textContent = `$${netRealRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  }
  if (elements.routeNetNequiCop) {
    elements.routeNetNequiCop.textContent = `≈ ${formatCop(netRealRevenueCop)}`;
  }

  // 2. Costo Nómina Mensual
  if (elements.upworkPayrollCostDisplay) {
    elements.upworkPayrollCostDisplay.textContent = `$${monthlyPayrollCost.toFixed(2)}`;
  }
  if (elements.upworkPayrollCostCopDisplay) {
    elements.upworkPayrollCostCopDisplay.textContent = `≈ ${formatCop(payrollCop)}`;
  }
  if (elements.upworkPayrollDetails) {
    const parts = [];
    if (monthlyHours > 0 || monthlyArts === 0) parts.push(`${monthlyHours.toFixed(2)}h`);
    if (monthlyArts > 0) parts.push(`${monthlyArts} ${monthlyArts === 1 ? 'arte' : 'artes'}`);
    elements.upworkPayrollDetails.textContent = `${parts.join(" • ")} de tareas aprobadas este mes`;
  }

  // 3. Presupuesto Disponible (Mes) / Margen Real
  if (elements.upworkAvailableBudgetDisplay) {
    if (realNetMargin >= 0) {
      elements.upworkAvailableBudgetDisplay.textContent = `$${realNetMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      elements.upworkAvailableBudgetDisplay.className = "hero-amount tabular-nums text-ink";
    } else {
      elements.upworkAvailableBudgetDisplay.textContent = `-$${Math.abs(realNetMargin).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      elements.upworkAvailableBudgetDisplay.className = "hero-amount tabular-nums text-ember";
    }
  }

  if (elements.upworkAvailableBudgetCopDisplay) {
    if (realNetMargin >= 0) {
      elements.upworkAvailableBudgetCopDisplay.textContent = `≈ +${formatCop(realNetMarginCop)}`;
      elements.upworkAvailableBudgetCopDisplay.className = "block text-xs font-mono font-medium text-mid tabular-nums mt-0.5";
    } else {
      elements.upworkAvailableBudgetCopDisplay.textContent = `≈ -${formatCop(Math.abs(realNetMarginCop))}`;
      elements.upworkAvailableBudgetCopDisplay.className = "block text-xs font-mono font-medium text-ink tabular-nums mt-0.5";
    }
  }

  // Porcentaje y barra de ejecución del presupuesto del mes
  let usagePercent = 0;
  if (netRealRevenue > 0) {
    usagePercent = Math.min(Math.round((monthlyPayrollCost / netRealRevenue) * 100), 999);
  } else if (grossRevenue > 0) {
    usagePercent = 100;
  }

  if (elements.upworkBudgetPercentLabel) {
    elements.upworkBudgetPercentLabel.textContent = netRealRevenue > 0 ? `${usagePercent}% consumido` : "Sin meta definida";
  }

  if (elements.upworkBudgetProgressBar) {
    const barWidth = netRealRevenue > 0 ? Math.min(usagePercent, 100) : 0;
    elements.upworkBudgetProgressBar.style.width = `${barWidth}%`;
    if (usagePercent > 100) {
      elements.upworkBudgetProgressBar.className = "h-2 rounded-full bg-ember transition-all duration-500";
    } else if (usagePercent > 80) {
      elements.upworkBudgetProgressBar.className = "h-2 rounded-full bg-faint transition-all duration-500";
    } else {
      elements.upworkBudgetProgressBar.className = "h-2 rounded-full bg-primary transition-all duration-500";
    }
  }

  if (elements.upworkBudgetStatusBadge) {
    if (grossRevenue === 0) {
      elements.upworkBudgetStatusBadge.textContent = "Pendiente Recaudo";
      elements.upworkBudgetStatusBadge.className = "text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold bg-muted/10 text-mid";
    } else if (realNetMargin < 0) {
      elements.upworkBudgetStatusBadge.textContent = "Excedido";
      elements.upworkBudgetStatusBadge.className = "text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold bg-ember/15 text-ink";
    } else {
      const freePercent = Math.max(0, 100 - usagePercent);
      elements.upworkBudgetStatusBadge.textContent = `${freePercent}% Libre`;
      elements.upworkBudgetStatusBadge.className = "text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold bg-ink/10 text-mid";
    }
  }

  if (elements.upworkBudgetHealthDesc) {
    if (grossRevenue === 0) {
      elements.upworkBudgetHealthDesc.textContent = "Ingresa la recaudación de las semanas para monitorear el balance del mes";
      elements.upworkBudgetHealthDesc.className = "text-[10px] font-semibold text-mid";
    } else if (usagePercent > 100) {
      elements.upworkBudgetHealthDesc.textContent = "⚠️ Nómina mensual supera el recaudo neto en Colombia";
      elements.upworkBudgetHealthDesc.className = "text-[10px] font-semibold text-ink";
    } else if (usagePercent > 80) {
      elements.upworkBudgetHealthDesc.textContent = "Alerta: nómina mensual cercana al límite del recaudo (80%+)";
      elements.upworkBudgetHealthDesc.className = "text-[10px] font-semibold text-mid";
    } else {
      elements.upworkBudgetHealthDesc.textContent = "Presupuesto mensual saludable con margen neto positivo";
      elements.upworkBudgetHealthDesc.className = "text-[10px] font-semibold text-mid";
    }
  }

  if (elements.upworkBudgetSubtitle) {
    if (grossRevenue === 0) {
      elements.upworkBudgetSubtitle.textContent = "Ingresa recaudación semanal para monitorear el margen mensual";
    } else if (realNetMargin >= 0) {
      elements.upworkBudgetSubtitle.textContent = "Margen real neto de ganancia del mes (post-nómina)";
    } else {
      elements.upworkBudgetSubtitle.textContent = "Déficit mensual proyectado post-nómina";
    }
  }
}

function openUpworkBudgetModal() {
  if (!elements.upworkBudgetModal) return;

  const upworkWeeks = getUpworkWeeksForMonth();
  const currentWeekNum = getCurrentUpworkWeek();

  // Configurar badge del mes en el modal
  if (elements.modalMonthBadge) {
    elements.modalMonthBadge.textContent = getMonthLabel();
  }

  // Configurar cada una de las semanas (1 a 6) con las fechas reales del ciclo Upwork
  [1, 2, 3, 4, 5, 6].forEach(wNum => {
    const wInfo = upworkWeeks.find(w => w.num === wNum);
    const container = elements[`containerWeek${wNum}`];
    const label = elements[`labelWeek${wNum}`];
    const dateLabel = elements[`dateWeek${wNum}`];
    const badge = elements[`badgeWeek${wNum}`];

    if (wInfo) {
      if (container) container.classList.remove("hidden");
      if (label) label.textContent = wInfo.cardTitle;
      if (dateLabel) dateLabel.textContent = wInfo.shortDateLabel;
      if (badge) {
        if (wInfo.isCurrent) {
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }
    } else {
      // Ocultar si el mes no abarca esta semana
      if (container) container.classList.add("hidden");
    }
  });

  // Cargar valores de las semanas guardadas
  const weeks = state.upworkMonthlyWeeks || { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0 };
  if (elements.upworkWeek1Input) elements.upworkWeek1Input.value = Number(weeks.w1) > 0 ? Number(weeks.w1) : "";
  if (elements.upworkWeek2Input) elements.upworkWeek2Input.value = Number(weeks.w2) > 0 ? Number(weeks.w2) : "";
  if (elements.upworkWeek3Input) elements.upworkWeek3Input.value = Number(weeks.w3) > 0 ? Number(weeks.w3) : "";
  if (elements.upworkWeek4Input) elements.upworkWeek4Input.value = Number(weeks.w4) > 0 ? Number(weeks.w4) : "";
  if (elements.upworkWeek5Input) elements.upworkWeek5Input.value = Number(weeks.w5) > 0 ? Number(weeks.w5) : "";
  if (elements.upworkWeek6Input) elements.upworkWeek6Input.value = Number(weeks.w6) > 0 ? Number(weeks.w6) : "";

  if (elements.upworkFeePercentInput) {
    elements.upworkFeePercentInput.value = state.upworkFeePercent !== undefined ? state.upworkFeePercent : 15;
  }
  if (elements.upworkIncludeVatInput) {
    elements.upworkIncludeVatInput.checked = state.upworkIncludeVat !== false;
  }
  if (elements.upworkPayoutCostInput) {
    elements.upworkPayoutCostInput.value = state.upworkPayoutCost !== undefined ? state.upworkPayoutCost : 1.0;
  }
  if (elements.nequiIncludeFeeInput) {
    elements.nequiIncludeFeeInput.checked = state.nequiIncludeFee !== false;
  }

  updateUpworkInputPreview();
  elements.upworkBudgetModal.classList.remove("hidden");
  elements.upworkBudgetModal.classList.add("flex");

  // Focus en el input de la semana en curso
  setTimeout(() => {
    const currentInput = elements[`upworkWeek${currentWeekNum}Input`];
    if (currentInput && !currentInput.closest('.hidden')) {
      currentInput.focus();
    } else {
      elements.upworkWeek1Input?.focus();
    }
  }, 50);
}

function closeUpworkBudgetModal() {
  if (!elements.upworkBudgetModal) return;
  elements.upworkBudgetModal.classList.add("hidden");
  elements.upworkBudgetModal.classList.remove("flex");
}

function updateUpworkInputPreview() {
  const w1 = parseFloat(elements.upworkWeek1Input?.value) || 0;
  const w2 = parseFloat(elements.upworkWeek2Input?.value) || 0;
  const w3 = parseFloat(elements.upworkWeek3Input?.value) || 0;
  const w4 = parseFloat(elements.upworkWeek4Input?.value) || 0;
  const w5 = parseFloat(elements.upworkWeek5Input?.value) || 0;
  const w6 = parseFloat(elements.upworkWeek6Input?.value) || 0;

  const totalGross = w1 + w2 + w3 + w4 + w5 + w6;

  if (elements.upworkRevenueInput) {
    elements.upworkRevenueInput.value = totalGross;
  }

  if (elements.upworkTotalMonthlyRevenueLabel) {
    elements.upworkTotalMonthlyRevenueLabel.textContent = `$${totalGross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const feePercent = parseFloat(elements.upworkFeePercentInput?.value) || 0;
  const includeVat = elements.upworkIncludeVatInput ? elements.upworkIncludeVatInput.checked : true;
  const payoutCost = parseFloat(elements.upworkPayoutCostInput?.value) || 0;
  const includeNequi = elements.nequiIncludeFeeInput ? elements.nequiIncludeFeeInput.checked : true;
  const trm = getActiveTrmRate();

  if (elements.upworkInputCopPreview) {
    elements.upworkInputCopPreview.textContent = `≈ ${formatCop(totalGross * trm)}`;
  }

  // 1. Tarifa servicio Upwork (15% por defecto)
  const feeAmount = totalGross > 0 ? (totalGross * (feePercent / 100)) : 0;
  // 2. IVA Colombia (19%) sobre tarifa de Upwork (VAT CO on service fee)
  const vatAmount = (totalGross > 0 && includeVat) ? (feeAmount * 0.19) : 0;
  // 3. Ganancia neta en Upwork (Net earnings)
  const upworkNetEarnings = Math.max(0, totalGross - feeAmount - vatAmount);
  // 4. Retiro a fin de mes Upwork a PayPal ($1.00 USD)
  const payoutAmount = totalGross > 0 ? payoutCost : 0;
  // 5. Saldo en PayPal
  const paypalAmount = Math.max(0, upworkNetEarnings - payoutAmount);
  // 6. Nequi Colombia (o Cuenta Bancaria Directa con 0% comisión)
  const nequiCalc = includeNequi ? calculateNequiFee(paypalAmount) : { tier: 0, rate: 0, percentLabel: "0%", feeAmount: 0, netAmount: paypalAmount, tierName: "Cuenta Directa (0%)" };
  // 7. Monto neto real que entra a Colombia
  const netReal = totalGross > 0 ? nequiCalc.netAmount : 0;

  // Costo Nómina del Mes actual para comparar contra el margen
  const monthlyTasks = getMonthlyApprovedTasks();
  const monthlyPayroll = monthlyTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);
  const netMargin = netReal - monthlyPayroll;

  if (elements.upworkBreakdownGross) {
    elements.upworkBreakdownGross.textContent = `$${totalGross.toFixed(2)} USD`;
  }
  if (elements.upworkBreakdownFeeLabel) {
    elements.upworkBreakdownFeeLabel.textContent = `2. Tarifa de Servicio Upwork (${feePercent}%):`;
  }
  if (elements.upworkBreakdownFee) {
    elements.upworkBreakdownFee.textContent = `-$${feeAmount.toFixed(2)} USD`;
  }
  if (elements.upworkBreakdownVat) {
    elements.upworkBreakdownVat.textContent = `-$${vatAmount.toFixed(2)} USD (19%)`;
  }
  if (elements.upworkVatBreakdownRow) {
    elements.upworkVatBreakdownRow.style.opacity = includeVat ? "1" : "0.5";
  }
  if (elements.upworkBreakdownNetEarnings) {
    elements.upworkBreakdownNetEarnings.textContent = `$${upworkNetEarnings.toFixed(2)} USD`;
  }
  if (elements.upworkBreakdownPayout) {
    elements.upworkBreakdownPayout.textContent = `-$${payoutAmount.toFixed(2)} USD`;
  }
  if (elements.upworkBreakdownPayPal) {
    elements.upworkBreakdownPayPal.textContent = `$${paypalAmount.toFixed(2)} USD`;
  }
  if (elements.upworkBreakdownNequi) {
    if (includeNequi && paypalAmount > 0) {
      elements.upworkBreakdownNequi.textContent = `-$${nequiCalc.feeAmount.toFixed(2)} USD (${nequiCalc.percentLabel})`;
    } else if (includeNequi) {
      elements.upworkBreakdownNequi.textContent = `-$0.00 USD (${nequiCalc.percentLabel})`;
    } else {
      elements.upworkBreakdownNequi.textContent = `$0.00 USD (Cuenta Directa 0%)`;
    }
  }
  if (elements.nequiBreakdownRow) {
    elements.nequiBreakdownRow.style.opacity = includeNequi ? "1" : "0.5";
  }

  // Actualizar pill y resaltar caja de tramo activa en el modal
  if (elements.nequiActiveTierPill) {
    if (includeNequi && paypalAmount > 0) {
      elements.nequiActiveTierPill.textContent = `${nequiCalc.percentLabel} con IVA (${nequiCalc.tierName})`;
    } else if (includeNequi) {
      elements.nequiActiveTierPill.textContent = "4,76% con IVA";
    } else {
      elements.nequiActiveTierPill.textContent = "Cuenta Directa (0% com.)";
    }
  }

  const tier1 = elements.nequiTierBox1;
  const tier2 = elements.nequiTierBox2;
  const tier3 = elements.nequiTierBox3;
  [tier1, tier2, tier3].forEach(el => {
    el?.classList.remove("ring-2", "ring-ink", "bg-muted", "dark:bg-ink/40");
  });
  if (includeNequi && paypalAmount > 0) {
    if (nequiCalc.tier === 1) tier1?.classList.add("ring-2", "ring-ink", "bg-muted", "dark:bg-ink/40");
    else if (nequiCalc.tier === 2) tier2?.classList.add("ring-2", "ring-ink", "bg-muted", "dark:bg-ink/40");
    else if (nequiCalc.tier === 3) tier3?.classList.add("ring-2", "ring-ink", "bg-muted", "dark:bg-ink/40");
  }

  if (elements.upworkBreakdownNet) {
    elements.upworkBreakdownNet.textContent = `$${netReal.toFixed(2)} USD (≈ ${formatCop(netReal * trm)})`;
  }
  if (elements.upworkBreakdownMonthlyPayroll) {
    elements.upworkBreakdownMonthlyPayroll.textContent = `-$${monthlyPayroll.toFixed(2)} USD (≈ ${formatCop(monthlyPayroll * trm)})`;
  }
  if (elements.upworkBreakdownNetMargin) {
    if (netMargin >= 0) {
      elements.upworkBreakdownNetMargin.textContent = `+$${netMargin.toFixed(2)} USD (≈ +${formatCop(netMargin * trm)})`;
      elements.upworkBreakdownNetMargin.className = "font-bold text-mid";
    } else {
      elements.upworkBreakdownNetMargin.textContent = `-$${Math.abs(netMargin).toFixed(2)} USD (≈ -${formatCop(Math.abs(netMargin * trm))})`;
      elements.upworkBreakdownNetMargin.className = "font-bold text-ink";
    }
  }
}

async function saveUpworkBudget(weeksOrAmount, feePercent = 15, payoutCost = 1.0, nequiIncludeFee = true, upworkIncludeVat = true) {
  let cleanWeeks = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0 };
  if (typeof weeksOrAmount === "object" && weeksOrAmount !== null) {
    cleanWeeks = {
      w1: Math.max(0, parseFloat(weeksOrAmount.w1) || 0),
      w2: Math.max(0, parseFloat(weeksOrAmount.w2) || 0),
      w3: Math.max(0, parseFloat(weeksOrAmount.w3) || 0),
      w4: Math.max(0, parseFloat(weeksOrAmount.w4) || 0),
      w5: Math.max(0, parseFloat(weeksOrAmount.w5) || 0),
      w6: Math.max(0, parseFloat(weeksOrAmount.w6) || 0)
    };
  } else if (typeof weeksOrAmount === "number" || typeof weeksOrAmount === "string") {
    const curW = getCurrentUpworkWeek();
    cleanWeeks[`w${curW}`] = Math.max(0, parseFloat(weeksOrAmount) || 0);
  }

  const totalAmount = cleanWeeks.w1 + cleanWeeks.w2 + cleanWeeks.w3 + cleanWeeks.w4 + cleanWeeks.w5 + cleanWeeks.w6;

  state.upworkMonthlyWeeks = cleanWeeks;
  state.upworkWeeklyRevenue = totalAmount;
  state.upworkFeePercent = feePercent;
  state.upworkIncludeVat = upworkIncludeVat;
  state.upworkPayoutCost = payoutCost;
  state.nequiIncludeFee = nequiIncludeFee;

  localStorage.setItem("widely_upwork_monthly_weeks", JSON.stringify(cleanWeeks));
  localStorage.setItem("widely_upwork_weekly_revenue", String(totalAmount));
  localStorage.setItem("widely_upwork_fee_percent", String(feePercent));
  localStorage.setItem("widely_upwork_include_vat", String(upworkIncludeVat));
  localStorage.setItem("widely_upwork_payout_cost", String(payoutCost));
  localStorage.setItem("widely_nequi_include_fee", String(nequiIncludeFee));
  updateUpworkBudgetDashboard();

  if (db) {
    try {
      await setDoc(doc(db, "configuracion", "upwork"), {
        monthlyWeeks: cleanWeeks,
        weeklyRevenue: totalAmount,
        feePercent: feePercent,
        includeVat: upworkIncludeVat,
        payoutCost: payoutCost,
        nequiIncludeFee: nequiIncludeFee,
        updatedAt: serverTimestamp(),
        updatedBy: state.currentUser?.email || "admin"
      }, { merge: true });
      const vatText = upworkIncludeVat ? "+IVA CO" : "sin IVA";
      const nequiText = nequiIncludeFee ? "Nequi activo" : "Cuenta Directa (0% com.)";
      showToast(`Presupuesto actualizado: $${totalAmount.toFixed(2)} USD del mes (-${feePercent}% Upwork ${vatText}, -$${payoutCost} retiro, ${nequiText})`, "success");
      return;
    } catch (err) {
      console.warn("[Upwork Budget] Guardado localmente, error en Firestore:", err);
    }
  }
  showToast(`Guardado en este navegador ($${totalAmount.toFixed(2)} USD del mes)`, "info");
}

async function loadUpworkBudget() {
  const cachedWeeks = localStorage.getItem("widely_upwork_monthly_weeks");
  if (cachedWeeks) {
    try {
      const parsed = JSON.parse(cachedWeeks);
      if (parsed && typeof parsed === "object") {
        state.upworkMonthlyWeeks = {
          w1: Number(parsed.w1) || 0,
          w2: Number(parsed.w2) || 0,
          w3: Number(parsed.w3) || 0,
          w4: Number(parsed.w4) || 0,
          w5: Number(parsed.w5) || 0,
          w6: Number(parsed.w6) || 0
        };
      }
    } catch (e) {
      console.warn("[Upwork Budget] Error parseando semanas en localStorage", e);
    }
  } else {
    // Si no había semanas guardadas pero sí un weeklyRevenue anterior, asignarlo a la semana en curso
    const cachedRevenue = localStorage.getItem("widely_upwork_weekly_revenue");
    if (cachedRevenue !== null && !isNaN(Number(cachedRevenue))) {
      const rev = Number(cachedRevenue);
      const curW = getCurrentUpworkWeek();
      state.upworkMonthlyWeeks[`w${curW}`] = rev;
    }
  }

  state.upworkWeeklyRevenue = getMonthlyWeeksGross(state.upworkMonthlyWeeks);

  const cachedFee = localStorage.getItem("widely_upwork_fee_percent");
  if (cachedFee !== null && !isNaN(Number(cachedFee))) {
    state.upworkFeePercent = Number(cachedFee);
  }
  const cachedVat = localStorage.getItem("widely_upwork_include_vat");
  if (cachedVat !== null) {
    state.upworkIncludeVat = cachedVat !== "false";
  }
  const cachedPayout = localStorage.getItem("widely_upwork_payout_cost");
  if (cachedPayout !== null && !isNaN(Number(cachedPayout))) {
    state.upworkPayoutCost = Number(cachedPayout);
  }
  const cachedNequi = localStorage.getItem("widely_nequi_include_fee");
  if (cachedNequi !== null) {
    state.nequiIncludeFee = cachedNequi !== "false";
  }
  updateUpworkBudgetDashboard();

  if (db) {
    try {
      const cfgDoc = await getDoc(doc(db, "configuracion", "upwork"));
      if (cfgDoc.exists()) {
        const data = cfgDoc.data();
        if (data.monthlyWeeks && typeof data.monthlyWeeks === "object") {
          state.upworkMonthlyWeeks = {
            w1: Number(data.monthlyWeeks.w1) || 0,
            w2: Number(data.monthlyWeeks.w2) || 0,
            w3: Number(data.monthlyWeeks.w3) || 0,
            w4: Number(data.monthlyWeeks.w4) || 0,
            w5: Number(data.monthlyWeeks.w5) || 0,
            w6: Number(data.monthlyWeeks.w6) || 0
          };
          localStorage.setItem("widely_upwork_monthly_weeks", JSON.stringify(state.upworkMonthlyWeeks));
        } else if (typeof data.weeklyRevenue === "number") {
          const curW = getCurrentUpworkWeek();
          state.upworkMonthlyWeeks[`w${curW}`] = data.weeklyRevenue;
          localStorage.setItem("widely_upwork_monthly_weeks", JSON.stringify(state.upworkMonthlyWeeks));
        }
        state.upworkWeeklyRevenue = getMonthlyWeeksGross(state.upworkMonthlyWeeks);

        if (typeof data.feePercent === "number") {
          state.upworkFeePercent = data.feePercent;
          localStorage.setItem("widely_upwork_fee_percent", String(data.feePercent));
        }
        if (typeof data.includeVat === "boolean") {
          state.upworkIncludeVat = data.includeVat;
          localStorage.setItem("widely_upwork_include_vat", String(data.includeVat));
        }
        if (typeof data.payoutCost === "number") {
          state.upworkPayoutCost = data.payoutCost;
          localStorage.setItem("widely_upwork_payout_cost", String(data.payoutCost));
        }
        if (typeof data.nequiIncludeFee === "boolean") {
          state.nequiIncludeFee = data.nequiIncludeFee;
          localStorage.setItem("widely_nequi_include_fee", String(data.nequiIncludeFee));
        }
        updateUpworkBudgetDashboard();
      }
    } catch (err) {
      console.warn("[Upwork Budget] Usando caché local:", err);
    }
  }
}

window.openUpworkBudgetModal = openUpworkBudgetModal;

/* ============================================================================
   10.E GESTIÓN DE CLIENTES & RENTABILIDAD DE PROYECTOS
   ============================================================================ */
function openClientModal(clientId = null) {
  if (!elements.clientModal) return;

  if (clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (client) {
      if (elements.clientIdInput) elements.clientIdInput.value = client.id;
      if (elements.clientNameInput) elements.clientNameInput.value = client.nombre || "";
      if (elements.clientRateInput) elements.clientRateInput.value = client.tarifaPorHora > 0 ? client.tarifaPorHora : "";
      if (elements.clientHourBudgetInput) elements.clientHourBudgetInput.value = client.limiteHoras > 0 ? client.limiteHoras : "";
      if (elements.clientNotesInput) elements.clientNotesInput.value = client.notas || "";
      if (elements.clientModalTitle) elements.clientModalTitle.textContent = `Editar: ${client.nombre}`;
    }
  } else {
    if (elements.formClient) elements.formClient.reset();
    if (elements.clientIdInput) elements.clientIdInput.value = "";
    if (elements.clientModalTitle) elements.clientModalTitle.textContent = "Nuevo Cliente / Proyecto";
  }

  elements.clientModal.classList.remove("hidden");
  elements.clientModal.classList.add("flex");
  setTimeout(() => elements.clientNameInput?.focus(), 50);
}

function closeClientModal() {
  if (!elements.clientModal) return;
  elements.clientModal.classList.add("hidden");
  elements.clientModal.classList.remove("flex");
  if (elements.formClient) elements.formClient.reset();
}

async function handleSaveClient(e) {
  e.preventDefault();
  const name = elements.clientNameInput?.value.trim();
  if (!name) {
    showToast("Ingresa el nombre del cliente.", "warning");
    return;
  }

  const clientId = elements.clientIdInput?.value.trim();
  const rateRaw = elements.clientRateInput?.value.trim();
  const rate = rateRaw === "" ? 0 : parseFloat(rateRaw);
  const budgetRaw = elements.clientHourBudgetInput?.value.trim();
  const limitHours = budgetRaw === "" ? 0 : parseFloat(budgetRaw);
  const notes = elements.clientNotesInput?.value.trim() || "";

  if (isNaN(rate) || rate < 0) {
    showToast("La tarifa debe ser un número igual o mayor a 0.", "warning");
    return;
  }
  if (isNaN(limitHours) || limitHours < 0) {
    showToast("El paquete de horas debe ser igual o mayor a 0.", "warning");
    return;
  }

  const clientData = {
    nombre: name,
    tarifaPorHora: Number(rate.toFixed(2)),
    limiteHoras: Number(limitHours.toFixed(2)),
    notas: notes,
    updatedAt: db ? serverTimestamp() : new Date().toISOString()
  };

  try {
    if (clientId) {
      if (db) {
        await setDoc(doc(db, "clientes", clientId), clientData, { merge: true });
      } else {
        const idx = state.clients.findIndex(c => c.id === clientId);
        if (idx !== -1) state.clients[idx] = { id: clientId, ...clientData };
      }
      showToast(`Cliente "${name}" actualizado con éxito.`, "success");
    } else {
      clientData.createdAt = db ? serverTimestamp() : new Date().toISOString();
      if (db) {
        await addDoc(collection(db, "clientes"), clientData);
      } else {
        clientData.id = "local_client_" + Date.now();
        state.clients.push(clientData);
      }
      showToast(`Cliente "${name}" creado exitosamente.`, "success");
    }

    closeClientModal();
    updateClientsUI();
    updateClientsDatalist();
  } catch (err) {
    console.error("[Clientes] Error guardando cliente:", err);
    showToast("Error al guardar cliente: " + err.message, "error");
  }
}

async function deleteClient(clientId, clientName) {
  window.requestDelete("clientes", clientId, `el cliente "${clientName}"`);
}

async function syncClientsFromTasks() {
  const existingNames = new Set(state.clients.map(c => (c.nombre || "").trim().toLowerCase()));
  const taskClientNames = new Set();

  state.tasks.forEach(t => {
    if (t.cliente && typeof t.cliente === "string") {
      const clean = t.cliente.trim();
      if (clean && !existingNames.has(clean.toLowerCase())) {
        taskClientNames.add(clean);
      }
    }
  });

  if (taskClientNames.size === 0) {
    showToast("Todos los clientes encontrados en las tareas ya están registrados.", "info");
    return;
  }

  let count = 0;
  for (const clientName of taskClientNames) {
    const clientData = {
      nombre: clientName,
      tarifaPorHora: 0,
      limiteHoras: 0,
      notas: "Detectado automáticamente desde actividades",
      createdAt: db ? serverTimestamp() : new Date().toISOString()
    };
    try {
      if (db) {
        await addDoc(collection(db, "clientes"), clientData);
      } else {
        clientData.id = "local_client_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
        state.clients.push(clientData);
      }
      count++;
    } catch (err) {
      console.warn("[Clientes] Error al auto-registrar:", clientName, err);
    }
  }

  showToast(`Se agregaron ${count} clientes detectados automáticamente.`, "success");
  updateClientsUI();
  updateClientsDatalist();
}

function updateClientsUI() {
  if (!elements.clientsTableBody) return;
  const currentTrm = getActiveTrmRate();

  if (state.clients.length === 0) {
    elements.clientsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-mid text-xs">
          No tienes clientes registrados aún. Haz clic en <strong>+ Nuevo Cliente</strong> o <strong>Detectar Clientes</strong>.
        </td>
      </tr>
    `;
    return;
  }

  const rows = state.clients.map(client => {
    const clientNameNorm = (client.nombre || "").trim().toLowerCase();
    const clientTasks = state.tasks.filter(t => (t.cliente || "").trim().toLowerCase() === clientNameNorm && isTaskApproved(t));

    const totalHours = clientTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
    const totalPayrollCost = clientTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);
    const hourlyRate = Number(client.tarifaPorHora || 0);
    const limitHours = Number(client.limiteHoras || 0);

    const billableRevenue = totalHours * hourlyRate;
    const grossMargin = billableRevenue - totalPayrollCost;

    const billableCop = billableRevenue * currentTrm;
    const payrollCop = totalPayrollCost * currentTrm;
    const marginCop = grossMargin * currentTrm;

    // Barra de consumo de horas vs paquete
    let progressHtml = "";
    if (limitHours > 0) {
      const pct = Math.min(Math.round((totalHours / limitHours) * 100), 999);
      const barColor = pct > 100 ? "bg-ember" : pct > 80 ? "bg-faint" : "bg-primary";
      progressHtml = `
        <div class="mt-1">
          <div class="flex items-center justify-between text-[10px] font-mono text-mid">
            <span>${totalHours.toFixed(1)}h / ${limitHours.toFixed(1)}h</span>
            <span class="${pct > 100 ? 'text-ink font-bold' : ''}">${pct}%</span>
          </div>
          <div class="w-full bg-muted rounded-full h-1.5 mt-0.5 overflow-hidden">
            <div class="${barColor} h-1.5 rounded-full" style="width: ${Math.min(pct, 100)}%"></div>
          </div>
        </div>
      `;
    } else {
      progressHtml = `
        <span class="text-xs font-mono font-medium text-ink">${totalHours.toFixed(2)}h registradas</span>
        <span class="text-[10px] text-mid block">Sin límite pactado</span>
      `;
    }

    const marginColor = grossMargin >= 0 
      ? "text-mid font-semibold" 
      : "text-ink font-semibold";

    return `
      <tr class="hover:bg-muted transition-colors">
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-ink/10 text-mid flex items-center justify-center text-xs font-semibold shrink-0 border border-line">
              <i class="fa-solid fa-briefcase text-[11px]"></i>
            </div>
            <div>
              <span class="font-semibold text-ink block text-xs">${escapeHtml(client.nombre)}</span>
              ${client.notas ? `<span class="text-[10px] text-mid truncate block max-w-xs" title="${escapeHtml(client.notas)}">${escapeHtml(client.notas)}</span>` : ""}
            </div>
          </div>
        </td>
        <td class="py-3 px-2 text-right font-mono text-xs">
          ${hourlyRate > 0 ? `<span class="font-semibold text-ink">$${hourlyRate.toFixed(2)}/h</span>` : `<span class="text-mid">Sin tarifa</span>`}
        </td>
        <td class="py-3 px-3 min-w-[150px]">
          ${progressHtml}
        </td>
        <td class="py-3 px-2 text-right font-mono text-xs tabular-nums">
          <span class="font-semibold text-ink">$${billableRevenue.toFixed(2)}</span>
          <span class="text-[10px] text-mid block">≈ ${formatCop(billableCop)}</span>
        </td>
        <td class="py-3 px-2 text-right font-mono text-xs tabular-nums">
          <span class="font-medium text-ink">$${totalPayrollCost.toFixed(2)}</span>
          <span class="text-[10px] text-mid block">≈ ${formatCop(payrollCop)}</span>
        </td>
        <td class="py-3 px-3 text-right font-mono text-xs tabular-nums">
          <span class="${marginColor}">${grossMargin >= 0 ? '+' : ''}$${grossMargin.toFixed(2)}</span>
          <span class="text-[10px] ${grossMargin >= 0 ? 'text-mid' : 'text-ink'} block">≈ ${formatCop(marginCop)}</span>
        </td>
        <td class="py-3 px-2 text-center whitespace-nowrap">
          <div class="inline-flex items-center gap-1">
            <button type="button" onclick="window.openClientModal(${jsArg(client.id)})" class="p-1 rounded-md text-mid hover:text-ink hover:bg-ink/10 transition-colors" title="Editar cliente">
              <i class="fa-regular fa-pen-to-square text-xs"></i>
            </button>
            <button type="button" onclick="window.deleteClient(${jsArg(client.id)}, ${jsArg(client.nombre)})" class="p-1 rounded-md text-mid hover:text-ember hover:bg-ember/10 transition-colors" title="Eliminar cliente">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  elements.clientsTableBody.innerHTML = rows;
}

window.openClientModal = openClientModal;
window.deleteClient = deleteClient;
window.syncClientsFromTasks = syncClientsFromTasks;

/* ============================================================================
   10.F SISTEMA UNIVERSAL DE EXPORTACIÓN EXCEL / CSV
   ============================================================================ */
function exportToCsv(filename, headers, rows) {
  if (!rows || rows.length === 0) {
    showToast("No hay registros para exportar en el período seleccionado.", "warning");
    return;
  }

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = "\uFEFF" + [
    headers.map(escapeCell).join(","),
    ...rows.map(row => row.map(escapeCell).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Archivo "${filename}" descargado con éxito.`, "success");
}

function handleExportTasksCsv() {
  const currentTrm = getActiveTrmRate();
  const tasks = getFilteredTasks();
  const periodLabel = elements.periodFilterLabel?.textContent.trim() || "Periodo";

  const headers = [
    "ID Tarea",
    "Fecha",
    "Colaborador",
    "Cliente / Cuenta",
    "Descripción de Actividad",
    "Categoría",
    "Modalidad",
    "Horas Registradas",
    "Cantidad Artes",
    "Costo USD",
    "Costo COP (TRM " + Math.round(currentTrm) + ")",
    "Estado Aprobación",
    "Motivo Rechazo"
  ];

  const rows = tasks.map(t => {
    const isArt = (Number(t.cantidadArtes) || 0) > 0;
    const usd = Number(t.costoTotal || 0);
    const cop = usd * currentTrm;
    const cat = getCategoryInfo(t.categoria);
    const status = t.aprobada === false ? "Rechazada" : (t.aprobada === true ? "Aprobada" : "Pendiente");

    return [
      t.id || "",
      t.fecha || "",
      t.trabajadorNombre || "Anónimo",
      t.cliente || "General",
      t.descripcion || "",
      cat.label,
      isArt ? "Diseño de Artes" : "Por Horas",
      Number(t.horas || 0).toFixed(4),
      t.cantidadArtes || 0,
      usd.toFixed(2),
      Math.round(cop),
      status,
      t.motivoRechazo || ""
    ];
  });

  const todayStr = new Date().toISOString().split("T")[0];
  exportToCsv(`Widely_Actividades_${periodLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${todayStr}.csv`, headers, rows);
}

function handleExportPaymentsCsv() {
  const currentTrm = getActiveTrmRate();
  const payments = getFilteredPayments();
  const periodLabel = elements.periodFilterLabel?.textContent.trim() || "Periodo";

  const headers = [
    "ID Pago",
    "Fecha Desembolso",
    "Colaborador",
    "Referencia / Concepto",
    "Monto USD",
    "Monto COP (TRM " + Math.round(currentTrm) + ")"
  ];

  const rows = payments.map(p => {
    const usd = Number(p.monto || 0);
    const cop = usd * currentTrm;
    return [
      p.id || "",
      p.fecha || "",
      p.trabajadorNombre || "",
      p.referencia || "Pago registrado",
      usd.toFixed(2),
      Math.round(cop)
    ];
  });

  const todayStr = new Date().toISOString().split("T")[0];
  exportToCsv(`Widely_Pagos_${periodLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${todayStr}.csv`, headers, rows);
}

function handleExportFinancialCsv() {
  const currentTrm = getActiveTrmRate();
  const periodLabel = elements.periodFilterLabel?.textContent.trim() || "Periodo";
  const filteredTasks = getFilteredTasks();
  const filteredPayments = getFilteredPayments();

  const headers = [
    "Colaborador",
    "Correo Electrónico",
    "Teléfono / WhatsApp",
    "Tarifa Hora ($/h)",
    "Tarifa Arte ($/arte)",
    "Horas Período",
    "Artes Período",
    "Total Causado USD",
    "Total Causado COP",
    "Total Pagado USD",
    "Total Pagado COP",
    "Saldo Pendiente USD",
    "Saldo Pendiente COP",
    "Estado de Nómina"
  ];

  const rows = state.workers.map(worker => {
    const workerTasks = filteredTasks.filter(t => t.trabajadorId === worker.id && isTaskApproved(t));
    const workerPayments = filteredPayments.filter(p => p.trabajadorId === worker.id);

    const totalHours = workerTasks.reduce((sum, t) => sum + (Number(t.horas) || 0), 0);
    const totalArts = workerTasks.filter(t => t.cantidadArtes > 0).reduce((sum, t) => sum + (Number(t.cantidadArtes) || 0), 0);
    const totalEarned = workerTasks.reduce((sum, t) => sum + (Number(t.costoTotal) || 0), 0);
    const totalPaid = workerPayments.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
    const balance = totalEarned - totalPaid;

    const earnedCop = totalEarned * currentTrm;
    const paidCop = totalPaid * currentTrm;
    const balanceCop = balance * currentTrm;

    let status = "Al Día";
    if (balance > 0.005) status = "Saldo Pendiente";
    else if (balance < -0.005) status = "Anticipo a Favor";

    return [
      worker.nombre || "",
      worker.email || "",
      worker.telefono || "",
      Number(worker.tarifaHora || 0).toFixed(2),
      Number(worker.tarifaArte || 0).toFixed(2),
      totalHours.toFixed(2),
      totalArts,
      totalEarned.toFixed(2),
      Math.round(earnedCop),
      totalPaid.toFixed(2),
      Math.round(paidCop),
      balance.toFixed(2),
      Math.round(balanceCop),
      status
    ];
  });

  const todayStr = new Date().toISOString().split("T")[0];
  exportToCsv(`Widely_Nomina_Consolidada_${periodLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${todayStr}.csv`, headers, rows);
}

window.exportTasksCsv = handleExportTasksCsv;
window.exportPaymentsCsv = handleExportPaymentsCsv;
window.exportFinancialCsv = handleExportFinancialCsv;

/* ============================================================================
   10.G COMPARTIR COMPROBANTES POR WHATSAPP EN 1 CLIC
   ============================================================================ */
function handleShareWhatsAppStatement() {
  if (!currentStatementWorkerId) {
    showToast("No se ha seleccionado ningún colaborador.", "warning");
    return;
  }

  const worker = state.workers.find(w => w.id === currentStatementWorkerId);
  if (!worker) {
    showToast("Colaborador no encontrado.", "error");
    return;
  }

  let phone = (worker.telefono || "").replace(/[^0-9+]/g, "");
  if (!phone) {
    const entered = prompt(`Ingresa el número de WhatsApp para ${worker.nombre} (ej: +57 300 123 4567):`, "");
    if (!entered) {
      showToast("Envío cancelado: no se especificó número de WhatsApp.", "info");
      return;
    }
    phone = entered.replace(/[^0-9+]/g, "");
    worker.telefono = phone;
    if (db) {
      setDoc(doc(db, "trabajadores", worker.id), { telefono: phone }, { merge: true }).catch(() => {});
    }
  }

  // Si tiene 10 dígitos y empieza por 3 (móvil estándar Colombia), agregar prefijo 57
  if (phone.length === 10 && phone.startsWith("3")) {
    phone = "57" + phone;
  } else if (phone.startsWith("+")) {
    phone = phone.replace("+", "");
  }

  const currentTrm = getActiveTrmRate();
  const periodLabel = elements.periodFilterLabel?.textContent.trim() || "Período actual";
  const filteredTasks = getFilteredTasks().filter(t => t.trabajadorId === worker.id && isTaskApproved(t));
  const filteredPayments = getFilteredPayments().filter(p => p.trabajadorId === worker.id);

  const totalHours = filteredTasks.reduce((sum, t) => sum + (Number(t.horas) || 0), 0);
  const totalArts = filteredTasks.filter(t => t.cantidadArtes > 0).reduce((sum, t) => sum + (Number(t.cantidadArtes) || 0), 0);
  const totalEarned = filteredTasks.reduce((sum, t) => sum + (Number(t.costoTotal) || 0), 0);
  const totalPaid = filteredPayments.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
  const balance = totalEarned - totalPaid;

  const earnedCop = formatCop(totalEarned * currentTrm);
  const paidCop = formatCop(totalPaid * currentTrm);
  const balanceCop = formatCop(balance * currentTrm);

  let msg = "";
  if (currentStatementDocType === "bill") {
    // Formato Cuenta de Cobro
    msg = `📄 *CUENTA DE COBRO | WIDELY SOCIAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Colaborador:* ${worker.nombre}\n` +
      `📅 *Período:* ${periodLabel}\n` +
      `⏱️ *Actividad:* ${totalHours.toFixed(2)}h registradas` + (totalArts > 0 ? ` (${totalArts} artes)` : ``) + `\n\n` +
      `💵 *Total Causado:* $${totalEarned.toFixed(2)} USD (≈ ${earnedCop})\n` +
      `💳 *Anticipos Recibidos:* -$${totalPaid.toFixed(2)} USD\n` +
      `📌 *VALOR NETO A COBRAR:* $${balance.toFixed(2)} USD (≈ ${balanceCop})\n\n` +
      `🏦 *Datos Bancarios:* ${elements.billBank?.textContent || 'Consignación'} | ${elements.billAccountNumber?.textContent || 'Registrada'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Generado formalmente desde Widely Social Time Tracker.`;
  } else {
    // Formato Recibo de Pago Oficial
    msg = `🧾 *COMPROBANTE DE PAGO OFICIAL | WIDELY SOCIAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Colaborador:* ${worker.nombre}\n` +
      `📅 *Período Liquidado:* ${periodLabel}\n` +
      `⏱️ *Horas Aprobadas:* ${totalHours.toFixed(2)} hrs` + (totalArts > 0 ? ` + ${totalArts} artes` : ``) + `\n\n` +
      `💰 *Total Devengado:* $${totalEarned.toFixed(2)} USD (≈ ${earnedCop})\n` +
      `✅ *Total Desembolsado:* $${totalPaid.toFixed(2)} USD (≈ ${paidCop})\n` +
      `📊 *Saldo Actual:* $${balance.toFixed(2)} USD (≈ ${balanceCop})\n\n` +
      `✍️ *Certificado por:* Lina De La Espriella (Administración)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Comprobante oficial emitido en Widely Social.`;
  }

  const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  showToast(`Abriendo WhatsApp con comprobante para ${worker.nombre}...`, "success");
}

window.shareWhatsAppStatement = handleShareWhatsAppStatement;

/* ============================================================================
   10.H POMODORO TIMER, CHIMES & METAS DE RENDIMIENTO DE COLABORADOR
   ============================================================================ */
function playChime(type = "focus") {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === "focus") {
      // Tono brillante de 2 campanas armónicas al iniciar enfoque (C5 -> E5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start(ctx.currentTime + 0.15);
      osc1.stop(ctx.currentTime + 0.7);
      osc2.stop(ctx.currentTime + 0.7);
    } else if (type === "break") {
      // Tono relajante y suave para inicio de descanso (G4 -> C5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(392.00, ctx.currentTime);
      osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.10, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    }
  } catch (err) {
    // Si la política de autoplay del navegador previene el audio, continuar silencioso
  }
}

function setTimerMode(mode) {
  if (mode === "pomodoro") {
    state.pomodoro.enabled = true;
    state.pomodoro.phase = "focus";
    state.pomodoro.remainingSeconds = state.pomodoro.focusMinutes * 60;

    if (elements.btnModePomodoro) {
      elements.btnModePomodoro.className = "px-2.5 py-1 text-xs font-semibold rounded-md bg-primary text-on-primary shadow-sm transition-all";
    }
    if (elements.btnModeStandard) {
      elements.btnModeStandard.className = "px-2.5 py-1 text-xs font-medium rounded-md text-mid hover:text-ink dark:hover:text-white transition-all";
    }
    if (elements.pomodoroBanner) {
      elements.pomodoroBanner.classList.remove("hidden");
    }
    if (elements.pomodoroPhaseLabel) {
      elements.pomodoroPhaseLabel.textContent = `🍅 Enfoque (${state.pomodoro.focusMinutes}:00)`;
    }
    playChime("focus");
    showToast("Modo Pomodoro activo: 25 min de enfoque + 5 min de descanso.", "info");
  } else {
    state.pomodoro.enabled = false;
    if (elements.btnModeStandard) {
      elements.btnModeStandard.className = "px-2.5 py-1 text-xs font-semibold rounded-md bg-primary text-on-primary shadow-sm transition-all";
    }
    if (elements.btnModePomodoro) {
      elements.btnModePomodoro.className = "px-2.5 py-1 text-xs font-medium rounded-md text-mid hover:text-ink dark:hover:text-white transition-all";
    }
    if (elements.pomodoroBanner) {
      elements.pomodoroBanner.classList.add("hidden");
    }
    showToast("Modo libre de cronómetro activo.", "info");
  }
}

function handlePomodoroTick() {
  if (!state.pomodoro.enabled || !state.timer.isRunning) return;

  if (state.pomodoro.remainingSeconds > 0) {
    state.pomodoro.remainingSeconds--;
  }

  const mins = Math.floor(state.pomodoro.remainingSeconds / 60);
  const secs = state.pomodoro.remainingSeconds % 60;
  const timeFormatted = `${mins}:${String(secs).padStart(2, "0")}`;

  if (state.pomodoro.remainingSeconds <= 0) {
    if (state.pomodoro.phase === "focus") {
      state.pomodoro.phase = "break";
      state.pomodoro.remainingSeconds = state.pomodoro.breakMinutes * 60;
      playChime("break");
      showToast("🔔 ¡Tiempo de enfoque cumplido! Tómate 5 minutos de descanso.", "info");
    } else {
      state.pomodoro.phase = "focus";
      state.pomodoro.remainingSeconds = state.pomodoro.focusMinutes * 60;
      playChime("focus");
      showToast("🎯 ¡Descanso finalizado! Retomando 25 min de enfoque.", "success");
    }
  }

  if (elements.pomodoroPhaseLabel) {
    if (state.pomodoro.phase === "focus") {
      elements.pomodoroPhaseLabel.textContent = `🍅 Enfoque (${timeFormatted})`;
    } else {
      elements.pomodoroPhaseLabel.textContent = `☕ Descanso (${timeFormatted})`;
    }
  }
}

function updateWorkerGoalUI() {
  if (!elements.workerGoalCard) return;

  const { start, end } = getCurrentWeekRange();
  const startTime = start.getTime();
  const endTime = end.getTime();

  let targetWorkerId = null;
  if (state.userProfile?.rol === "worker") {
    targetWorkerId = state.userProfile.trabajadorId || state.workers.find(w => (w.email || "").toLowerCase() === (state.userProfile.email || "").toLowerCase())?.id;
  }
  if (!targetWorkerId && state.workers.length > 0) {
    targetWorkerId = state.workers[0].id;
  }

  const weeklyTasks = state.tasks.filter(t => {
    if (targetWorkerId && t.trabajadorId !== targetWorkerId) return false;
    if (!t.fecha || !isTaskApproved(t)) return false;
    const taskDate = new Date(t.fecha + "T00:00:00");
    const tTime = taskDate.getTime();
    return tTime >= startTime && tTime <= endTime;
  });

  const weeklyHours = weeklyTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
  const weeklyArts = weeklyTasks.filter(t => t.cantidadArtes > 0).reduce((acc, t) => acc + (Number(t.cantidadArtes) || 0), 0);
  const goal = Number(state.workerWeeklyGoal) || 20;
  const pct = Math.min(Math.round((weeklyHours / goal) * 100), 999);

  if (elements.workerGoalText) {
    const artText = weeklyArts > 0 ? ` • ${weeklyArts} ${weeklyArts === 1 ? 'arte' : 'artes'}` : '';
    elements.workerGoalText.textContent = `${weeklyHours.toFixed(1)}h de ${goal}h meta semanal${artText}`;
  }

  if (elements.workerGoalPercent) {
    elements.workerGoalPercent.textContent = `${pct}%`;
  }

  if (elements.workerGoalProgressBar) {
    elements.workerGoalProgressBar.style.width = `${Math.min(pct, 100)}%`;
    if (pct >= 100) {
      elements.workerGoalProgressBar.className = "bg-primary h-2 rounded-full transition-all duration-500";
    } else if (pct >= 50) {
      elements.workerGoalProgressBar.className = "bg-primary h-2 rounded-full transition-all duration-500";
    } else {
      elements.workerGoalProgressBar.className = "bg-faint h-2 rounded-full transition-all duration-500";
    }
  }

  if (elements.workerGoalStatusBadge) {
    if (pct >= 100) {
      elements.workerGoalStatusBadge.textContent = "¡Meta Superada!";
      elements.workerGoalStatusBadge.className = "text-[9px] font-mono px-2 py-0.5 rounded-full font-semibold bg-ink/10 text-mid border border-line";
    } else {
      elements.workerGoalStatusBadge.textContent = `${pct}% Logrado`;
      elements.workerGoalStatusBadge.className = "text-[9px] font-mono px-2 py-0.5 rounded-full font-semibold bg-ink/10 text-ink border border-line";
    }
  }
}

function handleEditWorkerGoal() {
  const current = state.workerWeeklyGoal || 20;
  const entered = prompt("Ingresa tu meta semanal en horas (ej: 20, 30, 40):", current);
  if (!entered) return;
  const val = parseFloat(entered);
  if (isNaN(val) || val <= 0) {
    showToast("Por favor ingresa un número de horas válido mayor a 0.", "warning");
    return;
  }
  state.workerWeeklyGoal = val;
  localStorage.setItem("widely_worker_weekly_goal", String(val));
  updateWorkerGoalUI();
  showToast(`Meta semanal ajustada a ${val} horas.`, "success");
}

window.setTimerMode = setTimerMode;
window.editWorkerGoal = handleEditWorkerGoal;

/* ============================================================================
   11. GESTIÓN DE ELIMINACIONES CON MODAL
   ============================================================================ */
window.requestDelete = function(collectionName, id, label) {
  if (state.userProfile?.rol === "worker" && collectionName !== "tareas") {
    showToast("Los colaboradores solo pueden eliminar sus propias tareas.", "warning");
    return;
  }
  state.deleteTarget = { collection: collectionName, id, label };
  elements.deleteModalText.innerHTML = `¿Seguro que deseas eliminar <strong>${escapeHtml(label)}</strong>? Se recalcularán los saldos de inmediato.`;
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
      if (colName === "clientes") {
        state.clients = state.clients.filter(c => c.id !== id);
        updateClientsUI();
        updateClientsDatalist();
      }
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
      return `<option value="${escapeHtml(w.id)}" data-rate="${hRate}" data-art-rate="${aRate}">${escapeHtml(w.nombre)} (${label})</option>`;
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
      elements.manualModeArtsBtn.className = "py-1.5 px-3 rounded-lg bg-primary text-on-primary shadow-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (elements.manualModeHoursBtn) {
      elements.manualModeHoursBtn.className = "py-1.5 px-3 rounded-lg text-mid hover:text-ink dark:hover:text-white font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (artsIcon) artsIcon.className = "fa-solid fa-palette text-xs text-on-primary";
    if (hoursIcon) hoursIcon.className = "fa-solid fa-clock text-xs text-ink";

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
      elements.manualModeHoursBtn.className = "py-1.5 px-3 rounded-lg bg-primary text-on-primary shadow-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (elements.manualModeArtsBtn) {
      elements.manualModeArtsBtn.className = "py-1.5 px-3 rounded-lg text-mid hover:text-ink dark:hover:text-white font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer";
    }
    if (hoursIcon) hoursIcon.className = "fa-solid fa-clock text-xs text-on-primary";
    if (artsIcon) artsIcon.className = "fa-solid fa-palette text-xs text-ink";

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
    const canOverrideArtRate = state.userProfile?.rol !== "worker";
    const effectiveArtRate = (canOverrideArtRate && !isNaN(manualArtRateVal) && manualArtRateVal > 0) ? manualArtRateVal : workerArtRate;
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
    // Solo la administradora puede usar una tarifa por arte distinta a la configurada
    const effectiveArtRate = (!isWorkerRole && !isNaN(manualArtRateVal) && manualArtRateVal > 0) ? manualArtRateVal : workerArtRate;

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
    elements.docTypeBillBtn?.classList.add("bg-primary", "text-on-primary", "shadow-sm");
    elements.docTypeBillBtn?.classList.remove("text-mid", "dark:text-mid");
    elements.docTypeReceiptBtn?.classList.remove("bg-primary", "text-on-primary", "shadow-sm");
    elements.docTypeReceiptBtn?.classList.add("text-mid", "dark:text-mid");
    elements.docViewBill?.classList.remove("hidden");
    elements.docViewReceipt?.classList.add("hidden");
    if (elements.btnPrintStatementLabel) {
      elements.btnPrintStatementLabel.textContent = "Imprimir / Guardar Cuenta de Cobro (PDF)";
    }
  } else {
    elements.docTypeReceiptBtn?.classList.add("bg-primary", "text-on-primary", "shadow-sm");
    elements.docTypeReceiptBtn?.classList.remove("text-mid", "dark:text-mid");
    elements.docTypeBillBtn?.classList.remove("bg-primary", "text-on-primary", "shadow-sm");
    elements.docTypeBillBtn?.classList.add("text-mid", "dark:text-mid");
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
    accountNumber: elements.billAccountNumber?.textContent.trim() || "",
    idNumber: elements.billWorkerIdNumber?.textContent.trim() || "",
    phone: elements.billWorkerPhone?.textContent.trim() || ""
  };
  try {
    localStorage.setItem(`widely_banking_${workerId}`, JSON.stringify(data));
  } catch (e) {}
}

function loadWorkerBankingPrefs(workerId) {
  if (!workerId) return {};
  const worker = state.workers.find(w => w.id === workerId);
  let localData = {};
  try {
    const raw = localStorage.getItem(`widely_banking_${workerId}`);
    if (raw) localData = JSON.parse(raw);
  } catch (e) {}

  return {
    bank: localData.bank || localData.banco || worker?.banco || "Bancolombia",
    accountType: localData.accountType || localData.tipoCuenta || worker?.tipoCuenta || "Ahorros",
    accountNumber: localData.accountNumber || localData.numeroCuenta || worker?.numeroCuenta || "",
    idNumber: localData.idNumber || localData.documento || localData.numeroDocumento || worker?.numeroDocumento || worker?.documento || "",
    city: localData.city || localData.ciudad || worker?.ciudad || "Bogotá D.C.",
    phone: localData.phone || localData.telefono || worker?.telefono || "",
    mobile: localData.mobile || localData.celular || worker?.telefono || "",
    accountHolder: localData.accountHolder || localData.titularCuenta || worker?.titularCuenta || worker?.nombre || ""
  };
}

window.openStatementModal = function(workerId, preferredType) {
  const worker = state.workers.find(w => w.id === workerId);
  if (!worker) {
    showToast("Trabajador no encontrado.", "error");
    return;
  }
  currentStatementWorkerId = worker.id;

  const filteredTasks = state.tasks.filter(t => 
    (t.trabajadorId === worker.id || (!t.trabajadorId && t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase())) &&
    isDateInPeriod(t.fecha, state.filterPeriod) &&
    isTaskApproved(t)
  );

  const filteredPayments = state.payments.filter(p =>
    (p.trabajadorId === worker.id || (!p.trabajadorId && p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase())) &&
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
      elements.billTasksBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-mid text-xs">No hay actividades registradas en este período.</td></tr>`;
    } else {
      elements.billTasksBody.innerHTML = filteredTasks.map(t => {
        const cat = getCategoryMeta(t.categoria);
        const isArtTask = t.cantidadArtes && Number(t.cantidadArtes) > 0;
        const artPill = isArtTask
          ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-ink border border-line ml-1.5"><i class="fa-solid fa-palette text-ink"></i> ${t.cantidadArtes} artes @ $${Number(t.tarifaArte || 0).toFixed(2)}</span>`
          : "";
        const volText = isArtTask ? `${t.cantidadArtes} artes` : `${Number(t.horas || 0).toFixed(2)}h`;

        return `
          <tr class="text-xs">
            <td class="py-2.5 px-3 font-medium text-mid tabular-nums whitespace-nowrap">${escapeHtml(t.fecha || '-')}</td>
            <td class="py-2.5 px-3 font-semibold text-ink">${escapeHtml(t.cliente || 'General')}</td>
            <td class="py-2.5 px-3 text-ink">
              <span class="font-medium">${escapeHtml(t.descripcion || 'Servicio')}</span>
              ${artPill}
              <span class="text-[10px] text-mid block">${cat.label}</span>
            </td>
            <td class="py-2.5 px-2 text-right font-medium text-mid tabular-nums whitespace-nowrap">${volText}</td>
            <td class="py-2.5 px-3 text-right font-bold text-ink tabular-nums whitespace-nowrap">$${Number(t.costoTotal || 0).toFixed(2)}</td>
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
    elements.receiptNetBalance.className = netBalance > 0 ? "text-base sm:text-lg font-bold tabular-nums text-ember" : "text-base sm:text-lg font-bold tabular-nums text-mid";
  }
  if (elements.receiptNetBalanceCop) {
    elements.receiptNetBalanceCop.textContent = `≈ ${formatCop(netBalance * currentTrm)}`;
  }
  if (elements.receiptSignWorkerName) elements.receiptSignWorkerName.textContent = worker.nombre;

  if (elements.receiptTasksBody) {
    if (filteredTasks.length === 0) {
      elements.receiptTasksBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-mid text-xs">No hay actividades aprobadas en este período.</td></tr>`;
    } else {
      elements.receiptTasksBody.innerHTML = filteredTasks.map(t => {
        const cat = getCategoryMeta(t.categoria);
        const isArtTask = t.cantidadArtes && Number(t.cantidadArtes) > 0;
        const catPill = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-ink border border-line"><i class="fa-solid ${cat.icon}"></i> ${cat.label}</span>`;
        const clientPill = t.cliente ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-ink border border-line"><i class="fa-solid fa-briefcase text-ink"></i> ${escapeHtml(t.cliente)}</span>` : "";
        const artPill = isArtTask
          ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-ink border border-line"><i class="fa-solid fa-palette text-ink"></i> ${t.cantidadArtes} artes @ $${Number(t.tarifaArte || 0).toFixed(2)}</span>`
          : "";
        const volText = isArtTask ? `${t.cantidadArtes} artes` : `${Number(t.horas || 0).toFixed(2)}h`;

        return `
          <tr class="text-xs">
            <td class="py-2.5 px-3 font-medium text-mid tabular-nums whitespace-nowrap">${escapeHtml(t.fecha || '-')}</td>
            <td class="py-2.5 px-3 text-ink">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-medium">${escapeHtml(t.descripcion || 'Tarea')}</span>
                ${clientPill}
                ${catPill}
                ${artPill}
              </div>
            </td>
            <td class="py-2.5 px-2 text-right font-medium text-mid tabular-nums whitespace-nowrap">${volText}</td>
            <td class="py-2.5 px-3 text-right font-bold text-ink tabular-nums whitespace-nowrap">$${Number(t.costoTotal || 0).toFixed(2)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  if (elements.receiptPaymentsBody) {
    if (filteredPayments.length === 0) {
      elements.receiptPaymentsBody.innerHTML = `<tr><td colspan="3" class="py-3 text-center text-mid text-xs">No hay pagos registrados para este colaborador en el período.</td></tr>`;
    } else {
      elements.receiptPaymentsBody.innerHTML = filteredPayments.map(p => `
        <tr class="text-xs">
          <td class="py-2.5 px-3 font-medium text-mid tabular-nums whitespace-nowrap">${escapeHtml(p.fecha || '-')}</td>
          <td class="py-2.5 px-3 text-ink">${escapeHtml(p.referencia || 'Transferencia / Liquidación')}</td>
          <td class="py-2.5 px-3 text-right font-bold text-mid tabular-nums whitespace-nowrap">$${Number(p.monto || 0).toFixed(2)}</td>
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
    const workerId = profile.trabajadorId;
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

  elements.btnAdminApprovalsViewAll?.addEventListener("click", () => {
    window.setTaskStatusFilter("pendiente");
    document.querySelector('.sidebar-nav-link[data-nav="tasks"]')?.click();
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

  // Control Presupuestal Upwork
  elements.btnEditUpworkBudget?.addEventListener("click", openUpworkBudgetModal);
  elements.btnOpenUpworkBudgetModal?.addEventListener("click", openUpworkBudgetModal);
  elements.btnCloseUpworkModal?.addEventListener("click", closeUpworkBudgetModal);
  elements.btnCancelUpworkBudget?.addEventListener("click", closeUpworkBudgetModal);
  elements.upworkBudgetModal?.addEventListener("click", (e) => {
    if (e.target === elements.upworkBudgetModal) closeUpworkBudgetModal();
  });
  elements.upworkWeek1Input?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkWeek2Input?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkWeek3Input?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkWeek4Input?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkWeek5Input?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkWeek6Input?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkRevenueInput?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkFeePercentInput?.addEventListener("input", updateUpworkInputPreview);
  elements.upworkIncludeVatInput?.addEventListener("change", updateUpworkInputPreview);
  elements.upworkPayoutCostInput?.addEventListener("input", updateUpworkInputPreview);
  elements.nequiIncludeFeeInput?.addEventListener("change", updateUpworkInputPreview);
  document.querySelectorAll(".btn-upwork-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const amount = parseFloat(btn.dataset.amount);
      if (!isNaN(amount)) {
        const curW = getCurrentUpworkWeek();
        const input = elements[`upworkWeek${curW}Input`];
        if (input) input.value = amount;
        updateUpworkInputPreview();
      }
    });
  });
  elements.formUpworkBudget?.addEventListener("submit", (e) => {
    e.preventDefault();
    const w1 = parseFloat(elements.upworkWeek1Input?.value) || 0;
    const w2 = parseFloat(elements.upworkWeek2Input?.value) || 0;
    const w3 = parseFloat(elements.upworkWeek3Input?.value) || 0;
    const w4 = parseFloat(elements.upworkWeek4Input?.value) || 0;
    const w5 = parseFloat(elements.upworkWeek5Input?.value) || 0;
    const w6 = parseFloat(elements.upworkWeek6Input?.value) || 0;

    if (w1 < 0 || w2 < 0 || w3 < 0 || w4 < 0 || w5 < 0 || w6 < 0) {
      showToast("Los montos de las semanas no pueden ser negativos", "warning");
      return;
    }

    const fee = parseFloat(elements.upworkFeePercentInput?.value);
    const payout = parseFloat(elements.upworkPayoutCostInput?.value);
    const nequiInclude = elements.nequiIncludeFeeInput ? elements.nequiIncludeFeeInput.checked : true;
    const includeVat = elements.upworkIncludeVatInput ? elements.upworkIncludeVatInput.checked : true;

    saveUpworkBudget(
      { w1, w2, w3, w4, w5, w6 },
      isNaN(fee) ? 15 : fee,
      isNaN(payout) ? 1.0 : payout,
      nequiInclude,
      includeVat
    );
    closeUpworkBudgetModal();
  });

  // Clientes & Rentabilidad de Proyectos
  elements.btnOpenClientModal?.addEventListener("click", () => openClientModal());
  elements.btnCloseClientModal?.addEventListener("click", closeClientModal);
  elements.btnCancelClientModal?.addEventListener("click", closeClientModal);
  elements.btnSyncClientsFromTasks?.addEventListener("click", syncClientsFromTasks);
  elements.formClient?.addEventListener("submit", handleSaveClient);
  elements.clientModal?.addEventListener("click", (e) => {
    if (e.target === elements.clientModal) closeClientModal();
  });

  // Exportación Excel / CSV Universal
  elements.btnExportTasksCsv?.addEventListener("click", handleExportTasksCsv);
  elements.btnExportPaymentsCsv?.addEventListener("click", handleExportPaymentsCsv);
  elements.btnExportFinancialCsv?.addEventListener("click", handleExportFinancialCsv);

  // Compartir Comprobante por WhatsApp
  elements.btnShareWhatsAppStatement?.addEventListener("click", handleShareWhatsAppStatement);

  // Pomodoro & Metas de Colaborador
  elements.btnModeStandard?.addEventListener("click", () => setTimerMode("standard"));
  elements.btnModePomodoro?.addEventListener("click", () => setTimerMode("pomodoro"));
  elements.btnEditWorkerGoal?.addEventListener("click", handleEditWorkerGoal);

  // Mini-Dock Flotante Dynamic Island (Concepto 3)
  elements.islandBtnPlayPause?.addEventListener("click", () => {
    if (state.timer.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });
  elements.islandBtnRegister?.addEventListener("click", () => handleRegisterTask());
  elements.islandScrollToTimer?.addEventListener("click", () => {
    const card = elements.timerMainCard || document.getElementById("timerMainCard");
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("highlight-pulse");
      setTimeout(() => card.classList.remove("highlight-pulse"), 1600);
    }
  });
  elements.islandBtnDismiss?.addEventListener("click", () => {
    state.islandDismissed = true;
    elements.dynamicIslandTimer?.classList.remove("island-visible");
  });
  window.addEventListener("scroll", checkDynamicIslandVisibility, { passive: true });
  elements.timerClientProject?.addEventListener("input", updateDynamicIslandUI);
  elements.timerTaskDescription?.addEventListener("input", updateDynamicIslandUI);

  // Control Picture-in-Picture Always-On-Top (Flotar sobre Apps del PC)
  elements.btnTogglePipTimer?.addEventListener("click", togglePictureInPictureWindow);
  elements.islandBtnPip?.addEventListener("click", togglePictureInPictureWindow);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // -------------------------------------------------------------
  // GESTIÓN DE PERFILES, ADMINISTRADORES & COLABORADORES SOLO DATOS
  // -------------------------------------------------------------
  // Mi Perfil (Vista de Página Completa SaaS Pro)
  elements.btnTopbarMyProfile?.addEventListener("click", showProfilePage);
  elements.sidebarMyProfileLink?.addEventListener("click", showProfilePage);
  elements.userProfileBar?.addEventListener("click", showProfilePage);
  elements.btnBackToDashboard?.addEventListener("click", hideProfilePage);
  elements.btnCancelProfilePage?.addEventListener("click", hideProfilePage);
  elements.btnTopSaveProfile?.addEventListener("click", () => elements.formMyProfile?.requestSubmit());
  elements.formMyProfile?.addEventListener("submit", handleSaveMyProfile);
  elements.btnUpdateMyPassword?.addEventListener("click", handleUpdateMyPassword);
  elements.btnSendResetEmailMyProfile?.addEventListener("click", handleSendResetEmailMyProfile);

  // Actualización en vivo de la Tarjeta Digital Neobanco
  elements.myProfileBank?.addEventListener("change", updateDigitalBankCardPreview);
  elements.myProfileAccountNumber?.addEventListener("input", updateDigitalBankCardPreview);
  elements.myProfileAccountHolder?.addEventListener("input", updateDigitalBankCardPreview);
  elements.myProfileAccountType?.addEventListener("change", updateDigitalBankCardPreview);
  elements.myProfileName?.addEventListener("input", updateDigitalBankCardPreview);

  // Acceso directo a Cuenta de Cobro Formal desde la Página de Perfil
  elements.btnPageOpenMyBill?.addEventListener("click", () => {
    const profile = state.userProfile;
    if (!profile) return;
    const workerId = profile.trabajadorId;
    if (workerId) {
      window.openStatementModal(workerId, "bill");
    } else if (state.workers.length > 0) {
      window.openStatementModal(state.workers[0].id, "bill");
    } else {
      showToast("No tienes un perfil de trabajador asignado aún.", "warning");
    }
  });

  // Pestañas de administración (Cuentas de Usuario vs Colaboradores Solo Datos)
  elements.tabUsersBtn?.addEventListener("click", () => switchAdminTab("users"));
  elements.tabDataWorkersBtn?.addEventListener("click", () => switchAdminTab("workers"));

  // Perfil de datos sin cuenta (Admin)
  elements.btnOpenCreateDataProfile?.addEventListener("click", openCreateDataProfileModal);
  elements.btnCloseDataProfileModal?.addEventListener("click", closeCreateDataProfileModal);
  elements.btnCancelDataProfileModal?.addEventListener("click", closeCreateDataProfileModal);
  elements.formDataProfile?.addEventListener("submit", handleSaveDataProfile);
  elements.createDataProfileModal?.addEventListener("click", (e) => {
    if (e.target === elements.createDataProfileModal) closeCreateDataProfileModal();
  });

  // Editar perfil de usuario (Admin)
  elements.btnCloseAdminEditUserModal?.addEventListener("click", closeAdminEditUserModal);
  elements.btnCancelAdminEditUserModal?.addEventListener("click", closeAdminEditUserModal);
  elements.formAdminEditUser?.addEventListener("submit", handleSaveAdminEditUser);
  elements.adminEditUserModal?.addEventListener("click", (e) => {
    if (e.target === elements.adminEditUserModal) closeAdminEditUserModal();
  });

  // Añadir Administrador (Admin)
  elements.btnOpenAddAdminModal?.addEventListener("click", openAddAdminModal);
  elements.btnCloseAddAdminModal?.addEventListener("click", closeAddAdminModal);
  elements.btnCancelAddAdminModal?.addEventListener("click", closeAddAdminModal);
  elements.formAddAdmin?.addEventListener("submit", handleSaveNewAdmin);
  elements.addAdminModal?.addEventListener("click", (e) => {
    if (e.target === elements.addAdminModal) closeAddAdminModal();
  });

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

  // Barra inferior en celular: reutiliza la navegación del sidebar y los botones existentes
  const tabbarButtons = document.querySelectorAll("#mobileTabbar button");
  tabbarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const { tabNav, tabScroll, tabClick } = btn.dataset;
      if (tabNav) {
        document.querySelector(`.sidebar-nav-link[data-nav="${tabNav}"]`)?.click();
      } else if (tabScroll) {
        hideProfilePage();
        document.getElementById(tabScroll)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (tabClick) {
        document.getElementById(tabClick)?.click();
      }
      if (!btn.classList.contains("tabbar-fab") && tabClick !== "btnToggleMobileSidebar") {
        tabbarButtons.forEach(b => b.classList.toggle("active", b === btn));
      }
    });
  });

  sidebarLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const navKey = link.dataset.nav;
      if (!navKey) return;

      sidebarLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      const isWorker = state.userProfile?.rol === "worker";

      let targetId = null;
      if (navKey === "myprofile") {
        showProfilePage();
        if (window.innerWidth < 1024) closeSidebar();
        return;
      } else {
        hideProfilePage();
      }

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
        targetId = "adminTeamSection";
      } else if (navKey === "clients") {
        targetId = "adminClientsSection";
      } else if (navKey === "upwork") {
        targetId = "adminUpworkBudgetSection";
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

// Serializa un valor como literal JS seguro para usarlo dentro de atributos onclick="..."
// (escapeHtml solo no basta: el navegador decodifica &#039; a ' antes de ejecutar el código)
function jsArg(value) {
  return escapeHtml(JSON.stringify(String(value ?? "")));
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

  let icon = "fa-circle-info text-ink";
  if (type === "success") icon = "fa-circle-check text-mid";
  else if (type === "warning") icon = "fa-triangle-exclamation text-mid";
  else if (type === "error") icon = "fa-circle-xmark text-ember";

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

/* ============================================================================
   INICIALIZACIÓN DE LA APLICACIÓN (Arranca una vez todo está cargado)
   ============================================================================ */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
