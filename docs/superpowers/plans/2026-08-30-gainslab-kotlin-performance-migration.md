# Plan de implementación: migración de rendimiento de GainsLab a Kotlin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Migrar de forma gradual y medible los caminos Android que más afectan startup, interacción de sets, persistencia y rest timer hacia Kotlin/native, sin cambiar la lógica de entrenamiento, el modelo de datos ni la experiencia visual aprobada.

**Architecture:** Mantener GainsLab como aplicación híbrida. React Native/TypeScript conserva navegación, pantallas no críticas, reglas de negocio, sincronización y compatibilidad iOS. Android incorpora módulos nativos pequeños y una superficie de sesión nativa sólo después de demostrar paridad. Cada fase mantiene un fallback TypeScript y una única autoridad de estado/escritura.

**Tech Stack:** Expo 56, React Native 0.85, Hermes, React 19, Expo Router, Redux Toolkit, Drizzle ORM sobre expo-sqlite, módulos Expo locales, Kotlin Android, Android Views/XML para la UI crítica, coroutines, WorkManager y el servicio de workout existente.

**Spec:** Este documento es la especificación ejecutable de la migración Android derivada de la auditoría de GainsLab y la comparación estática/runtime con Strong realizada sobre el Moto G24 Power. No autoriza por sí solo una release ni cambios de versión.

## Global Constraints

- Trabajar exclusivamente en agent/gainslab-performance-polish.
- No tocar main, no hacer merge, no abrir PR, no crear tags ni publicar releases durante la ejecución de este plan.
- Mantener com.gabsvm.gainslab, el bundle identifier existente, la firma, el keystore y la compatibilidad ARM64.
- No cambiar workout prescriptions, sets, reps, descansos prescritos, progression, KONG, NH programming rules, SessionBlueprint semantics, selección de ejercicios ni semántica de supersets.
- No modificar el schema SQLite, migraciones, nombres de tablas, formato de JSON persistido, claves de KeyValueStore, Supabase, auth, sync, backup ni datos del usuario.
- No cambiar de Drizzle/expo-sqlite a Realm ni crear una segunda base de datos. Strong usa Realm, pero esa decisión no es una razón suficiente para alterar la persistencia de GainsLab.
- No hacer un rediseño visual. Mantener la dirección True Black + Acid Green, el layout aprobado y los estados actuales.
- Preservar el camino de baja latencia de sets: react-native-paper TouchableRipple directo en app/src/components/presentation/workout/weighted/potential-set-counter.tsx mientras la pantalla nativa no haya demostrado paridad.
- No introducir un round trip JS/native por cada frame ni por cada tick de timer. El estado crítico debe tener una única autoridad.
- No reintroducir un contexto dinámico para ocultar NativeTabs ni montar tab transitions durante el push de un workout.
- No activar QuickCrypto globalmente durante cold start. El startup normal debe seguir evitando ese costo.
- No cambiar lógica funcional sólo para obtener métricas mejores. Cada cambio debe tener una hipótesis, una métrica y una prueba de regresión.
- Mantener fallback TypeScript/iOS mientras la implementación Android se valida. La ruta nativa se habilita sólo mediante una bandera explícita y reversible.
- No agregar dependencias externas si una API existente del proyecto resuelve el problema. Una dependencia nueva requiere justificar tamaño, mantenimiento y efecto en release.
- Todos los cambios de implementación futuros deben separarse en commits pequeños y verificarse antes de continuar con la siguiente fase.

## Current Evidence

### GainsLab actual

- El proyecto usa Expo/React Native/Hermes con Redux Toolkit, Drizzle y expo-sqlite.
- El módulo nativo existente app/modules/workout-worker ya contiene un servicio Android, notificaciones, acciones repetitivas y broadcast coalescing.
- app/src/components/presentation/workout/weighted/potential-set-counter.tsx usa TouchableRipple directo de react-native-paper para el tap de sets.
- app/src/components/presentation/workout/weighted/weighted-exercise.tsx mantiene recordedExerciseRef y callbacks estables para evitar renders y cierres obsoletos.
- La persistencia actual usa el schema y las claves existentes. El plan no puede sustituirlas ni duplicar escrituras.
- History, Stats, Feed, QuickCrypto, Health y servicios avanzados ya tienen optimizaciones lazy que deben permanecer.

