import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Download, Watch, Zap } from 'lucide-react';
import PageHeader from './PageHeader';
import { getHevyApiKey, getPlan, setHevyApiKey } from '../lib/storage/plans';
import { buildWorkoutFit, fitFileName } from '../lib/fit/workout';
import { buildSessionTcx } from '../lib/exporters/tcx';
import {
  buildRoutinePayload,
  createRoutine,
  curlCommand,
  fetchExerciseTemplates,
  matchTemplate,
  type HevyExerciseTemplate,
} from '../lib/exporters/hevy';
import { downloadFile } from '../lib/download';

const inputClass =
  'block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';

const cardClass = 'bg-white shadow-sm rounded-lg p-6';

const PlanExport: React.FC = () => {
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>();
  const plan = useMemo(() => (planId ? getPlan(planId) : undefined), [planId]);
  const day = plan?.days.find((d) => d.id === dayId);

  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Hevy
  const [apiKey, setApiKey] = useState(getHevyApiKey);
  const [templates, setTemplates] = useState<HevyExerciseTemplate[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Strava
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [durationMin, setDurationMin] = useState('60');
  const [distanceKm, setDistanceKm] = useState('');

  if (!plan || !day) {
    return (
      <div className="min-h-screen bg-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <PageHeader title="Día no encontrado" backTo="/plans" backLabel="Volver a los planes" />
          <p className="text-gray-600">Ese día ya no existe en el plan.</p>
        </div>
      </div>
    );
  }

  const reset = () => {
    setError('');
    setStatus('');
  };

  const handleGarmin = () => {
    reset();
    try {
      const fit = buildWorkoutFit(day, { name: day.name });
      downloadFile(fit, fitFileName(day, plan.name), 'application/vnd.ant.fit');
      setStatus('Archivo .fit descargado. Impórtalo en Garmin Connect.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el archivo.');
    }
  };

  const handleLoadTemplates = async () => {
    reset();
    setBusy(true);
    try {
      setHevyApiKey(apiKey);
      const list = await fetchExerciseTemplates(apiKey);
      setTemplates(list);
      const guessed: Record<string, string> = {};
      for (const block of day.strength) {
        const match = matchTemplate(block, list);
        if (match) guessed[block.id] = match.id;
      }
      setMapping(guessed);
      const missing = day.strength.length - Object.keys(guessed).length;
      setStatus(
        `${list.length} ejercicios cargados de Hevy.` +
          (missing > 0 ? ` Faltan ${missing} por asignar a mano.` : ' Todos los ejercicios encontrados.'),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al contactar con Hevy.');
    } finally {
      setBusy(false);
    }
  };

  const routinePayload = buildRoutinePayload(day, mapping, { title: `${plan.name} · ${day.name}`, notes: plan.notes });

  const handleCreateRoutine = async () => {
    reset();
    if (routinePayload.routine.exercises.length === 0) {
      setError('Asigna al menos un ejercicio de Hevy antes de crear la rutina.');
      return;
    }
    setBusy(true);
    try {
      await createRoutine(apiKey, routinePayload);
      setStatus('Rutina creada en Hevy. Ábrela en la app para entrenar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear la rutina.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    reset();
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copiado al portapapeles.`);
    } catch {
      setError('El navegador no dejó copiar. Selecciona el texto a mano.');
    }
  };

  const handleStrava = () => {
    reset();
    const minutes = Number(durationMin);
    if (!startedAt || !Number.isFinite(minutes) || minutes <= 0) {
      setError('Indica la fecha de inicio y una duración válida.');
      return;
    }
    const km = Number(distanceKm);
    const tcx = buildSessionTcx(day, {
      startedAt: new Date(startedAt),
      durationSec: minutes * 60,
      distanceMeters: Number.isFinite(km) && km > 0 ? km * 1000 : 0,
      name: `${plan.name} · ${day.name}`,
    });
    downloadFile(tcx, fitFileName(day, plan.name).replace(/\.fit$/, '.tcx'), 'application/xml');
    setStatus('Archivo .tcx descargado. Súbelo en strava.com/upload/select.');
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={`Exportar: ${day.name}`}
          subtitle={`${plan.name} · ${day.kind === 'strength' ? 'fuerza' : 'cardio'}`}
          backTo={`/plans/${plan.id}`}
          backLabel="Volver al plan"
        />

        {error && <p className="rounded-md bg-red-50 text-red-700 text-sm p-3">{error}</p>}
        {status && <p className="rounded-md bg-green-50 text-green-700 text-sm p-3">{status}</p>}

        <section className={cardClass}>
          <h2 className="flex items-center text-xl font-semibold text-gray-900">
            <Watch className="h-5 w-5 mr-2 text-indigo-600" />
            Garmin Connect
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Descarga el entrenamiento como archivo <code>.fit</code> y súbelo <strong>antes de entrenar</strong>:
            en Garmin Connect entra en <em>Entrenamiento &gt; Entrenamientos &gt; Importar</em>, o copia el archivo a
            la carpeta <code>GARMIN/NEWFILES</code> del reloj conectado por USB. Después sincroniza y el reloj te irá
            guiando series, repeticiones y descansos.
          </p>
          <button
            type="button"
            onClick={handleGarmin}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar .fit
          </button>
        </section>

        {day.kind === 'strength' && (
          <section className={cardClass}>
            <h2 className="flex items-center text-xl font-semibold text-gray-900">
              <Zap className="h-5 w-5 mr-2 text-yellow-500" />
              Hevy
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Crea el día como rutina de Hevy con su API pública. Necesitas la clave personal de{' '}
              <a
                className="text-indigo-600 hover:underline"
                href="https://hevy.com/settings?developer"
                target="_blank"
                rel="noreferrer"
              >
                hevy.com/settings?developer
              </a>{' '}
              (requiere Hevy Pro). La clave se guarda sólo en este navegador.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                type="password"
                className={`${inputClass} flex-1 min-w-[16rem]`}
                placeholder="Clave de API de Hevy"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                disabled={!apiKey || busy}
                onClick={handleLoadTemplates}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50"
              >
                {busy ? 'Cargando…' : 'Buscar ejercicios'}
              </button>
            </div>

            {templates.length > 0 && (
              <div className="mt-5 space-y-3">
                {day.strength.map((block) => (
                  <div key={block.id} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                    <span className="text-sm text-gray-700">
                      {block.name}{' '}
                      <span className="text-gray-400">
                        ({block.sets}x{block.reps})
                      </span>
                    </span>
                    <select
                      className={inputClass}
                      value={mapping[block.id] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [block.id]: e.target.value })}
                    >
                      <option value="">— sin asignar (se omite) —</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!apiKey || busy}
                onClick={handleCreateRoutine}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
              >
                Crear rutina en Hevy
              </button>
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(routinePayload, null, 2), 'JSON de la rutina')}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Copiar JSON
              </button>
              <button
                type="button"
                onClick={() => handleCopy(curlCommand(routinePayload), 'Comando curl')}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Copiar curl
              </button>
            </div>
          </section>
        )}

        <section className={cardClass}>
          <h2 className="flex items-center text-xl font-semibold text-gray-900">
            <Activity className="h-5 w-5 mr-2 text-orange-500" />
            Strava
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Strava no acepta entrenamientos planificados: su API y su importador sólo admiten actividades ya
            realizadas. Por eso aquí el archivo se genera <strong>después</strong> de entrenar, con la hora y la
            duración reales, para subirlo en{' '}
            <a
              className="text-indigo-600 hover:underline"
              href="https://www.strava.com/upload/select"
              target="_blank"
              rel="noreferrer"
            >
              strava.com/upload/select
            </a>
            .
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="tcx-start" className="block text-xs font-medium text-gray-600 mb-1">
                Inicio
              </label>
              <input
                id="tcx-start"
                type="datetime-local"
                className={inputClass}
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tcx-duration" className="block text-xs font-medium text-gray-600 mb-1">
                Duración (min)
              </label>
              <input
                id="tcx-duration"
                type="number"
                min={1}
                className={inputClass}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tcx-distance" className="block text-xs font-medium text-gray-600 mb-1">
                Distancia (km, opcional)
              </label>
              <input
                id="tcx-distance"
                type="number"
                step="0.1"
                min={0}
                className={inputClass}
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleStrava}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar .tcx
          </button>
        </section>
      </div>
    </div>
  );
};

export default PlanExport;
