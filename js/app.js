import * as api from "./api.js";

const appEl = document.getElementById("app");
const toastEl = document.getElementById("toast");

let session = null;
let profile = null;
let passwordRecoveryMode = false;
let calendarMonth = new Date(); // vista del calendario (mes actual por defecto)

// ============================================================================
// Utilidades
// ============================================================================

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg, isError) {
  toastEl.textContent = msg;
  toastEl.className = isError ? "show error" : "show";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (toastEl.className = ""), 3800);
}

function handleErr(err) {
  console.error(err);
  toast(err?.message || "Ocurrió un error.", true);
}

function fmtMoney(n, moneda = "GTQ") {
  const val = Number(n || 0);
  try {
    return new Intl.NumberFormat("es-GT", { style: "currency", currency: moneda }).format(val);
  } catch {
    return `Q${val.toFixed(2)}`;
  }
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T12:00:00" : "")) : d;
  return dt.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function businessDaysBetween(startISO, endISO) {
  const start = new Date(startISO + "T12:00:00");
  const end = new Date(endISO + "T12:00:00");
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function tiempoEnEmpresa(fechaIngreso, fechaEgreso) {
  if (!fechaIngreso) return "—";
  const start = new Date(fechaIngreso + "T12:00:00");
  const end = fechaEgreso ? new Date(fechaEgreso + "T12:00:00") : new Date();
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months--;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts = [];
  if (years) parts.push(`${years} año${years === 1 ? "" : "s"}`);
  parts.push(`${rem} mes${rem === 1 ? "" : "es"}`);
  return parts.join(", ");
}

function monthDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return { m: d.getMonth(), d: d.getDate() };
}

function pillEstado(estado) {
  const label = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado", listo: "Listo", validado: "Validado" }[estado] || estado;
  return `<span class="pill pill-${estado}">${escapeHtml(label)}</span>`;
}

function currentPeriodo() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtPeriodo(periodo) {
  const [y, m] = periodo.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-GT", { month: "long", year: "numeric" });
}

// Redondeo de horas extra: minutos después de la hora de salida programada.
// 0-24 min no cuenta, 25-45 min = 0.5h, 45+ min = 1h (y se repite el patrón
// por cada hora completa adicional).
function calcularHorasExtra(horaSalidaProgramada, horaSalidaReal) {
  if (!horaSalidaProgramada || !horaSalidaReal) return 0;
  const [ph, pm] = horaSalidaProgramada.split(":").map(Number);
  const [rh, rm] = horaSalidaReal.split(":").map(Number);
  const minutosExtra = rh * 60 + rm - (ph * 60 + pm);
  if (minutosExtra <= 0) return 0;
  const horasCompletas = Math.floor(minutosExtra / 60);
  const resto = minutosExtra % 60;
  let extra = horasCompletas;
  if (resto >= 45) extra += 1;
  else if (resto >= 25) extra += 0.5;
  return extra;
}

const MOTIVOS_VACACIONES = [
  "Vacaciones familiares",
  "Viaje o turismo",
  "Descanso personal",
  "Motivos de salud",
  "Trámites personales",
  "Motivos familiares",
  "Estudios o exámenes",
  "Otros",
];

// Regla de suspensión IGSS: el patrono paga el primer día de la suspensión y
// el IGSS paga el resto, así que en Planilla se debita (días - 1) por cada
// suspensión — pero solo se resta ese "primer día" una vez por suspensión,
// en el mes donde inició, no en cada mes que abarque.
function diasSuspendidosEnPeriodo(susp, periodo) {
  if (!susp.fecha_inicio || !susp.fecha_fin) return { dias: 0, esInicio: false };
  const [y, m] = periodo.split("-").map(Number);
  const inicioMes = new Date(y, m - 1, 1);
  const finMes = new Date(y, m, 0);
  const fi = new Date(susp.fecha_inicio + "T12:00:00");
  const ff = new Date(susp.fecha_fin + "T12:00:00");
  const desde = fi > inicioMes ? fi : inicioMes;
  const hasta = ff < finMes ? ff : finMes;
  if (desde > hasta) return { dias: 0, esInicio: false };
  const dias = Math.round((hasta - desde) / 86400000) + 1;
  const esInicio = fi.getFullYear() === y && fi.getMonth() === m - 1;
  return { dias, esInicio };
}

function calcularDebitoIgss(suspensiones, periodo, salarioBase) {
  let diasDebito = 0;
  for (const s of suspensiones || []) {
    if (!s.suspendido) continue;
    const { dias, esInicio } = diasSuspendidosEnPeriodo(s, periodo);
    if (dias <= 0) continue;
    diasDebito += esInicio ? Math.max(0, dias - 1) : dias;
  }
  const valorDia = Number(salarioBase || 0) / 30;
  return { diasDebito, monto: diasDebito * valorDia };
}

// Easter Sunday (algoritmo de Meeus/Jones/Butcher) — necesario para Jueves y
// Viernes Santo, que se mueven cada año.
function domingoDeResurreccion(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Feriados oficiales de Guatemala (Código de Trabajo art. 127) + 24/31 dic
// como medio día, de costumbre en la mayoría de empresas.
function getFeriadosGuatemala(year) {
  const pascua = domingoDeResurreccion(year);
  return [
    { fecha: `${year}-01-01`, nombre: "Año Nuevo" },
    { fecha: toISODate(addDays(pascua, -3)), nombre: "Jueves Santo" },
    { fecha: toISODate(addDays(pascua, -2)), nombre: "Viernes Santo" },
    { fecha: `${year}-05-01`, nombre: "Día del Trabajo" },
    { fecha: `${year}-06-30`, nombre: "Día del Ejército" },
    { fecha: `${year}-09-15`, nombre: "Independencia" },
    { fecha: `${year}-10-20`, nombre: "Día de la Revolución" },
    { fecha: `${year}-11-01`, nombre: "Todos los Santos" },
    { fecha: `${year}-12-24`, nombre: "Nochebuena (medio día)" },
    { fecha: `${year}-12-25`, nombre: "Navidad" },
    { fecha: `${year}-12-31`, nombre: "Fin de año (medio día)" },
  ];
}

// ---------------------------------------------------------------------------
// Números y fechas en letras (español) — para constancias laborales/ingresos
// ---------------------------------------------------------------------------

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIECIS = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const VEINTIS = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function numeroATextoEs(n) {
  n = Math.floor(n);
  if (n < 0) return `menos ${numeroATextoEs(-n)}`;
  if (n === 0) return "cero";
  if (n === 100) return "cien";

  function menorMil(num) {
    let out = "";
    const c = Math.floor(num / 100);
    const resto = num % 100;
    if (c) out += (c === 1 && resto > 0 ? "ciento" : CENTENAS[c]) + " ";
    if (resto >= 10 && resto < 20) out += DIECIS[resto - 10];
    else if (resto >= 20 && resto < 30) out += VEINTIS[resto - 20];
    else if (resto >= 30) {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      out += DECENAS[d] + (u ? " y " + UNIDADES[u] : "");
    } else if (resto > 0) {
      out += UNIDADES[resto];
    }
    return out.trim();
  }

  if (n < 1000) return menorMil(n);

  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const milesTexto = miles === 1 ? "mil" : `${menorMil(miles)} mil`;
    return resto ? `${milesTexto} ${menorMil(resto)}` : milesTexto;
  }

  const millones = Math.floor(n / 1000000);
  const resto = n % 1000000;
  const millonesTexto = millones === 1 ? "un millón" : `${numeroATextoEs(millones)} millones`;
  return resto ? `${millonesTexto} ${numeroATextoEs(resto)}` : millonesTexto;
}

// "Cuatro Mil Trescientos Quetzales Exactos" / "...con 50/100"
function montoATextoEs(monto) {
  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  const texto = numeroATextoEs(entero).replace(/\b\w/g, (c) => c.toUpperCase());
  return centavos > 0 ? `${texto} Quetzales con ${String(centavos).padStart(2, "0")}/100` : `${texto} Quetzales Exactos`;
}

const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "treinta y un días del mes de julio del dos mil veintiséis"
function fechaATextoEs(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  let dia;
  if (d === 1) dia = "primer día";
  else {
    // apócope de "uno" ante sustantivo: veintiuno -> veintiún, treinta y uno -> treinta y un
    let texto = numeroATextoEs(d).replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
    dia = `${texto} días`;
  }
  return `${dia} del mes de ${MESES_ES[m - 1]} del año ${numeroATextoEs(y)}`;
}

// "01 de septiembre del 2020" (formato corto usado dentro del cuerpo de las constancias)
function fechaCortaEs(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return `${String(d).padStart(2, "0")} de ${MESES_ES[m - 1]} del ${y}`;
}

function openModal(title, bodyHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="h-cond" style="font-size:17px">${escapeHtml(title)}</div>
        <button class="modal-close" data-close>&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-close]")) wrap.remove();
  });
  document.body.appendChild(wrap);
  return wrap;
}

// ============================================================================
// Bootstrap de sesión
// ============================================================================

async function bootstrap() {
  if (/type=recovery/.test(window.location.hash)) {
    passwordRecoveryMode = true;
    renderSetPassword();
  }

  try {
    session = await api.getSession();
    if (session) profile = await api.getMyProfile();
  } catch (e) {
    console.error(e);
  }

  api.onAuthChange(async (event, s) => {
    if (event === "PASSWORD_RECOVERY") {
      passwordRecoveryMode = true;
      renderSetPassword();
      return;
    }
    if (passwordRecoveryMode) return;
    const wasLoggedIn = !!session;
    session = s;
    if (s && !profile) {
      try {
        profile = await api.getMyProfile();
      } catch (e) {
        console.error(e);
      }
    }
    if (!s) profile = null;
    if (wasLoggedIn !== !!s) router();
  });

  window.addEventListener("hashchange", () => {
    if (!passwordRecoveryMode) router();
  });

  if (!passwordRecoveryMode) router();
}

function navigate(hash) {
  if (window.location.hash === hash) router();
  else window.location.hash = hash;
}

function defaultRoute() {
  return profile?.role === "rrhh" ? "#/planilla" : "#/inicio";
}

function tabsForRole(role) {
  if (role === "rrhh") {
    return [
      { hash: "#/planilla", label: "Planilla" },
      { hash: "#/vacaciones", label: "Ausencias" },
      { hash: "#/documentos", label: "Documentos" },
      { hash: "#/horas-extra", label: "Horas extra" },
      { hash: "#/evaluaciones", label: "Evaluaciones" },
      { hash: "#/calendario", label: "Calendario" },
      { hash: "#/roles", label: "Roles" },
      { hash: "#/cartas", label: "Cartas" },
    ];
  }
  return [
    { hash: "#/inicio", label: "Mi perfil" },
    { hash: "#/vacaciones", label: "Ausencias" },
    { hash: "#/documentos", label: "Documentos" },
    { hash: "#/horas-extra", label: "Horas extra" },
    { hash: "#/evaluaciones", label: "Evaluaciones" },
    { hash: "#/calendario", label: "Calendario" },
    { hash: "#/roles", label: "Roles" },
  ];
}

function router() {
  if (!session || !profile) {
    renderLogin();
    return;
  }
  let hash = window.location.hash || defaultRoute();
  const allowedHashes = tabsForRole(profile.role).map((t) => t.hash);
  if (!allowedHashes.includes(hash)) hash = defaultRoute();

  const routes = {
    "#/inicio": renderInicio,
    "#/planilla": renderPlanilla,
    "#/vacaciones": renderVacaciones,
    "#/documentos": renderDocumentos,
    "#/horas-extra": renderHorasExtra,
    "#/evaluaciones": renderEvaluaciones,
    "#/calendario": renderCalendario,
    "#/roles": renderRolesView,
    "#/cartas": renderCartas,
  };
  routes[hash]();
}

