/**
 * Genera un archivo FIT de tipo `workout` (entrenamiento planificado) a partir
 * de un día del plan. El archivo se importa en Garmin Connect antes de entrenar
 * y se sincroniza al reloj, que va guiando series, repeticiones y descansos.
 */
import type { CardioStep, PlanDay, StepIntensity, StrengthBlock } from '../../types/plan';
import { FitFileBuilder, toFitTimestamp, type MessageDef } from './encoder';
import { fitExerciseCategory } from './exerciseCategories';

const FILE_ID: MessageDef = {
  globalNum: 0,
  localNum: 0,
  fields: [
    { num: 0, name: 'type', type: 'enum' },
    { num: 1, name: 'manufacturer', type: 'uint16' },
    { num: 2, name: 'product', type: 'uint16' },
    { num: 3, name: 'serialNumber', type: 'uint32z' },
    { num: 4, name: 'timeCreated', type: 'uint32' },
  ],
};

const WORKOUT: MessageDef = {
  globalNum: 26,
  localNum: 1,
  fields: [
    { num: 8, name: 'wktName', type: 'string', size: 32 },
    { num: 4, name: 'sport', type: 'enum' },
    { num: 11, name: 'subSport', type: 'enum' },
    { num: 5, name: 'capabilities', type: 'uint32z' },
    { num: 6, name: 'numValidSteps', type: 'uint16' },
  ],
};

const WORKOUT_STEP: MessageDef = {
  globalNum: 27,
  localNum: 2,
  fields: [
    { num: 254, name: 'messageIndex', type: 'uint16' },
    { num: 0, name: 'wktStepName', type: 'string', size: 32 },
    { num: 1, name: 'durationType', type: 'enum' },
    { num: 2, name: 'durationValue', type: 'uint32' },
    { num: 3, name: 'targetType', type: 'enum' },
    { num: 4, name: 'targetValue', type: 'uint32' },
    { num: 5, name: 'customTargetLow', type: 'uint32' },
    { num: 6, name: 'customTargetHigh', type: 'uint32' },
    { num: 7, name: 'intensity', type: 'enum' },
    { num: 8, name: 'notes', type: 'string', size: 40 },
    { num: 10, name: 'exerciseCategory', type: 'uint16' },
    { num: 11, name: 'exerciseName', type: 'uint16' },
    { num: 12, name: 'exerciseWeight', type: 'uint16' },
    { num: 13, name: 'weightDisplayUnit', type: 'uint16' },
  ],
};

/** `wkt_step_duration` del perfil FIT. */
const Duration = { TIME: 0, DISTANCE: 1, OPEN: 5, REPEAT_UNTIL_STEPS: 6, REPS: 29 } as const;
/** `wkt_step_target` del perfil FIT. */
const Target = { SPEED: 0, HEART_RATE: 1, OPEN: 2 } as const;
/** `intensity` del perfil FIT. */
const Intensity: Record<StepIntensity, number> = {
  active: 0,
  rest: 1,
  warmup: 2,
  cooldown: 3,
  interval: 5,
};

const Sport = { RUNNING: 1, CYCLING: 2, TRAINING: 10, WALKING: 11 } as const;
const SubSport = { GENERIC: 0, STRENGTH_TRAINING: 20, CARDIO_TRAINING: 26 } as const;
/** `fit_base_unit`: 1 = kilogramo. */
const WEIGHT_UNIT_KG = 1;

interface Step {
  wktStepName?: string;
  durationType: number;
  durationValue?: number;
  targetType?: number;
  targetValue?: number;
  customTargetLow?: number;
  customTargetHigh?: number;
  intensity?: number;
  notes?: string;
  exerciseCategory?: number;
  exerciseWeight?: number;
  weightDisplayUnit?: number;
}

function sportFor(day: PlanDay): { sport: number; subSport: number } {
  if (day.kind === 'strength') {
    return { sport: Sport.TRAINING, subSport: SubSport.STRENGTH_TRAINING };
  }
  switch (day.sport) {
    case 'running':
      return { sport: Sport.RUNNING, subSport: SubSport.GENERIC };
    case 'cycling':
      return { sport: Sport.CYCLING, subSport: SubSport.GENERIC };
    case 'walking':
      return { sport: Sport.WALKING, subSport: SubSport.GENERIC };
    default:
      return { sport: Sport.TRAINING, subSport: SubSport.CARDIO_TRAINING };
  }
}

/** Ritmo en min/km a velocidad en m/s * 1000 (unidad de velocidad de FIT). */
function paceToFitSpeed(paceMinPerKm: number): number {
  return Math.round((1000 / (paceMinPerKm * 60)) * 1000);
}

