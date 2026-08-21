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
  const label = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado", listo: "Listo" }[estado] || estado;
  return `<span class="pill pill-${estado}">${escapeHtml(label)}</span>`;
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
      { hash: "#/vacaciones", label: "Vacaciones" },
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
    { hash: "#/vacaciones", label: "Vacaciones" },
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
    const comp = await api.getCompensacion(profile.id);
    const anual = comp ? Number(comp.salario_mensual) * 12 + Number(comp.bono_anual) : 0;
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile"><div class="stat-value">${tiempoEnEmpresa(profile.fecha_ingreso)}</div><div class="stat-label">Tiempo en la empresa</div></div>
        <div class="stat-tile"><div class="stat-value">${fmtMoney(comp?.salario_mensual, comp?.moneda)}</div><div class="stat-label">Salario mensual</div></div>
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
    `;
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
      const mensual = Number(c?.salario_mensual || 0);
      const anual = mensual * 12 + Number(c?.bono_anual || 0);
      if (p.activo) {
        totalMensual += mensual;
        totalAnual += anual;
      }
      return `
        <tr data-edit="${p.id}" style="cursor:pointer">
          <td>${escapeHtml(p.full_name)}</td>
          <td>${escapeHtml(p.empresa || "—")}</td>
          <td>${escapeHtml(p.puesto || "—")}</td>
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

  document.getElementById("planillaStats").innerHTML = `
    <div class="stat-tile"><div class="stat-value">${activos}</div><div class="stat-label">Colaboradores activos</div></div>
    <div class="stat-tile"><div class="stat-value">${fmtMoney(totalMensual)}</div><div class="stat-label">Compensación mensual</div></div>
    <div class="stat-tile"><div class="stat-value">${fmtMoney(totalAnual)}</div><div class="stat-label">Compensación anual</div></div>
    <div class="stat-tile"><div class="stat-value">${rotacion}%</div><div class="stat-label">Rotación (12 meses)</div></div>
  `;
  document.getElementById("planillaTableBody").innerHTML =
    rows || `<tr><td colspan="8" class="empty-state">Sin colaboradores en esta empresa.</td></tr>`;

  root.querySelectorAll("[data-edit]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const p = colaboradores.find((c) => c.id === tr.dataset.edit);
      openEditColaborador(p, compById[p.id]);
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
      <div class="stat-grid" id="planillaStats"></div>
      <div class="card">
        <div class="card-title">Planilla — click en una fila para editar</div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nombre</th><th>Empresa</th><th>Puesto</th><th>Ingreso</th><th>Tiempo</th><th>Mensual</th><th>Anual</th><th>Estado</th></tr></thead>
            <tbody id="planillaTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    drawPlanillaTable(root, colaboradores, compById, "");
    document.getElementById("empresaFilter").addEventListener("change", (e) => {
      drawPlanillaTable(root, colaboradores, compById, e.target.value);
    });
  } catch (err) {
    handleErr(err);
  }
}