function renderShell(contentHtml, activeHash) {
  const tabs = tabsForRole(profile?.role);
  const tabsHtml = tabs
    .map((t) => `<button class="tab ${t.hash === activeHash ? "active" : ""}" data-nav="${t.hash}">${escapeHtml(t.label)}</button>`)
    .join("");

  appEl.innerHTML = `
    <div class="shell">
      <div class="topbar">
        <div class="topbar-left">
          <img src="/assets/icono-grupo-imisa.png" alt="Grupo IMISA" class="brand-badge">
          <div>
            <div class="topbar-title">IMISA Conecta</div>
            <div class="topbar-sub">Grupo IMISA</div>
          </div>
        </div>
        <div class="topbar-right">
          <div class="user-chip">
            <span class="name">${escapeHtml(profile?.full_name || "")}</span>
            <span class="role">${profile?.role === "rrhh" ? "Jefatura RRHH" : "Colaborador"}</span>
          </div>
          <button class="btn btn-ghost btn-sm" id="logoutBtn">Salir</button>
        </div>
      </div>
      <div class="tabs">${tabsHtml}</div>
      <main class="view" id="viewRoot">${contentHtml}</main>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api.signOut();
    window.location.hash = "";
    router();
  });
  appEl.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => navigate(btn.dataset.nav)));

  const activeTab = appEl.querySelector(".tab.active");
  if (activeTab) activeTab.scrollIntoView({ inline: "nearest", block: "nearest" });

  return document.getElementById("viewRoot");
}

// ============================================================================
// Vista: Login / recuperar código
// ============================================================================

function renderLogin(errorMsg) {
  appEl.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">
          <img src="/assets/icono-grupo-imisa.png" alt="Grupo IMISA" class="brand-badge">
          <div class="title">IMISA Conecta</div>
          <div class="sub">Plataforma interna de RRHH — Grupo IMISA</div>
        </div>
        <div class="card">
          ${errorMsg ? `<div class="field hint" style="color:#E4665F;margin-bottom:14px">${escapeHtml(errorMsg)}</div>` : ""}
          <form id="loginForm">
            <div class="field"><label>Correo</label><input class="input" type="email" id="loginEmail" autocomplete="username" required></div>
            <div class="field">
              <label>Código (6 dígitos)</label>
              <input class="input" type="password" id="loginPass" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="6" autocomplete="current-password" required>
            </div>
            <button class="btn btn-primary btn-block" type="submit" id="loginSubmit">Ingresar</button>
          </form>
          <div class="login-link">
            <button type="button" id="forgotToggleBtn">¿Primera vez o olvidaste tu código?</button>
          </div>
          <div id="forgotHost" style="display:none;margin-top:14px"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    const btn = document.getElementById("loginSubmit");
    btn.disabled = true;
    btn.textContent = "Ingresando…";
    try {
      await api.signIn(email, pass);
      profile = await api.getMyProfile();
      window.location.hash = defaultRoute();
      router();
    } catch (err) {
      renderLogin(err.message === "Invalid login credentials" ? "Correo o código incorrecto." : err.message);
    }
  });

  document.getElementById("forgotToggleBtn").addEventListener("click", () => {
    const host = document.getElementById("forgotHost");
    host.style.display = "block";
    document.getElementById("forgotToggleBtn").style.display = "none";
    host.innerHTML = `
      <p class="field hint">Escribe el correo con el que te dieron de alta. Te llegará un enlace para elegir tu propio código — nadie más lo verá.</p>
      <div class="field"><label>Tu correo</label><input class="input" type="email" id="forgotEmail" required></div>
      <button class="btn btn-primary btn-block" type="button" id="forgotSubmitBtn">Enviar enlace</button>
    `;
    document.getElementById("forgotSubmitBtn").addEventListener("click", async () => {
      const email = document.getElementById("forgotEmail").value.trim();
      if (!email) return toast("Escribe tu correo.", true);
      const btn = document.getElementById("forgotSubmitBtn");
      btn.disabled = true;
      btn.textContent = "Enviando…";
      try {
        await api.sendPasswordReset(email);
        host.innerHTML = `<p class="field hint">Listo. Revisa tu correo (y spam) y sigue el enlace para configurar tu código.</p>`;
      } catch (err) {
        handleErr(err);
        btn.disabled = false;
        btn.textContent = "Enviar enlace";
      }
    });
  });
}

function renderSetPassword() {
  appEl.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">
          <img src="/assets/icono-grupo-imisa.png" alt="Grupo IMISA" class="brand-badge">
          <div class="title">IMISA Conecta</div>
          <div class="sub">Plataforma interna de RRHH — Grupo IMISA</div>
        </div>
        <div class="card">
          <p class="field hint" style="margin-bottom:16px">Elige el código de acceso que vas a usar de aquí en adelante.</p>
          <form id="setPasswordForm">
            <div class="field"><label>Nuevo código (6 dígitos)</label>
              <input class="input" type="password" id="newPass" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="6" autocomplete="new-password" required></div>
            <div class="field"><label>Confirma el código</label>
              <input class="input" type="password" id="newPass2" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="6" autocomplete="new-password" required></div>
            <button class="btn btn-primary btn-block" type="submit" id="setPasswordSubmit">Guardar y entrar</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById("setPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = document.getElementById("newPass").value;
    const p2 = document.getElementById("newPass2").value;
    if (!/^\d{6}$/.test(p1)) return toast("El código debe ser de 6 dígitos.", true);
    if (p1 !== p2) return toast("Los códigos no coinciden.", true);
    const btn = document.getElementById("setPasswordSubmit");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      await api.updatePassword(p1);
      passwordRecoveryMode = false;
      history.replaceState(null, "", window.location.pathname);
      profile = await api.getMyProfile();
      toast("Código guardado. ¡Bienvenido!");
      window.location.hash = defaultRoute();
      router();
    } catch (err) {
      handleErr(err);
      btn.disabled = false;
      btn.textContent = "Guardar y entrar";
    }
  });
}

// ============================================================================
// Vista: Mi perfil (colaborador)
// ============================================================================

async function renderInicio() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/inicio");
  try {
    const [comp, roles] = await Promise.all([api.getCompensacion(profile.id), api.listDescripcionesRoles()]);
    const mensual = comp ? Number(comp.salario_mensual) + Number(comp.bonificacion_mensual || 0) : 0;
    const anual = mensual * 12 + Number(comp?.bono_anual || 0);
    const miPuesto = profile.puesto
      ? roles.find((r) => (r.puesto || "").trim().toLowerCase() === profile.puesto.trim().toLowerCase())
      : null;
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile"><div class="stat-value">${tiempoEnEmpresa(profile.fecha_ingreso)}</div><div class="stat-label">Tiempo en la empresa</div></div>
        <div class="stat-tile"><div class="stat-value">${fmtMoney(mensual, comp?.moneda)}</div><div class="stat-label">Salario mensual</div></div>
        <div class="stat-tile"><div class="stat-value">${fmtMoney(anual, comp?.moneda)}</div><div class="stat-label">Compensación anual</div></div>
      </div>
      <div class="card">
        <div class="card-title">Mis datos</div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Empresa</div></div><div>${escapeHtml(profile.empresa || "—")}</div></div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Puesto</div></div><div>${escapeHtml(profile.puesto || "—")}</div></div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Área</div></div><div>${escapeHtml(profile.area || "—")}</div></div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Fecha de ingreso</div></div><div>${fmtDate(profile.fecha_ingreso)}</div></div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Cumpleaños</div></div><div>${profile.fecha_nacimiento ? fmtDate(profile.fecha_nacimiento) : "—"}</div></div>
        <div class="list-row"><div class="list-row-main"><div class="list-row-title">Correo</div></div><div>${escapeHtml(profile.email)}</div></div>
      </div>
      ${
        miPuesto
          ? `<div class="card">
              <div class="card-title">Descriptor de mi puesto</div>
              <p style="color:var(--text-dim);white-space:pre-wrap">${escapeHtml((miPuesto.descripcion || "").slice(0, 220))}${(miPuesto.descripcion || "").length > 220 ? "…" : ""}</p>
              <div style="display:flex;gap:8px;margin-top:6px">
                <button class="btn btn-ghost btn-sm" id="verMiPuestoBtn">Ver detalle completo</button>
                <button class="btn btn-ghost btn-sm" id="imprimirMiPuestoBtn">Imprimir</button>
              </div>
            </div>`
          : ""
      }
    `;
    if (miPuesto) {
      document.getElementById("verMiPuestoBtn").addEventListener("click", () => verDetallePuesto(miPuesto));
      document.getElementById("imprimirMiPuestoBtn").addEventListener("click", () => imprimirPuesto(miPuesto));
    }
  } catch (err) {
    handleErr(err);
  }
}

// ============================================================================
// Vista: Planilla (RRHH)
// ============================================================================

function drawPlanillaTable(root, colaboradores, compById, empresaFiltro) {
  const filtrados = empresaFiltro ? colaboradores.filter((p) => (p.empresa || "Sin empresa") === empresaFiltro) : colaboradores;

  let totalMensual = 0;
  let totalAnual = 0;
  const rows = filtrados
    .map((p) => {
      const c = compById[p.id];
      const mensual = Number(c?.salario_mensual || 0) + Number(c?.bonificacion_mensual || 0);
      const anual = mensual * 12 + Number(c?.bono_anual || 0);
      if (p.activo) {
        totalMensual += mensual;
        totalAnual += anual;
      }
      return `
        <tr data-edit="${p.id}" style="cursor:pointer">
          <td class="wrap">${escapeHtml(p.full_name)}</td>
          <td>${escapeHtml(p.empresa || "—")}</td>
          <td class="wrap">${escapeHtml(p.puesto || "—")}</td>
          <td>${fmtDate(p.fecha_ingreso)}</td>
          <td>${tiempoEnEmpresa(p.fecha_ingreso, p.fecha_egreso)}</td>
          <td>${fmtMoney(mensual, c?.moneda)}</td>
          <td>${fmtMoney(anual, c?.moneda)}</td>
          <td><span class="pill pill-${p.activo ? "activo" : "inactivo"}">${p.activo ? "Activo" : "Inactivo"}</span></td>
        </tr>
      `;
    })
    .join("");

  // Rotación simple: bajas en los últimos 12 meses / headcount promedio actual.
  const hace12m = new Date();
  hace12m.setFullYear(hace12m.getFullYear() - 1);
  const bajas12m = filtrados.filter((p) => p.fecha_egreso && new Date(p.fecha_egreso) >= hace12m).length;
  const activos = filtrados.filter((p) => p.activo).length;
  const rotacion = activos > 0 ? ((bajas12m / activos) * 100).toFixed(1) : "0.0";

  document.getElementById("planillaStatsTop").innerHTML = `
    <div class="stat-tile"><div class="stat-value">${activos}</div><div class="stat-label">Colaboradores activos</div></div>
    <div class="stat-tile"><div class="stat-value">${rotacion}%</div><div class="stat-label">Rotación (12 meses)</div></div>
  `;
  document.getElementById("planillaStatsDesglose").innerHTML = `
    <div class="stat-tile"><div class="stat-value">${fmtMoney(totalMensual)}</div><div class="stat-label">Compensación mensual</div></div>
    <div class="stat-tile"><div class="stat-value">${fmtMoney(totalAnual)}</div><div class="stat-label">Compensación anual</div></div>
  `;
  document.getElementById("planillaTableBody").innerHTML =
    rows || `<tr><td colspan="8" class="empty-state">Sin colaboradores en esta empresa.</td></tr>`;

  root.querySelectorAll("[data-edit]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const p = colaboradores.find((c) => c.id === tr.dataset.edit);
      openEditColaborador(p, compById[p.id], colaboradores);
    });
  });
}

async function renderPlanilla() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/planilla");
  try {
    const [colaboradores, compensaciones] = await Promise.all([
      api.listProfiles({ soloActivos: false }),
      api.listCompensaciones(),
    ]);
    const compById = Object.fromEntries(compensaciones.map((c) => [c.colaborador_id, c]));
    const empresas = [...new Set(colaboradores.map((p) => p.empresa || "Sin empresa"))].sort();

    root.innerHTML = `
      <div class="field" style="max-width:320px">
        <label>Filtrar por empresa</label>
        <select class="select" id="empresaFilter">
          <option value="">Todas las empresas</option>
          ${empresas.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("")}
        </select>
      </div>
      <div class="stat-grid" id="planillaStatsTop"></div>
      <div style="margin:4px 0 14px">
        <button class="btn btn-ghost btn-sm" id="irADesgloseBtn" type="button">Ir a Desglose mensual ↓</button>
      </div>
      <div class="card">
        <div class="card-title">Planilla — click en una fila para editar</div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nombre</th><th>Empresa</th><th>Puesto</th><th>Ingreso</th><th>Tiempo</th><th>Mensual</th><th>Anual</th><th>Estado</th></tr></thead>
            <tbody id="planillaTableBody"></tbody>
          </table>
        </div>
      </div>
      <div id="desgloseAnchor"></div>
      <div class="stat-grid" id="planillaStatsDesglose"></div>
      <div class="card">
        <div class="card-title">Desglose mensual</div>
        <div class="field" style="max-width:220px"><label>Mes</label><input class="input" type="month" id="periodoSelect" value="${currentPeriodo()}"></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nombre</th><th>Base</th><th>Incentivo</th><th>Bonificación</th><th>Horas extra</th><th>Comisiones</th><th>Débito IGSS</th><th>Total</th><th></th></tr></thead>
            <tbody id="desgloseTableBody"></tbody>
          </table>
        </div>
        <p class="field hint">Click en una fila para editar incentivo, bonificación o comisiones de ese mes. El salario base viene de la compensación del colaborador y las horas extra del cierre congelado en la pestaña Horas Extra.</p>
      </div>
    `;

    let empresaActual = "";
    drawPlanillaTable(root, colaboradores, compById, empresaActual);
    document.getElementById("empresaFilter").addEventListener("change", (e) => {
      empresaActual = e.target.value;
      drawPlanillaTable(root, colaboradores, compById, empresaActual);
      redrawDesglose();
    });
    document.getElementById("irADesgloseBtn").addEventListener("click", () => {
      document.getElementById("desgloseAnchor").scrollIntoView({ behavior: "smooth" });
    });

    const periodoInput = document.getElementById("periodoSelect");
    const redrawDesglose = () => drawDesgloseMensual(colaboradores, periodoInput.value, empresaActual);
    await redrawDesglose();
    periodoInput.addEventListener("change", redrawDesglose);
  } catch (err) {
    handleErr(err);
  }
}

