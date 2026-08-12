# Estado de la migración Android nativa

Fecha: 2026-08-11

La migración Android ya tiene una APK candidata instalada sobre la aplicación
existente. El rollback funcional sigue siendo la APK Expo anterior; no se
borra `db.db` y la app nativa usa `liftlog_native_pilot.db` después de leer la
base legacy en el primer arranque.

## Stack y alcance

- Kotlin Multiplatform para dominio, contratos, validaciones, estadísticas y
  transporte de backups.
- Jetpack Compose + Material 3 para la UI Android.
- SQLite Android versionado como almacenamiento nativo.
- iOS queda fuera de alcance por decisión del usuario: no se crea `iosApp` ni
  se implementa SwiftUI hasta disponer de macOS/Xcode y un dispositivo.
- El producto es un tracker general: fuerza, peso corporal, asistido,
  duración, distancia, cardio y mixto. No se reintroduce lógica específica de
  RP/GainsLab.

## Implementado

- Sesiones nuevas, historial, progreso y finalización.
- Biblioteca de ejercicios con búsqueda, alta y archivado.
- Editor de sets para peso, reps, peso corporal, asistencia, duración,
  distancia, RIR y RPE.
- Rutinas desde una sesión y desde cero; edición de ejercicios, sets,
  repeticiones objetivo, descanso y progresión `INCREASE_ALL`/
  `INCREASE_LOWEST`.
- Estadísticas de sesiones, completitud, sets, volumen, duración y 1RM.
- SQLite v5 con sesiones, sets, rutinas, biblioteca, progresión y descansos.
- Backup JSON versionado con sesiones, rutinas, biblioteca y preferencia de
  descanso; importación compatible con exports Expo antiguos; merge por ID y
  reemplazo idempotente de registros importados.
- Temporizador de descanso persistente y servicio foreground.
- Adaptador Health Connect con permisos de escritura; falta proveedor en el
  Redmi usado para una prueba física real.
- Cliente Supabase Android configurable por build para login, signup, subida y
  restauración del último backup privado. Sin credenciales compiladas, la UI
  informa que la función está deshabilitada.
- Lectura read-only de `db.db` legacy (`session`, `program`, `exercise`) y
  conversión controlada a los modelos nativos. Las filas inválidas se omiten
  y se registran en Logcat.

## APK candidata verificada

- Package: `com.gabsvm.gainslab`
- Versión: `1.2.0-native-migration`
- Version code: `7`
- Launcher: `com.gabsvm.liftlog.nativeapp.MainActivity`
- Firma: certificado SHA-256
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
- APK: `native/androidApp/build/outputs/apk/release/androidApp-release.apk`
- Hash SHA-256 del último build: `27835CC76EBCBB8E51D58B2877BC0644A79415A0251D33E2526D30A86EB02FF3`
- Instalación: `adb install -r` sobre el Redmi Note 10 `96165d8a`.
- Smoke técnico: instalación exitosa, actividad resuelta, proceso vivo y sin
  `FATAL EXCEPTION`, `SQLiteException` o `ANR` propios. La validación visual
  completa queda pendiente mientras el dispositivo permanezca bloqueado.

## Pendiente para declarar paridad completa

1. Desbloquear el Redmi y recorrer visualmente todos los flujos: sesión,
   edición de cada tipo, rutinas, historial, estadísticas, import/export,
   settings y restauración después de matar el proceso.
2. Ejecutar prueba real de Health Connect en un dispositivo que tenga el
   proveedor instalado, incluyendo permisos revocados.
3. Configurar un build con las credenciales públicas de Supabase del proyecto
   y validar login, signup, subida, restore, expiración y RLS contra el
   proyecto remoto real.
4. Añadir pruebas Compose/instrumentadas y una matriz de accesibilidad,
   rotación, estado vacío, errores de red y proceso muerto.
5. Comparar conteos y métricas nativas contra una exportación real de la base
   actual después de desbloquear el teléfono.
6. Publicar la APK en GitHub Release solamente cuando el smoke visual y la
   migración de datos estén aceptados; el build actual fue local y no se
   publicó automáticamente.

## Corrección de estrategia visual — 2026-08-11

La candidata nativa `1.2.0-native-migration` no se considera apta para
reemplazar la APK instalada. La primera iteración había introducido un
dashboard, navegación y tema distintos de GainsLab.

Estado actual del dispositivo `96165d8a`:

- APK activa: Expo `com.gabsvm.gainslab`, `versionCode=6`, `versionName=1.1.3`.
- La candidata nativa no está instalada sobre el package de producción.
- El package temporal `com.gabsvm.liftlog.nativeapp` usado para inspección fue
  desinstalado después de la prueba.

Regla para la siguiente iteración: mantener GainsLab, sus colores, jerarquía,
terminología y navegación como referencia; migrar datos, dominio y
persistencia debajo de esa interfaz, pantalla por pantalla; y no publicar ni
instalar una APK nativa sobre `com.gabsvm.gainslab` hasta validar paridad visual
y funcional contra la APK Expo instalada.