function openEditColaborador(p, comp) {
  const modal = openModal(`Editar — ${p.full_name}`, `
    <form id="editColabForm">
      <div class="row-2">
        <div class="field"><label>Empresa</label><input class="input" name="empresa" value="${escapeHtml(p.empresa || "")}" placeholder="Ej. Accesorios Ilimitados"></div>
        <div class="field"><label>Puesto</label><input class="input" name="puesto" value="${escapeHtml(p.puesto || "")}"></div>
      </div>
      <div class="field"><label>Área</label><input class="input" name="area" value="${escapeHtml(p.area || "")}"></div>
      <div class="row-2">
        <div class="field"><label>Fecha de ingreso</label><input class="input" type="date" name="fecha_ingreso" value="${p.fecha_ingreso || ""}"></div>
        <div class="field"><label>Fecha de nacimiento</label><input class="input" type="date" name="fecha_nacimiento" value="${p.fecha_nacimiento || ""}"></div>
      </div>
      <div class="row-2">
        <div class="field"><label>Salario mensual</label><input class="input" type="number" step="0.01" min="0" name="salario_mensual" value="${comp?.salario_mensual || 0}"></div>
        <div class="field"><label>Bono anual</label><input class="input" type="number" step="0.01" min="0" name="bono_anual" value="${comp?.bono_anual || 0}"></div>
      </div>
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

  modal.querySelector("#editColabForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api.updateProfile(p.id, {
        empresa: f.get("empresa") || null,
        puesto: f.get("puesto") || null,
        area: f.get("area") || null,
        fecha_ingreso: f.get("fecha_ingreso") || null,
        fecha_nacimiento: f.get("fecha_nacimiento") || null,
        fecha_egreso: f.get("fecha_egreso") || null,
        activo: f.get("activo") === "true",
      });
      await api.setCompensacion(
        p.id,
        { salario_mensual: Number(f.get("salario_mensual") || 0), bono_anual: Number(f.get("bono_anual") || 0), moneda: comp?.moneda || "GTQ" },
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

async function renderVacaciones() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/vacaciones");
  const isRrhh = profile.role === "rrhh";

  try {
    if (isRrhh) {
      const [pendientes, colaboradores] = await Promise.all([
        api.listSolicitudesVacaciones().then((all) => all.filter((s) => s.estado === "pendiente")),
        api.listProfiles(),
      ]);
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
          <div class="card-title">Saldo por colaborador</div>
          <div class="field"><select class="select" id="colabSelect"><option value="">Selecciona un colaborador…</option>
            ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
          </select></div>
          <div id="colabDetail"></div>
        </div>
      `;

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
            <div class="field"><label>Motivo (opcional)</label><input class="input" name="motivo"></div>
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
          await api.crearSolicitudVacaciones(profile.id, { fecha_inicio, fecha_fin, dias_habiles, motivo: f.get("motivo") || null });
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

// ============================================================================
// Vista: Documentos (drive)
// ============================================================================

function categoriaOptions() {
  return ["contrato", "identificacion", "carta", "evaluacion", "firmado", "otro"]
    .map((c) => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`)
    .join("");
}

async function renderDrivePara(colaboradorId, host) {
  host.innerHTML = `<div class="empty-state">Cargando…</div>`;
  const docs = await api.listDocumentos(colaboradorId);
  host.innerHTML = `
    <form id="uploadForm" class="row-2" style="align-items:end;margin-bottom:14px">
      <div class="field"><label>Categoría</label><select class="select" name="categoria">${categoriaOptions()}</select></div>
      <div class="field"><label>Archivo</label><input class="input" type="file" name="file" required></div>
      <button class="btn btn-primary" style="grid-column:1/-1" type="submit">Subir documento</button>
    </form>
    ${
      docs.length
        ? docs
            .map(
              (d) => `
        <div class="list-row">
          <div class="list-row-main"><div class="list-row-title">${escapeHtml(d.nombre)}</div><div class="list-row-sub">${escapeHtml(d.categoria)} · ${fmtDate(d.created_at)}</div></div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-view="${d.storage_path}">Ver</button>
            ${profile.role === "rrhh" ? `<button class="btn btn-danger-outline btn-sm" data-del="${d.id}" data-path="${d.storage_path}">Eliminar</button>` : ""}
          </div>
        </div>`
            )
            .join("")
        : `<div class="empty-state">Sin documentos todavía.</div>`
    }
  `;

  host.querySelector("#uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const file = f.get("file");
    if (!file || !file.size) return toast("Selecciona un archivo.", true);
    try {
      await api.subirDocumento(colaboradorId, file, f.get("categoria"), profile.id);
      toast("Documento subido.");
      renderDrivePara(colaboradorId, host);
    } catch (err) {
      handleErr(err);
    }
  });

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
        renderDrivePara(colaboradorId, host);
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
    await renderDrivePara(profile.id, document.getElementById("driveHost"));
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
      await renderDrivePara(id, host);
    });
  }
}

// ============================================================================
// Vista: Horas extra
// ============================================================================

async function renderHorasExtraPara(colaboradorId, host, showForm) {
  const anio = new Date().getFullYear();
  host.innerHTML = `<div class="empty-state">Cargando…</div>`;
  const registros = await api.listHorasExtra(colaboradorId, anio);
  const total = registros.reduce((s, r) => s + Number(r.horas), 0);
  host.innerHTML = `
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-value">${total}</div><div class="stat-label">Horas extra en ${anio}</div></div>
    </div>
    ${
      showForm
        ? `<form id="heForm" class="row-2" style="align-items:end;margin-bottom:14px">
            <div class="field"><label>Fecha</label><input class="input" type="date" name="fecha" value="${todayISO()}" required></div>
            <div class="field"><label>Horas</label><input class="input" type="number" step="0.25" min="0" name="horas" required></div>
            <div class="field" style="grid-column:1/-1"><label>Motivo (opcional)</label><input class="input" name="motivo"></div>
            <button class="btn btn-primary" style="grid-column:1/-1" type="submit">Registrar</button>
          </form>`
        : ""
    }
    ${
      registros.length
        ? registros.map((r) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${fmtDate(r.fecha)}</div><div class="list-row-sub">${escapeHtml(r.motivo || "")}</div></div><div>${r.horas} h</div></div>`).join("")
        : `<div class="empty-state">Sin registros en ${anio}.</div>`
    }
  `;

  if (showForm) {
    host.querySelector("#heForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.registrarHorasExtra(colaboradorId, { fecha: f.get("fecha"), horas: Number(f.get("horas")), motivo: f.get("motivo") || null }, profile.id);
        toast("Horas registradas.");
        renderHorasExtraPara(colaboradorId, host, true);
      } catch (err) {
        handleErr(err);
      }
    });
  }
}

async function renderHorasExtra() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/horas-extra");
  if (profile.role !== "rrhh") {
    root.innerHTML = `<div class="card"><div class="card-title">Mis horas extra</div><div id="heHost"></div></div>`;
    await renderHorasExtraPara(profile.id, document.getElementById("heHost"), false);
    return;
  }
  const colaboradores = await api.listProfiles();
  root.innerHTML = `
    <div class="card">
      <div class="card-title">Registrar horas extra</div>
      <div class="field"><select class="select" id="colabSelect"><option value="">Selecciona un colaborador…</option>
        ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
      </select></div>
      <div id="heHost"></div>
    </div>
  `;
  document.getElementById("colabSelect").addEventListener("change", async (e) => {
    const host = document.getElementById("heHost");
    if (!e.target.value) {
      host.innerHTML = "";
      return;
    }
    await renderHorasExtraPara(e.target.value, host, true);
  });
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
              <div class="field"><label>Resultado</label><input class="input" name="resultado" placeholder="Ej. Sobresaliente" required></div>
            </div>
            <div class="field"><label>Comentarios</label><textarea class="textarea" name="comentarios"></textarea></div>
            <button class="btn btn-primary btn-block" type="submit">Registrar evaluación</button>
          </form>`
        : ""
    }
    ${
      evals.length
        ? evals.map((e) => `<div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHtml(e.periodo)} — ${escapeHtml(e.resultado)}</div><div class="list-row-sub">${escapeHtml(e.comentarios || "")}</div></div></div>`).join("")
        : `<div class="empty-state">Sin evaluaciones registradas.</div>`
    }
  `;
  if (showForm) {
    host.querySelector("#evalForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.crearEvaluacion(colaboradorId, { periodo: f.get("periodo"), resultado: f.get("resultado"), comentarios: f.get("comentarios") || null }, profile.id);
        toast("Evaluación registrada.");
        renderEvaluacionesPara(colaboradorId, host, true);
      } catch (err) {
        handleErr(err);
      }
    });
  }
}