### Baseline medido en el Moto G24 Power

- GainsLab v1.1.9: cold start de aproximadamente 2.03 s de promedio en tres corridas; warm start de aproximadamente 77 ms.
- Strong v6.2.4: cold start de aproximadamente 579 ms de promedio; warm start de aproximadamente 132 ms.
- PSS estabilizado: GainsLab aproximadamente 301,796 KB y Strong aproximadamente 252,880 KB. Las pantallas no eran idénticas, por lo que esta comparación es direccional, no una equivalencia de memoria.
- Barrido sintético de frames: GainsLab tuvo 0 current janky frames y 1.53% legacy janky frames; Strong tuvo 0.17% current y 5.39% legacy. Esto no sustituye un test de interacción real.
- Taps rápidos sintéticos en GainsLab no mostraron taps perdidos o duplicados en la sesión observada, pero el hot path requiere retest físico después de cada cambio.

### Qué hace Strong que es relevante

- Es una app Android nativa con Kotlin, Views/XML, AndroidX Navigation, ViewModels, coroutines y Hilt/Dagger.
- Usa Realm para su dominio local, WorkManager para trabajo diferido, y un servicio nativo para el rest timer.
- La ventaja observable no es Kotlin aislado: eventos, estado de workout, render y persistencia crítica viven en el mismo runtime Android.
- GainsLab no debe copiar Realm, Hilt ni toda la navegación de Strong. Debe aplicar sólo la co-localización que demuestre una mejora sin romper su persistencia actual.

### Gap de arquitectura

En GainsLab un tap de set atraviesa componentes React, Redux y la persistencia debounced. Eso es válido y rápido en el estado actual, pero en una sesión larga puede distribuir trabajo entre renders, serialización y bridge. Para ganar rendimiento real, la pantalla nativa debe asumir evento, estado visible, timer y batching local; mover sólo una función Kotlin detrás de la UI JS no es suficiente y puede ser más lento.

## File Map

### Archivos existentes que se usarán como contratos/adaptadores

- app/src/store/current-session/index.ts
- app/src/store/current-session/effects.ts
- app/src/store/current-session/helpers.ts
- app/src/services/session-service.ts
- app/src/services/key-value-store.ts
- app/src/components/smart/session-component.tsx
- app/src/app/(session)/session/index.tsx
- app/src/app/(session)/session/post-workout.tsx
- app/src/components/presentation/workout/weighted/potential-set-counter.tsx
- app/src/components/presentation/workout/weighted/weighted-exercise.tsx
- app/src/components/presentation/workout/rest-timer.tsx
- app/src/services/database-migration-service.ts
- app/src/components/smart/app-state-provider.tsx
- app/src/components/smart/services-provider.tsx
- app/src/store/history-view/effects.ts
- app/src/store/stats/effects.ts
- app/src/db/schema.ts
- app/modules/workout-worker/src/WorkoutWorkerModule.ts
- app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/WorkoutWorkerService.kt
- app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/utils/RepeatingTimerAction.kt
- app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/utils/WorkoutNotificationManager.kt
- app/modules/native-lib

Estos archivos son puntos de integración. No se deben modificar sus reglas de negocio hasta que exista una prueba de paridad explícita.

### Archivos nuevos previstos

- app/modules/workout-worker/src/WorkoutEngineModule.ts
- app/modules/workout-worker/src/WorkoutEngine.types.ts
- app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/engine/WorkoutEngineModule.kt
- app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/engine/WorkoutEngine.kt
- app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/engine/WorkoutEngineStorage.kt
- app/modules/workout-worker/android/src/test/java/expo/modules/workoutworker/engine/WorkoutEngineTest.kt
- app/modules/workout-worker/src/WorkoutEngineModule.spec.ts
- app/modules/native-lib/android/src/main/java/expo/modules/nativelib/NativeStartupSnapshotModule.kt
- app/modules/native-lib/src/NativeStartupSnapshotModule.ts
- app/modules/native-lib/android/src/main/java/expo/modules/nativelib/NativeQueryModule.kt
- app/modules/native-lib/src/NativeQueryModule.ts
- app/android/app/src/main/java/com/gabsvm/gainslab/session/WorkoutActivity.kt
- app/android/app/src/main/java/com/gabsvm/gainslab/session/WorkoutViewModel.kt
- app/android/app/src/main/java/com/gabsvm/gainslab/session/WorkoutViewState.kt
- layouts XML bajo app/android/app/src/main/res/layout/ para la pantalla nativa, sólo después de aprobar la fase de engine

