# Templates y registro rápido de workouts

## Decisión de producto

LiftLog tendrá dos conceptos separados:

- **Workout**: una sesión real que empieza ahora, puede cambiar durante la
  ejecución y queda guardada en History.
- **Template**: una plantilla reutilizable sin resultados reales. Puede crearse
  desde cero o a partir de un workout terminado y puede vivir dentro de una
  carpeta.

La referencia funcional es el flujo de Strong: iniciar un workout vacío o
desde una plantilla, añadir ejercicios y sets durante la sesión, marcar cada
set rápidamente y guardar la sesión como plantilla. La implementación visual
mantiene la jerarquía, paleta y tono de GainsLab.

## UX híbrida elegida

### Biblioteca

- Acción primaria `Start empty` para entrenar sin plan.
- Templates ordenados por carpeta y una sección `Unfiled`.
- `Start` abre una sesión real, no edita la plantilla.
- `Move` cambia la carpeta sin duplicar el template.
- `New folder` crea una carpeta local.
- `Save template` desde la sesión permite cambiar nombre y carpeta.

### Ejecución

- La sesión comienza con el menor número de pasos posible.
- Cada set muestra número, resumen y checkbox rápido.
- Un toque en el cuerpo del set conserva el editor detallado de LiftLog para
  peso, reps, RIR/RPE, duración, distancia y tipos especiales.
- Guardar el editor marca el set como completado cuando los datos son válidos.
- El checkbox conserva el comportamiento de toggle de LiftLog para completar o
  desmarcar rápidamente.
- Al marcar un set se inicia el descanso configurado del ejercicio o el
  descanso global, igual que al guardar un set desde el editor.
- El temporizador de descanso sigue siendo nativo y persistente.

Esto evita dos extremos: una tabla lenta que obliga a abrir un formulario para
cada set, o una interfaz tan simplificada que pierda los datos específicos que
LiftLog ya soporta.

## Modelo y persistencia

- `WorkoutRoutine` se usa como template y ahora puede tener `folderId`.
- `WorkoutTemplateFolder` representa carpetas locales.
- SQLite sube a versión 6 con `workout_template_folders` y `folder_id` en
  `workout_routines`.
- Borrar una carpeta deja sus templates en `Unfiled`; no borra sesiones ni
  plantillas.
- El export/import nativo conserva carpetas y relación template-carpeta, con
  campos opcionales para mantener compatibilidad con backups v1 existentes.

## Estado de esta rebanada

Implementado en el piloto Android nativo y validado en el Redmi con package
temporal:

- biblioteca GainsLab de templates;
- inicio de workout vacío;
- guardado de una sesión como template con carpeta;
- carpetas persistentes y movimiento de templates;
- checkbox rápido por set y edición detallada;
- build `:shared:jvmTest` + `:androidApp:assembleDebug`;
- smoke ADB sin crash, `SQLiteException` ni ANR.

La APK Expo `com.gabsvm.gainslab` `1.1.3` sigue siendo la instalada en el
dispositivo. La APK nativa aún no reemplaza producción.

## Siguiente iteración

1. Mostrar el siguiente ejercicio/set en la tarjeta del temporizador.
2. Añadir supersets/circuitos con el mismo registro rápido.
3. Comparar esta pantalla con la APK Expo antes de hacer el cambio de package.

## Segunda rebanada implementada

- Los workouts nuevos desde un template y los ejercicios añadidos a una sesión
  reutilizan los valores del último rendimiento conocido, sin copiar la marca
  de completado.
- `Finish` ofrece `Finish & save`, que finaliza la sesión y abre el guardado
  como template con carpeta.
- Los ejercicios y sets tienen controles accesibles `↑`/`↓` y también se pueden
  reordenar arrastrando después de una pulsación prolongada.
- El orden se persiste en la sesión y no modifica el template de origen.

## Supersets y pairing al estilo Strong

El pairing se crea desde el botón `Pair` del ejercicio, tanto mientras se
edita un template como durante un workout ya iniciado. Al elegir otro
ejercicio se guarda el mismo `supersetGroup` en ambos elementos; si alguno ya
pertenece a un grupo, los grupos se combinan. `Unpair` elimina el grupo de dos
ejercicios o separa solo el elemento seleccionado en un circuito de tres o
más.

La representación sigue el patrón de Strong:

- `A1`, `A2` indican el orden de los ejercicios dentro del primer superset;
- el siguiente grupo se muestra como `B1`, `B2`;
- dos ejercicios se nombran `Superset`; tres o más, `Circuit`;
- una línea lateral y el texto `alterna con A2` hacen visible que no son
  ejercicios independientes;
- el resumen del template también lista los miembros del grupo, por ejemplo
  `Superset A · A1 BB Bench Press · A2 DB Row`.

El orden de la lista determina el orden A1/A2. Por eso reordenar ejercicios
también reordena la ronda del pairing sin cambiar los datos del ejercicio.
Al iniciar el template, el grupo se copia a la sesión y se conserva al guardar
la sesión como otro template o al exportar/importar el backup.

La lógica se basa en el `supersetGroup` que ya existía en el dominio y en la
persistencia de sesiones/rutinas; no requiere una migración de SQLite.

## Tercera rebanada — workout activo estilo Strong

La pantalla activa del piloto nativo ahora incorpora:

- campos inline para peso, repeticiones, asistencia, duración y distancia;
- columna `Previous` calculada desde el último rendimiento del ejercicio;
- checkbox de serie deshabilitado hasta que los datos mínimos sean válidos;
- guardado incremental de los borradores sin marcar automáticamente la serie;
- descanso asociado al ejercicio que acaba de completarse y uso de `RestConfig`;
- cronómetro visible de la sesión y renombrado del workout durante la ejecución;
- selector de ejercicios con búsqueda por nombre o grupo muscular;
- menú contextual por ejercicio para pairing o eliminación;
- conservación de la edición detallada para RIR/RPE y campos avanzados.

La validación local ejecutada fue `:shared:jvmTest` y
`:androidApp:assembleDebug`. La validación por ADB queda pendiente de que el
teléfono vuelva a conectarse; la APK de producción Expo no se reemplazó.
## Cuarta rebanada — control avanzado sin salir del workout

Mientras el dispositivo estÃ¡ desconectado se completÃ³ otra parte del flujo:

- el editor detallado permite cambiar tipo de serie, unidad kg/lb y notas;
- las notas de ejercicio se editan desde el menÃº `More` de la tarjeta activa;
- el selector permite filtrar por grupo muscular y ordenar A-Z/Z-A;
- cada set muestra su tipo especial cuando no es `Normal`;
- supersets y circuits muestran una cabecera de ronda antes del grupo;
- `Finish` muestra sets completos, ejercicios, duraciÃ³n y volumen estimado.

La APK debug queda preparada en
`native/androidApp/build/outputs/apk/debug/androidApp-debug.apk`. Antes de
usarla como candidata de producciÃ³n hay que completar el recorrido ADB en el
Redmi y revisar visualmente densidad, teclado, scroll y comportamiento al
volver del background.
