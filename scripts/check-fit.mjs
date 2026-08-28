/**
 * Comprueba que los archivos .fit generados por la app son válidos,
 * decodificándolos con el SDK oficial de Garmin.
 *
 *   npm run check:fit
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Decoder, Stream } from '@garmin/fitsdk';

const strengthDay = {
  id: 'a',
  name: 'Día 1 - Empuje',
  kind: 'strength',
  sport: 'running',
  strength: [
    { id: '1', exerciseId: 'bench-press', name: 'Press de Banca', sets: 4, reps: 8, weightKg: 72.5, restSec: 120 },
    { id: '2', exerciseId: 'shoulder-press', name: 'Press de Hombros', sets: 3, reps: 12, weightKg: 30 },
  ],
  cardio: [],
};

const cardioDay = {
  id: 'b',
  name: 'Series 5x1000',
  kind: 'cardio',
  sport: 'running',
  strength: [],
  cardio: [
    { id: '1', name: 'Calentamiento', intensity: 'warmup', durationType: 'time', durationValue: 900, targetType: 'none' },
    {
      id: '2',
      name: '1000m fuerte',
      intensity: 'interval',
      durationType: 'distance',
      durationValue: 1000,
      repeat: 5,
      targetType: 'pace',
      paceMinLow: 4.0,
      paceMinHigh: 4.3,
    },
    {
      id: '3',
      name: 'Vuelta a la calma',
      intensity: 'cooldown',
      durationType: 'time',
      durationValue: 600,
      targetType: 'hr',
      hrLow: 120,
      hrHigh: 140,
    },
  ],
};

const dir = mkdtempSync(join(tmpdir(), 'fit-check-'));
const bundle = join(dir, 'workout.mjs');

try {
  await build({
    entryPoints: ['src/lib/fit/workout.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
    logLevel: 'silent',
  });
  const { buildWorkoutFit } = await import(pathToFileURL(bundle).href);

  const failures = [];
  const check = (label, condition, detail) => {
    if (!condition) failures.push(`${label}: ${detail}`);
  };

  for (const [label, day, expectedSteps] of [
    ['fuerza', strengthDay, 6],
    ['cardio', cardioDay, 4],
  ]) {
    const bytes = buildWorkoutFit(day, { createdAt: new Date('2026-01-01T08:00:00Z') });
    writeFileSync(join(dir, `${label}.fit`), bytes);

    const stream = Stream.fromByteArray(Array.from(bytes));
    check(label, Decoder.isFIT(stream), 'el archivo no se reconoce como FIT');
    const decoder = new Decoder(stream);
    check(label, decoder.checkIntegrity(), 'CRC o estructura inválidos');

    const { messages, errors } = decoder.read();
    check(label, errors.length === 0, `errores al decodificar: ${errors.join(', ')}`);
    check(label, messages.fileIdMesgs?.[0]?.type === 'workout', 'el file_id no es de tipo workout');

    const workout = messages.workoutMesgs?.[0];
    check(label, workout?.wktName === day.name, `nombre inesperado: ${workout?.wktName}`);
    check(label, workout?.numValidSteps === expectedSteps, `se esperaban ${expectedSteps} pasos`);
    check(label, (messages.workoutStepMesgs ?? []).length === expectedSteps, 'faltan mensajes workout_step');

    console.log(`✓ ${label}: ${bytes.length} bytes, ${expectedSteps} pasos, ${workout?.sport}/${workout?.subSport}`);
  }

  const strength = new Decoder(
    Stream.fromByteArray(Array.from(buildWorkoutFit(strengthDay))),
  ).read().messages.workoutStepMesgs;
  check('fuerza', strength[0].exerciseCategory === 'benchPress', 'categoría de ejercicio incorrecta');
  check('fuerza', strength[0].exerciseWeight === 72.5, `peso incorrecto: ${strength[0].exerciseWeight}`);
  check('fuerza', strength[0].durationReps === 8, 'repeticiones incorrectas');
  check('fuerza', strength[2].repeatSteps === 4, 'número de series incorrecto');

  const cardio = new Decoder(
    Stream.fromByteArray(Array.from(buildWorkoutFit(cardioDay))),
  ).read().messages.workoutStepMesgs;
  check('cardio', cardio[1].durationDistance === 1000, 'distancia incorrecta');
  check('cardio', cardio[2].repeatSteps === 5, 'repeticiones del intervalo incorrectas');
  check('cardio', cardio[3].customTargetHeartRateHigh === 240, 'objetivo de pulsaciones incorrecto');

  if (failures.length > 0) {
    console.error('\n✗ Fallos:\n' + failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('\n✓ Todos los archivos .fit son válidos para Garmin.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