async function drawDesgloseMensual(colaboradores, periodo, empresaFiltro) {
  const tbody = document.getElementById("desgloseTableBody");
  tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Cargando…</td></tr>`;
  const activos = colaboradores.filter((p) => p.activo && (!empresaFiltro || (p.empresa || "Sin empresa") === empresaFiltro));
  const [planillas, compensaciones, cierres, suspensiones] = await Promise.all([
    api.listPlanillaMensual(periodo),
    api.listCompensaciones(),
    Promise.all(activos.map((p) => api.getCierreHorasExtra(p.id, periodo))),
    api.listSuspensionesIgss(),
  ]);
  const planById = Object.fromEntries(planillas.map((p) => [p.colaborador_id, p]));
  const compById = Object.fromEntries(compensaciones.map((c) => [c.colaborador_id, c]));
  const cierreById = Object.fromEntries(activos.map((p, i) => [p.id, cierres[i]]));
  const suspensionesPorColaborador = {};
  suspensiones.forEach((s) => (suspensionesPorColaborador[s.colaborador_id] ||= []).push(s));

  const rows = activos
    .map((p) => {
      const plan = planById[p.id];
      const comp = compById[p.id];
      const salarioBase = Number(comp?.salario_mensual || 0);
      const incentivo = Number(plan?.incentivo || 0);
      // Si RRHH no ha tocado este mes todavía, usa la bonificación mensual
      // "estándar" del colaborador como valor por defecto.
      const bonificacion = plan ? Number(plan.bonificacion || 0) : Number(comp?.bonificacion_mensual || 0);
      const comisiones = p.aplica_comisiones ? Number(plan?.comisiones || 0) : 0;
      const horasExtraMonto = Number(cierreById[p.id]?.monto || 0);
      const { diasDebito, monto: debitoIgss } = calcularDebitoIgss(suspensionesPorColaborador[p.id], periodo, salarioBase);
      const total = salarioBase + incentivo + bonificacion + comisiones + horasExtraMonto - debitoIgss;
      return `
        <tr data-edit-mensual="${p.id}" style="cursor:pointer">
          <td>${escapeHtml(p.full_name)}</td>
          <td>${fmtMoney(salarioBase)}</td>
          <td>${fmtMoney(incentivo)}</td>
          <td>${fmtMoney(bonificacion)}</td>
          <td>${fmtMoney(horasExtraMonto)}</td>
          <td>${p.aplica_comisiones ? fmtMoney(comisiones) : "—"}</td>
          <td>${debitoIgss > 0 ? `-${fmtMoney(debitoIgss)} (${diasDebito}d)` : "—"}</td>
          <td>${fmtMoney(total)}</td>
          <td><button type="button" class="btn btn-ghost btn-sm" data-recibo="${p.id}">Recibo</button></td>
        </tr>
      `;
    })
    .join("");
  tbody.innerHTML = rows || `<tr><td colspan="8" class="empty-state">Sin colaboradores activos.</td></tr>`;

  tbody.querySelectorAll("[data-edit-mensual]").forEach((tr) => {
    tr.addEventListener("click", (e) => {
      if (e.target.closest("[data-recibo]")) return;
      const p = activos.find((c) => c.id === tr.dataset.editMensual);
      openEditPlanillaMensual(p, planById[p.id], periodo, () => drawDesgloseMensual(colaboradores, periodo, empresaFiltro));
    });
  });

  tbody.querySelectorAll("[data-recibo]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = activos.find((c) => c.id === btn.dataset.recibo);
      const plan = planById[p.id];
      const comp = compById[p.id];
      const salarioBaseRecibo = Number(comp?.salario_mensual || 0);
      const { diasDebito, monto: debitoIgssSuspension } = calcularDebitoIgss(suspensionesPorColaborador[p.id], periodo, salarioBaseRecibo);
      openReciboModal(p, periodo, {
        salarioBase: salarioBaseRecibo,
        bonificacion: plan ? Number(plan.bonificacion || 0) : Number(comp?.bonificacion_mensual || 0),
        comisiones: p.aplica_comisiones ? Number(plan?.comisiones || 0) : 0,
        horasExtraMonto: Number(cierreById[p.id]?.monto || 0),
        igssCalculado: calcularIgss(salarioBaseRecibo, p.jubilado),
        debitoIgssSuspension,
        diasSuspendidoIgss: diasDebito,
      });
    });
  });
}

function openEditPlanillaMensual(p, plan, periodo, onSaved) {
  const modal = openModal(`${p.full_name} — ${fmtPeriodo(periodo)}`, `
    <form id="planMensualForm">
      <div class="field"><label>Incentivo</label><input class="input" type="number" step="0.01" min="0" name="incentivo" value="${plan?.incentivo || 0}"></div>
      <div class="field"><label>Bonificación</label><input class="input" type="number" step="0.01" min="0" name="bonificacion" value="${plan?.bonificacion || 0}"></div>
      ${
        p.aplica_comisiones
          ? `<div class="field"><label>Comisiones</label><input class="input" type="number" step="0.01" min="0" name="comisiones" value="${plan?.comisiones || 0}"></div>`
          : ""
      }
      <button class="btn btn-primary btn-block" type="submit">Guardar</button>
    </form>
  `);
  modal.querySelector("#planMensualForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api.setPlanillaMensual(
        p.id,
        periodo,
        { incentivo: f.get("incentivo"), bonificacion: f.get("bonificacion"), comisiones: f.get("comisiones") },
        profile.id
      );
      modal.remove();
      toast("Guardado.");
      onSaved();
    } catch (err) {
      handleErr(err);
    }
  });
}

function openEditColaborador(p, comp, todosColaboradores) {
  const posiblesJefes = (todosColaboradores || []).filter((c) => c.id !== p.id);
  const modal = openModal(`Editar — ${p.full_name}`, `
    <form id="editColabForm">
      <div class="row-2">
        <div class="field"><label>Empresa</label><input class="input" name="empresa" value="${escapeHtml(p.empresa || "")}" placeholder="Ej. Accesorios Ilimitados"></div>
        <div class="field"><label>Puesto</label><input class="input" name="puesto" value="${escapeHtml(p.puesto || "")}"></div>
      </div>
      <div class="row-2">
        <div class="field"><label>Área</label><input class="input" name="area" value="${escapeHtml(p.area || "")}"></div>
        <div class="field"><label>Jefe directo</label>
          <select class="select" name="jefe_id">
            <option value="">Sin jefe asignado</option>
            ${posiblesJefes.map((c) => `<option value="${c.id}" ${p.jefe_id === c.id ? "selected" : ""}>${escapeHtml(c.full_name)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Jefaturas adicionales (si tiene más de una)</label>
        <div id="jefaturasAdicionalesList" class="field hint">Cargando…</div>
        <div class="row-2">
          <select class="select" id="nuevaJefaturaSelect">
            <option value="">Selecciona a alguien más…</option>
            ${posiblesJefes.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
          </select>
          <button type="button" class="btn btn-ghost" id="agregarJefaturaBtn">+ Agregar</button>
        </div>
      </div>
      <div class="row-2">
        <div class="field"><label>Fecha de ingreso</label><input class="input" type="date" name="fecha_ingreso" value="${p.fecha_ingreso || ""}"></div>
        <div class="field"><label>Fecha de nacimiento</label><input class="input" type="date" name="fecha_nacimiento" value="${p.fecha_nacimiento || ""}"></div>
      </div>
      <div class="row-2">
        <div class="field"><label>DPI</label><input class="input" name="dpi" value="${escapeHtml(p.dpi || "")}" placeholder="0000 00000 0000"></div>
        <div class="field"><label>No. afiliación IGSS</label><input class="input" name="igss" value="${escapeHtml(p.igss || "")}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px;color:var(--text-dim)">
        <input type="checkbox" name="jubilado" ${p.jubilado ? "checked" : ""}> Jubilado que continúa laborando (aporta 3% IVS al IGSS en vez de 4.83%)
      </label>
      <div class="row-2">
        <div class="field"><label>Hora de entrada</label><input class="input" type="time" name="hora_entrada" value="${p.hora_entrada || ""}"></div>
        <div class="field"><label>Hora de salida</label><input class="input" type="time" name="hora_salida" value="${p.hora_salida || ""}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px;color:var(--text-dim)">
        <input type="checkbox" name="aplica_comisiones" ${p.aplica_comisiones ? "checked" : ""}> Aplica comisiones (ej. ventas)
      </label>
      <div class="row-2">
        <div class="field"><label>Salario base (mensual)</label><input class="input" type="number" step="0.01" min="0" name="salario_mensual" value="${comp?.salario_mensual || 0}"></div>
        <div class="field"><label>Bonificación mensual</label><input class="input" type="number" step="0.01" min="0" name="bonificacion_mensual" value="${comp?.bonificacion_mensual || 0}"></div>
      </div>
      <div class="field"><label>Bono anual (adicional, si aplica)</label><input class="input" type="number" step="0.01" min="0" name="bono_anual" value="${comp?.bono_anual || 0}"></div>
      <div class="row-2">
        <div class="field"><label>Fecha de egreso</label><input class="input" type="date" name="fecha_egreso" value="${p.fecha_egreso || ""}"></div>
        <div class="field"><label>Estado</label>
          <select class="select" name="activo">
            <option value="true" ${p.activo ? "selected" : ""}>Activo</option>
            <option value="false" ${!p.activo ? "selected" : ""}>Inactivo</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Guardar</button>
    </form>
  `);

  const drawJefaturasAdicionales = async () => {
    const host = modal.querySelector("#jefaturasAdicionalesList");
    const lista = await api.listJefaturasAdicionales(p.id);
    host.innerHTML = lista.length
      ? lista.map((j) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0">${escapeHtml(j.jefe?.full_name || "—")} <button type="button" class="btn btn-danger-outline btn-sm" data-quitar-jefatura="${j.id}">Quitar</button></div>`).join("")
      : "Sin jefaturas adicionales.";
    host.querySelectorAll("[data-quitar-jefatura]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await api.quitarJefaturaAdicional(btn.dataset.quitarJefatura);
          drawJefaturasAdicionales();
        } catch (err) {
          handleErr(err);
        }
      })
    );
  };
  drawJefaturasAdicionales();

  modal.querySelector("#agregarJefaturaBtn").addEventListener("click", async () => {
    const select = modal.querySelector("#nuevaJefaturaSelect");
    if (!select.value) return toast("Selecciona a alguien primero.", true);
    try {
      await api.agregarJefaturaAdicional(p.id, select.value, profile.id);
      select.value = "";
      drawJefaturasAdicionales();
    } catch (err) {
      handleErr(err);
    }
  });

  modal.querySelector("#editColabForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api.updateProfile(p.id, {
        empresa: f.get("empresa") || null,
        puesto: f.get("puesto") || null,
        area: f.get("area") || null,
        jefe_id: f.get("jefe_id") || null,
        dpi: f.get("dpi") || null,
        igss: f.get("igss") || null,
        fecha_ingreso: f.get("fecha_ingreso") || null,
        fecha_nacimiento: f.get("fecha_nacimiento") || null,
        fecha_egreso: f.get("fecha_egreso") || null,
        hora_entrada: f.get("hora_entrada") || null,
        hora_salida: f.get("hora_salida") || null,
        aplica_comisiones: f.get("aplica_comisiones") === "on",
        jubilado: f.get("jubilado") === "on",
        activo: f.get("activo") === "true",
      });
      await api.setCompensacion(
        p.id,
        {
          salario_mensual: Number(f.get("salario_mensual") || 0),
          bonificacion_mensual: Number(f.get("bonificacion_mensual") || 0),
          bono_anual: Number(f.get("bono_anual") || 0),
          moneda: comp?.moneda || "GTQ",
        },
        profile.id
      );
      modal.remove();
      toast("Colaborador actualizado.");
      renderPlanilla();
    } catch (err) {
      handleErr(err);
    }
  });
}

// ============================================================================
// Vista: Vacaciones
// ============================================================================

async function saldoVacaciones(colaboradorId) {
  const [ajustes, solicitudes] = await Promise.all([
    api.listVacacionesAjustes(colaboradorId),
    api.listSolicitudesVacaciones({ colaboradorId }),
  ]);
  const otorgados = ajustes.reduce((s, a) => s + Number(a.dias), 0);
  const tomados = solicitudes.filter((s) => s.estado === "aprobado").reduce((s, r) => s + Number(r.dias_habiles), 0);
  return { saldo: otorgados - tomados, otorgados, tomados, ajustes, solicitudes };
}

let ausenciasSubTab = "vacaciones";

