import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Share2, Trash2 } from 'lucide-react';
import PageHeader from './PageHeader';
import { exerciseCatalog } from '../data/exerciseCatalog';
import { getPlan, savePlan } from '../lib/storage/plans';
import {
  emptyDay,
  newId,
  type CardioStep,
  type DayKind,
  type PlanDay,
  type StepIntensity,
  type StrengthBlock,
  type TrainingPlan,
} from '../types/plan';

const inputClass =
  'block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';

const INTENSITY_LABELS: Record<StepIntensity, string> = {
  warmup: 'Calentamiento',
  active: 'Activo',
  interval: 'Serie',
  rest: 'Recuperación',
  cooldown: 'Vuelta a la calma',
};

/** Lee un campo numérico dejando el valor sin definir cuando está vacío. */
function num(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const PlanEditor: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<TrainingPlan | undefined>(() => (planId ? getPlan(planId) : undefined));
  const [activeDayId, setActiveDayId] = useState<string>(() => (planId ? getPlan(planId)?.days[0]?.id ?? '' : ''));

  const activeDay = useMemo(() => plan?.days.find((d) => d.id === activeDayId), [plan, activeDayId]);

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <PageHeader title="Plan no encontrado" backTo="/plans" backLabel="Volver a los planes" />
          <p className="text-gray-600">Ese plan ya no existe. Vuelve al listado y crea uno nuevo.</p>
        </div>
      </div>
    );
  }

  const update = (next: TrainingPlan) => setPlan(savePlan(next));

  const updateDay = (dayId: string, changes: Partial<PlanDay>) =>
    update({ ...plan, days: plan.days.map((day) => (day.id === dayId ? { ...day, ...changes } : day)) });

  const addDay = () => {
    const day = emptyDay(`Día ${plan.days.length + 1}`);
    update({ ...plan, days: [...plan.days, day] });
    setActiveDayId(day.id);
  };

  const removeDay = (dayId: string) => {
    const days = plan.days.filter((day) => day.id !== dayId);
    update({ ...plan, days });
    if (activeDayId === dayId) setActiveDayId(days[0]?.id ?? '');
  };

  const addStrengthBlock = (day: PlanDay) => {
    const first = exerciseCatalog[0];
    const block: StrengthBlock = {
      id: newId(),
      exerciseId: first.id,
      name: first.name,
      sets: 4,
      reps: 10,
      restSec: 90,
    };
    updateDay(day.id, { strength: [...day.strength, block] });
  };

  const updateBlock = (day: PlanDay, blockId: string, changes: Partial<StrengthBlock>) =>
    updateDay(day.id, {
      strength: day.strength.map((block) => (block.id === blockId ? { ...block, ...changes } : block)),
    });

  const addCardioStep = (day: PlanDay) => {
    const step: CardioStep = {
      id: newId(),
      name: day.cardio.length === 0 ? 'Calentamiento' : 'Serie',
      intensity: day.cardio.length === 0 ? 'warmup' : 'interval',
      durationType: 'time',
      durationValue: 600,
      repeat: 1,
      targetType: 'none',
    };
    updateDay(day.id, { cardio: [...day.cardio, step] });
  };

  const updateStep = (day: PlanDay, stepId: string, changes: Partial<CardioStep>) =>
    updateDay(day.id, {
      cardio: day.cardio.map((step) => (step.id === stepId ? { ...step, ...changes } : step)),
    });

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title={plan.name}
          subtitle="Los cambios se guardan solos en este dispositivo."
          backTo="/plans"
          backLabel="Volver a los planes"
          actions={
            activeDay && (
              <Link
                to={`/plans/${plan.id}/export/${activeDay.id}`}
                className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Exportar este día
              </Link>
            )
          }
        />

        <div className="bg-white shadow-sm rounded-lg p-6 mb-6 space-y-4">
          <div>
            <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del plan
            </label>
            <input
              id="plan-name"
              className={inputClass}
              value={plan.name}
              onChange={(e) => update({ ...plan, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="plan-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              id="plan-notes"
              rows={2}
              className={inputClass}
              value={plan.notes ?? ''}
              onChange={(e) => update({ ...plan, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {plan.days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setActiveDayId(day.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                day.id === activeDayId ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {day.name}
            </button>
          ))}
          <button
            type="button"
            onClick={addDay}
            className="px-4 py-2 rounded-md text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:bg-white"
          >
            <Plus className="h-4 w-4 inline mr-1" />
            Añadir día
          </button>
        </div>

        {activeDay && (
          <div className="bg-white shadow-sm rounded-lg p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="day-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del día
                </label>
                <input
                  id="day-name"
                  className={inputClass}
                  value={activeDay.name}
                  onChange={(e) => updateDay(activeDay.id, { name: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="day-kind" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  id="day-kind"
                  className={inputClass}
                  value={activeDay.kind}
                  onChange={(e) => updateDay(activeDay.id, { kind: e.target.value as DayKind })}
                >
                  <option value="strength">Fuerza (gimnasio)</option>
                  <option value="cardio">Cardio</option>
                </select>
              </div>
              {activeDay.kind === 'cardio' && (
                <div>
                  <label htmlFor="day-sport" className="block text-sm font-medium text-gray-700 mb-1">
                    Deporte
                  </label>
                  <select
                    id="day-sport"
                    className={inputClass}
                    value={activeDay.sport}
                    onChange={(e) => updateDay(activeDay.id, { sport: e.target.value as PlanDay['sport'] })}
                  >
                    <option value="running">Correr</option>
                    <option value="cycling">Bici</option>
                    <option value="walking">Caminar</option>
                    <option value="cardio">Cardio genérico</option>
                  </select>
                </div>
              )}
            </div>

            {activeDay.kind === 'strength' ? (
              <div className="space-y-4">
                {activeDay.strength.map((block) => (
                  <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid gap-3 sm:grid-cols-6 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Ejercicio</label>
                        <select
                          className={inputClass}
                          value={block.exerciseId}
                          onChange={(e) => {
                            const found = exerciseCatalog.find((x) => x.id === e.target.value);
                            updateBlock(activeDay, block.id, {
                              exerciseId: e.target.value,
                              name: found ? found.name : block.name,
                            });
                          }}
                        >
                          {exerciseCatalog.map((exercise) => (
                            <option key={exercise.id} value={exercise.id}>
                              {exercise.name}
                            </option>
                          ))}
                          <option value="custom">Otro (escribir nombre)</option>
                        </select>
                        {block.exerciseId === 'custom' && (
                          <input
                            className={`${inputClass} mt-2`}
                            placeholder="Nombre del ejercicio"
                            value={block.name}
                            onChange={(e) => updateBlock(activeDay, block.id, { name: e.target.value })}
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Series</label>
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={block.sets}
                          onChange={(e) => updateBlock(activeDay, block.id, { sets: num(e.target.value) ?? 1 })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Reps</label>
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={block.reps}
                          onChange={(e) => updateBlock(activeDay, block.id, { reps: num(e.target.value) ?? 1 })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Peso (kg)</label>
                        <input
                          type="number"
                          step="0.5"
                          className={inputClass}
                          value={block.weightKg ?? ''}
                          onChange={(e) => updateBlock(activeDay, block.id, { weightKg: num(e.target.value) })}
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Descanso (s)</label>
                          <input
                            type="number"
                            min={0}
                            className={inputClass}
                            value={block.restSec ?? ''}
                            onChange={(e) => updateBlock(activeDay, block.id, { restSec: num(e.target.value) })}
                          />
                        </div>
                        <button
                          type="button"
                          className="mb-2 text-gray-400 hover:text-red-600"
                          onClick={() =>
                            updateDay(activeDay.id, {
                              strength: activeDay.strength.filter((b) => b.id !== block.id),
                            })
                          }
                          aria-label="Quitar ejercicio"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addStrengthBlock(activeDay)}
                  className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir ejercicio
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDay.cardio.map((step) => (
                  <div key={step.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-5 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                        <input
                          className={inputClass}
                          value={step.name}
                          onChange={(e) => updateStep(activeDay, step.id, { name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Intensidad</label>
                        <select
                          className={inputClass}
                          value={step.intensity}
                          onChange={(e) =>
                            updateStep(activeDay, step.id, { intensity: e.target.value as StepIntensity })
                          }
                        >
                          {Object.entries(INTENSITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Duración</label>
                        <select
                          className={inputClass}
                          value={step.durationType}
                          onChange={(e) =>
                            updateStep(activeDay, step.id, {
                              durationType: e.target.value as CardioStep['durationType'],
                            })
                          }
                        >
                          <option value="time">Tiempo (s)</option>
                          <option value="distance">Distancia (m)</option>
                          <option value="open">Abierta (lap)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {step.durationType === 'distance' ? 'Metros' : 'Segundos'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          disabled={step.durationType === 'open'}
                          className={`${inputClass} disabled:bg-gray-100`}
                          value={step.durationValue ?? ''}
                          onChange={(e) => updateStep(activeDay, step.id, { durationValue: num(e.target.value) })}
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Repetir x</label>
                          <input
                            type="number"
                            min={1}
                            className={inputClass}
                            value={step.repeat ?? 1}
                            onChange={(e) => updateStep(activeDay, step.id, { repeat: num(e.target.value) ?? 1 })}
                          />
                        </div>
                        <button
                          type="button"
                          className="mb-2 text-gray-400 hover:text-red-600"
                          onClick={() =>
                            updateDay(activeDay.id, { cardio: activeDay.cardio.filter((s) => s.id !== step.id) })
                          }
                          aria-label="Quitar intervalo"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Objetivo</label>
                        <select
                          className={inputClass}
                          value={step.targetType}
                          onChange={(e) =>
                            updateStep(activeDay, step.id, { targetType: e.target.value as CardioStep['targetType'] })
                          }
                        >
                          <option value="none">Sin objetivo</option>
                          <option value="hr">Pulsaciones (ppm)</option>
                          <option value="pace">Ritmo (min/km)</option>
                        </select>
                      </div>
                      {step.targetType === 'hr' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">FC mínima</label>
                            <input
                              type="number"
                              className={inputClass}
                              value={step.hrLow ?? ''}
                              onChange={(e) => updateStep(activeDay, step.id, { hrLow: num(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">FC máxima</label>
                            <input
                              type="number"
                              className={inputClass}
                              value={step.hrHigh ?? ''}
                              onChange={(e) => updateStep(activeDay, step.id, { hrHigh: num(e.target.value) })}
                            />
                          </div>
                        </>
                      )}
                      {step.targetType === 'pace' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Ritmo rápido</label>
                            <input
                              type="number"
                              step="0.05"
                              className={inputClass}
                              placeholder="4.30"
                              value={step.paceMinLow ?? ''}
                              onChange={(e) => updateStep(activeDay, step.id, { paceMinLow: num(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Ritmo lento</label>
                            <input
                              type="number"
                              step="0.05"
                              className={inputClass}
                              placeholder="4.50"
                              value={step.paceMinHigh ?? ''}
                              onChange={(e) => updateStep(activeDay, step.id, { paceMinHigh: num(e.target.value) })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addCardioStep(activeDay)}
                  className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir intervalo
                </button>
              </div>
            )}

            {plan.days.length > 1 && (
              <button
                type="button"
                onClick={() => removeDay(activeDay.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Borrar este día
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanEditor;
