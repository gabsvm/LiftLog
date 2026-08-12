# Plan de migración nativa de LiftLog

Estado: Android nativo en fase 3 incremental en `feat/gainslab-sync-import`  
Objetivo: migrar progresivamente LiftLog a Kotlin Multiplatform para el núcleo, Jetpack Compose + Material 3 en Android y SwiftUI en iOS.

## Decisiones de alcance

- Se elimina del plan toda lógica específica de GainsLab/RP.
- El producto objetivo es un tracker general de entrenamientos: fuerza, peso corporal, asistido, duración, distancia y cardio.
- La app Expo/React Native sigue siendo la aplicación activa durante toda la migración.
- No se hará una reescritura total ni se cambiará la base de datos productiva de golpe.
- El núcleo compartido será la futura fuente de verdad para dominio, validaciones, casos de uso y contratos de repositorio.
- Android e iOS conservarán sus propias pantallas, navegación, componentes y adaptadores de plataforma.
- No se mantendrán dos escrituras de datos en paralelo. Cada feature se migra primero a una ruta nativa y se valida antes de retirar su equivalente Expo.

## Estado actual verificado

LiftLog está actualmente en:

- Expo SDK 56 y React Native 0.85.
- Expo Router.
- Redux Toolkit para estado y efectos.
- SQLite + Drizzle como almacenamiento local.
- Servicios TypeScript con integraciones Android/iOS.
- Material 3 mediante `react-native-paper` y componentes React Native.
- Worker Android nativo para el entrenamiento activo y el temporizador persistente.
- Historial, estadísticas, cardio, backups, importación, sincronización y Health Connect/HealthKit ya existentes en distinto grado de madurez.

El worktree ya contiene cambios locales de `feat/gainslab-sync-import`. Esos cambios quedan fuera de la migración y no deben sobrescribirse.

## Arquitectura destino

```text
native/
  shared/                 Kotlin Multiplatform: dominio y contratos
    src/commonMain/       modelos, reglas y casos de uso puros
    src/commonTest/       tests multiplataforma
    src/androidMain/      adaptadores Android cuando sean necesarios
    src/iosMain/          adaptadores Apple cuando sean necesarios
  androidApp/             aplicación Android nativa
    Compose + Material 3
  iosApp/                 proyecto Xcode
    SwiftUI

app/                      aplicación Expo existente durante la transición
```

La UI no se compartirá por defecto. El núcleo sí compartirá:

- modelos de ejercicio, sesión y set;
- reglas de completitud y validación;
- cálculos de progreso y estadísticas;
- casos de uso del tracker;
- contratos de repositorio;
- sincronización y serialización cuando exista una implementación estable;
- tests de dominio.

Quedan específicos de plataforma:

- navegación;
- Material 3 y Material 3 Expressive en Android;
- SwiftUI y Liquid Glass en iOS;
- notificaciones, Health Connect, HealthKit, background work y permisos;
- base de datos concreta mientras se verifica la migración;
- accesibilidad y gestos propios de cada sistema.

## Fases

### Fase 0 — Protección y contrato

Objetivo: poder avanzar sin poner en riesgo la app actual.

- Congelar la referencia funcional actual mediante typecheck, lint y tests.
- Registrar el modelo de datos actual y sus incompatibilidades con un tracker general.
- Crear el módulo KMP fuera del árbol Expo.
- No cambiar Redux, Drizzle ni los servicios existentes todavía.

Salida: módulo nuevo compilable y un contrato de dominio revisable.

### Fase 1 — Núcleo compartido de tracker general

Objetivo: reemplazar gradualmente modelos de sesión acoplados a la UI.

- Definir `ExerciseDefinition`, `WorkoutSession`, `SessionExercise` y `LoggedSet`.
- Soportar tipos de ejercicio weighted, bodyweight, assisted, duration, distance, cardio y mixed.
- Soportar tipos de set normal, warm-up, drop-set, top-set, back-off, failure y AMRAP.
- Implementar validación de completitud y progreso.
- Definir interfaces de repositorio sin acoplarlas todavía a SQLite o Supabase.
- Agregar tests de dominio multiplataforma.

