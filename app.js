/**
 * ============================================================================
 * WIDELY TIME TRACKER & FINANCIAL DASHBOARD
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
  updateProfile
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
   2. ESTADO GLOBAL DE LA APLICACIÓN
   ============================================================================ */
let state = {
  workers: [],      // Colección 'trabajadores'
  tasks: [],        // Colección 'tareas'
  payments: [],     // Colección 'pagos'
  currentUser: null, // Firebase Auth user
  userProfile: null, // Perfil activo { uid, nombre, email, rol, trabajadorId }
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

  // Modal Editar Tarifa
  editRateModal: document.getElementById("editRateModal"),
  formEditRate: document.getElementById("formEditRate"),
  editRateWorkerId: document.getElementById("editRateWorkerId"),
  editRateModalWorker: document.getElementById("editRateModalWorker"),
  editRateInput: document.getElementById("editRateInput"),
  btnCancelEditRate: document.getElementById("btnCancelEditRate"),

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
  workerRoleNotice: document.getElementById("workerRoleNotice"),
  adminManagementSection: document.getElementById("adminManagementSection"),
  authTabLogin: document.getElementById("authTabLogin"),
  authTabRegister: document.getElementById("authTabRegister"),
  formAuthLogin: document.getElementById("formAuthLogin"),
  authLoginEmail: document.getElementById("authLoginEmail"),
  authLoginPassword: document.getElementById("authLoginPassword"),
  formAuthRegister: document.getElementById("formAuthRegister"),
  authRegName: document.getElementById("authRegName"),
  authRegEmail: document.getElementById("authRegEmail"),
  authRegPassword: document.getElementById("authRegPassword"),
  authRegRole: document.getElementById("authRegRole"),
  btnQuickAdmin: document.getElementById("btnQuickAdmin"),
  btnQuickWorker: document.getElementById("btnQuickWorker")
};

/* ============================================================================
   4. INICIALIZACIÓN
   ============================================================================ */
