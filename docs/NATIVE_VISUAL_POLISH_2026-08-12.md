# Native Android visual polish - 2026-08-12

## Alcance

Esta fase continua la auditoria UX/UI de la rama `feat/gainslab-sync-import`.
La referencia principal fueron las capturas del dispositivo con tres zonas de uso:

- Home / Train.
- More / Settings.
- Active workout.

El objetivo fue conservar la identidad GainsLab y mejorar la claridad sin cambiar
el contrato de datos ni la firma de la APK interna.

## Cambios aplicados

### Home

- Se elimino el duplicado de `UP NEXT` cuando la rutina siguiente era el mismo
  workout que ya estaba activo.
- El logo usa ahora el caracter Unicode escapado en Kotlin, evitando que el
  arrow aparezca como texto mojibake (`a` y simbolos rotos).
- El icono del programa actual usa un icono Material real.

### More / Settings

- Las filas de ajustes usan iconos Material reales por tipo de opcion.
- Se eliminaron de la ruta visible los bullets y simbolos de texto que se
  renderizaban corruptos.

### Active workout

- El campo de busqueda del selector de ejercicios usa `Icons.Filled.Search`.
- El resumen anterior por serie y el check de finalizacion usan escapes Unicode
  estables (`em dash`, `multiplication sign`, `check mark`).
- El panel de descanso mantiene los controles `-15s`, `Restart`, `+15s` y
  `Skip`, y muestra el rango recomendado con un guion Unicode estable.

### Navegacion

- Se reemplazaron los flags independientes de pantalla por una pila ligera de
  destinos nativos: Train, Progress, History, Routines, Exercises y More.
- More -> Routines/Exercises y History -> Routines/Exercises conservan ahora el
  origen al pulsar Back.
- Se agrego `BackHandler` para que el boton Back del sistema cierre primero el
  workout activo y despues retroceda por la pila visual.
- Los tabs cambian de destino de forma directa y no dejan pantallas antiguas
  superpuestas.

## Validacion

Comando ejecutado:

```text
app\android\gradlew.bat --project-dir native :androidApp:compileDebugKotlin --console=plain
```

Resultado: `BUILD SUCCESSFUL`.

Queda pendiente en esta fase ejecutar el paquete completo de tests, lint y
assembleDebug/assembleRelease, y comprobar nuevamente las pantallas en el Redmi
cuando ADB este conectado. La validacion de UI fisica no se considera completada
solo por compilar.

## Fase de cierre post-workout

La siguiente fase de mayor impacto ya esta implementada:

- Al terminar una sesion se muestra una pantalla `WORKOUT COMPLETE`.
- Resume duracion, volumen y sets completados.
- Compara el volumen con la sesion anterior del mismo nombre.
- Destaca hasta tres ejercicios con aumento de volumen.
- Marca `NEW PR` cuando el mejor peso del ejercicio supera la sesion anterior.
- Mantiene `Save as template` y permite finalizar con `Done`.

## Progress

- El selector de periodo ya no es decorativo: permite 30 dias, 90 dias, un ano
  o todo el historial.
- Las estadisticas y la tendencia se recalculan usando el periodo seleccionado.
- Los chips de metrica se pueden desplazar horizontalmente en pantallas angostas
  sin cortar `Volume` o `Reps`.

## Localizacion nativa

- Se agregaron recursos Android en `values/strings.xml` y `values-es/strings.xml`.
- Home, workout activo, cierre post-workout, Progress y More ya obtienen sus
  textos principales mediante `stringResource`.
- La variante espanola mantiene el mismo layout y solo cambia copy, unidades
  textuales y etiquetas de accesibilidad.
- Los iconos de More soportan nombres localizados para conservar su semantica
  al cambiar de idioma.

## Fases restantes

1. Cubrir navegacion, registro compacto, cambio de idioma y cierre con pruebas
   Compose.
2. Separar el archivo monolitico de Compose despues de estabilizar la UI.
3. Validar densidad, teclado, timer y reemplazo por `adb install -r` en el Redmi.
