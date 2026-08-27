/**
 * Exportación a TCX para Strava.
 *
 * Strava no admite subir entrenamientos *planificados* por archivo ni por API
 * pública: sólo actividades ya realizadas. Este exportador genera el TCX de una
 * sesión terminada (fecha, hora y duración reales que introduce el usuario)
 * para subirla en strava.com/upload/select.
 */
import type { PlanDay } from '../../types/plan';

/** Deportes admitidos por el atributo `Sport` de TCX. */
type TcxSport = 'Running' | 'Biking' | 'Other';

function tcxSport(day: PlanDay): TcxSport {
  if (day.kind === 'strength') return 'Other';
  if (day.sport === 'cycling') return 'Biking';
  if (day.sport === 'running' || day.sport === 'walking') return 'Running';
  return 'Other';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function summarize(day: PlanDay): string {
  if (day.kind === 'strength') {
    return day.strength
      .map((b) => `${b.name}: ${b.sets}x${b.reps}${b.weightKg ? ` @ ${b.weightKg}kg` : ''}`)
      .join(' | ');
  }
  return day.cardio.map((s) => s.name).join(' | ');
}

export interface TcxSessionOptions {
  /** Momento de inicio de la sesión. */
  startedAt: Date;
  /** Duración total en segundos. */
  durationSec: number;
  /** Distancia recorrida en metros (opcional, para cardio). */
  distanceMeters?: number;
  name?: string;
}

/** Genera el XML TCX de una sesión ya realizada. */
export function buildSessionTcx(day: PlanDay, options: TcxSessionOptions): string {
  const start = options.startedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const end = new Date(options.startedAt.getTime() + options.durationSec * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
  const distance = Math.max(0, Math.round(options.distanceMeters ?? 0));
  const notes = escapeXml([options.name ?? day.name, summarize(day)].filter(Boolean).join(' — ')).slice(0, 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${tcxSport(day)}">
      <Id>${start}</Id>
      <Lap StartTime="${start}">
        <TotalTimeSeconds>${Math.max(1, Math.round(options.durationSec))}</TotalTimeSeconds>
        <DistanceMeters>${distance}</DistanceMeters>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          <Trackpoint>
            <Time>${start}</Time>
            <DistanceMeters>0</DistanceMeters>
          </Trackpoint>
          <Trackpoint>
            <Time>${end}</Time>
            <DistanceMeters>${distance}</DistanceMeters>
          </Trackpoint>
        </Track>
      </Lap>
      <Notes>${notes}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}
