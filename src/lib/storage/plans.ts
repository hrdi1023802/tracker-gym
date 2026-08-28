/**
 * Persistencia de los planes de entrenamiento.
 *
 * De momento se guardan en `localStorage` del navegador, igual que el resto de
 * datos de la app (login y registros aún son simulados). El módulo aísla el
 * acceso para poder pasar a Firestore más adelante sin tocar los componentes.
 */
import type { TrainingPlan } from '../../types/plan';

const STORAGE_KEY = 'tracker-gym:plans';

function read(): TrainingPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrainingPlan[]) : [];
  } catch {
    return [];
  }
}

function write(plans: TrainingPlan[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function listPlans(): TrainingPlan[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPlan(id: string): TrainingPlan | undefined {
  return read().find((plan) => plan.id === id);
}

export function savePlan(plan: TrainingPlan): TrainingPlan {
  const updated = { ...plan, updatedAt: new Date().toISOString() };
  const plans = read();
  const index = plans.findIndex((p) => p.id === plan.id);
  if (index >= 0) plans[index] = updated;
  else plans.push(updated);
  write(plans);
  return updated;
}

export function deletePlan(id: string): void {
  write(read().filter((plan) => plan.id !== id));
}

const API_KEY_STORAGE = 'tracker-gym:hevy-api-key';

export function getHevyApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setHevyApiKey(key: string): void {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
}