async function renderEvaluaciones() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/evaluaciones");
  if (profile.role !== "rrhh") {
    root.innerHTML = `<div class="card"><div class="card-title">Mis evaluaciones de desempeño</div><div id="evalHost"></div></div>`;
    await renderEvaluacionesPara(profile.id, document.getElementById("evalHost"), false);
    return;
  }
  const colaboradores = await api.listProfiles();
  root.innerHTML = `
    <div class="card">
      <div class="card-title">Evaluaciones de desempeño</div>
      <div class="field"><select class="select" id="colabSelect"><option value="">Selecciona un colaborador…</option>
        ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
      </select></div>
      <div id="evalHost"></div>
    </div>
  `;
  document.getElementById("colabSelect").addEventListener("change", async (e) => {
    const host = document.getElementById("evalHost");
    if (!e.target.value) {
      host.innerHTML = "";
      return;
    }
    await renderEvaluacionesPara(e.target.value, host, true);
  });
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

  let cells = "";
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-day other-month"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const events = [
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

  root.innerHTML = `
    ${isRrhh ? `<div style="margin-bottom:14px"><button class="btn btn-primary" id="newRoleBtn">+ Nuevo puesto</button></div>` : ""}
    ${
      roles.length
        ? roles
            .map(
              (r) => `
        <div class="card">
          <div class="card-title">${escapeHtml(r.puesto)}</div>
          <p style="color:var(--text-dim);white-space:pre-wrap">${escapeHtml(r.descripcion || "Sin descripción.")}</p>
          ${r.requisitos ? `<p class="label-sm" style="margin-bottom:4px">Requisitos</p><p style="color:var(--text-mute);white-space:pre-wrap">${escapeHtml(r.requisitos)}</p>` : ""}
          ${isRrhh ? `<button class="btn btn-ghost btn-sm" data-edit-role="${r.id}">Editar</button>` : ""}
        </div>`
            )
            .join("")
        : `<div class="empty-state">Aún no hay descripciones de puestos.</div>`
    }
  `;

  const openRoleForm = (r) => {
    const modal = openModal(r ? `Editar — ${r.puesto}` : "Nuevo puesto", `
      <form id="roleForm">
        <div class="field"><label>Puesto</label><input class="input" name="puesto" value="${escapeHtml(r?.puesto || "")}" required ${r ? "readonly" : ""}></div>
        <div class="field"><label>Descripción</label><textarea class="textarea" name="descripcion">${escapeHtml(r?.descripcion || "")}</textarea></div>
        <div class="field"><label>Requisitos</label><textarea class="textarea" name="requisitos">${escapeHtml(r?.requisitos || "")}</textarea></div>
        <button class="btn btn-primary btn-block" type="submit">Guardar</button>
      </form>
    `);
    modal.querySelector("#roleForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.guardarDescripcionRol({ id: r?.id, puesto: f.get("puesto"), descripcion: f.get("descripcion") || null, requisitos: f.get("requisitos") || null }, profile.id);
        modal.remove();
        toast("Guardado.");
        renderRolesView();
      } catch (err) {
        handleErr(err);
      }
    });
  };

  if (isRrhh) {
    document.getElementById("newRoleBtn").addEventListener("click", () => openRoleForm(null));
    root.querySelectorAll("[data-edit-role]").forEach((btn) =>
      btn.addEventListener("click", () => openRoleForm(roles.find((r) => r.id === btn.dataset.editRole)))
    );
  }
}

