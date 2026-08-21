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

export async function setCompensacion(colaboradorId, { salario_mensual, bono_anual, moneda }, userId) {
  const { data, error } = await supabase
    .from("compensacion")
    .upsert(
      { colaborador_id: colaboradorId, salario_mensual, bono_anual, moneda, updated_at: new Date().toISOString(), updated_by: userId },
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
// Vacaciones
// ---------------------------------------------------------------------------

export async function listVacacionesAjustes(colaboradorId) {
  const { data, error } = await supabase
    .from("vacaciones_ajustes")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("created_at", { ascending: false });
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

export async function registrarHorasExtra(colaboradorId, { fecha, horas, motivo }, userId) {
  const { data, error } = await supabase
    .from("horas_extra")
    .insert({ colaborador_id: colaboradorId, fecha, horas, motivo, creado_por: userId })
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

export async function crearEvaluacion(colaboradorId, { periodo, resultado, comentarios }, userId) {
  const { data, error } = await supabase
    .from("evaluaciones_desempeno")
    .insert({ colaborador_id: colaboradorId, periodo, resultado, comentarios, creado_por: userId })
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

export async function guardarDescripcionRol({ id, puesto, descripcion, requisitos }, userId) {
  const payload = { puesto, descripcion, requisitos, updated_at: new Date().toISOString(), updated_by: userId };
  const { data, error } = id
    ? await supabase.from("descripciones_roles").update(payload).eq("id", id).select().single()
    : await supabase.from("descripciones_roles").insert(payload).select().single();
  if (error) throw error;
  return data;
}