Los archivos nuevos se crean sólo en la fase que los necesita. No se deben generar stubs vacíos ni archivos de compatibilidad sin consumidores.

## Phase 0: Baseline and safety gate

### Task 0.1: Confirm repository and working tree

**Files:** ninguno.

- [ ] Ejecutar git switch agent/gainslab-performance-polish.
- [ ] Ejecutar git status --short --branch, git rev-parse HEAD y git log -1 --oneline.
- [ ] Confirmar que no hay cambios ajenos antes de comenzar. Si aparecen, preservarlos y detener cualquier comando que pueda sobrescribirlos.
- [ ] Confirmar que main, restore/gainslab-liftlog-1.1.2 y otras ramas no serán modificadas.

**Acceptance:** la rama actual es la exclusiva de trabajo y el estado inicial está registrado.

### Task 0.2: Capture reproducible local gates

**Files:** ninguno.

- [ ] Desde app/, ejecutar npm ci.
- [ ] Ejecutar npm run typecheck.
- [ ] Ejecutar npm run lint.
- [ ] Ejecutar npm run test -- --run --passWithNoTests.
- [ ] Ejecutar el build Android release existente sin cambiar versión ni firma.
- [ ] Confirmar con adb devices si el Moto G24 Power está disponible.

**Acceptance:** se conoce qué gates ya fallan antes de migrar; ningún fallo preexistente se atribuye a Kotlin.

### Task 0.3: Record device baseline

**Files:** registro de ejecución en este plan o en un informe de benchmark aprobado; no modificar código.

- [ ] Medir cinco cold starts y cinco warm starts con el mismo APK y el mismo estado de pantalla.
- [ ] Medir PSS después de estabilizar Home y una sesión activa.
- [ ] Ejecutar adb shell dumpsys gfxinfo com.gabsvm.gainslab reset, un flujo de navegación y luego adb shell dumpsys gfxinfo com.gabsvm.gainslab.
- [ ] Medir taps rápidos de seis sets y una secuencia de completar/descompletar.
- [ ] Capturar adb logcat filtrando AndroidRuntime, ReactNativeJS, Expo, WorkoutWorker y GainsLab.
- [ ] Anotar si el estado observado contiene Current Workout, timer activo, Feed o diálogos; no comparar métricas con Strong usando estados distintos.

**Acceptance:** existe una medición comparable para cada fase; ningún resultado sintético se presenta como prueba manual.

## Phase 1: Define a parity-safe native contract

### Task 1.1: Map the existing session model before creating DTOs

**Files:** app/src/store/current-session/index.ts, app/src/store/current-session/effects.ts, app/src/services/session-service.ts, app/src/db/schema.ts, app/src/components/presentation/workout/weighted/weighted-exercise.tsx.

- [ ] Documentar los campos mínimos que la UI actual necesita para renderizar un workout activo, sin inventar nombres paralelos.
- [ ] Identificar las funciones existentes para toggle de set, actualización de reps, actualización de weight, inicio/reset del rest timer y finish.
- [ ] Identificar la clave exacta de persistencia del current session y el formato serializado ya usado.
- [ ] Marcar qué transformaciones son presentación y cuáles son semántica de programación; la engine nativa no puede recalcular prescriptions ni progression.
- [ ] Crear fixtures a partir de sesiones existentes: weighted, cardio, superset A1/A2/A3, workout incompleto, workout completo y sesión sin histórico previo.

**Acceptance:** cada comando futuro tiene una correspondencia trazable con una acción existente y un fixture de paridad.

### Task 1.2: Add a versioned command/snapshot contract

**Files:** app/modules/workout-worker/src/WorkoutEngine.types.ts, app/modules/workout-worker/src/WorkoutEngineModule.ts, app/modules/workout-worker/src/WorkoutEngineModule.spec.ts, app/modules/workout-worker/expo-module.config.json, app/modules/workout-worker/src/index.ts si exporta módulos.

