# GainsLab — auditoría y especificación mobile UI/UX

Fecha: 29 de julio de 2026  
Plataforma verificada: Android, Moto G24 Power, viewport 720 × 1612 px  
Base técnica: Expo SDK 56, React Native 0.85, Expo Router y Material 3

## 1. Diagnóstico ejecutivo

La aplicación tenía una base funcional sólida, pero se percibía como una
personalización incompleta de LiftLog. La navegación, los controles y el modelo
de datos eran potentes; la identidad, la priorización y la densidad visual no
estaban al mismo nivel.

La captura de la pantalla principal anterior confirmó los problemas más
visibles:

- El encabezado decía `LiftLog` aunque el binario y los assets ya eran
  `GainsLab`.
- El color principal era azul dinámico del dispositivo; el lima GainsLab no
  participaba en la interfaz.
- Una sola rutina ocupaba casi todo el viewport por mostrar todos sus ejercicios
  y valores a la vez.
- Compartir y editar tenían casi el mismo peso que comenzar a entrenar.
- El FAB de entrenamiento libre flotaba sobre el contenido y competía con la
  navegación.
- Cinco destinos principales daban el mismo peso a Entrenar, Feed, Estadísticas,
  Historial y Ajustes.

La dirección aplicada convierte GainsLab en un producto de entrenamiento
enfocado: la próxima acción está clara, el detalle aparece en capas y la marca es
estable en modo claro y oscuro.

## 2. Qué funcionaba y se preservó

- El modelo de planes, sesiones, ejercicios y progresión tiene profundidad real.
- La acción de reanudar una sesión existente ya estaba contemplada.
- El calendario de historial permite crear, abrir y borrar sesiones con rapidez.
- Estadísticas ofrece métricas accionables y acceso al detalle por ejercicio.
- Los destinos usan rutas nativas y conservan comportamiento de back correcto.
- Los controles de peso, repeticiones y descanso están optimizados para uso
  durante el entrenamiento.
- La app soporta localización, accesibilidad de texto, tema claro/oscuro y
  unidades métricas/imperiales.

## 3. Problemas y oportunidades

### Críticos

1. **Identidad fragmentada.** `app.json` decía GainsLab, pero onboarding,
   encabezados, textos de soporte y diálogos seguían diciendo LiftLog.
2. **Color no controlado.** Material You tomaba el color del sistema y podía
   transformar completamente la percepción de marca.
3. **Jerarquía plana en Inicio.** Gestión del plan, compartir, editar y comenzar
   rutina competían visualmente.
4. **Densidad excesiva.** Cada tarjeta mostraba la rutina completa. Era difícil
   comparar rutinas y aumentaba el scroll.
5. **Onboarding centrado en el proyecto, no en el usuario.** La primera pantalla
   explicaba que el código era open source en vez de explicar el valor del
   producto.

### Fricción alta

1. **Cinco tabs permanentes.** Feed es una función secundaria y desplazaba
   destinos más frecuentes.
2. **FAB superpuesto.** El botón de entrenamiento libre tapaba contenido en
   pantallas pequeñas.
3. **Historial verboso.** Repetía todos los ejercicios y cuatro acciones por
   sesión.
4. **Ajustes sin arquitectura.** Una lista larga mezclaba planes, idioma,
   backups, IA, soporte y cuenta.
5. **Sesión activa sin resumen de progreso.** El usuario veía ejercicios, pero no
   una lectura inmediata del avance global.
6. **Estados de carga opacos.** Mensajes como `Loading current session` no
   explicaban si la app estaba recuperando datos, migrando o esperando red.

### Inconsistencias

- Mezcla de inglés y español en ajustes agregados recientemente.
- Radios pequeños en algunas superficies y grandes en otras.
- Iconos dentro de botones, iconos sueltos y FAB con prioridades ambiguas.
- Márgenes dobles o inexistentes según la pantalla.
- Uso de azul, grises Material y lima sin una regla semántica.
- Enlaces de soporte apuntando al proyecto original en lugar del repositorio del
  producto.