function motivoVacacionesFieldHtml(valorActual) {
  const esOtro = valorActual && !MOTIVOS_VACACIONES.includes(valorActual);
  return `
    <div class="field"><label>Motivo</label>
      <select class="select" name="motivo" id="motivoSelect" required>
        ${MOTIVOS_VACACIONES.map((m) => `<option value="${escapeHtml(m)}" ${(esOtro ? "Otros" : valorActual) === m ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}
      </select>
    </div>
    <div class="field" id="motivoOtroWrap" style="display:${esOtro ? "block" : "none"}">
      <label>Especifica el motivo</label>
      <input class="input" name="motivo_otro" value="${escapeHtml(esOtro ? valorActual : "")}">
    </div>
  `;
}

function attachMotivoVacacionesToggle(form) {
  form.querySelector("#motivoSelect").addEventListener("change", (e) => {
    form.querySelector("#motivoOtroWrap").style.display = e.target.value === "Otros" ? "block" : "none";
  });
}

function motivoVacacionesValor(f) {
  return f.get("motivo") === "Otros" ? f.get("motivo_otro") || "Otros" : f.get("motivo");
}

async function renderVacaciones() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/vacaciones");
  const isRrhh = profile.role === "rrhh";

  try {
    if (isRrhh) {
      root.innerHTML = `
        <div class="tabs" style="margin-bottom:14px">
          <button class="tab ${ausenciasSubTab === "vacaciones" ? "active" : ""}" data-subtab="vacaciones">Vacaciones</button>
          <button class="tab ${ausenciasSubTab === "igss" ? "active" : ""}" data-subtab="igss">Suspensiones IGSS</button>
        </div>
        <div id="ausenciasSubHost"></div>
      `;
      root.querySelectorAll("[data-subtab]").forEach((btn) =>
        btn.addEventListener("click", () => {
          ausenciasSubTab = btn.dataset.subtab;
          renderVacaciones();
        })
      );
      const subHost = document.getElementById("ausenciasSubHost");
      if (ausenciasSubTab === "igss") await renderSuspensionesIgssAdmin(subHost);
      else await renderVacacionesAdmin(subHost);
    } else {
      const { saldo, solicitudes } = await saldoVacaciones(profile.id);
      root.innerHTML = `
        <div class="stat-grid">
          <div class="stat-tile"><div class="stat-value">${saldo}</div><div class="stat-label">Días disponibles</div></div>
        </div>
        <div class="card">
          <div class="card-title">Solicitar vacaciones</div>
          <form id="solForm">
            <div class="row-2">
              <div class="field"><label>Desde</label><input class="input" type="date" name="fecha_inicio" required></div>
              <div class="field"><label>Hasta</label><input class="input" type="date" name="fecha_fin" required></div>
            </div>
            ${motivoVacacionesFieldHtml()}
            <div class="field hint" id="diasPreview"></div>
            <button class="btn btn-primary btn-block" type="submit">Enviar solicitud</button>
          </form>
        </div>
        <div class="card">
          <div class="card-title">Mis solicitudes</div>
          ${
            solicitudes.length
              ? solicitudes
                  .map(
                    (s) => `
                <div class="list-row">
                  <div class="list-row-main"><div class="list-row-title">${fmtDate(s.fecha_inicio)} → ${fmtDate(s.fecha_fin)}</div><div class="list-row-sub">${s.dias_habiles} día(s)${s.comentario_rrhh ? " · " + escapeHtml(s.comentario_rrhh) : ""}</div></div>
                  <div style="display:flex;align-items:center;gap:8px">
                    ${pillEstado(s.estado)}
                    ${s.estado === "pendiente" ? `<button class="btn btn-danger-outline btn-sm" data-cancel="${s.id}">Cancelar</button>` : ""}
                  </div>
                </div>`
                  )
                  .join("")
              : `<div class="empty-state">Aún no tienes solicitudes.</div>`
          }
        </div>
      `;

      const form = document.getElementById("solForm");
      attachMotivoVacacionesToggle(form);
      const updatePreview = () => {
        const fi = form.fecha_inicio.value;
        const ff = form.fecha_fin.value;
        document.getElementById("diasPreview").textContent = fi && ff ? `${businessDaysBetween(fi, ff)} día(s) hábil(es)` : "";
      };
      form.fecha_inicio.addEventListener("change", updatePreview);
      form.fecha_fin.addEventListener("change", updatePreview);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const fecha_inicio = f.get("fecha_inicio");
        const fecha_fin = f.get("fecha_fin");
        const dias_habiles = businessDaysBetween(fecha_inicio, fecha_fin);
        if (dias_habiles <= 0) return toast("El rango de fechas no es válido.", true);
        try {
          await api.crearSolicitudVacaciones(profile.id, { fecha_inicio, fecha_fin, dias_habiles, motivo: motivoVacacionesValor(f) });
          toast("Solicitud enviada.");
          renderVacaciones();
        } catch (err) {
          handleErr(err);
        }
      });

      root.querySelectorAll("[data-cancel]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            await api.cancelarSolicitudVacaciones(btn.dataset.cancel);
            toast("Solicitud cancelada.");
            renderVacaciones();
          } catch (err) {
            handleErr(err);
          }
        })
      );
    }
  } catch (err) {
    handleErr(err);
  }
}

async function renderVacacionesAdmin(root) {
  const [pendientes, colaboradores, todosAjustes, todasSolicitudes] = await Promise.all([
    api.listSolicitudesVacaciones().then((all) => all.filter((s) => s.estado === "pendiente")),
    api.listProfiles(),
    api.listVacacionesAjustes(),
    api.listSolicitudesVacaciones(),
  ]);

  const otorgadosPorColab = {};
  todosAjustes.forEach((a) => (otorgadosPorColab[a.colaborador_id] = (otorgadosPorColab[a.colaborador_id] || 0) + Number(a.dias)));
  const tomadosPorColab = {};
  todasSolicitudes
    .filter((s) => s.estado === "aprobado")
    .forEach((s) => (tomadosPorColab[s.colaborador_id] = (tomadosPorColab[s.colaborador_id] || 0) + Number(s.dias_habiles)));

  const empresas = [...new Set(colaboradores.map((p) => p.empresa || "Sin empresa"))].sort();

  root.innerHTML = `
    <div class="card">
      <div class="card-title">Solicitudes pendientes</div>
      ${
        pendientes.length
          ? pendientes
              .map(
                (s) => `
          <div class="list-row">
            <div class="list-row-main">
              <div class="list-row-title">${escapeHtml(s.colaborador?.full_name || "—")}</div>
              <div class="list-row-sub">${fmtDate(s.fecha_inicio)} → ${fmtDate(s.fecha_fin)} · ${s.dias_habiles} día(s) · ${escapeHtml(s.motivo || "sin motivo")}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-green btn-sm" data-approve="${s.id}">Aprobar</button>
              <button class="btn btn-danger-outline btn-sm" data-reject="${s.id}">Rechazar</button>
            </div>
          </div>`
              )
              .join("")
          : `<div class="empty-state">No hay solicitudes pendientes.</div>`
      }
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div class="card-title" style="margin:0">Vacaciones pendientes por colaborador</div>
        <div class="field" style="margin:0;min-width:200px">
          <select class="select" id="empresaResumenVacaciones"><option value="">Todas las empresas</option>
            ${empresas.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="resumenVacacionesHost"></div>
    </div>
    <div class="card">
      <div class="card-title">Saldo por colaborador</div>
      <div class="field"><select class="select" id="colabSelect"><option value="">Selecciona un colaborador…</option>
        ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
      </select></div>
      <div id="colabDetail"></div>
    </div>
  `;

  const drawResumen = () => {
    const empresaFiltro = document.getElementById("empresaResumenVacaciones").value;
    const filas = colaboradores
      .filter((p) => p.activo && (!empresaFiltro || (p.empresa || "Sin empresa") === empresaFiltro))
      .map((p) => ({
        p,
        saldo: (otorgadosPorColab[p.id] || 0) - (tomadosPorColab[p.id] || 0),
      }))
      .sort((a, b) => b.saldo - a.saldo);
    document.getElementById("resumenVacacionesHost").innerHTML = filas.length
      ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>Colaborador</th><th>Empresa</th><th>Días pendientes</th></tr></thead>
          <tbody>${filas.map((f) => `<tr><td>${escapeHtml(f.p.full_name)}</td><td>${escapeHtml(f.p.empresa || "—")}</td><td>${f.saldo}</td></tr>`).join("")}</tbody>
        </table></div>`
      : `<div class="empty-state">Sin colaboradores.</div>`;
  };
  drawResumen();
  document.getElementById("empresaResumenVacaciones").addEventListener("change", drawResumen);

  root.querySelectorAll("[data-approve]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await api.resolverSolicitudVacaciones(btn.dataset.approve, "aprobado", null, profile.id);
        toast("Solicitud aprobada.");
        renderVacaciones();
      } catch (err) {
        handleErr(err);
      }
    })
  );
  root.querySelectorAll("[data-reject]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await api.resolverSolicitudVacaciones(btn.dataset.reject, "rechazado", null, profile.id);
        toast("Solicitud rechazada.");
        renderVacaciones();
      } catch (err) {
        handleErr(err);
      }
    })
  );

  document.getElementById("colabSelect").addEventListener("change", async (e) => {
    const id = e.target.value;
    const host = document.getElementById("colabDetail");
    if (!id) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = `<div class="empty-state">Cargando…</div>`;
    const { saldo, solicitudes } = await saldoVacaciones(id);
    host.innerHTML = `
      <div class="stat-grid" style="margin-top:14px">
        <div class="stat-tile"><div class="stat-value">${saldo}</div><div class="stat-label">Días disponibles</div></div>
      </div>
      <form id="ajusteForm" class="row-2" style="align-items:end">
        <div class="field"><label>Otorgar/quitar días</label><input class="input" type="number" step="0.5" name="dias" required></div>
        <div class="field"><label>Motivo</label><input class="input" name="motivo" placeholder="Ej. aniversario laboral" required></div>
        <button class="btn btn-primary" style="grid-column:1/-1" type="submit">Registrar ajuste</button>
      </form>
      <div class="card-title" style="margin-top:14px">Historial de solicitudes</div>
      ${
        solicitudes.length
          ? solicitudes
              .map(
                (s) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${fmtDate(s.fecha_inicio)} → ${fmtDate(s.fecha_fin)}</div><div class="list-row-sub">${s.dias_habiles} día(s)</div></div>${pillEstado(s.estado)}</div>`
              )
              .join("")
          : `<div class="empty-state">Sin solicitudes.</div>`
      }
    `;
    document.getElementById("ajusteForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.crearAjusteVacaciones(id, Number(f.get("dias")), f.get("motivo"), profile.id);
        toast("Ajuste registrado.");
        e.target.reset();
        document.getElementById("colabSelect").dispatchEvent(new Event("change"));
      } catch (err) {
        handleErr(err);
      }
    });
  });
}

async function renderSuspensionesIgssAdmin(root) {
  const [suspensiones, colaboradores] = await Promise.all([api.listSuspensionesIgss(), api.listProfiles()]);

  root.innerHTML = `
    <div class="card">
      <div class="card-title">Registrar visita / suspensión IGSS</div>
      <form id="suspForm">
        <div class="field"><label>Colaborador</label>
          <select class="select" name="colaborador_id" required><option value="">Selecciona…</option>
            ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
          </select>
        </div>
        <div class="row-2">
          <div class="field"><label>Fecha de la visita al IGSS</label><input class="input" type="date" name="fecha_visita" value="${todayISO()}" required></div>
          <div class="field"><label>Motivo</label><input class="input" name="motivo" placeholder="Ej. consulta médica" required></div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px;color:var(--text-dim)">
          <input type="checkbox" name="suspendido" id="suspendidoCheck"> Lo suspendieron
        </label>
        <div class="row-2" id="suspFechasWrap" style="display:none">
          <div class="field"><label>Desde</label><input class="input" type="date" name="fecha_inicio"></div>
          <div class="field"><label>Hasta</label><input class="input" type="date" name="fecha_fin"></div>
        </div>
        <p class="field hint">Recuerda: la empresa paga el primer día de la suspensión y el IGSS paga el resto — el sistema descuenta automáticamente esos días del salario base en Planilla del mes que corresponda.</p>
        <button class="btn btn-primary btn-block" type="submit">Guardar</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">Historial de suspensiones IGSS</div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Colaborador</th><th>Fecha visita</th><th>Motivo</th><th>Suspendido</th><th>Desde</th><th>Hasta</th><th></th></tr></thead>
          <tbody>
            ${suspensiones
              .map(
                (s) => `<tr>
                  <td>${escapeHtml(s.colaborador?.full_name || "—")}</td>
                  <td>${fmtDate(s.fecha_visita)}</td>
                  <td>${escapeHtml(s.motivo)}</td>
                  <td>${s.suspendido ? "Sí" : "No"}</td>
                  <td>${s.fecha_inicio ? fmtDate(s.fecha_inicio) : "—"}</td>
                  <td>${s.fecha_fin ? fmtDate(s.fecha_fin) : "—"}</td>
                  <td><button class="btn btn-ghost btn-sm" data-edit-susp="${s.id}">Editar</button></td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const form = document.getElementById("suspForm");
  form.querySelector("#suspendidoCheck").addEventListener("change", (e) => {
    document.getElementById("suspFechasWrap").style.display = e.target.checked ? "grid" : "none";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const suspendido = f.get("suspendido") === "on";
    if (suspendido && (!f.get("fecha_inicio") || !f.get("fecha_fin"))) {
      return toast("Completa el rango de fechas de la suspensión.", true);
    }
    try {
      await api.crearSuspensionIgss(
        {
          colaborador_id: f.get("colaborador_id"),
          motivo: f.get("motivo"),
          fecha_visita: f.get("fecha_visita"),
          suspendido,
          fecha_inicio: suspendido ? f.get("fecha_inicio") : null,
          fecha_fin: suspendido ? f.get("fecha_fin") : null,
        },
        profile.id
      );
      toast("Registrado.");
      renderVacaciones();
    } catch (err) {
      handleErr(err);
    }
  });

  root.querySelectorAll("[data-edit-susp]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const s = suspensiones.find((x) => x.id === btn.dataset.editSusp);
      openEditSuspensionIgss(s);
    })
  );
}

function openEditSuspensionIgss(s) {
  const modal = openModal(`Editar suspensión — ${s.colaborador?.full_name || ""}`, `
    <form id="editSuspForm">
      <div class="row-2">
        <div class="field"><label>Fecha de la visita al IGSS</label><input class="input" type="date" name="fecha_visita" value="${s.fecha_visita || ""}" required></div>
        <div class="field"><label>Motivo</label><input class="input" name="motivo" value="${escapeHtml(s.motivo || "")}" required></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px;color:var(--text-dim)">
        <input type="checkbox" name="suspendido" id="editSuspendidoCheck" ${s.suspendido ? "checked" : ""}> Lo suspendieron
      </label>
      <div class="row-2" id="editSuspFechasWrap" style="display:${s.suspendido ? "grid" : "none"}">
        <div class="field"><label>Desde</label><input class="input" type="date" name="fecha_inicio" value="${s.fecha_inicio || ""}"></div>
        <div class="field"><label>Hasta</label><input class="input" type="date" name="fecha_fin" value="${s.fecha_fin || ""}"></div>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Guardar cambios</button>
    </form>
  `);
  modal.querySelector("#editSuspendidoCheck").addEventListener("change", (e) => {
    modal.querySelector("#editSuspFechasWrap").style.display = e.target.checked ? "grid" : "none";
  });
  modal.querySelector("#editSuspForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const suspendido = f.get("suspendido") === "on";
    if (suspendido && (!f.get("fecha_inicio") || !f.get("fecha_fin"))) {
      return toast("Completa el rango de fechas de la suspensión.", true);
    }
    try {
      await api.actualizarSuspensionIgss(s.id, {
        fecha_visita: f.get("fecha_visita"),
        motivo: f.get("motivo"),
        suspendido,
        fecha_inicio: suspendido ? f.get("fecha_inicio") : null,
        fecha_fin: suspendido ? f.get("fecha_fin") : null,
      });
      toast("Actualizado.");
      modal.remove();
      renderVacaciones();
    } catch (err) {
      handleErr(err);
    }
  });
}

// ============================================================================
// Vista: Documentos (drive)
// ============================================================================

function categoriaOptions() {
  return ["contrato", "identificacion", "carta", "evaluacion", "firmado", "otro"]
    .map((c) => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`)
    .join("");
}

async function renderDrivePara(colaboradorId, host, isRrhh) {
  host.innerHTML = `<div class="empty-state">Cargando…</div>`;
  const docs = await api.listDocumentos(colaboradorId);
  host.innerHTML = `
    ${
      isRrhh
        ? `<form id="uploadForm" class="row-2" style="align-items:end;margin-bottom:14px">
            <div class="field"><label>Categoría</label><select class="select" name="categoria">${categoriaOptions()}</select></div>
            <div class="field"><label>Archivo</label><input class="input" type="file" name="file" required></div>
            <button class="btn btn-primary" style="grid-column:1/-1" type="submit">Subir documento</button>
          </form>`
        : ""
    }
    ${
      docs.length
        ? docs
            .map(
              (d) => `
        <div class="list-row">
          <div class="list-row-main"><div class="list-row-title">${escapeHtml(d.nombre)}</div><div class="list-row-sub">${escapeHtml(d.categoria)} · ${fmtDate(d.created_at)}</div></div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-view="${d.storage_path}">Ver</button>
            ${isRrhh ? `<button class="btn btn-danger-outline btn-sm" data-del="${d.id}" data-path="${d.storage_path}">Eliminar</button>` : ""}
          </div>
        </div>`
            )
            .join("")
        : `<div class="empty-state">Sin documentos todavía.</div>`
    }
  `;

  if (isRrhh) {
    host.querySelector("#uploadForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const file = f.get("file");
      if (!file || !file.size) return toast("Selecciona un archivo.", true);
      try {
        await api.subirDocumento(colaboradorId, file, f.get("categoria"), profile.id);
        toast("Documento subido.");
        renderDrivePara(colaboradorId, host, isRrhh);
      } catch (err) {
        handleErr(err);
      }
    });
  }

  host.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        const url = await api.getDocumentoUrl(btn.dataset.view);
        window.open(url, "_blank");
      } catch (err) {
        handleErr(err);
      }
    })
  );
  host.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este documento?")) return;
      try {
        await api.eliminarDocumento(btn.dataset.del, btn.dataset.path);
        toast("Documento eliminado.");
        renderDrivePara(colaboradorId, host, isRrhh);
      } catch (err) {
        handleErr(err);
      }
    })
  );
}