- [ ] Definir un contrato versionado y pequeño. El comando debe distinguir toggle-set, update-reps, update-weight, start-rest, reset-rest y finish.
- [ ] Cada comando debe incluir sessionId, revision y los identificadores existentes de ejercicio/set cuando correspondan.
- [ ] El snapshot debe incluir schemaVersion, sessionId, revision, estado de sesión, estado de cada set visible, restTimerEndTime nullable y un estado de error serializable.
- [ ] Exponer un método de snapshot inicial, un método de comando y un evento de snapshot. Las respuestas deben ser idempotentes respecto de una revision ya aplicada.
- [ ] Rechazar comandos con sesión o revisión incompatibles con un error explícito; nunca aplicar silenciosamente un evento atrasado.
- [ ] Probar parseo/serialización, revisión duplicada, comando inválido y error recuperable sin usar any ni desactivar TypeScript.

**Acceptance:** TypeScript puede consumir el contrato sin conocer clases Kotlin; una revisión duplicada no genera una segunda mutación.

## Phase 2: Native state engine without changing persistence

### Task 2.1: Implement pure Kotlin session transitions

**Files:** app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/engine/WorkoutEngine.kt, app/modules/workout-worker/android/src/test/java/expo/modules/workoutworker/engine/WorkoutEngineTest.kt.

- [ ] Implementar una engine pura que reciba el snapshot serializado actual y devuelva el siguiente snapshot.
- [ ] Mantener exactamente las semánticas existentes de set completion, reps, weight, cardio, supersets y finish; no generar workouts ni decidir el siguiente ejercicio.
- [ ] Aplicar version bits y demás identificadores sólo donde el contrato existente lo exige; la engine no debe invocar crypto ni QuickCrypto.
- [ ] Hacer que las transiciones sean deterministas y que cada comando incremente una sola revision.
- [ ] Cubrir weighted, cardio, superset, completar/descompletar, actualización de reps/weight, sesión incompleta y finish.
- [ ] Agregar pruebas de propiedad simples: aplicar dos veces el mismo comando con la misma revisión produce el mismo snapshot y no duplica trabajo.

**Acceptance:** todas las pruebas Kotlin pasan y el snapshot coincide con el resultado esperado del reducer/servicio TypeScript para los fixtures.

### Task 2.2: Add the Expo bridge as an opt-in engine only

**Files:** app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/engine/WorkoutEngineModule.kt, app/modules/workout-worker/src/WorkoutEngineModule.ts, app/modules/workout-worker/src/WorkoutEngineModule.spec.ts, app/src/components/smart/session-component.tsx.

- [ ] Registrar el módulo en la configuración del módulo existente, sin crear otro runtime ni otra base de datos.
- [ ] Enviar un snapshot inicial completo una sola vez al entrar a la sesión.
- [ ] Enviar comandos sólo cuando una ruta opt-in esté habilitada; conservar el camino actual como fallback.
- [ ] Entregar snapshots coalescidos y no un evento por frame. Un tap debe producir una sola mutación visible.
- [ ] Mantener el callback de persistencia actual como autoridad durante esta fase. La engine no escribe SQLite ni KeyValueStore todavía.
- [ ] Añadir logs de diagnóstico sólo en builds de desarrollo y con el identificador de sesión redactado.

**Acceptance:** la pantalla existente sigue funcionando sin la bandera; con la bandera la engine puede ejecutar fixtures sin escribir datos reales; no hay cambio funcional observable.

## Phase 3: Native persistence with one writer

### Task 3.1: Prove the existing storage protocol and atomicity

**Files:** app/src/services/key-value-store.ts, app/src/store/current-session/effects.ts, app/modules/native-lib/src/ y su módulo Android existente.

- [ ] Documentar el protocolo de escritura actual: archivo temporal, write, reemplazo/eliminación de la versión previa y move final.
- [ ] Identificar el directorio y la clave exactos desde el código, sin duplicar strings en Kotlin.
- [ ] Definir una única interfaz nativa de escritura atómica que reciba la clave ya resuelta por TypeScript y bytes/JSON ya serializado.
- [ ] No generar nombres temporales con UUID ni importar @/utils/uuid en KeyValueStore. Los nombres temporales deben usar timestamp más contador local, igual que la corrección actual.
- [ ] Añadir pruebas de interrupción simulada: fallo antes de move conserva el archivo anterior; éxito reemplaza exactamente una vez; reintento no duplica archivos.