## Incremento actual — paridad de plan y Up next

La UI nativa ahora conserva la estructura de GainsLab y, cuando la base nativa
no contiene rutinas, siembra una copia de compatibilidad de las cuatro rutinas
Beginner Upper/Lower (`Upper 1`, `Lower 1`, `Upper 2`, `Lower 2`). La siembra es
idempotente y queda marcada en preferencias: no reaparece si el usuario borra
todas las rutinas posteriormente.

La tarjeta `Up next` usa esas rutinas y `Start workout` crea una sesión nativa
real mediante el mismo repositorio SQLite. Se validó en un package temporal
con ADB; el package temporal fue desinstalado y la APK Expo `1.1.3` quedó otra
vez activa en el Redmi.

## Incremento actual — Progress, History y More

Se alinearon las tres pestañas restantes del shell nativo con GainsLab:

- `Progress`: encabezado, selector `Last 90 days`, estado vacío y resumen de
  estadísticas.
- `History`: encabezado, calendario mensual, contador `Workouts in month`,
  estado vacío, tarjetas de sesiones y backup/import.
- `More`: grupos `Training plan`, `Account and data`, `App configuration` y
  `Support`, conservando acciones de rutinas, ejercicios, backup, sync y
  descanso.
- Las tres pantallas ya tienen la barra inferior `Train / Progress / History /
  More`.

Validación: `:shared:jvmTest` y `:androidApp:assembleDebug` pasaron; el smoke
ADB recorrió las tres pestañas sin `FATAL EXCEPTION`, `SQLiteException` ni ANR.
El package temporal se desinstaló y producción continúa en Expo `1.1.3`.

## Incremento actual — Templates y registro rápido

La biblioteca de rutinas se está convirtiendo en una biblioteca de templates,
separada de las sesiones reales:

- se puede iniciar un workout vacío desde la biblioteca;
- una sesión activa se puede guardar como template con nombre y carpeta;
- los templates se agrupan en carpetas persistentes y también existe `Unfiled`;
- el export/import nativo conserva carpetas y `folderId`;
- la ejecución combina el editor detallado de LiftLog con un checkbox rápido por
  set, manteniendo el temporizador de descanso.

La base SQLite subió a versión 6 mediante migración no destructiva. El smoke
test ADB recorrió biblioteca, inicio vacío, selección de ejercicio y checkbox de
set; no hubo `FATAL EXCEPTION`, `SQLiteException` ni ANR. La candidata nativa se
desinstaló y `com.gabsvm.gainslab` `1.1.3` quedó nuevamente activa.

El detalle de producto y los siguientes pasos están en
`docs/WORKOUT_TEMPLATES_AND_FAST_LOGGING.md`.

## Incremento actual — velocidad de ejecución

La ejecución nativa añade una segunda rebanada enfocada en reducir toques:

- los sets de una sesión nueva se prellenan con el último rendimiento conocido;
- `Finish` ofrece `Finish & save` para crear un template desde la sesión recién
  terminada;
- ejercicios y sets se pueden mover con `↑`/`↓` o con arrastre tras pulsación
  prolongada;
- el orden se guarda solo en la sesión actual y no altera el template original.

Validación: `:shared:jvmTest` y `:androidApp:assembleDebug` pasaron. El smoke
ADB verificó el shell GainsLab, la pantalla de ejecución, los controles de
orden y el diálogo `Finish & save`, sin errores de la app. El package temporal
se desinstaló; el Redmi queda en Expo `com.gabsvm.gainslab` `1.1.3`.

## Incremento actual — supersets, circuits y pairing

Se completó la siguiente parte del registro rápido con el modelo de grupos que
LiftLog ya tenía:

- `Pair` desde cada ejercicio en una sesión activa y desde el editor de
  templates;
- `Unpair` para separar un ejercicio; los grupos de tres o más se conservan
  como circuitos al quitar un miembro;
- combinación de grupos cuando se emparejan dos ejercicios que ya estaban
  agrupados;
- indicadores visuales `A1`, `A2`, `B1`, `B2`, línea lateral y texto de
  alternancia, siguiendo el patrón de Strong;
- resumen de los pairs dentro de cada template;
- copia del grupo template → sesión y persistencia en SQLite/export-import sin
  cambio de schema.

Validación real en Redmi `96165d8a`: se creó un pair entre `BB Bench Press` y
`DB Row`, se confirmó la visualización `A1`/`A2` y `Superset A`, se editó un
template, se guardó y se inició nuevamente para verificar que el pairing
persistiera en la sesión. Pasaron `:shared:jvmTest` y
`:androidApp:assembleDebug`; no hubo `FATAL EXCEPTION` ni `SQLiteException`.
El package usado fue `com.gabsvm.liftlog.nativeapp` y debe desinstalarse al
terminar la prueba; producción sigue siendo `com.gabsvm.gainslab` `1.1.3`.