async function renderDocumentos() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/documentos");
  const isRrhh = profile.role === "rrhh";

  if (!isRrhh) {
    root.innerHTML = `
      <div class="card">
        <div class="card-title">Mi drive</div>
        <div id="driveHost"></div>
      </div>
      <div class="card">
        <div class="card-title">Solicitar un documento</div>
        <form id="reqForm">
          <div class="field"><label>¿Qué necesitas?</label><input class="input" name="tipo" placeholder="Ej. constancia laboral" required></div>
          <div class="field"><label>Comentario (opcional)</label><textarea class="textarea" name="comentario"></textarea></div>
          <button class="btn btn-primary btn-block" type="submit">Enviar solicitud</button>
        </form>
      </div>
      <div class="card">
        <div class="card-title">Mis solicitudes</div>
        <div id="reqListHost"></div>
      </div>
    `;
    await renderDrivePara(profile.id, document.getElementById("driveHost"), false);
    const renderReqList = async () => {
      const reqs = await api.listSolicitudesDocumentos({ colaboradorId: profile.id });
      document.getElementById("reqListHost").innerHTML = reqs.length
        ? reqs
            .map(
              (r) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHtml(r.tipo_documento)}</div><div class="list-row-sub">${fmtDate(r.created_at)}</div></div>${pillEstado(r.estado)}</div>`
            )
            .join("")
        : `<div class="empty-state">Sin solicitudes.</div>`;
    };
    await renderReqList();
    document.getElementById("reqForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.crearSolicitudDocumento(profile.id, f.get("tipo"), f.get("comentario") || null);
        toast("Solicitud enviada.");
        e.target.reset();
        renderReqList();
      } catch (err) {
        handleErr(err);
      }
    });
  } else {
    const colaboradores = await api.listProfiles();
    root.innerHTML = `
      <div class="card">
        <div class="card-title">Solicitudes de documentos pendientes</div>
        <div id="pendReqHost"></div>
      </div>
      <div class="card">
        <div class="card-title">Drive de un colaborador</div>
        <div class="field"><select class="select" id="colabSelect"><option value="">Selecciona un colaborador…</option>
          ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
        </select></div>
        <div id="driveHost"></div>
      </div>
    `;

    const renderPend = async () => {
      const reqs = await api.listSolicitudesDocumentos({ soloPendientes: true });
      document.getElementById("pendReqHost").innerHTML = reqs.length
        ? reqs
            .map(
              (r) => `
        <div class="list-row">
          <div class="list-row-main"><div class="list-row-title">${escapeHtml(r.colaborador?.full_name || "—")} — ${escapeHtml(r.tipo_documento)}</div><div class="list-row-sub">${escapeHtml(r.comentario || "")}</div></div>
          <button class="btn btn-green btn-sm" data-resolve="${r.id}" data-colab="${r.colaborador_id}">Resolver</button>
        </div>`
            )
            .join("")
        : `<div class="empty-state">Sin solicitudes pendientes.</div>`;

      document.querySelectorAll("[data-resolve]").forEach((btn) =>
        btn.addEventListener("click", () => {
          document.getElementById("colabSelect").value = btn.dataset.colab;
          document.getElementById("colabSelect").dispatchEvent(new Event("change"));
          document.getElementById("driveHost").scrollIntoView({ behavior: "smooth" });
          toast("Sube el documento en el drive de abajo; luego márcalo como listo desde el botón junto a la solicitud (recárgala si ya subiste el archivo).");
        })
      );
    };
    await renderPend();

    document.getElementById("colabSelect").addEventListener("change", async (e) => {
      const id = e.target.value;
      const host = document.getElementById("driveHost");
      if (!id) {
        host.innerHTML = "";
        return;
      }
      await renderDrivePara(id, host, true);
    });
  }
}

// ============================================================================
// Vista: Horas extra
// ============================================================================

function formHorasExtraHtml(colaborador) {
  const tieneHorario = !!colaborador.hora_salida;
  return `
    <form id="heForm" style="margin-bottom:14px">
      <div class="row-2">
        <div class="field"><label>Fecha</label><input class="input" type="date" name="fecha" value="${todayISO()}" required></div>
        ${
          tieneHorario
            ? `<div class="field"><label>Hora de salida real</label><input class="input" type="time" name="hora_salida_real"></div>`
            : `<div class="field"><label>Horas extra</label><input class="input" type="number" step="0.25" min="0" name="horas_manual"></div>`
        }
      </div>
      ${
        tieneHorario
          ? `<p class="field hint" id="heCalcPreview">Salida programada: ${colaborador.hora_salida}. 0–24 min tarde no cuenta, 25–45 min = 0.5h, 45+ min = 1h. Se paga a 1.5x.</p>`
          : ""
      }
      <div class="field"><label>Motivo</label><input class="input" name="motivo" required></div>
      <button class="btn btn-primary btn-block" type="submit">Registrar</button>
    </form>
  `;
}

function attachHorasExtraForm(host, colaborador, onRegistered) {
  const form = host.querySelector("#heForm");
  if (!form) return;

  if (colaborador.hora_salida && form.hora_salida_real) {
    form.hora_salida_real.addEventListener("change", () => {
      const horas = calcularHorasExtra(colaborador.hora_salida, form.hora_salida_real.value);
      document.getElementById("heCalcPreview").textContent = `Horas extra calculadas: ${horas}h (salida programada ${colaborador.hora_salida}), pagadas a 1.5x.`;
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const horas = colaborador.hora_salida
      ? calcularHorasExtra(colaborador.hora_salida, f.get("hora_salida_real"))
      : Number(f.get("horas_manual"));
    if (!horas || horas <= 0) return toast("No hay horas extra que registrar con esos datos.", true);
    try {
      await api.registrarHorasExtra(
        colaborador.id,
        { fecha: f.get("fecha"), hora_salida_real: f.get("hora_salida_real") || null, horas, tipo: "simple", motivo: f.get("motivo") },
        profile.id
      );
      toast(`Registradas ${horas}h (quedan pendientes de validación).`);
      onRegistered();
    } catch (err) {
      handleErr(err);
    }
  });
}

async function renderMisHorasExtra(host, colaborador, onRegistered) {
  const periodo = currentPeriodo();
  host.innerHTML = `<div class="empty-state">Cargando…</div>`;
  const registros = await api.listHorasExtraPorPeriodo(colaborador.id, periodo);
  const validadas = registros.filter((r) => r.estado === "validado").reduce((s, r) => s + Number(r.horas), 0);
  const pendientes = registros.filter((r) => r.estado === "pendiente").reduce((s, r) => s + Number(r.horas), 0);
  host.innerHTML = `
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-value">${validadas}</div><div class="stat-label">Horas validadas — ${fmtPeriodo(periodo)}</div></div>
      <div class="stat-tile"><div class="stat-value">${pendientes}</div><div class="stat-label">Horas pendientes de validar por RRHH</div></div>
    </div>
    ${formHorasExtraHtml(colaborador)}
    ${
      registros.length
        ? registros
            .map(
              (r) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${fmtDate(r.fecha)} — ${r.horas}h</div><div class="list-row-sub">${escapeHtml(r.motivo || "")}</div></div>${pillEstado(r.estado)}</div>`
            )
            .join("")
        : `<div class="empty-state">Sin registros en ${fmtPeriodo(periodo)}.</div>`
    }
  `;
  attachHorasExtraForm(host, colaborador, () => {
    renderMisHorasExtra(host, colaborador, onRegistered);
    if (onRegistered) onRegistered();
  });
}

async function renderEquipoHorasExtra(host) {
  const pendientes = await api.listHorasExtraPendientesEquipo();
  host.innerHTML = `
    <div class="card-title">Mi equipo — pendientes de validar</div>
    ${
      pendientes.length
        ? pendientes
            .map(
              (r) => `
        <div class="list-row">
          <div class="list-row-main"><div class="list-row-title">${escapeHtml(r.colaborador?.full_name || "—")} — ${fmtDate(r.fecha)}</div><div class="list-row-sub">${r.horas}h · ${escapeHtml(r.motivo || "")}</div></div>
          <button class="btn btn-green btn-sm" data-validar="${r.id}">Validar</button>
        </div>`
            )
            .join("")
        : `<div class="empty-state">Sin pendientes de tu equipo.</div>`
    }
  `;
  host.querySelectorAll("[data-validar]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await api.validarHorasExtra(btn.dataset.validar, profile.id);
        toast("Horas validadas.");
        renderEquipoHorasExtra(host);
      } catch (err) {
        handleErr(err);
      }
    })
  );
}

async function renderHorasExtra() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/horas-extra");

  if (profile.role !== "rrhh") {
    const subordinados = await api.listSubordinados(profile.id);
    root.innerHTML = `
      <div class="card"><div class="card-title">Mis horas extra</div><div id="misHeHost"></div></div>
      ${subordinados.length ? `<div class="card" id="equipoHeHost"></div>` : ""}
    `;
    await renderMisHorasExtra(document.getElementById("misHeHost"), profile);
    if (subordinados.length) await renderEquipoHorasExtra(document.getElementById("equipoHeHost"));
    return;
  }

  const colaboradores = await api.listProfiles();
  root.innerHTML = `
    <div class="card" id="pendientesHost"></div>
    <div class="card">
      <div class="card-title">Registrar horas extra</div>
      <div class="field"><select class="select" id="colabSelect"><option value="">Selecciona un colaborador…</option>
        ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
      </select></div>
      <div id="heHost"></div>
    </div>
    <div class="card">
      <div class="card-title">Congelar mes (calcula el monto)</div>
      <div class="row-2">
        <div class="field"><label>Colaborador</label>
          <select class="select" id="congelarColabSelect"><option value="">Selecciona…</option>
            ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Mes</label><input class="input" type="month" id="congelarPeriodo" value="${currentPeriodo()}"></div>
      </div>
      <div id="congelarHost"></div>
    </div>
    <div class="card">
      <div class="card-title">Registro biométrico</div>
      <p class="label-sm" style="color:var(--text-mute);margin-bottom:10px">
        Sube aquí el archivo .xls/.xlsx que exporta el biométrico (columnas Nombre y Fecha/Hora). El sistema calcula
        solo las horas extra (salida real vs. hora programada de cada quien) y las deja pendientes de validar.
      </p>
      <div class="row-2" style="align-items:end;margin-bottom:14px">
        <div class="field"><label>Archivo del biométrico</label><input class="input" type="file" id="biometricoFile" accept=".xls,.xlsx"></div>
        <button class="btn btn-primary" id="biometricoSubirBtn" type="button">Subir y procesar</button>
      </div>
      <div class="row-2">
        <div class="field" style="max-width:220px"><label>Mes a mostrar</label><input class="input" type="month" id="biometricoPeriodo" value="${currentPeriodo()}"></div>
        <div class="field"><label>Filtrar por colaborador</label>
          <select class="select" id="biometricoColabFiltro"><option value="">Todos</option>
            ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="biometricoHost"></div>
    </div>
  `;

  await renderEquipoHorasExtra(document.getElementById("pendientesHost"));

  document.getElementById("colabSelect").addEventListener("change", async (e) => {
    const host = document.getElementById("heHost");
    if (!e.target.value) {
      host.innerHTML = "";
      return;
    }
    const colaborador = colaboradores.find((c) => c.id === e.target.value);
    await renderMisHorasExtra(host, colaborador, () => renderEquipoHorasExtra(document.getElementById("pendientesHost")));
  });

  const drawCongelar = async () => {
    const colabId = document.getElementById("congelarColabSelect").value;
    const periodo = document.getElementById("congelarPeriodo").value;
    const host = document.getElementById("congelarHost");
    if (!colabId) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = `<div class="empty-state">Cargando…</div>`;
    const [registros, cierre] = await Promise.all([
      api.listHorasExtraPorPeriodo(colabId, periodo),
      api.getCierreHorasExtra(colabId, periodo),
    ]);
    const validadas = registros.filter((r) => r.estado === "validado");
    const simples = validadas.filter((r) => r.tipo !== "doble").reduce((s, r) => s + Number(r.horas), 0);
    const dobles = validadas.filter((r) => r.tipo === "doble").reduce((s, r) => s + Number(r.horas), 0);
    host.innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile"><div class="stat-value">${simples}</div><div class="stat-label">Horas simples validadas</div></div>
        <div class="stat-tile"><div class="stat-value">${dobles}</div><div class="stat-label">Horas dobles validadas</div></div>
        ${cierre ? `<div class="stat-tile"><div class="stat-value">${fmtMoney(cierre.monto)}</div><div class="stat-label">Ya congelado</div></div>` : ""}
      </div>
      <button class="btn btn-primary" id="congelarBtn">${cierre ? "Recalcular y congelar de nuevo" : "Congelar y calcular monto"}</button>
    `;
    document.getElementById("congelarBtn").addEventListener("click", async () => {
      try {
        const resultado = await api.congelarHorasExtra(colabId, periodo, profile.id);
        toast(`Congelado: ${fmtMoney(resultado.monto)}`);
        drawCongelar();
      } catch (err) {
        handleErr(err);
      }
    });
  };
  document.getElementById("congelarColabSelect").addEventListener("change", drawCongelar);
  document.getElementById("congelarPeriodo").addEventListener("change", drawCongelar);

  let biometricoRegistros = [];
  let biometricoSort = { key: "fecha", dir: "desc" };

  const COLUMNAS_BIOMETRICO = [
    { key: "colaborador", label: "Colaborador" },
    { key: "fecha", label: "Fecha" },
    { key: "hora_salida_real", label: "Hora salida" },
    { key: "tipo", label: "Tipo" },
    { key: "horas", label: "Horas extra" },
  ];

  const valorOrdenable = (r, key) => {
    if (key === "colaborador") return (r.colaborador?.full_name || "").toLowerCase();
    if (key === "horas") return Number(r.horas);
    return r[key] ?? "";
  };

  const renderBiometricoTabla = () => {
    const host = document.getElementById("biometricoHost");
    const colabFiltro = document.getElementById("biometricoColabFiltro").value;
    const filtrados = colabFiltro ? biometricoRegistros.filter((r) => r.colaborador_id === colabFiltro) : biometricoRegistros;
    if (!filtrados.length) {
      host.innerHTML = `<div class="empty-state">Sin registros biométricos en ${fmtPeriodo(document.getElementById("biometricoPeriodo").value)}${colabFiltro ? " para este colaborador" : ""}.</div>`;
      return;
    }
    const { key, dir } = biometricoSort;
    const factor = dir === "asc" ? 1 : -1;
    const ordenados = [...filtrados].sort((a, b) => {
      const va = valorOrdenable(a, key);
      const vb = valorOrdenable(b, key);
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
    const totalHoras = filtrados.reduce((s, r) => s + Number(r.horas || 0), 0);
    host.innerHTML = `<div class="table-wrap"><table class="data">
        <thead><tr>${COLUMNAS_BIOMETRICO.map(
          (c) => `<th data-sort-key="${c.key}" style="cursor:pointer;user-select:none">${c.label}${key === c.key ? (dir === "asc" ? " ▲" : " ▼") : ""}</th>`
        ).join("")}</tr></thead>
        <tbody>${ordenados
          .map((r) => `<tr><td>${escapeHtml(r.colaborador?.full_name || "—")}</td><td>${fmtDate(r.fecha)}</td><td>${r.hora_salida_real || "—"}</td><td>${r.tipo === "doble" ? "Doble" : "Simple"}</td><td>${r.horas}h</td></tr>`)
          .join("")}</tbody>
        <tfoot><tr style="font-weight:700;border-top:1px solid var(--border-strong)">
          <td colspan="4">Total${colabFiltro ? " (filtrado)" : ""}</td><td>${totalHoras}h</td>
        </tr></tfoot>
      </table></div>`;
    host.querySelectorAll("[data-sort-key]").forEach((th) =>
      th.addEventListener("click", () => {
        const k = th.dataset.sortKey;
        biometricoSort = { key: k, dir: biometricoSort.key === k && biometricoSort.dir === "asc" ? "desc" : "asc" };
        renderBiometricoTabla();
      })
    );
  };

  const drawBiometrico = async () => {
    const periodo = document.getElementById("biometricoPeriodo").value;
    const host = document.getElementById("biometricoHost");
    host.innerHTML = `<div class="empty-state">Cargando…</div>`;
    biometricoRegistros = await api.listHorasExtraBiometrico(periodo);
    renderBiometricoTabla();
  };
  document.getElementById("biometricoPeriodo").addEventListener("change", drawBiometrico);
  document.getElementById("biometricoColabFiltro").addEventListener("change", renderBiometricoTabla);
  await drawBiometrico();

  document.getElementById("biometricoSubirBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("biometricoFile");
    const file = fileInput.files[0];
    if (!file) return toast("Selecciona el archivo del biométrico primero.", true);
    const btn = document.getElementById("biometricoSubirBtn");
    btn.disabled = true;
    btn.textContent = "Procesando…";
    try {
      const resumen = await procesarBiometrico(file, colaboradores);
      let msg = `${resumen.insertados} registro(s) de horas extra nuevos.`;
      if (resumen.yaExistian) msg += ` ${resumen.yaExistian} ya estaban cargados.`;
      if (resumen.sinMatch.length) msg += ` ${resumen.sinMatch.length} nombre(s) no se pudieron emparejar: ${resumen.sinMatch.join(", ")}.`;
      if (resumen.sinCuenta.length) msg += ` Sin cuenta creada: ${resumen.sinCuenta.join(", ")}.`;
      if (resumen.sinHorario.length) msg += ` Sin hora de entrada configurada: ${resumen.sinHorario.join(", ")}.`;
      toast(msg);
      fileInput.value = "";
      await drawBiometrico();
    } catch (err) {
      handleErr(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Subir y procesar";
    }
  });
}

function normalizarNombre(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function encontrarColaboradorPorNombre(nombreBiometrico, colaboradores) {
  const palabras = normalizarNombre(nombreBiometrico).split(/\s+/).filter(Boolean);
  const candidatos = colaboradores.filter((c) => {
    const nl = normalizarNombre(c.full_name);
    return palabras.length && palabras.every((p) => nl.includes(p));
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

function sumarHorasAHora(hhmm, horas) {
  const [h, m] = hhmm.split(":").map(Number);
  let totalMin = h * 60 + m + horas * 60;
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const hh = Math.floor(totalMin / 60);
  const mm = Math.round(totalMin % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Parsea el .xls/.xlsx crudo del biométrico: detecta las columnas Nombre y
// Fecha/Hora buscando esos encabezados (sin asumir una posición fija), y
// devuelve una lista de eventos { nombre, fecha (YYYY-MM-DD), hora (HH:MM) }.
function parseEventosBiometrico(aoa) {
  let colNombre = -1;
  let colFecha = -1;
  for (const row of aoa) {
    const idxNombre = row.findIndex((v) => typeof v === "string" && /nombre/i.test(v));
    const idxFecha = row.findIndex((v) => typeof v === "string" && /fecha/i.test(v));
    if (idxNombre >= 0 && idxFecha >= 0) {
      colNombre = idxNombre;
      colFecha = idxFecha;
      break;
    }
  }
  if (colNombre < 0 || colFecha < 0) {
    throw new Error("No se encontraron las columnas de Nombre y Fecha/Hora en el archivo.");
  }
  const eventos = [];
  for (const row of aoa) {
    const nombre = row[colNombre];
    const fh = row[colFecha];
    if (!nombre || !fh) continue;
    const m = String(fh).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!m) continue;
    const [, dd, mm, yyyy, hh, mi] = m;
    eventos.push({
      nombre: String(nombre).trim(),
      fecha: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`,
      hora: `${hh.padStart(2, "0")}:${mi}`,
    });
  }
  return eventos;
}