// ============================================================================
// Vista: Cartas (RRHH) — genera una carta imprimible / descargable
// ============================================================================

function cartaHtml({ tipo, colaborador, destinatario, motivo, salarioTexto }) {
  const fecha = fmtDate(todayISO());
  const cuerpo =
    tipo === "ingreso"
      ? `Por este medio se hace constar que <strong>${escapeHtml(colaborador.full_name)}</strong> labora en Grupo IMISA desde el <strong>${fmtDate(colaborador.fecha_ingreso)}</strong>, desempeñando el puesto de <strong>${escapeHtml(colaborador.puesto || "—")}</strong>${salarioTexto ? `, con un salario mensual de <strong>${escapeHtml(salarioTexto)}</strong>` : ""}.`
      : `Por este medio hago constar que <strong>${escapeHtml(colaborador.full_name)}</strong> laboró/labora en Grupo IMISA desde el <strong>${fmtDate(colaborador.fecha_ingreso)}</strong>${colaborador.fecha_egreso ? ` hasta el <strong>${fmtDate(colaborador.fecha_egreso)}</strong>` : ""}, desempeñando el puesto de <strong>${escapeHtml(colaborador.puesto || "—")}</strong>. ${escapeHtml(motivo || "")}`;

  return `
    <div class="print-area" style="max-width:700px;margin:0 auto;padding:40px;font-family:Georgia,serif;color:#111;background:#fff">
      <p style="text-align:right">Guatemala, ${fecha}</p>
      <h2 style="text-align:center;text-transform:uppercase;letter-spacing:.05em">${tipo === "ingreso" ? "Carta de ingreso laboral" : "Carta de recomendación laboral"}</h2>
      ${destinatario ? `<p><strong>A quien interese: ${escapeHtml(destinatario)}</strong></p>` : `<p><strong>A quien interese:</strong></p>`}
      <p style="line-height:1.8">${cuerpo}</p>
      <p style="margin-top:60px">Atentamente,</p>
      <p style="margin-top:60px">_____________________________<br>Jefatura de Recursos Humanos<br>Grupo IMISA</p>
    </div>
  `;
}