**Acceptance:** el protocolo conserva el archivo válido anterior ante fallo y no cambia ninguna clave ni formato persistido.

### Task 3.2: Serialize native writes and reconcile lifecycle

**Files:** app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/engine/WorkoutEngineStorage.kt, app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/engine/WorkoutEngineModule.kt, app/src/store/current-session/effects.ts, app/src/services/key-value-store.ts.

- [ ] Implementar una cola de escritura serializada en Kotlin sólo para el snapshot actual, con cancelación segura al destruir el módulo.
- [ ] Definir que la engine nativa es la única escritora cuando la pantalla nativa está activa. El fallback TypeScript es la única escritora cuando está inactivo.
- [ ] Prohibir dual-write y evitar que JS persista el mismo comando después de recibir un snapshot nativo.
- [ ] Preservar debounce/coalescing existente donde no sea posible migrar una ruta completa.
- [ ] Recuperar el último snapshot válido después de process death y comparar sessionId/revision antes de aceptarlo.
- [ ] Ejecutar una prueba de rotación, background/foreground, process recreation y cierre durante la escritura sin borrar la base.

**Acceptance:** existe una única autoridad por sesión, no se pierden sets, no se duplican broadcasts y no se modifica el formato de datos.

## Phase 4: Make the rest timer native-authoritative

### Task 4.1: Extend the existing worker/timer path

**Files:** app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/WorkoutWorkerService.kt, app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/utils/RepeatingTimerAction.kt, app/modules/workout-worker/android/src/main/java/expo/modules/workoutworker/utils/WorkoutNotificationManager.kt, app/src/components/presentation/workout/rest-timer.tsx, app/src/store/current-session/helpers.ts.

- [ ] Reutilizar el servicio y las acciones existentes; no crear un segundo servicio de timer.
- [ ] Hacer que la autoridad temporal sea un end time persistible, usando reloj monotónico para el cálculo transcurrido y wall clock sólo para recuperación.
- [ ] Emitir un snapshot de timer aproximadamente una vez por segundo y nunca usar un timer de alta frecuencia para pintar React.
- [ ] Mantener start, reset, pause/resume, finalización, background, notification y sonido según el comportamiento actual.
- [ ] Cancelar acciones, listeners y callbacks en stop, finish, destroy y reemplazo de sesión.
- [ ] Evitar cualquier dependencia de global.crypto o QuickCrypto en el camino del timer.

**Acceptance:** el timer sigue actualizándose a 1 Hz aproximadamente, sobrevive background/foreground, no añade trabajo por frame y conserva la API JS existente.

### Task 4.2: Validate timer/set interaction together

**Files:** tests Kotlin del worker, app/src/components/presentation/workout/rest-timer.tsx, fixtures de sesión.

- [ ] Probar completar un set, iniciar timer, tocar otro set, editar reps/weight y hacer scroll.
- [ ] Probar reset largo, finish, cambio de sesión y back Android.
- [ ] Verificar que un timer activo no agrega subscriptions Redux globales ni rerenders de toda la sesión.
- [ ] Comparar frames y tiempo de respuesta contra el baseline en el mismo dispositivo.

**Acceptance:** no hay taps perdidos, duplicados ni latencia perceptible nueva; el timer no empeora el hot path.

## Phase 5: Native startup snapshot without bypassing migrations

### Task 5.1: Add a minimal startup snapshot reader

**Files:** app/modules/native-lib/android/src/main/java/expo/modules/nativelib/NativeStartupSnapshotModule.kt, app/modules/native-lib/src/NativeStartupSnapshotModule.ts, app/src/components/smart/app-state-provider.tsx, app/src/components/smart/services-provider.tsx.

- [ ] Leer sólo el mínimo necesario para pintar el shell y recuperar Current Workout: settings visuales seguras, metadata de programa y snapshot de sesión ya existente.
- [ ] No abrir una ruta paralela de migraciones, no cambiar schema y no leer datos que todavía estén bajo una migración crítica.
- [ ] Usar el snapshot sólo como bootstrap visual provisional. La hidratación TypeScript continúa validando el estado y mantiene initializationError, Retry y el timeout real.
- [ ] Si el snapshot falta, está corrupto o tiene una versión incompatible, volver al flujo actual sin resetear datos.
- [ ] No cargar History completo, catálogo de ejercicios, Feed, crypto, Health ni servicios avanzados durante el bootstrap.