async function procesarBiometrico(file, colaboradores) {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const eventos = parseEventosBiometrico(aoa);

  // Última marca del día = hora de salida real (sin importar cuántas marcas
  // haya ese día: entrada, salida/entrada de almuerzo, salida final).
  const porPersonaDia = new Map();
  for (const ev of eventos) {
    const key = `${ev.nombre}|${ev.fecha}`;
    const actual = porPersonaDia.get(key);
    if (!actual || ev.hora > actual.hora) porPersonaDia.set(key, ev);
  }

  const periodos = [...new Set([...porPersonaDia.values()].map((e) => e.fecha.slice(0, 7)))];
  const existentesPorPeriodo = await Promise.all(periodos.map((p) => api.listHorasExtraBiometrico(p)));
  const yaExisten = new Set();
  existentesPorPeriodo.flat().forEach((r) => yaExisten.add(`${r.colaborador_id}|${r.fecha}`));

  const sinMatch = new Set();
  const sinCuenta = new Set();
  const sinHorario = new Set();
  let yaExistian = 0;
  const filas = [];

  for (const { nombre, fecha, hora } of porPersonaDia.values()) {
    const colaborador = encontrarColaboradorPorNombre(nombre, colaboradores);
    if (!colaborador) {
      sinMatch.add(nombre);
      continue;
    }
    if (!colaborador.hora_entrada) {
      sinHorario.add(colaborador.full_name);
      continue;
    }
    if (yaExisten.has(`${colaborador.id}|${fecha}`)) {
      yaExistian++;
      continue;
    }
    // Turno de 9h (8h netas + 1h de almuerzo), salvo que ya tenga hora_salida configurada.
    const horaSalidaProgramada = colaborador.hora_salida || sumarHorasAHora(colaborador.hora_entrada, 9);
    const horas = calcularHorasExtra(horaSalidaProgramada, hora);
    if (horas <= 0) continue;
    filas.push({
      colaborador_id: colaborador.id,
      fecha,
      hora_salida_real: hora,
      horas,
      tipo: "simple",
      motivo: "Registro biométrico — salida real vs. hora programada",
      origen: "biometrico",
      estado: "pendiente",
    });
  }

  if (filas.length) await api.insertarHorasExtraBiometricoLote(filas);

  return {
    insertados: filas.length,
    yaExistian,
    sinMatch: [...sinMatch],
    sinCuenta: [...sinCuenta],
    sinHorario: [...sinHorario],
  };
}

// ============================================================================
// Vista: Evaluaciones de desempeño
// ============================================================================

async function renderEvaluacionesPara(colaboradorId, host, showForm) {
  host.innerHTML = `<div class="empty-state">Cargando…</div>`;
  const evals = await api.listEvaluaciones(colaboradorId);
  host.innerHTML = `
    ${
      showForm
        ? `<form id="evalForm" style="margin-bottom:14px">
            <div class="row-2">
              <div class="field"><label>Periodo</label><input class="input" name="periodo" placeholder="Ej. 2026 - S1" required></div>
              <div class="field"><label>Punteo</label><input class="input" type="number" step="0.01" name="punteo" placeholder="Ej. 85"></div>
            </div>
            <div class="field"><label>Resultado</label><input class="input" name="resultado" placeholder="Ej. Sobresaliente" required></div>
            <div class="field"><label>Comentarios</label><textarea class="textarea" name="comentarios"></textarea></div>
            <button class="btn btn-primary btn-block" type="submit">Registrar evaluación</button>
          </form>`
        : ""
    }
    ${
      evals.length
        ? evals
            .map(
              (e) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHtml(e.periodo)} — ${escapeHtml(e.resultado)}${e.punteo != null ? ` (${e.punteo} pts)` : ""}</div><div class="list-row-sub">${escapeHtml(e.comentarios || "")}</div></div></div>`
            )
            .join("")
        : `<div class="empty-state">Sin evaluaciones registradas.</div>`
    }
  `;
  if (showForm) {
    host.querySelector("#evalForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.crearEvaluacion(
          colaboradorId,
          { periodo: f.get("periodo"), resultado: f.get("resultado"), punteo: f.get("punteo") ? Number(f.get("punteo")) : null, comentarios: f.get("comentarios") || null },
          profile.id
        );
        toast("Evaluación registrada.");
        renderEvaluacionesPara(colaboradorId, host, true);
      } catch (err) {
        handleErr(err);
      }
    });
  }
}

async function renderEvaluacionesAdmin() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/evaluaciones");
  const colaboradores = await api.listProfiles();
  const areas = [...new Set(colaboradores.map((p) => p.area || "Sin área"))].sort();

  root.innerHTML = `
    <div class="card">
      <div class="card-title">Evaluaciones de desempeño — todas</div>
      <div class="row-2">
        <div class="field"><label>Periodo</label><input class="input" id="fPeriodo" placeholder="Ej. 2026 - S1"></div>
        <div class="field"><label>Área</label>
          <select class="select" id="fArea"><option value="">Todas</option>${areas.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>Colaborador</label>
        <select class="select" id="fColab"><option value="">Todos</option>${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}</select>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Colaborador</th><th>Área</th><th>Evaluó</th><th>Periodo</th><th>Resultado</th><th>Punteo</th><th>Monto</th></tr></thead>
          <tbody id="evalAdminBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const redraw = async () => {
    const tbody = document.getElementById("evalAdminBody");
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Cargando…</td></tr>`;
    const periodo = document.getElementById("fPeriodo").value.trim();
    const area = document.getElementById("fArea").value;
    const colaboradorId = document.getElementById("fColab").value;
    let evals = await api.listEvaluacionesAdmin({ periodo: periodo || undefined, colaboradorId: colaboradorId || undefined });
    if (area) evals = evals.filter((e) => (e.colaborador?.area || "Sin área") === area);
    tbody.innerHTML = evals.length
      ? evals
          .map(
            (e) => `<tr>
              <td>${escapeHtml(e.colaborador?.full_name || "—")}</td>
              <td>${escapeHtml(e.colaborador?.area || "—")}</td>
              <td>${escapeHtml(e.evaluador?.full_name || "—")}</td>
              <td>${escapeHtml(e.periodo)}</td>
              <td>${escapeHtml(e.resultado)}</td>
              <td>${e.punteo ?? "—"}</td>
              <td>${e.monto != null ? fmtMoney(e.monto) : "—"}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="7" class="empty-state">Sin resultados.</td></tr>`;
  };

  document.getElementById("fPeriodo").addEventListener("change", redraw);
  document.getElementById("fArea").addEventListener("change", redraw);
  document.getElementById("fColab").addEventListener("change", redraw);
  await redraw();
}

async function renderEvaluaciones() {
  if (profile.role === "rrhh") {
    await renderEvaluacionesAdmin();
    return;
  }

  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/evaluaciones");
  const subordinados = await api.listSubordinados(profile.id);

  root.innerHTML = `
    ${
      subordinados.length
        ? `<div class="card">
            <div class="card-title">Mi equipo — evaluar</div>
            <div class="field"><select class="select" id="colabSelect"><option value="">Selecciona un colaborador…</option>
              ${subordinados.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
            </select></div>
            <div id="evalEquipoHost"></div>
          </div>`
        : ""
    }
    <div class="card"><div class="card-title">Mis evaluaciones de desempeño</div><div id="evalHost"></div></div>
  `;

  await renderEvaluacionesPara(profile.id, document.getElementById("evalHost"), false);

  if (subordinados.length) {
    document.getElementById("colabSelect").addEventListener("change", async (e) => {
      const host = document.getElementById("evalEquipoHost");
      if (!e.target.value) {
        host.innerHTML = "";
        return;
      }
      await renderEvaluacionesPara(e.target.value, host, true);
    });
  }
}

// ============================================================================
// Vista: Calendario (cumpleaños + actividades)
// ============================================================================

async function renderCalendario() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/calendario");
  const isRrhh = profile.role === "rrhh";
  await drawCalendar(root, isRrhh);
}

async function drawCalendar(root, isRrhh) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const monthLabel = calendarMonth.toLocaleDateString("es-GT", { month: "long", year: "numeric" });

  const [colaboradores, actividades] = await Promise.all([
    api.listProfiles(),
    api.listActividades(),
  ]);

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cumplePorDia = {};
  colaboradores.forEach((c) => {
    if (!c.fecha_nacimiento) return;
    const { m, d } = monthDay(c.fecha_nacimiento);
    if (m === month) (cumplePorDia[d] ||= []).push(c.full_name);
  });
  const actPorDia = {};
  actividades.forEach((a) => {
    const d = new Date(a.fecha + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) (actPorDia[d.getDate()] ||= []).push(a);
  });

  const feriadosPorDia = {};
  getFeriadosGuatemala(year).forEach((f) => {
    const d = new Date(f.fecha + "T12:00:00");
    if (d.getMonth() === month) (feriadosPorDia[d.getDate()] ||= []).push(f);
  });

  let cells = "";
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-day other-month"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const events = [
      ...(feriadosPorDia[d] || []).map((f) => `<div class="cal-event feriado">🇬🇹 ${escapeHtml(f.nombre)}</div>`),
      ...(cumplePorDia[d] || []).map((n) => `<div class="cal-event birthday">🎂 ${escapeHtml(n)}</div>`),
      ...(actPorDia[d] || []).map((a) => `<div class="cal-event actividad" data-act="${a.id}" ${isRrhh ? 'style="cursor:pointer"' : ""}>${escapeHtml(a.titulo)}</div>`),
    ].join("");
    cells += `<div class="cal-day ${isToday ? "today" : ""}"><div class="cal-day-num">${d}</div>${events}</div>`;
  }

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" id="prevMonth">‹</button>
        <div class="h-cond" style="font-size:16px;text-transform:capitalize">${monthLabel}</div>
        <button class="btn btn-ghost btn-sm" id="nextMonth">›</button>
      </div>
      <div class="cal-grid">
        ${["D", "L", "M", "M", "J", "V", "S"].map((d) => `<div class="cal-dow">${d}</div>`).join("")}
        ${cells}
      </div>
    </div>
    ${
      isRrhh
        ? `<div class="card">
            <div class="card-title">Agregar actividad</div>
            <form id="actForm" class="row-2" style="align-items:end">
              <div class="field"><label>Título</label><input class="input" name="titulo" required></div>
              <div class="field"><label>Fecha</label><input class="input" type="date" name="fecha" required></div>
              <div class="field" style="grid-column:1/-1"><label>Descripción (opcional)</label><textarea class="textarea" name="descripcion"></textarea></div>
              <button class="btn btn-primary" style="grid-column:1/-1" type="submit">Agregar</button>
            </form>
          </div>`
        : ""
    }
  `;

  document.getElementById("prevMonth").addEventListener("click", () => {
    calendarMonth = new Date(year, month - 1, 1);
    drawCalendar(root, isRrhh);
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    calendarMonth = new Date(year, month + 1, 1);
    drawCalendar(root, isRrhh);
  });

  if (isRrhh) {
    document.getElementById("actForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.crearActividad({ titulo: f.get("titulo"), descripcion: f.get("descripcion") || null, fecha: f.get("fecha") }, profile.id);
        toast("Actividad agregada.");
        drawCalendar(root, isRrhh);
      } catch (err) {
        handleErr(err);
      }
    });
    root.querySelectorAll("[data-act]").forEach((el) =>
      el.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta actividad?")) return;
        try {
          await api.eliminarActividad(el.dataset.act);
          toast("Actividad eliminada.");
          drawCalendar(root, isRrhh);
        } catch (err) {
          handleErr(err);
        }
      })
    );
  }
}

// ============================================================================
// Vista: Descripción de roles
// ============================================================================

