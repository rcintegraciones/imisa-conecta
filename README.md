# IMISA Conecta — Guía de configuración

Plataforma interna de RRHH para **Grupo IMISA**. App privada, separada del
sitio público de Accesorios Ilimitados — vive en su propio repo y su propio
proyecto de Vercel. Usa **Supabase** como base de datos, login y
almacenamiento de documentos. Sigue estos pasos una sola vez para dejarlo
funcionando.

## 1. Crear el proyecto en Supabase

Crea un proyecto **nuevo y separado** en [supabase.com](https://supabase.com)
(plan gratuito alcanza para empezar) — no reutilices el de Accesorios
Ilimitados: los datos de RRHH (salarios, contratos, evaluaciones) son
sensibles y conviene aislarlos en su propia base.

## 2. Ejecutar el esquema de base de datos

1. En el dashboard de Supabase, abre **SQL Editor** → **New query**.
2. Copia y pega **todo** el contenido de [`supabase/schema.sql`](supabase/schema.sql).
3. Dale **Run**. Esto crea las tablas, las políticas de seguridad (RLS) y el
   bucket de almacenamiento privado `documentos`.

Se puede volver a correr sin problema si necesitas reaplicarlo.

## 3. Crear las cuentas

Las cuentas **no se auto-registran** — cada una la crea Jefatura RRHH
manualmente, igual que en los portales de Accesorios Ilimitados:

1. **Authentication → Users → Add user → Create new user**.
2. **Email**: correo real de la persona (ahí le llega el enlace para elegir
   su código).
3. **Password**: cualquier cosa de 6+ caracteres — es temporal, nunca se usa.
4. Marca **Auto Confirm User**.
5. En **User Metadata**, agrega:

   ```json
   {
     "full_name": "Nombre Apellido",
     "role": "colaborador",
     "puesto": "Puesto que ocupa",
     "area": "Área o departamento",
     "fecha_ingreso": "2024-03-01"
   }
   ```

   `role` debe ser exactamente `colaborador` o `rrhh`. El rol `rrhh` es
   Jefatura de Recursos Humanos: ve y administra todo (planilla,
   compensación de todos, aprobaciones, etc.). Todos los demás campos se
   pueden completar o corregir después desde la pestaña **Planilla** dentro
   de la app (incluyendo el salario, que no se pide aquí).
6. Guarda. La persona entra a la app, toca **"¿Primera vez o olvidaste tu
   código?"**, escribe su correo y sigue el enlace para elegir su código de
   6 dígitos — sin que nadie más lo vea.

## 4. Permitir los enlaces de "configura tu código"

1. **Authentication → URL Configuration**.
2. En **Redirect URLs** agrega la URL donde vivirá la app (ej.
   `https://imisa-conecta.vercel.app/` o tu dominio final), y también
   cualquier URL de preview de Vercel que uses mientras pruebas.

## 5. Conectar la aplicación con tu proyecto

1. En Supabase: **Project Settings → API**.
2. Copia el **Project URL** y la **anon / public key**.
3. Abre `js/config.js` y reemplaza los valores de ejemplo:

   ```js
   export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
   export const SUPABASE_ANON_KEY = "TU-ANON-KEY-AQUI";
   ```

   La `anon key` es segura de dejar visible en el navegador — el acceso a
   los datos está protegido por las políticas RLS del paso 2.

## 6. Probar en localhost

No hay build step (HTML/CSS/JS puro), así que basta con servir la carpeta
como sitio estático. Por ejemplo:

```bash
npx serve .
# o
python3 -m http.server 8080
```

Abre la URL que te indique (`http://localhost:3000` o `:8080`). Si vas a
probar el flujo de "primera vez / olvidé mi código", agrega también esa URL
local a **Redirect URLs** en Supabase (paso 4).

## 7. Desplegar en Vercel

1. Importa este repo (`rcintegraciones/imisa-conecta`) como proyecto nuevo en
   [vercel.com](https://vercel.com) — no requiere ninguna configuración de
   build especial (es un sitio estático).
2. Cuando tengas dominio propio para Grupo IMISA, apúntalo a este proyecto de
   Vercel y agrega esa URL final a **Redirect URLs** en Supabase.

## Cómo se usa

- **Colaborador**: ve su perfil (tiempo en la empresa, cumpleaños), su
  compensación mensual/anual, saldo y solicitud de vacaciones, su drive de
  documentos (ve/descarga los suyos, sube documentos firmados, solicita
  documentos nuevos), cuántas horas extra lleva en el año, sus evaluaciones
  de desempeño, el calendario de cumpleaños/actividades, y la descripción de
  su puesto.
- **Jefatura RRHH** (rol `rrhh`): planilla completa (con totales de
  compensación mensual/anual y rotación), aprobar/rechazar vacaciones y
  ajustar saldos, subir documentos a cualquier colaborador y resolver sus
  solicitudes, registrar horas extra y evaluaciones, administrar el
  calendario de actividades, mantener las descripciones de roles, y generar
  cartas de ingreso/recomendación listas para imprimir.

## Notas

- Los documentos se guardan en un bucket **privado**; la app genera URLs
  firmadas temporales para verlos/descargarlos.
- El registro biométrico (entradas, salidas, tardanzas) se automatiza por
  separado con n8n, que puede insertar filas directamente en la tabla
  `horas_extra` (columna `origen = 'biometrico'`) usando la *service role
  key* de este mismo proyecto de Supabase — sin necesidad de tocar esta app.
- Las cartas de ingreso/recomendación se generan como una página imprimible
  (el navegador las puede "Guardar como PDF" desde el diálogo de impresión);
  no se guardan automáticamente en el drive del colaborador — si quieres
  dejar una copia, guarda el PDF y súbelo manualmente desde su drive.
