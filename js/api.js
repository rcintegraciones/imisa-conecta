import { supabase } from "./supabaseClient.js";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return data.subscription;
}

export async function sendPasswordReset(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getMyProfile() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData?.user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Perfiles / planilla
// ---------------------------------------------------------------------------

export async function listProfiles({ soloActivos = true } = {}) {
  let query = supabase.from("profiles").select("*").order("full_name");
  if (soloActivos) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateProfile(id, fields) {
  const { data, error } = await supabase.from("profiles").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Compensación
// ---------------------------------------------------------------------------

export async function listCompensaciones() {
  const { data, error } = await supabase.from("compensacion").select("*");
  if (error) throw error;
  return data;
}

export async function getCompensacion(colaboradorId) {
  const { data, error } = await supabase
    .from("compensacion")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setCompensacion(colaboradorId, { salario_mensual, bonificacion_mensual, bono_anual, moneda }, userId) {
  const { data, error } = await supabase
    .from("compensacion")
    .upsert(
      {
        colaborador_id: colaboradorId,
        salario_mensual,
        bonificacion_mensual: bonificacion_mensual || 0,
        bono_anual,
        moneda,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "colaborador_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listHistorialCompensacion(colaboradorId) {
  const { data, error } = await supabase
    .from("historial_compensacion")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("vigente_hasta", { ascending: false });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Planilla mensual (base + incentivo + bonificación + comisiones)
// ---------------------------------------------------------------------------

export async function getPlanillaMensual(colaboradorId, periodo) {
  const { data, error } = await supabase
    .from("planilla_mensual")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPlanillaMensual(periodo) {
  const { data, error } = await supabase.from("planilla_mensual").select("*").eq("periodo", periodo);
  if (error) throw error;
  return data;
}

export async function setPlanillaMensual(colaboradorId, periodo, { incentivo, bonificacion, comisiones }, userId) {
  const comp = await getCompensacion(colaboradorId);
  const { data, error } = await supabase
    .from("planilla_mensual")
    .upsert(
      {
        colaborador_id: colaboradorId,
        periodo,
        salario_base: Number(comp?.salario_mensual || 0),
        incentivo: Number(incentivo || 0),
        bonificacion: Number(bonificacion || 0),
        comisiones: Number(comisiones || 0),
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "colaborador_id,periodo" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Vacaciones
// ---------------------------------------------------------------------------

export async function listVacacionesAjustes(colaboradorId) {
  let query = supabase.from("vacaciones_ajustes").select("*").order("created_at", { ascending: false });
  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function crearAjusteVacaciones(colaboradorId, dias, motivo, userId) {
  const { data, error } = await supabase
    .from("vacaciones_ajustes")
    .insert({ colaborador_id: colaboradorId, dias, motivo, creado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listSolicitudesVacaciones({ colaboradorId } = {}) {
  let query = supabase
    .from("solicitudes_vacaciones")
    .select("*, colaborador:profiles!solicitudes_vacaciones_colaborador_id_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function crearSolicitudVacaciones(colaboradorId, { fecha_inicio, fecha_fin, dias_habiles, motivo }) {
  const { data, error } = await supabase
    .from("solicitudes_vacaciones")
    .insert({ colaborador_id: colaboradorId, fecha_inicio, fecha_fin, dias_habiles, motivo })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolverSolicitudVacaciones(id, estado, comentario_rrhh, userId) {
  const { data, error } = await supabase
    .from("solicitudes_vacaciones")
    .update({ estado, comentario_rrhh, resuelto_por: userId, resuelto_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelarSolicitudVacaciones(id) {
  const { error } = await supabase.from("solicitudes_vacaciones").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Suspensiones IGSS
// ---------------------------------------------------------------------------

export async function listSuspensionesIgss(colaboradorId) {
  let query = supabase
    .from("suspensiones_igss")
    .select("*, colaborador:profiles!suspensiones_igss_colaborador_id_fkey(full_name, empresa)")
    .order("fecha_visita", { ascending: false });
  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function crearSuspensionIgss(payload, userId) {
  const { data, error } = await supabase
    .from("suspensiones_igss")
    .insert({ ...payload, creado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarSuspensionIgss(id, payload) {
  const { data, error } = await supabase
    .from("suspensiones_igss")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Documentos (drive)
// ---------------------------------------------------------------------------

export async function listDocumentos(colaboradorId) {
  const { data, error } = await supabase
    .from("documentos")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function subirDocumento(colaboradorId, file, categoria, userId) {
  const path = `${colaboradorId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("documentos").upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("documentos")
    .insert({ colaborador_id: colaboradorId, nombre: file.name, categoria, storage_path: path, subido_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarDocumento(id, storagePath) {
  await supabase.storage.from("documentos").remove([storagePath]);
  const { error } = await supabase.from("documentos").delete().eq("id", id);
  if (error) throw error;
}

const signedUrlCache = new Map();

export async function getDocumentoUrl(storagePath, expiresIn = 3600) {
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  signedUrlCache.set(storagePath, { url: data.signedUrl, expiresAt: Date.now() + (expiresIn - 60) * 1000 });
  return data.signedUrl;
}

export async function listSolicitudesDocumentos({ colaboradorId, soloPendientes = false } = {}) {
  let query = supabase
    .from("solicitudes_documentos")
    .select("*, colaborador:profiles!solicitudes_documentos_colaborador_id_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
  if (soloPendientes) query = query.eq("estado", "pendiente");
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function crearSolicitudDocumento(colaboradorId, tipo_documento, comentario) {
  const { data, error } = await supabase
    .from("solicitudes_documentos")
    .insert({ colaborador_id: colaboradorId, tipo_documento, comentario })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolverSolicitudDocumento(id, { estado, documento_id }, userId) {
  const { data, error } = await supabase
    .from("solicitudes_documentos")
    .update({ estado, documento_id, resuelto_por: userId, resuelto_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Horas extra
// ---------------------------------------------------------------------------

export async function listHorasExtra(colaboradorId, anio) {
  let query = supabase
    .from("horas_extra")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("fecha", { ascending: false });
  if (anio) query = query.gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// El ciclo de horas extra NO es mes calendario: va del 26 del mes anterior al
// 25 del mes del periodo (ej. periodo "2026-07" = 26 jun al 25 jul). El
// periodo se nombra por el mes en que cierra (el 25).
export function rangoPeriodoHorasExtra(periodo) {
  const [y, m] = periodo.split("-").map(Number);
  let yDesde = y;
  let mDesde = m - 1;
  if (mDesde === 0) {
    mDesde = 12;
    yDesde -= 1;
  }
  const desde = `${yDesde}-${String(mDesde).padStart(2, "0")}-26`;
  const hasta = `${y}-${String(m).padStart(2, "0")}-25`;
  return { desde, hasta };
}

// Dado un YYYY-MM-DD, devuelve a qué periodo de horas extra pertenece según
// el ciclo 26-25 (el día 26 en adelante ya cae en el periodo del mes siguiente).
export function periodoDeFecha(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  if (d <= 25) return `${y}-${String(m).padStart(2, "0")}`;
  let y2 = y;
  let m2 = m + 1;
  if (m2 === 13) {
    m2 = 1;
    y2 += 1;
  }
  return `${y2}-${String(m2).padStart(2, "0")}`;
}

export async function listHorasExtraPorPeriodo(colaboradorId, periodo) {
  const { desde, hasta } = rangoPeriodoHorasExtra(periodo);
  const { data, error } = await supabase
    .from("horas_extra")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .eq("origen", "manual")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listHorasExtraPendientesEquipo() {
  // RLS ya filtra: RRHH ve todas, una jefatura solo ve las de sus subordinados.
  const { data, error } = await supabase
    .from("horas_extra")
    .select("*, colaborador:profiles!horas_extra_colaborador_id_fkey(full_name)")
    .eq("origen", "manual")
    .eq("estado", "pendiente")
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listHorasExtraBiometrico(periodo) {
  let query = supabase
    .from("horas_extra")
    .select("*, colaborador:profiles!horas_extra_colaborador_id_fkey(full_name)")
    .eq("origen", "biometrico")
    .order("fecha", { ascending: false });
  if (periodo) {
    const { desde, hasta } = rangoPeriodoHorasExtra(periodo);
    query = query.gte("fecha", desde).lte("fecha", hasta);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listHorasExtraPlanillaOriginal(periodo) {
  const { data, error } = await supabase
    .from("horas_extra_planilla_original")
    .select("*")
    .eq("periodo", periodo);
  if (error) throw error;
  return data;
}

export async function insertarHorasExtraBiometricoLote(filas) {
  if (!filas.length) return [];
  const { data, error } = await supabase.from("horas_extra").insert(filas).select();
  if (error) throw error;
  return data;
}

export async function registrarHorasExtra(colaboradorId, { fecha, hora_salida_real, horas, tipo, motivo }, userId) {
  const { data, error } = await supabase
    .from("horas_extra")
    .insert({ colaborador_id: colaboradorId, fecha, hora_salida_real: hora_salida_real || null, horas, tipo: tipo || "simple", motivo, creado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function validarHorasExtra(id, userId) {
  const { data, error } = await supabase
    .from("horas_extra")
    .update({ estado: "validado", validado_por: userId, validado_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Cierres mensuales de horas extra ("congelar" -> calcula el monto)
// ---------------------------------------------------------------------------

export async function getCierreHorasExtra(colaboradorId, periodo) {
  const { data, error } = await supabase
    .from("cierres_horas_extra")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Congela el mes: suma las horas extra manuales YA VALIDADAS de ese período y
// calcula el monto con (salario_mensual / 30 / 8) x 1.5 x horas.
export async function congelarHorasExtra(colaboradorId, periodo, userId) {
  const [horasDelMes, comp] = await Promise.all([
    listHorasExtraPorPeriodo(colaboradorId, periodo),
    getCompensacion(colaboradorId),
  ]);
  const validadas = horasDelMes.filter((h) => h.estado === "validado");
  const totalSimples = validadas.filter((h) => h.tipo !== "doble").reduce((s, h) => s + Number(h.horas), 0);
  const totalDobles = validadas.filter((h) => h.tipo === "doble").reduce((s, h) => s + Number(h.horas), 0);
  const salarioMensual = Number(comp?.salario_mensual || 0);
  const horaBase = salarioMensual / 30 / 8;
  const monto = horaBase * 1.5 * totalSimples + horaBase * 2 * totalDobles;

  const { data, error } = await supabase
    .from("cierres_horas_extra")
    .upsert(
      {
        colaborador_id: colaboradorId,
        periodo,
        total_horas: totalSimples + totalDobles,
        total_horas_simples: totalSimples,
        total_horas_dobles: totalDobles,
        salario_usado: salarioMensual,
        monto,
        creado_por: userId,
      },
      { onConflict: "colaborador_id,periodo" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Evaluaciones de desempeño
// ---------------------------------------------------------------------------

export async function listEvaluaciones(colaboradorId) {
  const { data, error } = await supabase
    .from("evaluaciones_desempeno")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Para la vista admin: todas las evaluaciones con nombre del colaborador y de
// quien evaluó, filtrables por periodo / área / colaborador.
export async function listEvaluacionesAdmin({ periodo, colaboradorId } = {}) {
  let query = supabase
    .from("evaluaciones_desempeno")
    .select(
      "*, colaborador:profiles!evaluaciones_desempeno_colaborador_id_fkey(full_name, area), evaluador:profiles!evaluaciones_desempeno_creado_por_fkey(full_name)"
    )
    .order("created_at", { ascending: false });
  if (periodo) query = query.eq("periodo", periodo);
  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Subordinados directos de un jefe (según el organigrama en profiles.jefe_id).
export async function listSubordinados(jefeId) {
  const [{ data: directos, error: e1 }, { data: adicionalesRows, error: e2 }] = await Promise.all([
    supabase.from("profiles").select("*").eq("jefe_id", jefeId).order("full_name"),
    supabase.from("jefaturas_adicionales").select("colaborador:profiles!jefaturas_adicionales_colaborador_id_fkey(*)").eq("jefe_id", jefeId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const adicionales = (adicionalesRows || []).map((r) => r.colaborador).filter(Boolean);
  const porId = new Map([...directos, ...adicionales].map((p) => [p.id, p]));
  return [...porId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

// ---------------------------------------------------------------------------
// Jefaturas adicionales (cuando alguien tiene más de una jefatura directa)
// ---------------------------------------------------------------------------

export async function listJefaturasAdicionales(colaboradorId) {
  const { data, error } = await supabase
    .from("jefaturas_adicionales")
    .select("*, jefe:profiles!jefaturas_adicionales_jefe_id_fkey(full_name)")
    .eq("colaborador_id", colaboradorId);
  if (error) throw error;
  return data;
}

export async function agregarJefaturaAdicional(colaboradorId, jefeId, userId) {
  const { data, error } = await supabase
    .from("jefaturas_adicionales")
    .insert({ colaborador_id: colaboradorId, jefe_id: jefeId, creado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function quitarJefaturaAdicional(id) {
  const { error } = await supabase.from("jefaturas_adicionales").delete().eq("id", id);
  if (error) throw error;
}

export async function crearEvaluacion(colaboradorId, { periodo, resultado, punteo, monto, comentarios }, userId) {
  const { data, error } = await supabase
    .from("evaluaciones_desempeno")
    .insert({ colaborador_id: colaboradorId, periodo, resultado, punteo: punteo ?? null, monto: monto ?? null, comentarios, creado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Calendario de actividades
// ---------------------------------------------------------------------------

export async function listActividades({ desde } = {}) {
  let query = supabase.from("actividades").select("*").order("fecha");
  if (desde) query = query.gte("fecha", desde);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function crearActividad({ titulo, descripcion, fecha }, userId) {
  const { data, error } = await supabase
    .from("actividades")
    .insert({ titulo, descripcion, fecha, creado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarActividad(id) {
  const { error } = await supabase.from("actividades").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Descripción de roles
// ---------------------------------------------------------------------------

export async function listDescripcionesRoles() {
  const { data, error } = await supabase.from("descripciones_roles").select("*").order("puesto");
  if (error) throw error;
  return data;
}

export async function guardarDescripcionRol({ id, puesto, descripcion, requisitos, codigo, empresa, area, jefe_inmediato }, userId) {
  const payload = {
    puesto,
    descripcion,
    requisitos,
    codigo,
    empresa,
    area,
    jefe_inmediato,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
  const { data, error } = id
    ? await supabase.from("descripciones_roles").update(payload).eq("id", id).select().single()
    : await supabase.from("descripciones_roles").insert(payload).select().single();
  if (error) throw error;
  return data;
}