## 4. Principios aplicados

1. **Entrenar primero.** La acción dominante en Inicio y sesión activa siempre es
   comenzar, reanudar o completar.
2. **Información por capas.** Una tarjeta muestra nombre, cantidad y hasta cuatro
   ejercicios; el detalle completo vive dentro de la sesión.
3. **Una mano, zona inferior.** Acciones frecuentes tienen al menos 48 dp y se
   ubican al final de la tarjeta o en la barra inferior.
4. **Marca estable.** GainsLab lima identifica progreso, selección y acción; no
   se usa como relleno decorativo indiscriminado.
5. **Contraste antes que estética.** En oscuro se usa lima brillante. En claro se
   usa verde oliva `#4A6800` para texto y controles accesibles.
6. **Escaneabilidad.** Títulos cortos, labels de contexto en mayúsculas, números
   tabulares y listas compactas.
7. **Secundario silencioso.** Compartir, editar, borrar y configurar nunca
   compiten con el CTA.
8. **Movimiento con propósito.** Feedback háptico leve al avanzar onboarding o
   iniciar una sesión; animación sólo para comunicar cambio de estado.

## 5. Arquitectura de navegación

La navegación primaria queda reducida a cuatro destinos:

1. **Entrenar** — plan activo, próxima rutina, sesión en curso y entrenamiento
   libre.
2. **Progreso** — resumen, periodo, tendencias y detalle por ejercicio.
3. **Historial** — calendario y sesiones registradas.
4. **Más** — planes, ejercicios, cuenta, datos, preferencias, comunidad y
   soporte.

`Feed` permanece disponible dentro de Más > Soporte y comunidad. De esta forma
no se elimina funcionalidad; se corrige su jerarquía.

### Flujo principal optimizado

```text
Abrir app
  → Entrenar
    → Ver próxima rutina
      → Comenzar
        → Registrar series
          → Ver avance y descanso
            → Completar
              → Resumen post-entreno
                → Progreso / Entrenar
```

### Flujos secundarios

- Cambiar plan: Entrenar > Plan de entrenamiento > Elegir.
- Editar rutina: Entrenar > Plan de entrenamiento > Editar.
- Entrenamiento espontáneo: final de Entrenar > Entrenamiento libre.
- Repetir sesión: Historial > sesión > reproducir.
- Importar: Más > Cuenta y datos > Importar desde IronLog.
- Comunidad: Más > Soporte > Feed.

## 6. Sistema de diseño

### Color

| Token | Oscuro | Claro | Uso |
|---|---:|---:|---|
| Brand / primary | `#C6FF00` | `#4A6800` | CTA, progreso, foco |
| Background | `#0B0D0C` | `#F5F7F3` | fondo de pantalla |
| Surface | `#0B0D0C` | `#F9FBF7` | base |
| Surface container | `#151816` | `#EBEFE8` | tarjetas |
| Surface high | `#1B1F1C` | `#E5E9E2` | superficies elevadas |
| Text | `#E4E8E2` | `#191D19` | texto primario |
| Text secondary | `#C2C8BE` | `#42483F` | soporte |
| Outline | `#8C9388` | `#73796F` | bordes necesarios |
| Error | `#FFB4AB` | `#BA1A1A` | acciones destructivas |

Regla: nunca usar el lima brillante como texto pequeño sobre blanco. En claro,
usar `#4A6800`.

### Tipografía

Se conserva la fuente del sistema por rendimiento y legibilidad.

- Display: 36–40 sp, peso 800, tracking `-1.4`.
- H1 mobile: 28–32 sp, peso 800, tracking `-0.8`.
- H2/card: 22–24 sp, peso 800.
- Title: 16–18 sp, peso 700.
- Body: 14–16 sp, interlínea 20–25.
- Label: 11–13 sp, peso 700–800.
- Eyebrow: 11 sp, tracking `1.5`, mayúsculas.
- Métricas: números tabulares.

