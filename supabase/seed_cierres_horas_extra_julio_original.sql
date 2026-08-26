-- ============================================================================
-- Cierre de horas extra de JULIO 2026 usando los valores YA PAGADOS de la
-- planilla original (columnas Cant. Simples/Cant. Dobles y Total Hrs.Extras de
-- cada hoja ACCISA/ISSA/IMISA/IERSA), no el calculo del biometrico.
--
-- Julio ya se pago con estos numeros, asi que Desglose mensual y el recibo de
-- julio deben reflejar esto exactamente (no lo que salga de biometrico).
--
-- Es seguro volver a correrlo (upsert por colaborador_id + periodo).
-- ============================================================================

insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 8.0, 8.0, 0.0, 4750.0, 237.5
from public.profiles where email = 'bernardoconstanza7@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- BERNARDO CONSTANZA LOPEZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 4.5, 4.5, 0.0, 6200.0, 174.375
from public.profiles where email = 'Juanchodrums85@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- JUAN LUIS MONZON CHAN
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 36.0, 36.0, 0.0, 4600.0, 1035.0
from public.profiles where email = 'enrique5529a1@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- MIGUEL ENRIQUE HERNANDEZ FAJARDO
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 9.0, 9.0, 0.0, 4850.0, 272.8125
from public.profiles where email = 'lazaromendezcruz204@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- LAZARO MANUEL MENDEZ CRUZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'allan@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ALLAN EDREI HERNANDEZ MARTINEZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 14.0, 14.0, 0.0, 4400.0, 385.0
from public.profiles where email = 'zaponjesus@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- JESUS ALBERTO ZAPON ZUÑIGA
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4250.0, 0.0
from public.profiles where email = 'xaviervas@outlook.es'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- JAVIER VASQUEZ ZACARIAS
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 5050.0, 0.0
from public.profiles where email = 'claudia@imisagt.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- CLAUDIA MARITZA YUMAN HERNANDEZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'oscar@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- OSCAR ARMANDO HERNANDEZ MATA
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'ricardo@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- RICARDO NATIVIDAD RODAS BARRIOS
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'alvaro-david@hotmail.es'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ALVARO DAVID LOPEZ RAMIREZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'edwincotill@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- EDWIN EDUARDO PULUC COTILL
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 24.0, 24.0, 0.0, 4150.0, 622.5
from public.profiles where email = 'Jordy_gomez05@hotmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- JORDY JOEL GOMEZ MORALES
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 7.0, 7.0, 0.0, 4500.0, 196.875
from public.profiles where email = 'davidmeza1869@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ANIEL DAVID SURUY MEZA
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 5600.0, 0.0
from public.profiles where email = 'andrea@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ANDREA MAGALY ALDANA ARAGON
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 12.5, 12.5, 0.0, 4100.0, 320.3125
from public.profiles where email = 'emiyocute09@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- EMILIO FRANCISCO YOCUTE PEREZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 19.5, 19.5, 0.0, 4050.0, 493.59375
from public.profiles where email = 'dangmz6320@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- JOSUE DANIEL PIRIR GOMEZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'brandon@accesoriosilimitados.com.gt'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- BRANDON GABRIEL BARREDA PEREZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4010.0, 0.0
from public.profiles where email = 'tecunlesly8@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- LESLY MARISOL TECUN POL
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'maymargomezburrion@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- MAYMAR MARIA JOSE GOMEZ BURRION
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4010.0, 0.0
from public.profiles where email = 'elizabeth@issa.com.gt'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- BRENDY ELIZABETH ZAPET ALVARADO
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 6150.0, 0.0
from public.profiles where email = 'susyaparicio@imisagt.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- NORMA AZUCENA APARICIO PINTO
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 8.0, 8.0, 0.0, 4050.0, 202.5
from public.profiles where email = 'ruizdeivid1811@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- CARLOS DAVID RUIZ MENCOS
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4200.0, 0.0
from public.profiles where email = 'sergiomonteros420@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- SERGIO OBALDINO MONTEROS TORRES
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 8.5, 8.5, 0.0, 4050.0, 215.15625
from public.profiles where email = 'Dannyconstanza141@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- DANY JOSUÉ CONSTANZA AMBROCIO
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 9.0, 9.0, 0.0, 4400.0, 247.5
from public.profiles where email = 'esaumorales273@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ESAU MORALES RODRIGUEZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 5000.0, 0.0
from public.profiles where email = 'gabrielachan@imisagt.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- GABRIELA DEL ROSARIO CHAN CALEL
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 5950.0, 0.0
from public.profiles where email = 'manugarril75@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- MANUEL BRAULIO GARRIL TZUNUN
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4350.0, 0.0
from public.profiles where email = 'yonderescobar15@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- YONDER EDUARDO ESCOBAR
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4010.0, 0.0
from public.profiles where email = 'donaldo@imisagt.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- DONALDO RECINOS QUIROA
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4400.0, 0.0
from public.profiles where email = 'raulgonzalez57007406@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ALEJANDRO RAUL GONZALEZ ALVAREZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 4.0, 4.0, 0.0, 4100.0, 102.5
from public.profiles where email = 'julianconstanza04@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- JULIAN CONSTANZA LOPEZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4300.0, 0.0
from public.profiles where email = 'antonio.vasquez5434@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ANTONIO VASQUEZ ALVAREZ
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 0.0, 0.0, 0.0, 4050.0, 0.0
from public.profiles where email = 'maria25lau@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- LAURA MARIA VASQUEZ ROSALES
insert into public.cierres_horas_extra (colaborador_id, periodo, total_horas, total_horas_simples, total_horas_dobles, salario_usado, monto)
select id, '2026-07', 5.0, 5.0, 0.0, 4150.0, 129.6875
from public.profiles where email = 'torresmonteros59@gmail.com'
on conflict (colaborador_id, periodo) do update set
  total_horas = excluded.total_horas, total_horas_simples = excluded.total_horas_simples,
  total_horas_dobles = excluded.total_horas_dobles, salario_usado = excluded.salario_usado,
  monto = excluded.monto;  -- ERICK RONALDO MONTEROS TORRES