**Acceptance:** Home puede mostrar su shell antes de la hidratación completa sin falsificar isHydrated; un fallo del lector es recuperable y no oculta errores de migración.

### Task 5.2: Measure startup and failure recovery

**Files:** tests del módulo native-lib, app/src/components/smart/app-state-provider.tsx, app/src/services/database-migration-service.ts.

- [ ] Probar instalación existente con datos, instalación vacía, snapshot corrupto y versión antigua.
- [ ] Forzar un fallo de migración en entorno de prueba y confirmar pantalla recuperable con Retry/diagnóstico, nunca spinner infinito.
- [ ] Medir cold start P50/P95 y tiempo hasta Home después de cinco corridas.
- [ ] Exigir una mejora de al menos 20% en P50 sin empeorar P95 ni alterar la secuencia de migración.
- [ ] Si no se logra la mejora sin riesgo, retirar la bandera del release y conservar sólo la instrumentación.

**Acceptance:** startup más rápido o la fase se rechaza sin tocar migraciones ni datos.

### Phase 5 gate result (2026-08-31)

- La fase queda rechazada para implementación en esta iteración. `CurrentSessionStateV1` todavía puede contener protobuf histórico o JSON V3 que debe pasar por las migraciones TypeScript existentes; el módulo nativo no tiene un parser compatible ni acceso al contrato de `Paths.document` del `KeyValueStore`.
- No se agregó un lector paralelo ni un sidecar: hacerlo podría saltarse migraciones, duplicar el formato persistido o crear una segunda autoridad de estado.
- Se conserva el bootstrap TypeScript actual: shell temprano, hidratación real, `initializationError`, Retry, diagnóstico y timeout recuperable.
- El dispositivo estuvo conectado al iniciar la medición, pero perdió conexión antes de completar las corridas; no se declara mejora de startup ni se habilita una bandera nativa.

## Phase 6: Native workout screen, only after engine parity

### Task 6.1: Build the Android session shell

**Files:** app/android/app/src/main/java/com/gabsvm/gainslab/session/WorkoutActivity.kt, WorkoutViewModel.kt, WorkoutViewState.kt, layouts XML en app/android/app/src/main/res/layout/, bridge en app/src/app/(session)/_layout.tsx.

- [ ] Crear una Activity/View nativa con Views/XML, no Compose, para minimizar costo en el Moto G24 Power y alinear el camino con Strong.
- [ ] Recibir un snapshot inicial versionado y devolver un resultado de sesión al salir; no reconstruir el workout desde nombres ni posiciones.
- [ ] Mantener el header, nombre real, LIVE, progreso, supersets, weighted/cardio, Previous existente, Notes, More y los touch targets aprobados.
- [ ] Mantener tabs visibles durante workout; no agregar tab visibility context ni transiciones de relayout.
- [ ] Implementar el tap de set, reps/weight lazy, rest timer y finish con la engine nativa y una sola autoridad de persistencia.
- [ ] Mantener el fallback session/index.tsx para iOS, debug y cualquier error de inicialización nativa.
- [ ] No montar dialogs o menus cerrados innecesariamente y no ejecutar cálculos históricos en cada bind de View.

**Acceptance:** la Activity nativa puede abrirse y cerrarse sin pantalla intermedia; la ruta TypeScript sigue siendo funcional y seleccionable.

### Task 6.2: Preserve semantics and accessibility

**Files:** layouts XML, WorkoutViewModel.kt, WorkoutEngine.kt, app/src/components/presentation/workout/weighted/weighted-exercise.tsx como referencia de paridad.

- [ ] Verificar 360 dp, nombres largos, unidades, modo oscuro, TalkBack, focus order y touch target mínimo.
- [ ] Verificar superset sólo mediante WeightedExerciseBlueprint.supersetWithNext, manteniendo A1/A2/A3, B1/B2 y connector.
- [ ] Verificar sesión incompleta, completa, post-workout summary enabled y disabled.
- [ ] Verificar que no se añade una segunda lógica de save(): la Activity debe llamar el mismo contrato semántico de finish.
- [ ] Verificar que volver atrás, Android back, rotación y process death no crean una sesión duplicada ni pierden el snapshot.