### Espaciado

Base de 4 dp:

- Margen horizontal de pantalla: 16 dp.
- Separación mínima texto/icono: 8 dp.
- Separación entre bloques de tarjeta: 12–20 dp.
- Separación entre secciones: 24–32 dp.
- Padding de tarjeta: 16 dp.
- Altura táctil mínima: 48 dp.
- Separación del borde inferior: 24–32 dp más safe area.

### Forma y elevación

- Tarjeta principal: radio 22 dp.
- Tarjeta secundaria: radio 18–20 dp.
- Contenedor de icono: 44 × 44 dp, radio 14 dp.
- Pills: radio 999 dp.
- Se evita sombra decorativa en oscuro; la jerarquía se construye con tonos de
  superficie. En claro, sólo elevación Material mínima en overlays.
- Bordes continuos y sin esquinas mezcladas.

### Iconografía

- Material Symbols en Android y SF Symbols en iOS.
- Tamaño normal: 20–24 dp.
- Tab bar: icono nativo.
- Destructivo: siempre icono + confirmación.
- No se muestran más de dos acciones secundarias sueltas por tarjeta.

## 7. Especificación por pantalla

### Onboarding

**Pantalla 1 — valor**

- Wordmark arriba.
- H1 `Entrená con intención`.
- Descripción de máximo tres líneas.
- Tres tarjetas: Registrar, Analizar, Crecer.
- CTA inferior fijo de 48 dp.
- Indicador 8 dp; activo 24 dp en lima.

**Pantalla 2 — esenciales**

- H1 `Hacelo tuyo`.
- Unidades, primer día e idioma.
- Se elimina la selección de color del onboarding para reducir decisiones.
- La apariencia avanzada permanece en Más.

**Pantalla 3 — foco**

- Notificaciones de descanso.
- Exportación a Health Connect/Apple Health.
- Comunidad opcional.
- Permiso del sistema se solicita al finalizar sólo si fue activado.

### Entrenar

```text
[GainsLab]
ENTRENAMIENTO DE HOY
¿Listo para entrenar?
Tu plan, tus números...

[ Plan de entrenamiento       ]
[ Elegir plan ]       [ Editar ]

Lo que sigue
[ Upper 1              7 ejercicios ]
[ 01 DB Incline Press        3 × 10 ]
[ 02 Neutral Chin-Up          3 × 8 ]
[ 03 Band Pull Apart         3 × 15 ]
[ 04 DB Seated Press          3 × 8 ]
[ +3 más                             ]
[ share ] [ edit ] [ Comenzar rutina ]

[ Entrenamiento libre ]
```

- Wordmark compacto: 32 dp.
- CTA de rutina: mínimo 48 dp, alineado a la derecha y ocupa el espacio
  restante.
- Preview máximo: cuatro ejercicios.
- Sesión activa muestra pill de estado.
- Entrenamiento libre pasa de FAB superpuesto a botón secundario al final.

### Sesión activa

- Header nativo conserva back, completar y menú.
- Bloque superior: label `ENTRENAMIENTO EN CURSO`, nombre, porcentaje y barra.
- Cada ejercicio usa tarjeta de radio 20 dp y margen lateral 16 dp.
- Historia, notas y menú son acciones secundarias.
- Set activo conserva controles grandes y próximos al pulgar.
- Descanso permanece anclado abajo cuando está activo.
- Resumen de volumen y tiempo aparece al final y abre detalle post-entreno.

Estados:

- Sin iniciar: primer set con acento primario.
- En progreso: barra y próximo ejercicio resaltados.
- Descanso: temporizador inferior persistente.
- Completo: feedback háptico, acción completar reforzada.
- Sin ejercicios: explicación + acción agregar, no sólo texto vacío.

### Progreso