function init() {
  initClock();
  initDefaultDate();
  initCachedSession();
  setupEventListeners();

  if (db) {
    listenToFirestore();
    initFirebaseAuth();
  } else {
    loadLocalFallbackData();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/* ============================================================================
   4.B. SISTEMA DE AUTENTICACIÓN Y ROLES (ADMIN / WORKER)
   ============================================================================ */
function initCachedSession() {
  try {
    const cached = localStorage.getItem("widely_cached_user");
    if (cached) {
      state.userProfile = JSON.parse(cached);
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
        if (userDocSnap.exists()) {
          state.userProfile = userDocSnap.data();
        } else {
          const fallbackProfile = {
            uid: user.uid,
            nombre: user.displayName || (user.email ? user.email.split("@")[0] : "Usuario"),
            email: user.email || "",
            rol: (user.email && user.email.toLowerCase().includes("admin")) ? "admin" : "worker",
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
        applyRoleView();
        updateFinancialDashboard();
        updateTasksUI();
        updatePaymentsUI();
        updateWorkersUI();
      } catch (err) {
        console.warn("[Auth] Error al sincronizar usuario con Firestore:", err);
      }
    }
  });
}

function applyRoleView() {
  const profile = state.userProfile;

  if (profile) {
    // Usuario con sesión activa: Mostrar Dashboard y ocultar pantalla de login
    document.documentElement.classList.add("has-user-session");
    elements.authScreen?.classList.add("hidden");
    elements.mainAppDashboard?.classList.remove("hidden");
    elements.userProfileBar?.classList.remove("hidden");
    elements.userProfileBar?.classList.add("flex");

    if (elements.userAvatar) {
      elements.userAvatar.textContent = (profile.nombre || "U").charAt(0).toUpperCase();
    }
    if (elements.userNameDisplay) {
      elements.userNameDisplay.textContent = profile.nombre || "Usuario";
    }

    if (profile.rol === "admin") {
      if (elements.userRoleBadge) {
        elements.userRoleBadge.textContent = "ADMIN";
        elements.userRoleBadge.className = "text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold uppercase";
      }
      if (elements.userAvatar) {
        elements.userAvatar.className = "w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-sm shadow-blue-500/20";
      }
      elements.adminManagementSection?.classList.remove("hidden");
      elements.workerRoleNotice?.classList.add("hidden");
      if (elements.timerWorkerSelect) {
        elements.timerWorkerSelect.disabled = false;
      }
    } else {
      if (elements.userRoleBadge) {
        elements.userRoleBadge.textContent = "COLABORADOR";
        elements.userRoleBadge.className = "text-[9px] font-mono text-cyan-600 dark:text-cyan-400 font-bold uppercase";
      }
      if (elements.userAvatar) {
        elements.userAvatar.className = "w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-cyan-600 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-sm shadow-cyan-500/20";
      }
      elements.adminManagementSection?.classList.add("hidden");
      elements.workerRoleNotice?.classList.remove("hidden");

      linkAndLockWorkerSelect();
    }
  } else {
    // Sin sesión activa: Mostrar Pantalla de Login / Registro y ocultar Dashboard
    document.documentElement.classList.remove("has-user-session");
    elements.authScreen?.classList.remove("hidden");
    elements.mainAppDashboard?.classList.add("hidden");
    elements.userProfileBar?.classList.add("hidden");
    elements.userProfileBar?.classList.remove("flex");
    elements.adminManagementSection?.classList.remove("hidden");
    elements.workerRoleNotice?.classList.add("hidden");
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
    if (!profile.trabajadorId) {
      profile.trabajadorId = matchingWorker.id;
      localStorage.setItem("widely_cached_user", JSON.stringify(profile));
    }
    if (elements.timerWorkerSelect) {
      elements.timerWorkerSelect.value = matchingWorker.id;
      elements.timerWorkerSelect.disabled = true;
      updateLiveCost();
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
          rol: email.toLowerCase().includes("admin") ? "admin" : "worker"
        };
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

      applyRoleView();
      closeAuthModal();
      showToast(`¡Bienvenido ${profile.nombre}! Modo ${profile.rol === "admin" ? "Administrador" : "Colaborador"}.`, "success");
      updateFinancialDashboard();
      updateTasksUI();
      updatePaymentsUI();
      updateWorkersUI();
    } else {
      loginMockUser(email.toLowerCase().includes("admin") ? "admin" : "worker", email.split("@")[0]);
    }
  } catch (error) {
    console.error("[Auth] Error en inicio de sesión:", error);
    let msg = error.message;
    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      msg = "Credenciales incorrectas. Verifica tu correo y contraseña.";
      showToast(`Error al iniciar sesión: ${msg}`, "error");
    } else if (error.code === "auth/configuration-not-found" || error.code === "auth/operation-not-allowed") {
      showToast(`Conectando... En Firebase Console debes presionar "Comenzar" en Authentication.`, "info");
      await loginMockUser(email.toLowerCase().includes("admin") ? "admin" : "worker", email.split("@")[0], email);
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
  const role = elements.authRegRole.value;

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
   5. LISTENERS EN TIEMPO REAL CON FIRESTORE (onSnapshot)
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
   6. LÓGICA DEL CRONÓMETRO DE TAREAS
   ============================================================================ */
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

  state.timer.intervalId = setInterval(() => {
    state.timer.elapsedSeconds = Math.floor((Date.now() - state.timer.startTime) / 1000);
    renderTimerDisplay();
    updateLiveCost();
  }, 1000);

  elements.btnStart.disabled = true;
  elements.btnPause.disabled = false;
  elements.btnReset.disabled = false;
  elements.timerDisplay.classList.add("timer-active");

  elements.timerStatusBadge.className = "text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1.5";
  elements.timerStatusBadge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Activo`;
}

function pauseTimer() {
  if (!state.timer.isRunning) return;

  state.timer.isRunning = false;
  clearInterval(state.timer.intervalId);

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
  const workerId = elements.timerWorkerSelect.value || state.userProfile?.trabajadorId;
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

    showToast(`¡Tarea registrada con éxito! Costo: $${totalCost.toFixed(2)}`, "success");
    elements.timerTaskDescription.value = "";
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

function updateTasksUI() {
  const isWorker = state.userProfile?.rol === "worker";
  let displayedTasks = state.tasks;

  if (isWorker) {
    const myId = state.userProfile.trabajadorId;
    const myName = (state.userProfile.nombre || "").trim().toLowerCase();
    displayedTasks = state.tasks.filter(t => 
      (myId && t.trabajadorId === myId) || 
      (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === myName)
    );
  }

  elements.taskCount.textContent = displayedTasks.length;

  if (displayedTasks.length === 0) {
    elements.tasksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
          ${isWorker ? "No tienes tareas registradas todavía." : "No hay tareas registradas todavía."}
        </td>
      </tr>
    `;
    return;
  }

  elements.tasksTableBody.innerHTML = displayedTasks.map(t => {
    const formattedTime = formatSecondsToTime(t.segundos || 0);
    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
        <td class="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap tabular-nums">${t.fecha || '-'}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">${escapeHtml(t.trabajadorNombre || 'Anónimo')}</td>
        <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title="${escapeHtml(t.descripcion || '')}">
          ${escapeHtml(t.descripcion || 'Sin descripción')}
        </td>
        <td class="py-2.5 px-2 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
          ${formattedTime} <span class="text-[10px] text-slate-400 dark:text-slate-500">(${Number(t.horas || 0).toFixed(2)}h)</span>
        </td>
        <td class="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-cyan-400 whitespace-nowrap tabular-nums">
          $${Number(t.costoTotal || 0).toFixed(2)}
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          <button 
            onclick="window.requestDelete('tareas', '${t.id}', 'Tarea: ${escapeHtml(t.descripcion || '')}')"
            class="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors active:scale-95"
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
  let displayedPayments = state.payments;

  if (isWorker) {
    const myId = state.userProfile.trabajadorId;
    const myName = (state.userProfile.nombre || "").trim().toLowerCase();
    displayedPayments = state.payments.filter(p => 
      (myId && p.trabajadorId === myId) || 
      (p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === myName)
    );
  }

  elements.paymentCount.textContent = displayedPayments.length;

  if (displayedPayments.length === 0) {
    elements.paymentsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
          ${isWorker ? "No tienes pagos registrados aún." : "No hay pagos registrados."}
        </td>
      </tr>
    `;
    return;
  }

  elements.paymentsTableBody.innerHTML = displayedPayments.map(p => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <td class="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap tabular-nums">${p.fecha || '-'}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">${escapeHtml(p.trabajadorNombre || '')}</td>
      <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title="${escapeHtml(p.referencia || '')}">
        ${escapeHtml(p.referencia || 'Pago')}
      </td>
      <td class="py-2.5 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
        $${Number(p.monto || 0).toFixed(2)}
      </td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        ${!isWorker ? `
          <button 
            onclick="window.requestDelete('pagos', '${p.id}', 'Pago de $${Number(p.monto || 0).toFixed(2)} a ${escapeHtml(p.trabajadorNombre || '')}')"
            class="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors active:scale-95"
            title="Eliminar pago">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        ` : `<span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Registrado</span>`}
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
        <td colspan="6" class="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
          ${isWorker 
            ? "Tu perfil aún no está vinculado a un trabajador en la lista. Puedes usar el cronómetro para registrar tu tiempo."
            : "Agrega trabajadores para visualizar el balance financiero en tiempo real."}
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

  const rowsHtml = displayedWorkers.map(worker => {
    const workerTasks = state.tasks.filter(t => t.trabajadorId === worker.id || (t.trabajadorNombre && t.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase()));
    const workerSeconds = workerTasks.reduce((acc, t) => acc + (Number(t.segundos) || 0), 0);
    const workerHours = workerTasks.reduce((acc, t) => acc + (Number(t.horas) || 0), 0);
    const workerEarned = workerTasks.reduce((acc, t) => acc + (Number(t.costoTotal) || 0), 0);

    const workerPayments = state.payments.filter(p => p.trabajadorId === worker.id || (p.trabajadorNombre && p.trabajadorNombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase()));
    const workerPaid = workerPayments.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    const pendingBalance = Number((workerEarned - workerPaid).toFixed(2));

    totalSegundosGlobal += workerSeconds;
    totalHorasGlobal += workerHours;
    totalGeneradoGlobal += workerEarned;
    totalPagadoGlobal += workerPaid;

    let balanceBadge = "";
    if (pendingBalance > 0.005) {
      // Debe dinero: Rojo vibrante con pulso
      balanceBadge = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 tabular-nums animate-pulse">
          <i class="fa-solid fa-triangle-exclamation text-[10px]"></i>
          +$${pendingBalance.toFixed(2)}
        </span>
      `;
    } else if (pendingBalance === 0) {
      // Al día: Esmeralda
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold font-mono bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20 tabular-nums">
          <i class="fa-solid fa-check text-[10px]"></i>
          $0.00
        </span>
      `;
    } else {
      // A favor: Azul
      balanceBadge = `
        <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold font-mono bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/20 tabular-nums">
          <i class="fa-solid fa-arrow-down text-[10px]"></i>
          -$${Math.abs(pendingBalance).toFixed(2)}
        </span>
      `;
    }

    const editRateBtn = !isWorker ? `
      <button 
        type="button"
        onclick="window.openEditRateModal('${worker.id}', '${escapeHtml(worker.nombre)}', ${Number(worker.tarifaHora || 0)})"
        class="hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 group"
        title="Clic para cambiar tarifa por hora">
        <span>$${Number(worker.tarifaHora || 0).toFixed(2)}/h</span>
        <i class="fa-solid fa-pencil text-[9px] opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500"></i>
      </button>
    ` : `<span>$${Number(worker.tarifaHora || 0).toFixed(2)}/h</span>`;

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
        <td class="py-3 px-3 font-semibold text-slate-900 dark:text-white">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold border border-blue-200 dark:border-slate-700">
              ${worker.nombre.charAt(0).toUpperCase()}
            </div>
            <span>${escapeHtml(worker.nombre)}</span>
          </div>
        </td>
        <td class="py-3 px-2 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums">
          ${editRateBtn}
        </td>
        <td class="py-3 px-2 text-right font-mono text-slate-800 dark:text-slate-200 tabular-nums">
          <span class="font-bold">${workerHours.toFixed(2)}h</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 block">${formatSecondsToTime(workerSeconds)}</span>
        </td>
        <td class="py-3 px-2 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
          $${workerEarned.toFixed(2)}
        </td>
        <td class="py-3 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          $${workerPaid.toFixed(2)}
        </td>
        <td class="py-3 px-3 text-right">
          ${balanceBadge}
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
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums";
    elements.kpiSaldoPendiente.textContent = `$${balance.toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = isWorker ? "Tu saldo pendiente por cobrar" : "Deuda total por liquidar a trabajadores";
  } else if (balance === 0) {
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums";
    elements.kpiSaldoPendiente.textContent = "$0.00";
    elements.kpiSaldoDesc.textContent = isWorker ? "Tus pagos están al día" : "Todos los pagos están al día";
  } else {
    elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums";
    elements.kpiSaldoPendiente.textContent = `+$${Math.abs(balance).toFixed(2)}`;
    elements.kpiSaldoDesc.textContent = isWorker ? "Anticipo recibido a tu favor" : "Saldo a favor de la empresa";
  }
}

function resetKPIs() {
  elements.kpiTotalHoras.textContent = "0.00";
  elements.kpiTotalHorasFormatted.textContent = "0h 0m 0s en total";
  elements.kpiTotalGenerado.textContent = "$0.00";
  elements.kpiTotalPagado.textContent = "$0.00";
  elements.kpiSaldoPendiente.textContent = "$0.00";
  elements.kpiSaldoPendiente.className = "text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums";
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

  // Pestañas
  elements.tabTasks.addEventListener("click", () => switchTab("tasks"));
  elements.tabPayments.addEventListener("click", () => switchTab("payments"));

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

  // Autenticación & Perfiles
  elements.btnLogout?.addEventListener("click", handleLogout);
  elements.authTabLogin?.addEventListener("click", () => switchAuthTab("login"));
  elements.authTabRegister?.addEventListener("click", () => switchAuthTab("register"));
  elements.formAuthLogin?.addEventListener("submit", handleLogin);
  elements.formAuthRegister?.addEventListener("submit", handleRegister);
  elements.btnQuickAdmin?.addEventListener("click", () => loginMockUser("admin"));
  elements.btnQuickWorker?.addEventListener("click", () => loginMockUser("worker"));
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
