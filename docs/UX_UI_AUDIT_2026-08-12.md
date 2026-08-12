# Auditoría UX/UI — GainsLab Android

Rama: `feat/gainslab-sync-import`

## Alcance implementado

La referencia visual adjunta se usó como guía de densidad y velocidad de registro. La aplicación conserva la identidad GainsLab y la lógica de LiftLog; no se convirtió la pantalla en una copia de Hevy.

### P0 — Workout activo

- Registro compacto por fila con columnas `SET`, `PREV`, métricas actuales y completion.
- La columna `PREV` muestra el último rendimiento del mismo ejercicio directamente junto al set actual.
- Las celdas numéricas son editables de forma directa y mantienen el flujo de aplicación de peso existente.
- Se redujo la altura vertical de las filas y celdas para mostrar más sets con menos scroll.
- `+ Add exercise` es ahora la acción primaria de ancho completo y siempre visible.
- `Save template` y `Health Connect` quedaron como acciones secundarias.
- El descanso conserva su cálculo existente y ahora ofrece un panel explícito al tocarlo:
  - `-15s`;
  - `Restart`;
  - `+15s`;
  - `Skip`;
  - recomendación mínima/máxima cuando la configuración del ejercicio la define.
- El estado del timer conserva duración, ejercicio de origen y persistencia al volver a abrir la app.

### P1 — Cierre e historial

- El diálogo de finalización muestra sets, volumen, duración y comparación de volumen con el último entrenamiento del mismo nombre.
- El historial permite borrar una sesión con confirmación.
- La eliminación usa el repositorio nativo y respeta las relaciones SQLite en cascada.

### P1 — Descubribilidad y progreso

- La barra inferior usa iconos Material en vez de letras temporales.
- Inicio muestra una sola rutina en `UP NEXT`, reduciendo competencia visual.
- La tarjeta de programa ocupa menos altura y trata la gestión como acción secundaria.
- El selector de ejercicios permite filtrar rápidamente por músculo, equipo y tipo.
- Progreso incorpora una tarjeta por ejercicio con métricas seleccionables: peso, 1RM estimado, volumen y repeticiones.
- La tendencia usa únicamente sesiones existentes y sólo muestra puntos con sets completados.

## Validación realizada

```powershell
$env:ANDROID_HOME = 'C:\Users\Gabriel Sanchez\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
app\android\gradlew.bat --project-dir native `
  :shared:jvmTest `
  :androidApp:testDebugUnitTest `
  :androidApp:lintDebug `
  :androidApp:assembleDebug `
  --console=plain
```

Resultado: correcto. Kotlin/Native iOS aparece deshabilitado por ejecutarse en Windows, sin afectar esta validación Android.

## Pendiente de verificación física

- Comprobar en el Redmi la densidad real, clipping horizontal y comportamiento del teclado numérico.
- Medir el uso con 4–6 sets visibles y validar que las celdas siguen siendo cómodas al tocar.
- Confirmar que el panel del timer no queda oculto por el teclado ni por la navegación del sistema.
- Probar historial, borrado, restauración y actualización `adb install -r` sobre la instalación existente.
- Sustituir los strings hardcodeados por recursos Android y corregir los textos heredados con problemas de codificación antes de considerar la paridad visual completa.
- Completar navegación basada en destinos y separar el archivo monolítico de Compose cuando la UI estabilice.
