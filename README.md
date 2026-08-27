# tracker-gym

Registro de entrenamientos de gimnasio con planes exportables a Garmin Connect, Hevy y Strava.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run lint       # eslint
npm run check:fit  # valida los .fit generados con el SDK oficial de Garmin
```

## Planes de entrenamiento

Desde **Planes** puedes crear un plan, definir sus días (fuerza o cardio) y exportarlos:

- **Garmin Connect** — archivo `.fit` de entrenamiento planificado, para importar *antes* de entrenar.
- **Hevy** — crea la rutina con su API pública.
- **Strava** — archivo `.tcx` de la sesión ya realizada (Strava no admite planes).

Los detalles de cada integración están en [docs/integraciones.md](docs/integraciones.md).

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/hrdi1023802/tracker-gym)