**Acceptance:** los fixtures y pruebas manuales de sesión coinciden con TypeScript y no se introduce ninguna modificación de programación.

### Task 6.3: Prove the set hot path on device

**Files:** ninguno adicional; benchmark y evidencia de dispositivo.

- [ ] Instalar la build mediante adb install -r sin desinstalar ni limpiar datos.
- [ ] Repetir taps 1, 2, 3, 4, 5, 6; completar/descompletar y varios ejercicios.
- [ ] Ejecutar la misma prueba con Rest Timer activo y en un superset.
- [ ] Capturar vídeo o timestamps de input sólo si el entorno lo permite y correlacionar con logcat.
- [ ] Comparar tiempo de respuesta y frames con baseline; una compilación correcta no cuenta como prueba de latencia.

**Acceptance:** respuesta visual inmediata, ningún tap perdido/duplicado, una sola mutación por tap y sin regresión de scroll.

## Phase 7: Native read paths for History and Stats, only if profiling justifies it

### Task 7.1: Add read-only query adapter over the existing schema

**Files:** app/modules/native-lib/android/src/main/java/expo/modules/nativelib/NativeQueryModule.kt, app/modules/native-lib/src/NativeQueryModule.ts, app/src/store/history-view/effects.ts, app/src/store/stats/effects.ts.

- [ ] Reusar la base db.db, tablas y columnas existentes; no cambiar Drizzle migrations ni schema.
- [ ] Exponer consultas pequeñas por rango mensual/período, no devolver History completo ni materializar arrays innecesarios.
- [ ] Mantener loadedRangeKey, requestedRangeKey, coalescing de requests y protección contra navegación rápida A → B → A.
- [ ] Mantener lazy loading de History/Stats, cache persistente y selección All Time/Custom.
- [ ] Devolver DTOs versionados que puedan compararse con la salida actual de Drizzle.
- [ ] No mover consultas a native si el perfil no muestra que SQLite/serialización sea un costo dominante.

**Acceptance:** resultados nativos y Drizzle coinciden en meses vacíos, meses con sesiones, rangos rápidos, All Time, Custom, no data y navegación repetida.

### Task 7.2: Validate no startup regression

**Files:** app/src/store/history-view/effects.ts, app/src/store/stats/effects.ts, tests de integración local.

- [ ] Confirmar que abrir Home no ejecuta estas consultas.
- [ ] Confirmar que el catálogo de ejercicios no se carga al startup.
- [ ] Confirmar que cambiar de rango cancela o ignora respuestas obsoletas.
- [ ] Medir memoria, serialización y duración antes/después.

**Acceptance:** History/Stats mejoran o quedan iguales sin aumentar el costo de startup ni cambiar los datos mostrados.

## Phase 8: Rollout, rollback, and verification

### Task 8.1: Feature flag and fallback

**Files:** módulo de configuración Android existente, bridge de sesión y documentación de ejecución.

- [ ] Introducir una bandera Android local, desactivada por defecto en la primera integración.
- [ ] Registrar por qué se seleccionó fallback: módulo ausente, snapshot incompatible, error de persistencia o excepción de Activity.
- [ ] Garantizar que un error nativo cierre la ruta nativa de forma segura y vuelva a TypeScript sin resetear DB.
- [ ] No enviar métricas de usuario ni datos personales para medir la fase.

**Acceptance:** cambiar la bandera no requiere reinstalar ni migrar datos y el fallback es verificable en un dispositivo.

### Task 8.2: Full local validation matrix

**Files:** ninguno adicional.

- [ ] Ejecutar npm ci, npm run typecheck, npm run lint y npm run test -- --run --passWithNoTests.
- [ ] Ejecutar el build Android release real con R8, resource shrinking y sólo arm64-v8a.
- [ ] Verificar package, versionName/versionCode sin cambios, signer, ABI y apksigner verify.
- [ ] Instalar incrementalmente con adb install -r; nunca usar adb uninstall, limpiar datos o resetear la DB.
- [ ] Ejecutar startup, Home, iniciar/resumir workout, taps rápidos, reps/weight, timer, finish, post-workout, History, Progress y More.
- [ ] Ejecutar cold/warm start, PSS, gfxinfo, logs de startup y process recreation.
- [ ] Confirmar ausencia de Property 'crypto' doesn't exist, spinner infinito, doble persistencia, tabs dinámicas y pantalla intermedia al iniciar workout.

