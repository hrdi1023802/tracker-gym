# Planes de entrenamiento e integraciones

Esta guía explica cómo llevar un plan creado en la app a **Garmin Connect**, **Hevy** y **Strava**,
y qué permite realmente cada plataforma.

## Resumen de lo que se puede y lo que no

| Plataforma | ¿Admite planes *antes* de entrenar? | Cómo se hace aquí |
| --- | --- | --- |
| **Garmin Connect** | Sí | Se genera un archivo `.fit` de tipo *workout* y se importa. El reloj guía series, repeticiones y descansos. |
| **Hevy** | Sí | Se crea una **rutina** con su API pública (`POST /v1/routines`). Necesita clave de API (Hevy Pro). |
| **Strava** | No | Strava sólo acepta actividades **ya realizadas**. Se genera un `.tcx` de la sesión terminada para subirlo a mano. |

## Cómo se usa

1. **Planes** en el menú principal → crea un plan y añade días.
2. Cada día es de **fuerza** (ejercicios, series, repeticiones, peso, descanso) o de **cardio**
   (intervalos por tiempo o distancia, con objetivo de pulsaciones o de ritmo).
3. Botón **Exportar este día** → una tarjeta por plataforma.

Los planes se guardan en el `localStorage` del navegador, igual que el resto de datos de la app.
Para sincronizarlos entre dispositivos habría que mover `src/lib/storage/plans.ts` a Firestore;
el resto del código no cambia.

## Garmin Connect

El archivo `.fit` se genera en el propio navegador (`src/lib/fit/`), sin servidor intermedio.
Dos formas de cargarlo:

- **Garmin Connect (web)**: *Entrenamiento → Entrenamientos → Importar*, y luego se sincroniza al reloj.
- **Directo al reloj**: conecta el reloj por USB y copia el `.fit` a `GARMIN/NEWFILES`.

Detalles de la conversión:

- Días de fuerza → `sport = training`, `sub_sport = strength_training`.
  Cada ejercicio produce un paso con duración por **repeticiones**, su peso (`exercise_weight`)
  y un paso de **descanso** (por tiempo si lo indicas, o abierto si no). Las series se codifican
  como un paso de repetición (`repeat_until_steps_cmplt`).
- Se rellena `exercise_category` (press de banca, sentadilla, dominadas…) a partir del catálogo o
  por palabras clave. No se usa el sub-índice `exercise_name` de Garmin: el nombre exacto que ves
  viaja en `wkt_step_name`, y así se evita mostrar un ejercicio equivocado.
- Días de cardio → pasos por tiempo o distancia, con objetivo de pulsaciones (ppm) o de ritmo
  (min/km, que FIT guarda como velocidad).

No hay API pública de Garmin para consumidores: la **Training API** de Garmin exige un acuerdo de
socio, así que el archivo es la vía oficial y estable.

### Comprobar que los archivos son válidos

```bash
npm run check:fit
```

Genera un día de fuerza y otro de cardio y los decodifica con el **SDK oficial de Garmin**
(`@garmin/fitsdk`), verificando CRC, estructura y valores. Si tocas `src/lib/fit/`, ejecútalo.

## Hevy

Necesitas la clave de API personal de <https://hevy.com/settings?developer> (requiere Hevy Pro).
Se guarda **sólo en tu navegador** (`localStorage`), nunca se envía a otro sitio.

Flujo: pegas la clave → **Buscar ejercicios** descarga tus plantillas (`GET /v1/exercise_templates`)
y las empareja por nombre con los ejercicios del plan → revisas los emparejamientos →
**Crear rutina en Hevy** (`POST /v1/routines`).

Si el navegador bloquea la petición por CORS, los botones **Copiar JSON** y **Copiar curl** te dan
el mismo envío listo para una terminal o para un proxy propio.

## Strava

La API de Strava no tiene ningún endpoint para crear entrenamientos planificados, y su importador
sólo acepta actividades realizadas (`.fit`, `.tcx`, `.gpx`). Por eso la tarjeta de Strava se usa
**después** de entrenar: indicas hora de inicio, duración y distancia reales, se genera un `.tcx`
con el resumen de la sesión y lo subes en <https://www.strava.com/upload/select>.

Alternativa sin archivos: si el reloj Garmin ya está enlazado con Strava, la actividad llega sola
cuando sincronizas, y no hace falta el `.tcx`.

## Estructura del código

```
src/types/plan.ts             Modelo del plan (días, ejercicios, intervalos)
src/lib/fit/encoder.ts        Codificador FIT genérico (cabecera, definiciones, CRC)
src/lib/fit/workout.ts        Día del plan → archivo .fit de entrenamiento
src/lib/fit/exerciseCategories.ts  Ejercicio → categoría de ejercicio de Garmin
src/lib/exporters/hevy.ts     Cliente de la API de Hevy y construcción de la rutina
src/lib/exporters/tcx.ts      Sesión realizada → TCX para Strava
src/lib/storage/plans.ts      Persistencia de planes (localStorage)
src/components/Plans.tsx      Listado de planes
src/components/PlanEditor.tsx Editor de días, ejercicios e intervalos
src/components/PlanExport.tsx Tarjetas de exportación (Garmin / Hevy / Strava)
scripts/check-fit.mjs         Validación de los .fit con el SDK oficial de Garmin
```
