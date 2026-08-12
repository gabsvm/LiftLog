# Strong — paquete de referencias visuales

Capturas tomadas directamente del teléfono Android el 11 de agosto de 2026 para orientar la evolución de LiftLog. No son una copia de la implementación de Strong: sirven como referencia de jerarquía, densidad y flujo de uso.

## Origen

- Aplicación: Strong (`io.strongapp.strong`)
- Dispositivo: Redmi, ADB `96165d8a`
- Resolución capturada: 1080 × 2263
- Secciones revisadas: Workout, History, Exercises, Measure, Profile y Settings

## Capturas

- `01-workout-library.png` — biblioteca Workout, inicio rápido, plantillas y carpetas.
- `02-history.png` — historial agrupado por fecha, resumen de sesiones y referencia visual de supersets.
- `03-exercises.png` — catálogo de ejercicios.
- `04-measure.png` — métricas corporales.
- `05-profile.png` — perfil, dashboard y widgets.
- `06-settings.png` — preferencias de apariencia, sonido, series, barras, discos y timers.
- `07-template-menu.png` — menú de una plantilla: editar, renombrar, archivar, duplicar, compartir y eliminar.
- `08-empty-workout.png` — workout vacío en ejecución.
- `09-exercise-picker.png` — selector de ejercicios con búsqueda, filtros y ordenación.
- `10-workout-with-exercise.png` — ejecución con un ejercicio añadido.
- `11-set-completed.png` — registro de una serie con peso/repeticiones y estado completado.
- `13-exercise-menu.png` — menú contextual del ejercicio dentro de la ejecución.

También pueden existir capturas auxiliares generadas durante la inspección (`12-after-back.png` y `14-cancel-dialog.png`); no forman parte del recorrido principal.

## Flujo observado

1. Desde Workout se puede iniciar una sesión vacía o arrancar una plantilla.
2. La sesión muestra el cronómetro arriba y mantiene `FINISH` siempre accesible.
3. Cada ejercicio expone series con valor anterior, entradas de peso/repeticiones y confirmación rápida.
4. El descanso aparece integrado debajo de las series y permite añadir otra serie con un único botón.
5. Las acciones avanzadas se mantienen dentro del menú contextual del ejercicio.
6. Las plantillas se organizan en carpetas y tienen acciones independientes de editar, duplicar, archivar, compartir y eliminar.

## Referencias oficiales

- [Supersets y circuits](https://help.strongapp.io/article/98-supersets-and-circuits)
- [Templates](https://help.strongapp.io/article/105-about-templates)
- [Primer workout](https://help.strongapp.io/article/229-my-first-workout)

## Estado de la inspección

Para capturar la pantalla de ejecución se abrió un workout vacío, se añadió un ejercicio y se registró una serie de prueba. La sesión se canceló al terminar; no se guardó como workout ni se alteraron las plantillas existentes. El teléfono se dejó nuevamente en LiftLog (`com.gabsvm.gainslab`).
