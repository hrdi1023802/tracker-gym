/**
 * Correspondencia entre los ejercicios de la app y las categorías de ejercicio
 * del perfil FIT de Garmin (`exercise_category`).
 *
 * Sólo se rellena la categoría, no el sub-índice `exercise_name`: la categoría
 * basta para que el reloj muestre el tipo de ejercicio y cuente repeticiones,
 * y el nombre exacto que ve el usuario viaja en `wkt_step_name`.
 */
export const ExerciseCategory = {
  BENCH_PRESS: 0,
  CALF_RAISE: 1,
  CARDIO: 2,
  CORE: 5,
  CRUNCH: 6,
  CURL: 7,
  DEADLIFT: 8,
  FLYE: 9,
  HIP_RAISE: 10,
  LATERAL_RAISE: 14,
  LEG_CURL: 15,
  LEG_RAISE: 16,
  LUNGE: 17,
  OLYMPIC_LIFT: 18,
  PLANK: 19,
  PULL_UP: 21,
  PUSH_UP: 22,
  ROW: 23,
  SHOULDER_PRESS: 24,
  SHRUG: 26,
  SIT_UP: 27,
  SQUAT: 28,
  TOTAL_BODY: 29,
  TRICEPS_EXTENSION: 30,
  WARM_UP: 31,
  UNKNOWN: 65534,
} as const;

/** Categoría por id del catálogo de la app. */
const BY_EXERCISE_ID: Record<string, number> = {
  'bench-press': ExerciseCategory.BENCH_PRESS,
  'incline-press': ExerciseCategory.BENCH_PRESS,
  'decline-press': ExerciseCategory.BENCH_PRESS,
  squat: ExerciseCategory.SQUAT,
  'leg-press': ExerciseCategory.SQUAT,
  deadlift: ExerciseCategory.DEADLIFT,
  'pull-up': ExerciseCategory.PULL_UP,
  'shoulder-press': ExerciseCategory.SHOULDER_PRESS,
  'bicep-curl': ExerciseCategory.CURL,
  'tricep-extension': ExerciseCategory.TRICEPS_EXTENSION,
};

/** Palabras clave para ejercicios escritos a mano. */
const BY_KEYWORD: Array<[RegExp, number]> = [
  [/banca|bench|press de pecho|pecho/i, ExerciseCategory.BENCH_PRESS],
  [/sentadilla|squat|prensa|leg press/i, ExerciseCategory.SQUAT],
  [/peso muerto|deadlift|hip thrust/i, ExerciseCategory.DEADLIFT],
  [/dominad|pull ?up|jalon|jalón|pulldown/i, ExerciseCategory.PULL_UP],
  [/remo|row/i, ExerciseCategory.ROW],
  [/hombro|shoulder|militar|press militar/i, ExerciseCategory.SHOULDER_PRESS],
  [/curl|biceps|bíceps/i, ExerciseCategory.CURL],
  [/tricep|tríceps|extension de codo/i, ExerciseCategory.TRICEPS_EXTENSION],
  [/zancada|lunge|estocada/i, ExerciseCategory.LUNGE],
  [/gemelo|calf/i, ExerciseCategory.CALF_RAISE],
  [/plancha|plank/i, ExerciseCategory.PLANK],
  [/abdominal|crunch/i, ExerciseCategory.CRUNCH],
  [/femoral|leg curl/i, ExerciseCategory.LEG_CURL],
  [/elevacion lateral|elevación lateral|lateral raise/i, ExerciseCategory.LATERAL_RAISE],
  [/flexion|flexión|push ?up|fondos/i, ExerciseCategory.PUSH_UP],
  [/encogimiento|shrug|trapecio/i, ExerciseCategory.SHRUG],
  [/apertura|flye|fly/i, ExerciseCategory.FLYE],
  [/core|abdomen/i, ExerciseCategory.CORE],
];

export function fitExerciseCategory(exerciseId: string, name: string): number {
  const byId = BY_EXERCISE_ID[exerciseId];
  if (byId !== undefined) return byId;
  for (const [pattern, category] of BY_KEYWORD) {
    if (pattern.test(name)) return category;
  }
  return ExerciseCategory.UNKNOWN;
}