Salida: reglas centrales ejecutables desde Android, iOS y tests.

### Fase 2 — Persistencia y puente Android

Objetivo: probar el primer flujo nativo con datos reales sin migrar todo el producto.

- Añadir `androidApp` con Compose y Material 3.
- Implementar el flujo mínimo: lista de sesiones y sesión activa.
- Crear un adaptador KMP hacia una copia controlada de los datos actuales.
- Definir la migración SQLite/exportación antes de tocar la base productiva.
- Comparar resultados del núcleo Kotlin con los cálculos TypeScript existentes.

Salida: Android nativo puede abrir, registrar y guardar una sesión de prueba.

### Fase 3 — Primer feature vertical nativo

Orden recomendado:

1. sesión activa;
2. ejercicio y sets;
3. temporizador de descanso;
4. historial de sesiones;
5. biblioteca de ejercicios;
6. rutinas y programas;
7. estadísticas;
8. ajustes, backup y sincronización.

Cada vertical tendrá Compose, pruebas, accesibilidad, persistencia y una estrategia de rollback antes de retirar su pantalla Expo.

### Fase 4 — App iOS nativa

- Crear `iosApp` en Xcode cuando exista un entorno macOS disponible.
- Consumir el mismo framework KMP.
- Implementar las mismas capacidades con SwiftUI y Observation.
- Usar navegación, sheets, controles, gestos y materiales nativos de Apple.
- Validar Liquid Glass solamente en componentes donde el sistema lo aporte y no como decoración global.

La validación física de iOS requiere macOS/Xcode; Windows no puede sustituir esa comprobación.

### Fase 5 — Integraciones y retiro gradual de Expo

- Migrar worker/background y notificaciones a servicios nativos.
- Migrar Health Connect y HealthKit.
- Migrar backup, restore, exportación e importación.
- Migrar autenticación y sincronización sin perder datos locales.
- Ejecutar paridad de datos y comportamiento entre las dos implementaciones.
- Retirar rutas Expo solamente después de una versión nativa estable y medible.

## Criterios de aceptación por feature

Una feature no se considera migrada por compilar. Debe cumplir:

- mismo resultado de dominio que la implementación actual;
- datos existentes legibles y preservados;
- offline funcional cuando la feature actual lo permite;
- estados de carga, vacío, error y cancelación;
- accesibilidad básica en Android e iOS;
- tests de dominio y de UI relevantes;
- prueba en dispositivo Android real;
- prueba en simulador/dispositivo iOS cuando exista macOS;
- rollback claro a la ruta Expo durante la transición.

## Riesgos y controles

| Riesgo | Control |
|---|---|
| Doble fuente de verdad | KMP domina el dominio; la UI solo consume estado y casos de uso |
| Pérdida de sesiones antiguas | migración/exportación versionada y backups antes de cambiar SQLite |
| Migrar UI antes del modelo | primero contrato y tests, después Compose/SwiftUI |
| Paridad falsa entre plataformas | tests de dominio compartidos y pruebas nativas por plataforma |
| Integraciones bloqueadas en Windows | avanzar con common/JVM/Android y reservar iOS para macOS |
| Cambios locales existentes | no mezclar ni revertir el worktree actual |
| Dependencias KMP inestables | empezar con Kotlin estándar y añadir librerías por necesidad comprobada |

## Primera ejecución realizada

En esta iteración se crea `native/shared` con:

- modelos generales de ejercicio, sesión y set;
- validación de completitud por tipo de ejercicio;
- cálculo de progreso de sesión;
- contratos de repositorio;
- tests de dominio;
- scaffold Gradle independiente del proyecto Expo.