async function renderRolesView() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/roles");
  const isRrhh = profile.role === "rrhh";
  const roles = await api.listDescripcionesRoles();

  if (!isRrhh) {
    // Un colaborador solo puede ver el descriptor de su propio puesto (la
    // RLS de descripciones_roles ya lo filtra así del lado del servidor).
    const miPuesto = roles[0];
    root.innerHTML = miPuesto
      ? `<div class="card">
          <div class="card-title">${escapeHtml(miPuesto.puesto)}</div>
          <p class="label-sm" style="margin:2px 0 8px">${[miPuesto.codigo, miPuesto.empresa, miPuesto.area].filter(Boolean).map(escapeHtml).join(" · ")}</p>
          <p style="color:var(--text-dim);white-space:pre-wrap">${escapeHtml(miPuesto.descripcion || "Sin descripción.")}</p>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-ghost btn-sm" id="verMiRolBtn">Ver detalle completo</button>
            <button class="btn btn-ghost btn-sm" id="imprimirMiRolBtn">Imprimir</button>
          </div>
        </div>`
      : `<div class="empty-state">Todavía no hay un descriptor de puesto registrado para tu puesto.</div>`;
    if (miPuesto) {
      document.getElementById("verMiRolBtn").addEventListener("click", () => verDetallePuesto(miPuesto));
      document.getElementById("imprimirMiRolBtn").addEventListener("click", () => imprimirPuesto(miPuesto));
    }
    return;
  }

  const empresas = [...new Set(roles.map((r) => r.empresa).filter(Boolean))].sort();

  const drawList = (filtroEmpresa) => {
    const listado = filtroEmpresa ? roles.filter((r) => r.empresa === filtroEmpresa) : roles;
    root.querySelector("#rolesGrid").innerHTML = listado.length
      ? listado
          .map(
            (r) => `
      <div class="card">
        <div class="card-title">${escapeHtml(r.puesto)}</div>
        <p class="label-sm" style="margin:2px 0 8px">${[r.codigo, r.empresa, r.area].filter(Boolean).map(escapeHtml).join(" · ")}</p>
        <p style="color:var(--text-dim);white-space:pre-wrap">${escapeHtml((r.descripcion || "Sin descripción.").slice(0, 220))}${(r.descripcion || "").length > 220 ? "…" : ""}</p>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-ghost btn-sm" data-ver-role="${r.id}">Ver detalle completo</button>
          ${isRrhh ? `<button class="btn btn-ghost btn-sm" data-edit-role="${r.id}">Editar</button>` : ""}
        </div>
      </div>`
          )
          .join("")
      : `<div class="empty-state">Aún no hay descripciones de puestos.</div>`;

    root.querySelectorAll("[data-ver-role]").forEach((btn) =>
      btn.addEventListener("click", () => verDetallePuesto(roles.find((r) => r.id === btn.dataset.verRole)))
    );
    if (isRrhh) {
      root.querySelectorAll("[data-edit-role]").forEach((btn) =>
        btn.addEventListener("click", () => openRoleForm(roles.find((r) => r.id === btn.dataset.editRole)))
      );
    }
  };

  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="field" style="min-width:220px;margin:0">
        <select class="input" id="filtroEmpresaRoles">
          <option value="">Todas las empresas</option>
          ${empresas.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("")}
        </select>
      </div>
      ${isRrhh ? `<button class="btn btn-primary" id="newRoleBtn">+ Nuevo puesto</button>` : ""}
    </div>
    <div id="rolesGrid"></div>
  `;
  drawList("");
  document.getElementById("filtroEmpresaRoles").addEventListener("change", (e) => drawList(e.target.value));

  const openRoleForm = (r) => {
    const modal = openModal(r ? `Editar — ${r.puesto}` : "Nuevo puesto", `
      <form id="roleForm">
        <div class="field"><label>Puesto</label><input class="input" name="puesto" value="${escapeHtml(r?.puesto || "")}" required ${r ? "readonly" : ""}></div>
        <div class="row-2">
          <div class="field"><label>Código</label><input class="input" name="codigo" value="${escapeHtml(r?.codigo || "")}"></div>
          <div class="field"><label>Empresa</label><input class="input" name="empresa" value="${escapeHtml(r?.empresa || "")}"></div>
        </div>
        <div class="row-2">
          <div class="field"><label>Área</label><input class="input" name="area" value="${escapeHtml(r?.area || "")}"></div>
          <div class="field"><label>Jefe inmediato</label><input class="input" name="jefe_inmediato" value="${escapeHtml(r?.jefe_inmediato || "")}"></div>
        </div>
        <div class="field"><label>Misión del puesto</label><textarea class="textarea" name="descripcion">${escapeHtml(r?.descripcion || "")}</textarea></div>
        <div class="field"><label>Perfil / requisitos (resumen)</label><textarea class="textarea" name="requisitos">${escapeHtml(r?.requisitos || "")}</textarea></div>
        <p class="label-sm" style="color:var(--text-mute)">El detalle completo (funciones, competencias, perfil, etc.) se administra por archivo — pide el ajuste y se actualiza directamente.</p>
        <button class="btn btn-primary btn-block" type="submit">Guardar</button>
      </form>
    `);
    modal.querySelector("#roleForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.guardarDescripcionRol(
          {
            id: r?.id,
            puesto: f.get("puesto"),
            descripcion: f.get("descripcion") || null,
            requisitos: f.get("requisitos") || null,
            codigo: f.get("codigo") || null,
            empresa: f.get("empresa") || null,
            area: f.get("area") || null,
            jefe_inmediato: f.get("jefe_inmediato") || null,
          },
          profile.id
        );
        modal.remove();
        toast("Guardado.");
        renderRolesView();
      } catch (err) {
        handleErr(err);
      }
    });
  };

  if (isRrhh) document.getElementById("newRoleBtn").addEventListener("click", () => openRoleForm(null));
}

function puestoDetalleContentHtml(r) {
  const d = r.detalle || {};
  const tabla = (rows, cols) =>
    rows && rows.length
      ? `<table style="width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:13px">
          <thead><tr>${cols.map((c) => `<th style="text-align:left;border-bottom:1px solid #999;padding:5px 6px;color:#555">${c.label}</th>`).join("")}</tr></thead>
          <tbody>${rows
            .map((row) => `<tr>${cols.map((c) => `<td style="padding:5px 6px;border-bottom:1px solid #ddd">${escapeHtml(row[c.key] ?? "")}</td>`).join("")}</tr>`)
            .join("")}</tbody>
        </table>`
      : "";

  const funcionesPorCategoria = {};
  (d.funciones || []).forEach((f) => {
    const cat = f.categoria || "General";
    (funcionesPorCategoria[cat] ||= []).push(f);
  });

  const perfil = d.perfil || {};
  const perfilRow = (label, val) => (val ? `<div><span class="label-sm">${escapeHtml(label)}</span><div>${escapeHtml(val)}</div></div>` : "");

  return `
      <p class="label-sm">${[r.empresa, r.area, r.departamento, r.lugar_trabajo].filter(Boolean).map(escapeHtml).join(" · ")}</p>
      <div class="row-2" style="margin:10px 0">
        <div><span class="label-sm">Jefe inmediato</span><div>${escapeHtml(r.jefe_inmediato || "—")}</div></div>
        <div><span class="label-sm">Nivel jerárquico</span><div>${escapeHtml(r.nivel_jerarquico || "—")}</div></div>
        <div><span class="label-sm">No. de personas que supervisa</span><div>${escapeHtml(String(d.no_supervisa ?? "—"))}</div></div>
        <div><span class="label-sm">Posiciones que supervisa</span><div>${escapeHtml(d.posiciones_supervisa || "—")}</div></div>
      </div>

      <h4>Misión del puesto</h4>
      <p style="white-space:pre-wrap">${escapeHtml(r.descripcion || "")}</p>

      ${
        Object.keys(funcionesPorCategoria).length
          ? `<h4>Funciones principales</h4>` +
            Object.entries(funcionesPorCategoria)
              .map(
                ([cat, fns]) =>
                  `<p class="label-sm" style="margin-top:10px">${escapeHtml(cat)}</p>` +
                  tabla(fns, [
                    { key: "funcion", label: "Función" },
                    { key: "frecuencia", label: "Frecuencia" },
                    { key: "tiempo", label: "Tiempo" },
                  ])
              )
              .join("")
          : ""
      }

      ${
        d.indicadores?.length
          ? `<h4>Métricas requeridas</h4>` +
            tabla(d.indicadores, [
              { key: "indicador", label: "Indicador" },
              { key: "resultado_esperado", label: "Resultado esperado" },
            ])
          : ""
      }

      <h4>Complejidad del puesto</h4>
      ${d.inversion_actividades ? `<p><strong>Inversión de actividades:</strong> ${escapeHtml(d.inversion_actividades)}</p>` : ""}
      ${d.nivel_iniciativa ? `<p><strong>Nivel de iniciativa y autonomía:</strong> ${escapeHtml(d.nivel_iniciativa)}</p>` : ""}
      ${d.toma_decisiones ? `<p><strong>Toma de decisiones:</strong> ${escapeHtml(d.toma_decisiones)}</p>` : ""}
      ${d.riesgos ? `<p><strong>Riesgos:</strong><br>${escapeHtml(d.riesgos).replace(/\n/g, "<br>")}</p>` : ""}

      <h4>Responsabilidad</h4>
      ${d.manejo_activos ? `<p><strong>Manejo de activos:</strong> ${escapeHtml(d.manejo_activos)}</p>` : ""}
      ${d.equipos_trabajo ? `<p><strong>Equipos de trabajo:</strong> ${escapeHtml(d.equipos_trabajo)}</p>` : ""}
      ${d.equipos_seguridad ? `<p><strong>Equipos de seguridad:</strong> ${escapeHtml(d.equipos_seguridad)}</p>` : ""}

      ${
        d.relaciones_internas?.length || d.relaciones_externas?.length
          ? `<h4>Relaciones internas y externas</h4>
            ${d.relaciones_internas?.length ? `<p class="label-sm">Internas</p>` + tabla(d.relaciones_internas, [{ key: "departamento", label: "Departamento" }, { key: "frecuencia", label: "Frecuencia" }, { key: "proposito", label: "Propósito" }]) : ""}
            ${d.relaciones_externas?.length ? `<p class="label-sm">Externas</p>` + tabla(d.relaciones_externas, [{ key: "persona", label: "Personas/Instituciones" }, { key: "frecuencia", label: "Frecuencia" }, { key: "proposito", label: "Propósito" }]) : ""}`
          : ""
      }

      ${d.condiciones_trabajo ? `<h4>Condiciones de trabajo</h4><p style="white-space:pre-wrap">${escapeHtml(d.condiciones_trabajo)}</p>` : ""}
      ${d.esfuerzo_fisico_mental ? `<h4>Nivel de esfuerzo físico y mental</h4><p style="white-space:pre-wrap">${escapeHtml(d.esfuerzo_fisico_mental)}</p>` : ""}

      <h4>Perfil del puesto</h4>
      <div class="row-2">
        ${perfilRow("Edad", perfil.edad)}
        ${perfilRow("Estado civil", perfil.estado_civil)}
        ${perfilRow("Sexo", perfil.sexo)}
        ${perfilRow("Idiomas requeridos", perfil.idiomas)}
        ${perfilRow("Años de experiencia laboral", perfil.anios_experiencia)}
        ${perfilRow("Formación académica", perfil.formacion_academica)}
        ${perfilRow("Formación complementaria", perfil.formacion_complementaria)}
        ${perfilRow("Conocimientos básicos", perfil.conocimientos_basicos)}
        ${perfilRow("Habilidades específicas", perfil.habilidades_especificas)}
        ${perfilRow("Conocimientos informáticos", perfil.conocimientos_informaticos)}
        ${perfilRow("Sistemas especializados", perfil.sistemas_especializados)}
        ${perfilRow("Salario", r.salario)}
        ${perfilRow("Beneficios", perfil.beneficios)}
        ${perfilRow("Se requiere viajar", perfil.se_requiere_viajar)}
        ${perfilRow("Se requiere vehículo", perfil.se_requiere_vehiculo)}
        ${perfilRow("Se requiere pasaporte/visa", perfil.se_requiere_pasaporte)}
        ${perfilRow("Valores o actitudes", perfil.valores_actitudes)}
      </div>

      ${
        d.competencias_generales?.length
          ? `<h4>Competencias generales</h4>` + tabla(d.competencias_generales, [{ key: "competencia", label: "Competencia" }, { key: "grado", label: "Grado" }])
          : ""
      }
      ${
        d.competencias_especificas?.length
          ? `<h4>Competencias específicas por área</h4>` + tabla(d.competencias_especificas, [{ key: "competencia", label: "Competencia" }, { key: "grado", label: "Grado" }])
          : ""
      }

      <p class="label-sm" style="margin-top:16px">
        Elaborado por: ${escapeHtml(d.elaborado_por || "—")} · Revisado por: ${escapeHtml(d.revisado_por || "—")}
        ${d.fecha_elaboracion ? ` · Fecha: ${fmtDate(d.fecha_elaboracion)}` : ""}
        ${d.version ? ` · ${escapeHtml(d.version)}` : ""}
      </p>
  `;
}

function imprimirPuesto(r) {
  const letterhead = getLetterhead(r.empresa);
  const { header, footer } = cartaHeaderFooterHtml(letterhead, r.empresa);
  const html = `
    <div class="print-area" style="max-width:800px;margin:0 auto;padding:40px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;font-size:13px">
      ${header}
      <h2 style="text-align:center;text-transform:uppercase;letter-spacing:.05em;font-size:16px">Perfil y Descriptor de Puesto</h2>
      <h3 style="text-align:center;font-size:14px;margin-top:0">${escapeHtml(r.puesto)}${r.codigo ? ` (${escapeHtml(r.codigo)})` : ""}</h3>
      ${puestoDetalleContentHtml(r)}
      ${footer}
    </div>
  `;
  const win = window.open("", "_blank");
  if (!win) {
    toast("El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.", true);
    return;
  }
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Descriptor de puesto</title></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}

function verDetallePuesto(r) {
  const modal = openModal(
    `${r.puesto}${r.codigo ? ` (${r.codigo})` : ""}`,
    `
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn btn-ghost btn-sm" id="imprimirPuestoBtn">Imprimir</button>
    </div>
    <div style="max-height:65vh;overflow:auto">
      ${puestoDetalleContentHtml(r)}
    </div>
  `
  );
  modal.querySelector("#imprimirPuestoBtn").addEventListener("click", () => imprimirPuesto(r));
  return modal;
}

// ============================================================================
// Recibo de pago (desde Planilla > Desglose mensual)
// ============================================================================

function reciboHtml(colaborador, periodo, datos) {
  const letterhead = getLetterhead(colaborador.empresa);
  const { header, footer } = cartaHeaderFooterHtml(letterhead, colaborador.empresa);
  const empresaTexto = letterhead ? letterhead.razonSocial : colaborador.empresa || "Grupo IMISA";

  const debitoIgssSuspension = datos.debitoIgssSuspension || 0;
  const totalIngresos = datos.salarioBase + datos.horasExtraMonto + datos.comisiones + datos.vacaciones;
  const totalDeducciones = datos.anticipo + datos.igss + datos.prestamos + datos.retencionIsr + datos.otros + debitoIgssSuspension;
  const liquido = totalIngresos + datos.bonificacion - totalDeducciones;

  const fila = (desc, ingreso, otroIngreso, deduccion) => `
    <tr>
      <td style="padding:5px 6px">${escapeHtml(desc)}</td>
      <td style="padding:5px 6px;text-align:right">${ingreso != null ? fmtMoney(ingreso) : ""}</td>
      <td style="padding:5px 6px;text-align:right">${otroIngreso != null ? fmtMoney(otroIngreso) : ""}</td>
      <td style="padding:5px 6px;text-align:right">${deduccion != null ? fmtMoney(deduccion) : ""}</td>
    </tr>`;

  return `
    <div class="print-area" style="max-width:700px;margin:0 auto;padding:40px;font-family:Georgia,serif;color:#111;background:#fff;font-size:13.5px">
      ${header}
      <h2 style="text-align:center;text-transform:uppercase;letter-spacing:.05em;font-size:16px">Recibo de pago de planilla</h2>
      <p style="text-align:right">Fecha: ${fmtDate(todayISO())}</p>
      <p><strong>Recibí de:</strong> ${escapeHtml(empresaTexto)}</p>
      <p><strong>La cantidad de:</strong> ${montoATextoEs(liquido)} (${fmtMoney(liquido)})</p>
      <p><strong>Por concepto de:</strong> Pago de salario mes de ${fmtPeriodo(periodo)}. — ${datos.diasLaborados} días laborados</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="border-bottom:1px solid #333">
            <th style="text-align:left;padding:5px 6px">Descripción</th>
            <th style="text-align:right;padding:5px 6px">Ingresos</th>
            <th style="text-align:right;padding:5px 6px">Otros ingresos</th>
            <th style="text-align:right;padding:5px 6px">Deducciones</th>
          </tr>
        </thead>
        <tbody>
          ${fila("Sueldo ordinario por días laborados", datos.salarioBase)}
          ${fila("Horas extras", datos.horasExtraMonto)}
          ${fila("Comisiones", datos.comisiones)}
          ${fila("Vacaciones", datos.vacaciones)}
          ${fila("Bonificación Decreto 37/2001", null, datos.bonificacion)}
          ${fila("Anticipo 1ra. quincena", null, null, datos.anticipo)}
          ${fila("IGSS", null, null, datos.igss)}
          ${fila("Préstamos o anticipos", null, null, datos.prestamos)}
          ${fila("Retención ISR", null, null, datos.retencionIsr)}
          ${debitoIgssSuspension > 0 ? fila(`Débito por suspensión IGSS (${datos.diasSuspendidoIgss || ""} día(s))`, null, null, debitoIgssSuspension) : ""}
          ${fila("Otros", null, null, datos.otros)}
        </tbody>
        <tfoot>
          <tr style="border-top:1px solid #333;font-weight:700">
            <td style="padding:6px">Totales</td>
            <td style="padding:6px;text-align:right">${fmtMoney(totalIngresos)}</td>
            <td style="padding:6px;text-align:right">${fmtMoney(datos.bonificacion)}</td>
            <td style="padding:6px;text-align:right">${fmtMoney(totalDeducciones)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="text-align:right;font-weight:700;font-size:15px">LÍQUIDO A RECIBIR: ${fmtMoney(liquido)}</p>
      <p style="margin-top:70px">(f) _____________________________<br>${escapeHtml(colaborador.full_name)}</p>
      ${footer}
    </div>
  `;
}

const IGSS_TASA_NORMAL = 0.0483;
const IGSS_TASA_JUBILADO = 0.03;

function calcularIgss(salarioBase, jubilado) {
  const tasa = jubilado ? IGSS_TASA_JUBILADO : IGSS_TASA_NORMAL;
  return Math.round(salarioBase * tasa * 100) / 100;
}

function openReciboModal(colaborador, periodo, ingresosAuto) {
  const tasaTexto = colaborador.jubilado ? "3% IVS (jubilado)" : "4.83%";
  const modal = openModal(`Recibo — ${colaborador.full_name} (${fmtPeriodo(periodo)})`, `
    <form id="reciboForm">
      <div class="row-2">
        <div class="field"><label>Días laborados</label><input class="input" type="number" step="1" min="0" max="31" name="dias_laborados" value="30"></div>
        <div class="field"><label>Vacaciones (Q)</label><input class="input" type="number" step="0.01" min="0" name="vacaciones" value="0"></div>
      </div>
      <p class="field hint">Ingresos automáticos: salario base ${fmtMoney(ingresosAuto.salarioBase)}, horas extra ${fmtMoney(ingresosAuto.horasExtraMonto)}, comisiones ${fmtMoney(ingresosAuto.comisiones)}, bonificación ${fmtMoney(ingresosAuto.bonificacion)}.</p>
      ${
        ingresosAuto.debitoIgssSuspension > 0
          ? `<p class="field hint" style="color:#E4665F">Se detectó una suspensión IGSS este mes: se debitan automáticamente ${fmtMoney(ingresosAuto.debitoIgssSuspension)} (${ingresosAuto.diasSuspendidoIgss} día(s)).</p>`
          : ""
      }
      <div class="card-title" style="font-size:13px;margin-top:6px">Deducciones (completa lo que aplique)</div>
      <div class="row-2">
        <div class="field"><label>Anticipo 1ra. quincena</label><input class="input" type="number" step="0.01" min="0" name="anticipo" value="0"></div>
        <div class="field">
          <label>IGSS (${tasaTexto} sobre salario base)</label>
          <input class="input" type="number" step="0.01" min="0" name="igss" value="${ingresosAuto.igssCalculado}">
        </div>
      </div>
      <div class="row-2">
        <div class="field"><label>Préstamos o anticipos</label><input class="input" type="number" step="0.01" min="0" name="prestamos" value="0"></div>
        <div class="field"><label>Retención ISR</label><input class="input" type="number" step="0.01" min="0" name="retencion_isr" value="0"></div>
      </div>
      <div class="field"><label>Otros</label><input class="input" type="number" step="0.01" min="0" name="otros" value="0"></div>
      <button class="btn btn-primary btn-block" type="submit">Generar e imprimir</button>
    </form>
  `);

  modal.querySelector("#reciboForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const datos = {
      ...ingresosAuto,
      diasLaborados: Number(f.get("dias_laborados") || 0),
      vacaciones: Number(f.get("vacaciones") || 0),
      anticipo: Number(f.get("anticipo") || 0),
      igss: Number(f.get("igss") || 0),
      prestamos: Number(f.get("prestamos") || 0),
      retencionIsr: Number(f.get("retencion_isr") || 0),
      otros: Number(f.get("otros") || 0),
    };
    const totalIngresos = datos.salarioBase + datos.horasExtraMonto + datos.comisiones + datos.vacaciones + datos.bonificacion;
    const totalDeducciones = datos.anticipo + datos.igss + datos.prestamos + datos.retencionIsr + datos.otros + (datos.debitoIgssSuspension || 0);
    if (totalDeducciones > totalIngresos) {
      return toast("Las deducciones superan los ingresos — revisa los montos antes de generar el recibo.", true);
    }

    const win = window.open("", "_blank");
    if (!win) {
      toast("El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.", true);
      return;
    }
    const html = reciboHtml(colaborador, periodo, datos);
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Recibo</title></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
    modal.remove();
  });
}

// ============================================================================
// Vista: Cartas (RRHH) — constancia laboral / constancia de ingresos,
// siguiendo los machotes reales de Accesorios Ilimitados.
// ============================================================================

const LETTERHEAD_ACCISA = {
  logo: "/assets/logo-accesorios-ilimitados.jpg",
  razonSocial: "Accesorios Ilimitados, Sociedad Anónima",
  direccion: "6ª. Avenida 9-39 Zona 9, Guatemala C.A.",
  telefono: "(502) 2326-1919",
  email: "accesorios@imisagt.com",
};
const LETTERHEAD_ISSA = {
  logo: "/assets/logo-issa.jpeg",
  razonSocial: "Internacional de Suministros, Sociedad Anónima",
  direccion: "Ruta 6, 3-19, Zona 4 Guatemala, C.A.",
  telefono: "(502) 2326-1919 – Fax: (502) 2326-1912",
  email: "matabi@imisagt.com",
};
const LETTERHEAD_IMISA = {
  logo: "/assets/logo-imisa.jpeg",
  razonSocial: "Importadora de Maquinaria Industrial, Sociedad Anónima",
  direccion: "Ruta 6, 3-19, Zona 4 Guatemala, C.A.",
  telefono: "(502) 2326-1919",
  email: "maquinaria@imisagt.com",
};
const LETTERHEAD_POR_EMPRESA = {
  // "accesorios ilimitados" se deja por compatibilidad con datos de prueba;
  // "accisa" es el valor real que usa el campo Empresa en Planilla.
  "accesorios ilimitados": LETTERHEAD_ACCISA,
  accisa: LETTERHEAD_ACCISA,
  issa: LETTERHEAD_ISSA,
  imisa: LETTERHEAD_IMISA,
};

function getLetterhead(empresa) {
  return LETTERHEAD_POR_EMPRESA[(empresa || "").toLowerCase().trim()] || null;
}

function cartaHeaderFooterHtml(letterhead, nombreEmpresa) {
  const header = letterhead
    ? `<img src="${window.location.origin}${letterhead.logo}" alt="" style="height:70px;margin-bottom:24px">`
    : `<div style="font-weight:700;font-size:18px;margin-bottom:24px">${escapeHtml(nombreEmpresa || "Grupo IMISA")}</div>`;
  const footer = letterhead
    ? `<div style="margin-top:70px;padding-top:10px;border-top:1px solid #999;font-size:10px;color:#555;text-align:center">
        ${escapeHtml(letterhead.razonSocial)} · ${escapeHtml(letterhead.direccion)} · Tel. ${escapeHtml(letterhead.telefono)} · ${escapeHtml(letterhead.email)}
      </div>`
    : "";
  return { header, footer };
}

function cartaLaboralHtml(colaborador) {
  const letterhead = getLetterhead(colaborador.empresa);
  const { header, footer } = cartaHeaderFooterHtml(letterhead, colaborador.empresa);
  const rangoFechas = colaborador.fecha_egreso
    ? `laboró en esta empresa desde el ${fechaCortaEs(colaborador.fecha_ingreso)} al ${fechaCortaEs(colaborador.fecha_egreso)}`
    : `labora en esta empresa desde el ${fechaCortaEs(colaborador.fecha_ingreso)} a la fecha`;

  return `
    <div class="print-area" style="max-width:700px;margin:0 auto;padding:40px;font-family:Georgia,serif;color:#111;background:#fff;font-size:14px">
      ${header}
      <p><strong>A quien interese:</strong></p>
      <p style="line-height:1.9;text-align:justify">
        De acuerdo a lo establecido en el artículo 87 del Código de Trabajo, por este medio se hace constar que
        <strong>${escapeHtml(colaborador.full_name)}</strong>, quien se identifica con Documento Personal de Identificación
        -DPI- <strong>${escapeHtml(colaborador.dpi || "____________________")}</strong>, ${rangoFechas},
        desempeñando el puesto de <strong>${escapeHtml(colaborador.puesto || "—")}</strong>.
      </p>
      <p style="line-height:1.9;text-align:justify">
        Y para los usos que al interesado convengan, se extiende la presente constancia laboral en una hoja
        membretada, firmada y sellada de la empresa, en la ciudad de Guatemala, a los ${fechaATextoEs(todayISO())}.
      </p>
      <p style="margin-top:60px">Atentamente,</p>
      <p style="margin-top:70px">_____________________________<br>Recursos Humanos</p>
      ${footer}
    </div>
  `;
}

function cartaIngresosHtml(colaborador, salarioBase, bonificacion) {
  const letterhead = getLetterhead(colaborador.empresa);
  const { header, footer } = cartaHeaderFooterHtml(letterhead, colaborador.empresa);
  const total = salarioBase + bonificacion;

  return `
    <div class="print-area" style="max-width:700px;margin:0 auto;padding:40px;font-family:Georgia,serif;color:#111;background:#fff;font-size:14px">
      ${header}
      <h2 style="text-align:center;text-transform:uppercase;letter-spacing:.05em;font-size:16px">Constancia de Ingresos</h2>
      <p style="line-height:1.9;text-align:justify">
        Por este medio, hacemos constar que <strong>${escapeHtml(colaborador.full_name)}</strong>, quien se identifica con
        Documento Personal de Identificación -DPI- <strong>${escapeHtml(colaborador.dpi || "____________________")}</strong>,
        labora en esta empresa desempeñando el puesto de <strong>${escapeHtml(colaborador.puesto || "—")}</strong>, desde el
        ${fechaCortaEs(colaborador.fecha_ingreso)} a la fecha, devengando un salario mensual de
        <strong>${montoATextoEs(total)} (${fmtMoney(total)})</strong> distribuidos de la siguiente manera:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0">
        <tr><td style="padding:4px 0">Salario Base</td><td style="padding:4px 0;text-align:right">${fmtMoney(salarioBase)}</td></tr>
        <tr><td style="padding:4px 0">Bonificación</td><td style="padding:4px 0;text-align:right">${fmtMoney(bonificacion)}</td></tr>
        <tr style="border-top:1px solid #333;font-weight:700"><td style="padding:6px 0">Total Salario Mensual</td><td style="padding:6px 0;text-align:right">${fmtMoney(total)}</td></tr>
      </table>
      <p style="line-height:1.9;text-align:justify">
        Para los usos que al interesado convengan se extiende y firma la presente en la ciudad de Guatemala,
        a los ${fechaATextoEs(todayISO())}.
      </p>
      <p style="margin-top:60px">Atentamente,</p>
      <p style="margin-top:70px">_____________________________<br>Recursos Humanos</p>
      ${footer}
    </div>
  `;
}

async function renderCartas() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/cartas");
  const colaboradores = await api.listProfiles();
  root.innerHTML = `
    <div class="card">
      <div class="card-title">Generar constancia</div>
      <form id="cartaForm">
        <div class="field"><label>Colaborador</label>
          <select class="select" name="colaborador_id" required><option value="">Selecciona…</option>
            ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Tipo</label>
          <select class="select" name="tipo">
            <option value="laboral">Constancia laboral</option>
            <option value="ingresos">Constancia de ingresos</option>
          </select>
        </div>
        <p class="field hint">Usa el DPI y el salario que tengas guardados en Planilla — revísalos antes de generar si no están completos.</p>
        <button class="btn btn-primary btn-block" type="submit">Generar e imprimir</button>
      </form>
    </div>
  `;

  document.getElementById("cartaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const colaborador = colaboradores.find((c) => c.id === f.get("colaborador_id"));
    if (!colaborador) return toast("Selecciona un colaborador.", true);
    const tipo = f.get("tipo");

    // Se abre la ventana de inmediato (dentro del gesto del usuario) para
    // evitar que el navegador bloquee el popup; el contenido se llena después.
    const win = window.open("", "_blank");
    if (!win) {
      toast("El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.", true);
      return;
    }

    let html;
    if (tipo === "ingresos") {
      let salarioBase = 0;
      let bonificacion = 0;
      try {
        const comp = await api.getCompensacion(colaborador.id);
        salarioBase = Number(comp?.salario_mensual || 0);
        bonificacion = Number(comp?.bonificacion_mensual || 0);
      } catch (err) {
        console.error(err);
      }
      if (!salarioBase && !bonificacion) {
        win.close();
        return toast("Este colaborador no tiene salario registrado en Planilla.", true);
      }
      html = cartaIngresosHtml(colaborador, salarioBase, bonificacion);
    } else {
      html = cartaLaboralHtml(colaborador);
    }

    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Constancia</title></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  });
}

// ============================================================================
// Arranque
// ============================================================================

bootstrap();