**Acceptance:** todos los gates aplicables son PASS o están marcados NOT RUN con una razón concreta; no se publica una release desde este plan.

### Task 8.3: Commit strategy

**Files:** historial Git.

- [ ] Commit de contrato: perf(android): define native workout parity contract.
- [ ] Commit de engine: perf(android): add parity-tested native workout engine.
- [ ] Commit de persistencia: perf(android): serialize native session snapshot writes.
- [ ] Commit de timer: perf(android): move rest timer authority to worker.
- [ ] Commit de startup: perf(android): add safe startup snapshot.
- [ ] Commit de UI nativa: perf(android): add opt-in native workout screen.
- [ ] Commit de queries: perf(android): add profiled native history queries.
- [ ] Cada commit debe compilar por sí mismo cuando eso sea posible, permanecer en agent/gainslab-performance-polish y ser reversible individualmente.

**Acceptance:** ningún commit mezcla rediseño, cambios de negocio, migraciones de schema, versión o release.

## Performance Gates

- **Set hot path:** mientras la UI sea React Native, conservar TouchableRipple directo, callbacks estables y una sola actualización de sesión por tap normal. En la UI nativa, el tap debe actualizar el estado local y encolar una sola persistencia coalescida.
- **Rest timer:** aproximadamente 1 Hz visible, sin actualización por frame, sin listener global adicional y sin bloquear taps o scroll.
- **Workout render:** no calcular session.isComplete, Previous, history lookups, arrays grandes, formatters, charts, promises, haptics nuevos ni navegación como consecuencia de cada tap.
- **Startup:** el snapshot no puede falsificar hidratación ni saltarse migraciones. Objetivo de fase: al menos 20% menos P50 de cold start, sin empeorar P95.
- **Memory:** medir mismo estado y misma pantalla; rechazar cualquier aumento sostenido que no esté explicado por eliminar renders/bridge cost.
- **History/Stats:** conservar lazy/range loading y coalescing; nunca hidratar el dataset completo para una pantalla que muestra un mes.
- **Native boundary:** evitar payloads completos repetidos. Usar snapshots sólo en entrada, comandos pequeños y eventos coalescidos.
- **Reliability:** process death, rotación, background, back y errores nativos deben conservar datos y ofrecer fallback.

## Explicitly Out of Scope

- Cambiar el diseño visual, navegación global, NativeTabs o añadir una inmersión dinámica durante workout.
- Migrar la totalidad del proyecto a Kotlin o reemplazar React Native en Home, More, Feed, auth, backup, sync o settings.
- Cambiar Realm/SQLite/Drizzle, crear tablas nuevas o reescribir migraciones.
- Reescribir la programación de workouts, progression, KONG, GUTS, PERFORMANCE, NH o SessionBlueprint.
- Cambiar QuickCrypto para que vuelva al cold start.
- Agregar features, métricas, entrenadores, pantallas o analytics de usuario.
- Publicar 1.1.9 o cualquier release mientras esta migración se implementa.

## Definition of Done

- [ ] La evidencia baseline y post-cambio está capturada en el mismo Moto G24 Power o se marca claramente como NOT RUN.
- [ ] Los contratos nativos tienen tests de serialización, revisión y errores.
- [ ] La engine Kotlin tiene pruebas de paridad para weighted, cardio, supersets, reps, weight, timer y finish.
- [ ] Existe una sola autoridad de persistencia activa en cada ruta y el formato almacenado no cambió.
- [ ] Startup conserva migration safety, initializationError, Retry, diagnóstico y fallback.
- [ ] El hot path de sets no tiene round trips por frame, doble update, animación pesada ni subscription adicional.
- [ ] Rest timer, back, rotación, background y process death tienen cobertura.
- [ ] History/Stats sólo se migran si el perfil demuestra beneficio y las consultas coinciden con Drizzle.
- [ ] Typecheck, lint, tests y release build locales pasan, o cada excepción está documentada con evidencia.
- [ ] La APK de prueba se verificó como ARM64, con package y firma existentes, y se instaló con adb install -r sin borrar datos cuando hubo dispositivo disponible.
- [ ] El plan no crea merge, PR, tag ni GitHub Release.
