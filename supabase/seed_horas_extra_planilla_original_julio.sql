-- ============================================================================
-- Referencia: cantidad de horas extra que ya traia capturada la planilla
-- original de JULIO 2026 (columnas Cant. Simples + Cant. Dobles de cada hoja
-- ACCISA/ISSA/IMISA/IERSA), antes de tener el registro biometrico en el sistema.
-- Sirve para el cruce de validacion en Planilla > Desglose mensual.
--
-- Solo se carga a quienes ya tienen cuenta creada. Es seguro volver a correrlo
-- (upsert por colaborador_id + periodo).
-- ============================================================================

insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 8.0
from public.profiles where email = 'bernardoconstanza7@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- BERNARDO CONSTANZA LOPEZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 4.5
from public.profiles where email = 'Juanchodrums85@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- JUAN LUIS MONZON CHAN
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 36.0
from public.profiles where email = 'enrique5529a1@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- MIGUEL ENRIQUE HERNANDEZ FAJARDO
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 9.0
from public.profiles where email = 'lazaromendezcruz204@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- LAZARO MANUEL MENDEZ CRUZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'allan@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ALLAN EDREI HERNANDEZ MARTINEZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 14.0
from public.profiles where email = 'zaponjesus@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- JESUS ALBERTO ZAPON ZUÑIGA
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'xaviervas@outlook.es'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- JAVIER VASQUEZ ZACARIAS
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'claudia@imisagt.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- CLAUDIA MARITZA YUMAN HERNANDEZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'oscar@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- OSCAR ARMANDO HERNANDEZ MATA
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'ricardo@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- RICARDO NATIVIDAD RODAS BARRIOS
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'alvaro-david@hotmail.es'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ALVARO DAVID LOPEZ RAMIREZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'edwincotill@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- EDWIN EDUARDO PULUC COTILL
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 24.0
from public.profiles where email = 'Jordy_gomez05@hotmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- JORDY JOEL GOMEZ MORALES
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 7.0
from public.profiles where email = 'davidmeza1869@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ANIEL DAVID SURUY MEZA
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'andrea@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ANDREA MAGALY ALDANA ARAGON
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 12.5
from public.profiles where email = 'emiyocute09@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- EMILIO FRANCISCO YOCUTE PEREZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 19.5
from public.profiles where email = 'dangmz6320@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- JOSUE DANIEL PIRIR GOMEZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'brandon@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- BRANDON GABRIEL BARREDA PEREZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'tecunlesly8@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- LESLY MARISOL TECUN POL
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'maymargomezburrion@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- MAYMAR MARIA JOSE GOMEZ BURRION
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'elizabeth@issa.com.gt'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- BRENDY ELIZABETH ZAPET ALVARADO
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'susyaparicio@imisagt.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- NORMA AZUCENA APARICIO PINTO
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 8.0
from public.profiles where email = 'ruizdeivid1811@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- CARLOS DAVID RUIZ MENCOS
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'sergiomonteros420@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- SERGIO OBALDINO MONTEROS TORRES
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 8.5
from public.profiles where email = 'Dannyconstanza141@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- DANY JOSUÉ CONSTANZA AMBROCIO
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 9.0
from public.profiles where email = 'esaumorales273@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ESAU MORALES RODRIGUEZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'gabrielachan@imisagt.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- GABRIELA DEL ROSARIO CHAN CALEL
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'manugarril75@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- MANUEL BRAULIO GARRIL TZUNUN
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'yonderescobar15@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- YONDER EDUARDO ESCOBAR
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'donaldo@imisagt.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- DONALDO RECINOS QUIROA
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'raulgonzalez57007406@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ALEJANDRO RAUL GONZALEZ ALVAREZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 4.0
from public.profiles where email = 'julianconstanza04@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- JULIAN CONSTANZA LOPEZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'antonio.vasquez5434@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ANTONIO VASQUEZ ALVAREZ
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 0.0
from public.profiles where email = 'maria25lau@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- LAURA MARIA VASQUEZ ROSALES
insert into public.horas_extra_planilla_original (colaborador_id, periodo, horas)
select id, '2026-07', 5.0
from public.profiles where email = 'torresmonteros59@gmail.com'
on conflict (colaborador_id, periodo) do update set horas = excluded.horas;  -- ERICK RONALDO MONTEROS TORRES