La primera rebanada ya está validada. La segunda rebanada añade un `androidApp` nativo con Compose, un `ViewModel` y un repositorio SQLite aislado para restaurar la sesión piloto. Todavía no se conecta a la base SQLite productiva: la base nativa se usa para validar persistencia y el contrato antes de migrar datos reales.

La siguiente rebanada ya tiene el contrato `liftlog.native.workouts` v1:

- `app/src/services/native-workout-export.ts` lee las filas `session` de Drizzle y construye un payload neutral sin escribir en la base.
- `native/shared/.../migration/NativeWorkoutExport.kt` valida el formato, versión, IDs y valores básicos antes de convertirlo a `WorkoutSession`.
- Ambos lados están cubiertos por tests; el lector KMP no depende de SQLite y por eso servirá igual para Android e iOS.

El mapeo v1 conserva sesiones, ejercicios ponderados/cardio, sets, pesos, repeticiones, duración, distancia, notas y tiempos de finalización. La fecha de una sesión existente, que hoy es `LocalDate`, se importa como inicio del día UTC. El contrato conserva también las reglas de progresión nativas cuando están disponibles; los exports Expo antiguos siguen siendo válidos porque esos campos son opcionales.

El siguiente paso después de este contrato era ejecutar una exportación real desde una copia de backup, comparar conteos y cálculos contra TypeScript, y recién entonces conectar una importación controlada al repositorio nativo. Esa validación y ese puente ya quedaron completados abajo.

## Validación con backup real

La exportación v1 se ejecutó contra `app/src/utils/__test__/export.liftlogbackup.sqlite.gz`, que es un backup SQLite real usado por las pruebas de restore:

- 420 sesiones exportadas;
- 420 IDs de sesión únicos;
- todas las sesiones del fixture contienen al menos un ejercicio;
- el backup se abrió en modo de lectura y se cerró sin escribirlo;
- el importador KMP decodifica y valida el mismo contrato JSON mediante tests representativos.

La validación pesada se puede repetir desde `app` con:

```powershell
$env:LIFTLOG_RUN_REAL_BACKUP = '1'
npx.cmd vitest run src/services/native-workout-export.spec.ts --testTimeout=15000
```

La escritura controlada ya existe en el repositorio Android mediante
`SQLiteWorkoutSessionRepository.importNativeExport(...)`. El servicio compartido
valida todo el JSON antes de llamar a `saveAll`; Android implementa `saveAll` en
una única transacción. El piloto Compose ya incluye historial, navegación a la
sesión activa y selector de documentos JSON. Esta UI todavía pertenece al
package aislado `com.gabsvm.liftlog.nativeapp` y no está conectada a la base
productiva.

## Estado Android actualizado

La siguiente rebanada ya implementa en el piloto Compose: estadísticas,
rutinas persistidas, biblioteca de ejercicios, creación de sesiones desde cero,
editor de sets por tipo, temporizador foreground, exportación/restauración de
sesiones-rutinas-ejercicios, preferencias locales, reglas de progresión y un
adaptador de Health Connect. El detalle verificable está en
`docs/NATIVE_ANDROID_STATUS.md`.

El APK nativo sigue aislado en `com.gabsvm.liftlog.nativeapp` para no romper el
rollback a Expo. La sincronización remota Supabase y la prueba Health Connect
en un dispositivo con proveedor siguen siendo pasos de integración externa,
no se simulan como completados.

## Comandos de validación

Desde la raíz del repositorio, cuando el JDK esté disponible:

```powershell
$env:ANDROID_HOME = "<ruta-local-del-Android-SDK>"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
app\android\gradlew.bat --project-dir native :shared:jvmTest
app\android\gradlew.bat --project-dir native :androidApp:assembleDebug
```

La ruta del SDK es específica de cada máquina y no debe versionarse. En Windows también puede definirse en `native/local.properties`, que está ignorado.

La app existente continúa validándose desde `app`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --run
```
