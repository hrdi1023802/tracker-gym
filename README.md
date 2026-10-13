# tracker-gym · Panel de entrenamiento con Garmin

`dashboard.py` descarga tus datos de Garmin Connect con los tokens OAuth ya
cacheados en `~/.garminconnect` (nunca pide contraseña) y genera un único
`index.html` autocontenido que puedes abrir en cualquier navegador.

## Qué muestra

- Cuenta atrás hasta el día de la carrera (días y semanas).
- Carga de entrenamiento: CTL (forma física), ATL (fatiga) y TSB (frescura) de las últimas 12 semanas.
- Volumen semanal con línea de tendencia.
- Recuperación: VFC (HRV) con su rango equilibrado, FC en reposo y sueño.
- Evolución del VO2 máx.
- Tabla de carreras de las últimas 4 semanas (fecha, distancia, ritmo, FC media, tipo).
- Ritmos de rodajes suaves frente a sesiones de calidad, y qué % de tus suaves queda bajo tu techo de FC.

## Puesta en marcha

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# edita config.json: carrera, fecha, altura, peso, marcas personales, unidades (km/mi)
python dashboard.py --probe   # opcional: lista qué métricas devuelve tu cuenta
python dashboard.py           # descarga datos y genera index.html
open index.html               # macOS (Linux: xdg-open, Windows: start)
```

Vuelve a ejecutar `python dashboard.py` cuando quieras actualizar. Los días ya
cerrados se guardan en `.cache/` para que las siguientes ejecuciones sean rápidas;
`--refresh` fuerza una descarga completa. `--demo` genera la página con datos
sintéticos para ver el diseño sin conexión.

### Actualización automática (opcional)

```cron
# crontab -e  → cada mañana a las 7:05
5 7 * * * cd /ruta/a/tracker-gym && .venv/bin/python dashboard.py >> .cache/cron.log 2>&1
```

## Notas

- **Tokens**: se leen de `tokenstore` en `config.json` (o de la variable `GARMINTOKENS`).
  Si tus tokens son del formato antiguo de *garth* (`oauth1_token.json` / `oauth2_token.json`),
  instala la versión compatible: `pip install "garminconnect<0.3"`.
- **Carga por sesión**: se usa la carga de Garmin (`activityTrainingLoad`); si una
  actividad no la tiene, se estima con TRIMP de Banister a partir de la FC.
- **Clasificación de carreras**: competición si Garmin la marca como *race*; calidad si el
  efecto de entrenamiento es tempo/umbral/VO2/anaeróbico o el nombre contiene "series",
  "tempo", "fartlek"…; largo si supera max(16 km, 1,6 × tu distancia mediana); el resto, suave.
- **Techo de FC suave**: `easy_hr_ceiling` en `config.json`; si es `null`, se calcula como el
  70 % de la reserva de FC (Karvonen) usando tu FC máx (`max_hr` o la máxima registrada) y tu FC en reposo.
- Cualquier endpoint que tu cuenta no devuelva se omite y se indica al pie de la página.