function strengthSteps(block: StrengthBlock): Step[] {
  const steps: Step[] = [];
  const sets = Math.max(1, Math.round(block.sets));
  const detail = `${sets}x${block.reps}${block.weightKg ? ` @ ${block.weightKg}kg` : ''}`;

  steps.push({
    wktStepName: block.name,
    durationType: Duration.REPS,
    durationValue: Math.max(1, Math.round(block.reps)),
    targetType: Target.OPEN,
    targetValue: 0,
    intensity: Intensity.active,
    notes: block.notes ? `${detail} · ${block.notes}` : detail,
    exerciseCategory: fitExerciseCategory(block.exerciseId, block.name),
    exerciseWeight: block.weightKg ? Math.round(block.weightKg * 100) : undefined,
    weightDisplayUnit: block.weightKg ? WEIGHT_UNIT_KG : undefined,
  });

  steps.push({
    wktStepName: 'Descanso',
    durationType: block.restSec ? Duration.TIME : Duration.OPEN,
    durationValue: block.restSec ? Math.round(block.restSec * 1000) : undefined,
    targetType: Target.OPEN,
    targetValue: 0,
    intensity: Intensity.rest,
  });

  return steps;
}

function cardioStep(step: CardioStep): Step {
  const out: Step = {
    wktStepName: step.name,
    durationType: Duration.OPEN,
    targetType: Target.OPEN,
    targetValue: 0,
    intensity: Intensity[step.intensity],
  };

  if (step.durationType === 'time' && step.durationValue) {
    out.durationType = Duration.TIME;
    out.durationValue = Math.round(step.durationValue * 1000);
  } else if (step.durationType === 'distance' && step.durationValue) {
    out.durationType = Duration.DISTANCE;
    out.durationValue = Math.round(step.durationValue * 100);
  }

  if (step.targetType === 'hr' && step.hrLow && step.hrHigh) {
    out.targetType = Target.HEART_RATE;
    // 1-100 se interpreta como % de FC máxima; a partir de 101 son pulsaciones + 100.
    out.customTargetLow = Math.round(step.hrLow) + 100;
    out.customTargetHigh = Math.round(step.hrHigh) + 100;
  } else if (step.targetType === 'pace' && step.paceMinLow && step.paceMinHigh) {
    out.targetType = Target.SPEED;
    // El ritmo más lento (más min/km) es la velocidad mínima.
    out.customTargetLow = paceToFitSpeed(Math.max(step.paceMinLow, step.paceMinHigh));
    out.customTargetHigh = paceToFitSpeed(Math.min(step.paceMinLow, step.paceMinHigh));
  }

  return out;
}

function repeatStep(fromIndex: number, times: number): Step {
  return {
    durationType: Duration.REPEAT_UNTIL_STEPS,
    durationValue: fromIndex,
    targetValue: times,
  };
}

/** Convierte un día del plan en la lista de pasos FIT. */
export function buildSteps(day: PlanDay): Step[] {
  const steps: Step[] = [];

  if (day.kind === 'strength') {
    for (const block of day.strength) {
      const loopStart = steps.length;
      const inner = strengthSteps(block);
      steps.push(...inner);
      const sets = Math.max(1, Math.round(block.sets));
      if (sets > 1) steps.push(repeatStep(loopStart, sets));
    }
  } else {
    for (const step of day.cardio) {
      const loopStart = steps.length;
      steps.push(cardioStep(step));
      const times = Math.max(1, Math.round(step.repeat ?? 1));
      if (times > 1) steps.push(repeatStep(loopStart, times));
    }
  }

  return steps;
}

export interface FitWorkoutOptions {
  /** Nombre del entrenamiento en Garmin Connect. Por defecto, el del día. */
  name?: string;
  createdAt?: Date;
}

/** Genera los bytes del archivo `.fit` del entrenamiento. */
export function buildWorkoutFit(day: PlanDay, options: FitWorkoutOptions = {}): Uint8Array {
  const steps = buildSteps(day);
  if (steps.length === 0) {
    throw new Error('El día no tiene ejercicios: añade al menos uno antes de exportar.');
  }

  const { sport, subSport } = sportFor(day);
  const builder = new FitFileBuilder();

  builder.add(FILE_ID, {
    type: 5, // workout
    manufacturer: 255, // development
    product: 0,
    timeCreated: toFitTimestamp(options.createdAt ?? new Date()),
  });

  builder.add(WORKOUT, {
    wktName: options.name ?? day.name,
    sport,
    subSport,
    numValidSteps: steps.length,
  });

  steps.forEach((step, index) => {
    builder.add(WORKOUT_STEP, { messageIndex: index, ...step } as Record<string, number | string | undefined>);
  });

  return builder.build();
}

/** Nombre de archivo seguro para el `.fit` descargado. */
export function fitFileName(day: PlanDay, planName?: string): string {
  const base = [planName, day.name].filter(Boolean).join('-');
  const slug = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${slug || 'entrenamiento'}.fit`;
}
