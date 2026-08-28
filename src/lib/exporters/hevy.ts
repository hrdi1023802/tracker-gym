/**
 * Integración con la API pública de Hevy (https://api.hevyapp.com/docs/).
 *
 * Un día de fuerza del plan se convierte en una rutina de Hevy. Hace falta la
 * clave de API personal (Hevy Pro): hevy.com/settings?developer.
 */
import type { PlanDay, StrengthBlock } from '../../types/plan';

const HEVY_API = 'https://api.hevyapp.com/v1';

export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group?: string;
  is_custom?: boolean;
}

export interface HevyRoutinePayload {
  routine: {
    title: string;
    folder_id: number | null;
    notes: string;
    exercises: Array<{
      exercise_template_id: string;
      superset_id: number | null;
      rest_seconds: number | null;
      notes: string | null;
      sets: Array<{
        type: 'normal' | 'warmup' | 'failure' | 'dropset';
        weight_kg: number | null;
        reps: number | null;
        distance_meters: number | null;
        duration_seconds: number | null;
        custom_metric: number | null;
      }>;
    }>;
  };
}

/** Términos en inglés con los que buscar cada ejercicio del catálogo en Hevy. */
const SEARCH_TERMS: Record<string, string[]> = {
  'bench-press': ['bench press barbell', 'bench press'],
  'incline-press': ['incline bench press barbell', 'incline bench press'],
  'decline-press': ['decline bench press barbell', 'decline bench press'],
  squat: ['squat barbell', 'back squat'],
  deadlift: ['deadlift barbell', 'deadlift'],
  'pull-up': ['pull up'],
  'shoulder-press': ['shoulder press barbell', 'overhead press'],
  'bicep-curl': ['bicep curl barbell', 'bicep curl dumbbell', 'curl'],
  'tricep-extension': ['triceps extension', 'tricep extension'],
  'leg-press': ['leg press'],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Puntúa cuánto se parece una plantilla de Hevy a un ejercicio del plan.
 * Devuelve 0 cuando no hay ninguna palabra en común.
 */
function score(candidate: string, query: string): number {
  const a = normalize(candidate);
  const b = normalize(query);
  if (!a || !b) return 0;
  if (a === b) return 100;
  const words = b.split(' ').filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const hits = words.filter((word) => a.includes(word)).length;
  if (hits === 0) return 0;
  // Se premia cubrir todas las palabras y se penaliza el ruido del título.
  return (hits / words.length) * 80 - Math.min(20, Math.abs(a.length - b.length) / 4);
}

/** Busca la plantilla de Hevy que mejor encaja con un ejercicio del plan. */
export function matchTemplate(
  block: StrengthBlock,
  templates: HevyExerciseTemplate[],
): HevyExerciseTemplate | null {
  const queries = [block.name, ...(SEARCH_TERMS[block.exerciseId] ?? [])];
  let best: { template: HevyExerciseTemplate; value: number } | null = null;
  for (const template of templates) {
    for (const query of queries) {
      const value = score(template.title, query);
      if (value > 0 && (!best || value > best.value)) best = { template, value };
    }
  }
  return best && best.value >= 40 ? best.template : null;
}

/** Construye el cuerpo de `POST /v1/routines` para un día de fuerza. */
export function buildRoutinePayload(
  day: PlanDay,
  templateIds: Record<string, string>,
  options: { title?: string; notes?: string; folderId?: number | null } = {},
): HevyRoutinePayload {
  const exercises = day.strength
    .filter((block) => templateIds[block.id])
    .map((block) => ({
      exercise_template_id: templateIds[block.id],
      superset_id: null,
      rest_seconds: block.restSec ?? null,
      notes: block.notes ?? null,
      sets: Array.from({ length: Math.max(1, Math.round(block.sets)) }, () => ({
        type: 'normal' as const,
        weight_kg: block.weightKg ?? null,
        reps: Math.max(1, Math.round(block.reps)),
        distance_meters: null,
        duration_seconds: null,
        custom_metric: null,
      })),
    }));

  return {
    routine: {
      title: options.title ?? day.name,
      folder_id: options.folderId ?? null,
      notes: options.notes ?? '',
      exercises,
    },
  };
}

/** Error de red típico del navegador cuando la API no permite peticiones cruzadas. */
export class HevyNetworkError extends Error {
  constructor() {
    super(
      'No se pudo contactar con Hevy desde el navegador (bloqueo CORS o sin conexión). ' +
        'Copia el JSON y envíalo con curl, o usa un pequeño proxy propio.',
    );
    this.name = 'HevyNetworkError';
  }
}

async function hevyFetch(path: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${HEVY_API}${path}`, {
      ...init,
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new HevyNetworkError();
  }
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  const body = await response.text().catch(() => '');
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Hevy rechazó la clave de API (${response.status}). Revísala en hevy.com/settings?developer.`);
  }
  throw new Error(`${action} falló (${response.status}). ${body.slice(0, 200)}`);
}

/** Descarga todas las plantillas de ejercicio de la cuenta (paginado). */
export async function fetchExerciseTemplates(apiKey: string): Promise<HevyExerciseTemplate[]> {
  const all: HevyExerciseTemplate[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const response = await hevyFetch(`/exercise_templates?page=${page}&pageSize=100`, apiKey);
    await assertOk(response, 'La descarga de ejercicios');
    const data = (await response.json()) as {
      page_count?: number;
      exercise_templates?: HevyExerciseTemplate[];
    };
    all.push(...(data.exercise_templates ?? []));
    pageCount = data.page_count ?? 1;
    page += 1;
  } while (page <= pageCount && page <= 50);
  return all;
}

/** Crea la rutina en Hevy. */
export async function createRoutine(apiKey: string, payload: HevyRoutinePayload): Promise<void> {
  const response = await hevyFetch('/routines', apiKey, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await assertOk(response, 'La creación de la rutina');
}

/** Comando equivalente para enviar la rutina desde una terminal. */
export function curlCommand(payload: HevyRoutinePayload): string {
  return [
    `curl -X POST ${HEVY_API}/routines \\`,
    "  -H 'api-key: TU_CLAVE' \\",
    "  -H 'Content-Type: application/json' \\",
    `  -d '${JSON.stringify(payload)}'`,
  ].join('\n');
}
