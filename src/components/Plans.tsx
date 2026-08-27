import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import PageHeader from './PageHeader';
import { deletePlan, listPlans, savePlan } from '../lib/storage/plans';
import { emptyPlan, type TrainingPlan } from '../types/plan';

const Plans: React.FC = () => {
  const [plans, setPlans] = useState<TrainingPlan[]>(() => listPlans());
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const plan = savePlan(emptyPlan(trimmed));
    navigate(`/plans/${plan.id}`);
  };

  const handleDelete = (id: string) => {
    deletePlan(id);
    setPlans(listPlans());
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Planes de entrenamiento"
          subtitle="Crea tu plan aquí y expórtalo a Garmin Connect, Hevy o Strava antes de entrenar."
        />

        <form onSubmit={handleCreate} className="bg-white shadow-sm rounded-lg p-6 mb-8 flex flex-wrap gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del plan (ej. Fuerza 4 días)"
            className="flex-1 min-w-[16rem] border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo plan
          </button>
        </form>

        {plans.length === 0 ? (
          <p className="text-center text-gray-500">Todavía no tienes planes. Crea el primero arriba.</p>
        ) : (
          <ul className="space-y-3">
            {plans.map((plan) => (
              <li key={plan.id} className="bg-white shadow-sm rounded-lg p-5 flex items-center justify-between">
                <div>
                  <Link to={`/plans/${plan.id}`} className="text-lg font-medium text-gray-900 hover:text-indigo-600">
                    {plan.name}
                  </Link>
                  <p className="mt-1 flex items-center text-sm text-gray-500">
                    <CalendarDays className="h-4 w-4 mr-1.5" />
                    {plan.days.length} {plan.days.length === 1 ? 'día' : 'días'} · actualizado{' '}
                    {new Date(plan.updatedAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(plan.id)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label={`Borrar ${plan.name}`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Plans;