async function renderCartas() {
  const root = renderShell(`<div class="empty-state">Cargando…</div>`, "#/cartas");
  const colaboradores = await api.listProfiles();
  root.innerHTML = `
    <div class="card">
      <div class="card-title">Generar carta</div>
      <form id="cartaForm">
        <div class="field"><label>Colaborador</label>
          <select class="select" name="colaborador_id" required><option value="">Selecciona…</option>
            ${colaboradores.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Tipo de carta</label>
          <select class="select" name="tipo">
            <option value="ingreso">Carta de ingreso</option>
            <option value="recomendacion">Carta de recomendación</option>
          </select>
        </div>
        <div class="field"><label>Dirigida a (opcional)</label><input class="input" name="destinatario" placeholder="Ej. Banco / Empresa"></div>
        <div class="field"><label>Motivo / detalle adicional (opcional)</label><textarea class="textarea" name="motivo"></textarea></div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px;color:var(--text-dim)">
          <input type="checkbox" name="incluir_salario"> Incluir salario mensual en la carta de ingreso
        </label>
        <button class="btn btn-primary btn-block" type="submit">Generar e imprimir</button>
      </form>
    </div>
  `;

  document.getElementById("cartaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const colaborador = colaboradores.find((c) => c.id === f.get("colaborador_id"));
    if (!colaborador) return toast("Selecciona un colaborador.", true);

    // Se abre la ventana de inmediato (dentro del gesto del usuario) para
    // evitar que el navegador bloquee el popup; el contenido se llena después.
    const win = window.open("", "_blank");

    let salarioTexto = "";
    if (f.get("incluir_salario")) {
      try {
        const comp = await api.getCompensacion(colaborador.id);
        if (comp) salarioTexto = fmtMoney(comp.salario_mensual, comp.moneda);
      } catch (err) {
        console.error(err);
      }
    }

    const html = cartaHtml({
      tipo: f.get("tipo"),
      colaborador,
      destinatario: f.get("destinatario"),
      motivo: f.get("motivo"),
      salarioTexto,
    });

    if (!win) {
      toast("El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.", true);
      return;
    }
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Carta</title></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  });
}

// ============================================================================
// Arranque
// ============================================================================

bootstrap();
