/**
 * Modelo de datos de los planes de entrenamiento.
 *
 * Un plan tiene varios días. Cada día es de fuerza (gimnasio) o de cardio,
 * y se puede exportar a Garmin Connect (.fit), Hevy (rutina) o Strava (.tcx).
 */

export type DayKind = 'strength' | 'cardio';

export type CardioSport = 'running' | 'cycling' | 'walking' | 'cardio';

/** Un ejercicio de fuerza con sus series. */
export interface StrengthBlock {
  id: string;
  /** Id del catálogo (`exerciseCatalog`) o `custom` si el nombre es libre. */
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weightKg?: number;
  /** Descanso entre series, en segundos. Sin valor = descanso abierto. */
  restSec?: number;
  notes?: string;
}

export type StepIntensity = 'warmup' | 'active' | 'interval' | 'rest' | 'cooldown';

/** Un intervalo de cardio (calentamiento, serie, recuperación, vuelta a la calma). */
export interface CardioStep {
  id: string;
  name: string;
  intensity: StepIntensity;
  durationType: 'time' | 'distance' | 'open';
  /** Segundos si `time`, metros si `distance`. */
  durationValue?: number;
  /** Repite este paso N veces (1 = sin repetición). */
  repeat?: number;
  targetType: 'none' | 'hr' | 'pace';
  /** Pulsaciones por minuto. */
  hrLow?: number;
  hrHigh?: number;
  /** Ritmo en minutos por km. `paceMinLow` es el ritmo más rápido. */
  paceMinLow?: number;
  paceMinHigh?: number;
}

export interface PlanDay {
  id: string;
  name: string;
  kind: DayKind;
  sport: CardioSport;
  strength: StrengthBlock[];
  cardio: CardioStep[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  days: PlanDay[];
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptyDay(name: string, kind: DayKind = 'strength'): PlanDay {
  return { id: newId(), name, kind, sport: 'running', strength: [], cardio: [] };
}

export function emptyPlan(name: string): TrainingPlan {
  const now = new Date().toISOString();
  return { id: newId(), name, createdAt: now, updatedAt: now, days: [emptyDay('Día 1')] };
}
