-- ============================================================================
-- IMISA Conecta — plataforma interna de RRHH para Grupo IMISA
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query > Run
-- Se puede volver a correr sin duplicar nada (usa "if not exists" / "or replace").
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- PERFILES (vincula cada usuario de Auth con sus datos de colaborador)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('colaborador','rrhh')) default 'colaborador',
  empresa text,
  puesto text,
  area text,
  telefono text,
  foto_url text,
  fecha_nacimiento date,
  fecha_ingreso date,
  fecha_egreso date,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Por si ya tenías la tabla creada de una corrida anterior de este script.
alter table public.profiles add column if not exists empresa text;

-- Crea el perfil automáticamente cuando se crea el usuario en Auth,
-- leyendo los datos desde "User Metadata".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, puesto, area, fecha_ingreso)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'colaborador'),
    new.raw_user_meta_data->>'puesto',
    new.raw_user_meta_data->>'area',
    nullif(new.raw_user_meta_data->>'fecha_ingreso','')::date
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- COMPENSACIÓN (separada de profiles: es sensible, solo la ve su dueño y RRHH)
-- ----------------------------------------------------------------------------
create table if not exists public.compensacion (
  colaborador_id uuid primary key references public.profiles(id) on delete cascade,
  salario_mensual numeric(12,2) not null default 0,
  bono_anual numeric(12,2) not null default 0,
  moneda text not null default 'GTQ',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.historial_compensacion (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.profiles(id) on delete cascade,
  salario_mensual numeric(12,2) not null,
  bono_anual numeric(12,2) not null,
  moneda text not null,
  vigente_hasta timestamptz not null default now(),
  registrado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Antes de actualizar una compensación, guarda el valor anterior en el historial.
create or replace function public.log_compensacion_anterior()
returns trigger
language plpgsql
as $$
begin
  insert into public.historial_compensacion (colaborador_id, salario_mensual, bono_anual, moneda, vigente_hasta, registrado_por)
  values (old.colaborador_id, old.salario_mensual, old.bono_anual, old.moneda, now(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists on_compensacion_update on public.compensacion;
create trigger on_compensacion_update
  before update on public.compensacion
  for each row execute function public.log_compensacion_anterior();

-- ----------------------------------------------------------------------------
-- VACACIONES
-- ----------------------------------------------------------------------------
create table if not exists public.vacaciones_ajustes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.profiles(id) on delete cascade,
  dias numeric(6,2) not null,
  motivo text not null,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.solicitudes_vacaciones (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.profiles(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  dias_habiles numeric(6,2) not null,
  motivo text,
  estado text not null check (estado in ('pendiente','aprobado','rechazado')) default 'pendiente',
  comentario_rrhh text,
  resuelto_por uuid references public.profiles(id),
  resuelto_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- DOCUMENTOS (drive por colaborador) + solicitudes de documentos
-- ----------------------------------------------------------------------------
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null,
  categoria text not null default 'otro',
  storage_path text not null,
  subido_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.solicitudes_documentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.profiles(id) on delete cascade,
  tipo_documento text not null,
  comentario text,
  estado text not null check (estado in ('pendiente','listo','rechazado')) default 'pendiente',
  documento_id uuid references public.documentos(id),
  resuelto_por uuid references public.profiles(id),
  resuelto_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- HORAS EXTRA
-- ----------------------------------------------------------------------------
create table if not exists public.horas_extra (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.profiles(id) on delete cascade,
  fecha date not null,
  horas numeric(6,2) not null,
  motivo text,
  origen text not null default 'manual' check (origen in ('manual','biometrico')),
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- EVALUACIONES DE DESEMPEÑO
-- ----------------------------------------------------------------------------
create table if not exists public.evaluaciones_desempeno (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.profiles(id) on delete cascade,
  periodo text not null,
  resultado text not null,
  comentarios text,
  storage_path text,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CALENDARIO DE ACTIVIDADES (cumpleaños se calculan de profiles.fecha_nacimiento)
-- ----------------------------------------------------------------------------
create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  fecha date not null,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- DESCRIPCIÓN DE ROLES
-- ----------------------------------------------------------------------------
create table if not exists public.descripciones_roles (
  id uuid primary key default gen_random_uuid(),
  puesto text not null unique,
  descripcion text,
  requisitos text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.compensacion enable row level security;
alter table public.historial_compensacion enable row level security;
alter table public.vacaciones_ajustes enable row level security;
alter table public.solicitudes_vacaciones enable row level security;
alter table public.documentos enable row level security;
alter table public.solicitudes_documentos enable row level security;
alter table public.horas_extra enable row level security;
alter table public.evaluaciones_desempeno enable row level security;
alter table public.actividades enable row level security;
alter table public.descripciones_roles enable row level security;

-- profiles: todo el personal autenticado puede ver el directorio (nombres,
-- puestos, cumpleaños), pero solo RRHH lo puede editar; cada quien puede
-- editar sus propios datos de contacto/foto.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid());

drop policy if exists profiles_all_rrhh on public.profiles;
create policy profiles_all_rrhh on public.profiles
  for all to authenticated using (public.current_role() = 'rrhh') with check (public.current_role() = 'rrhh');

-- compensación: sensible — cada quien ve/edita solo la suya, RRHH ve/edita todas.
drop policy if exists compensacion_select_self_or_rrhh on public.compensacion;
create policy compensacion_select_self_or_rrhh on public.compensacion
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists compensacion_write_rrhh on public.compensacion;
create policy compensacion_write_rrhh on public.compensacion
  for all to authenticated using (public.current_role() = 'rrhh') with check (public.current_role() = 'rrhh');

drop policy if exists historial_compensacion_select on public.historial_compensacion;
create policy historial_compensacion_select on public.historial_compensacion
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

-- vacaciones: cada quien ve/crea las suyas; RRHH ve y resuelve todas.
drop policy if exists vac_ajustes_select on public.vacaciones_ajustes;
create policy vac_ajustes_select on public.vacaciones_ajustes
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists vac_ajustes_write_rrhh on public.vacaciones_ajustes;
create policy vac_ajustes_write_rrhh on public.vacaciones_ajustes
  for insert to authenticated with check (public.current_role() = 'rrhh');

drop policy if exists solicitudes_vac_select on public.solicitudes_vacaciones;
create policy solicitudes_vac_select on public.solicitudes_vacaciones
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists solicitudes_vac_insert on public.solicitudes_vacaciones;
create policy solicitudes_vac_insert on public.solicitudes_vacaciones
  for insert to authenticated with check (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists solicitudes_vac_update on public.solicitudes_vacaciones;
create policy solicitudes_vac_update on public.solicitudes_vacaciones
  for update to authenticated using (
    public.current_role() = 'rrhh'
    or (colaborador_id = auth.uid() and estado = 'pendiente')
  );

-- documentos: cada quien ve/sube los suyos; RRHH ve y sube a cualquiera.
drop policy if exists documentos_select on public.documentos;
create policy documentos_select on public.documentos
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists documentos_insert on public.documentos;
create policy documentos_insert on public.documentos
  for insert to authenticated with check (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists documentos_delete_rrhh on public.documentos;
create policy documentos_delete_rrhh on public.documentos
  for delete to authenticated using (public.current_role() = 'rrhh');

drop policy if exists solicitudes_doc_select on public.solicitudes_documentos;
create policy solicitudes_doc_select on public.solicitudes_documentos
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists solicitudes_doc_insert on public.solicitudes_documentos;
create policy solicitudes_doc_insert on public.solicitudes_documentos
  for insert to authenticated with check (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists solicitudes_doc_update_rrhh on public.solicitudes_documentos;
create policy solicitudes_doc_update_rrhh on public.solicitudes_documentos
  for update to authenticated using (public.current_role() = 'rrhh');

-- horas extra: cada quien ve las suyas (solo lectura); RRHH ve y registra todas.
drop policy if exists horas_extra_select on public.horas_extra;
create policy horas_extra_select on public.horas_extra
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists horas_extra_write_rrhh on public.horas_extra;
create policy horas_extra_write_rrhh on public.horas_extra
  for insert to authenticated with check (public.current_role() = 'rrhh');

drop policy if exists horas_extra_update_rrhh on public.horas_extra;
create policy horas_extra_update_rrhh on public.horas_extra
  for update to authenticated using (public.current_role() = 'rrhh');

-- evaluaciones: cada quien ve las suyas (solo lectura); RRHH ve y registra todas.
drop policy if exists evaluaciones_select on public.evaluaciones_desempeno;
create policy evaluaciones_select on public.evaluaciones_desempeno
  for select to authenticated using (colaborador_id = auth.uid() or public.current_role() = 'rrhh');

drop policy if exists evaluaciones_write_rrhh on public.evaluaciones_desempeno;
create policy evaluaciones_write_rrhh on public.evaluaciones_desempeno
  for insert to authenticated with check (public.current_role() = 'rrhh');

-- actividades: todos ven; solo RRHH crea/edita/borra.
drop policy if exists actividades_select on public.actividades;
create policy actividades_select on public.actividades
  for select to authenticated using (true);

drop policy if exists actividades_write_rrhh on public.actividades;
create policy actividades_write_rrhh on public.actividades
  for all to authenticated using (public.current_role() = 'rrhh') with check (public.current_role() = 'rrhh');

-- descripción de roles: todos ven; solo RRHH crea/edita.
drop policy if exists roles_select on public.descripciones_roles;
create policy roles_select on public.descripciones_roles
  for select to authenticated using (true);

drop policy if exists roles_write_rrhh on public.descripciones_roles;
create policy roles_write_rrhh on public.descripciones_roles
  for all to authenticated using (public.current_role() = 'rrhh') with check (public.current_role() = 'rrhh');

-- ============================================================================
-- STORAGE: bucket privado para el drive de documentos
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Las políticas de storage usan el primer segmento de la ruta como
-- colaborador_id (los archivos se suben a "<colaborador_id>/<archivo>").
drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'documentos'
    and (
      public.current_role() = 'rrhh'
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists documentos_storage_insert on storage.objects;
create policy documentos_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documentos'
    and (
      public.current_role() = 'rrhh'
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists documentos_storage_delete on storage.objects;
create policy documentos_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'documentos' and public.current_role() = 'rrhh'
  );