- Encabezado de propósito, no sólo `Estadísticas`.
- Selector de periodo inmediatamente debajo.
- Grid 2 × N; tarjetas de al menos 116 dp.
- Icono dentro de contenedor 32 dp.
- Métrica con 22 sp y peso 800.
- Label puede ocupar dos líneas; no se trunca información importante.
- Top cinco ejercicios y `Ver más` abre buscador en sheet.

Estados:

- Cargando: skeleton de seis métricas.
- Vacío: explicación y CTA `Completá tu primer entrenamiento`.
- Error: mensaje contextual y reintentar.

### Historial

- Calendario como superficie primaria.
- Día con sesión usa color primario; hoy vacío usa borde.
- Debajo: cantidad de sesiones del mes.
- Cada sesión muestra nombre, fecha y máximo tres ejercicios.
- Acciones: editar dominante; compartir, repetir y borrar secundarias.
- Long press sobre día con sesión mantiene borrado rápido, siempre confirmado.

### Más

Agrupación:

1. Plan de entrenamiento.
2. Cuenta y datos.
3. Apariencia y experiencia.
4. Soporte y comunidad.

Cada grupo tiene título, descripción y una tarjeta contenedora. Esto sustituye la
lista plana y permite escanear por intención.

## 8. Estados y microinteracciones

- Press: escala visual nativa/ripple y háptico leve sólo en acciones relevantes.
- Inicio de sesión: `ImpactFeedbackStyle.Light`.
- Avance onboarding: selección háptica.
- Barra de progreso: debe animar 180–240 ms al completar ejercicio.
- Loading: skeleton; reservar spinner para acciones cortas.
- Error recuperable: mensaje dentro de la sección y CTA.
- Error global: nunca dejar pantalla negra; mostrar identidad, explicación y
  reintentar.
- Destructivo: confirmación con nombre del objeto y botón de error.
- Offline: badge pequeño en Cuenta y datos; el registro local no se bloquea.

## 9. Checklist implementado

- [x] Paleta GainsLab estable en claro y oscuro.
- [x] Wordmark y tagline reutilizables.
- [x] Encabezados con eyebrow, título y explicación.
- [x] Onboarding centrado en valor y configuración esencial.
- [x] Eliminación de open source como propuesta de valor principal.
- [x] Inicio con jerarquía entrenar > gestionar > compartir.
- [x] Preview compacto de máximo cuatro ejercicios.
- [x] Acción de entrenamiento libre sin superposición.
- [x] Sesión activa con progreso global.
- [x] Ejercicios activos agrupados como tarjetas.
- [x] Progreso con tarjetas métricas legibles.
- [x] Historial con sesiones resumidas.
- [x] Ajustes reorganizados por intención.
- [x] Navegación primaria reducida a cuatro tabs.
- [x] Feed reubicado dentro de Más sin eliminar funcionalidad.
- [x] URLs de soporte dirigidas al repositorio GainsLab.
- [x] Textos de marca principales corregidos en inglés y español.
- [x] Targets táctiles principales de 48 dp.
- [x] Safe area explícita cuando el header superior está oculto.
- [x] Feedback háptico en onboarding e inicio de rutina.

## 10. Criterios de aceptación

1. Ninguna pantalla principal visible muestra LiftLog como nombre del producto.
2. La próxima rutina y su CTA aparecen sin scroll en un teléfono de 720 × 1612.
3. El usuario puede comenzar o reanudar con un solo tap desde Entrenar.
4. Ningún FAB tapa una rutina o la barra inferior.
5. Sólo hay cuatro destinos persistentes.
6. El contraste de texto secundario es legible en claro y oscuro.
7. Las tarjetas no muestran más de cuatro ejercicios en listados.
8. La sesión activa comunica porcentaje y ejercicios completados.
9. Todos los targets principales miden al menos 48 dp.
10. Cambiar tamaño de fuente no corta títulos ni acciones críticas.
11. Carga, vacío, error y contenido preservan el mismo layout base.
12. La app abre, navega y registra una serie en un dispositivo real sin crash.

