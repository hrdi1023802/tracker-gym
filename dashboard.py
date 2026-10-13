#!/usr/bin/env python3
"""Dashboard de entrenamiento con datos de Garmin Connect.

Reutiliza los tokens OAuth cacheados (por defecto ~/.garminconnect) a través de
la librería `garminconnect`, nunca pide contraseña, y genera un único
index.html autocontenido (Chart.js por CDN).

Uso:
    python dashboard.py            # descarga datos y reconstruye index.html
    python dashboard.py --probe    # muestra qué métricas devuelve tu cuenta
    python dashboard.py --demo     # genera la página con datos sintéticos
    python dashboard.py --refresh  # ignora la caché local y vuelve a descargar
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_FILE = ROOT / ".cache" / "garmin_cache.json"
LOAD_WARMUP_DAYS = 90  # historial extra para que CTL (42 días) arranque estabilizado
KM_PER_MI = 1.609344

WORKOUT_LABELS = {
    "TEMPO", "LACTATE_THRESHOLD", "THRESHOLD", "VO2MAX", "ANAEROBIC_CAPACITY",
    "SPRINT", "ANAEROBIC", "SPEED",
}
WORKOUT_WORDS = (
    "interval", "series", "tempo", "fartlek", "umbral", "threshold", "track",
    "repeats", "workout", "cuestas", "hill", "progresiv", "vo2",
)
RACE_WORDS = ("race", "carrera", "10k race", "parkrun", "maratón", "marathon")


# --------------------------------------------------------------------------- #
# Configuración
# --------------------------------------------------------------------------- #
def load_config() -> dict:
    path = ROOT / "config.json"
    if not path.exists():
        sys.exit("No se encontró config.json junto a dashboard.py")
    return json.loads(path.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# Cliente Garmin + caché
# --------------------------------------------------------------------------- #
def connect_garmin(tokenstore: str):
    try:
        from garminconnect import Garmin
    except ImportError:
        sys.exit("Falta la librería: pip install -r requirements.txt")

    path = os.getenv("GARMINTOKENS") or tokenstore
    expanded = Path(path).expanduser()
    if not expanded.exists():
        sys.exit(
            f"No hay tokens en {expanded}. Inicia sesión una vez con el MCP de "
            "Garmin (o garminconnect) para crearlos; este script nunca pide contraseña."
        )
    client = Garmin()  # sin email/contraseña: solo tokens
    try:
        client.login(str(expanded))
    except Exception as exc:  # noqa: BLE001 - mostramos el motivo exacto
        msg = str(exc)
        hint = ""
        if "garth" in msg or "oauth1_token" in msg:
            hint = (
                "\nTus tokens tienen el formato antiguo de garth. Instala la versión "
                'compatible: pip install "garminconnect<0.3"'
            )
        sys.exit(f"No se pudo iniciar sesión con los tokens cacheados: {msg}{hint}")
    return client


class CachedClient:
    """Envuelve el cliente: guarda en disco las respuestas de días cerrados."""

    def __init__(self, client, use_cache: bool = True):
        self.client = client
        self.errors: dict[str, str] = {}
        self.cache: dict = {}
        if use_cache and CACHE_FILE.exists():
            try:
                self.cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                self.cache = {}

    def call(self, method: str, *args, cacheable: bool = True):
        key = f"{method}|{'|'.join(map(str, args))}"
        if cacheable and key in self.cache:
            return self.cache[key]
        fn = getattr(self.client, method, None)
        if fn is None:
            self.errors[method] = "método no disponible en esta versión de garminconnect"
            return None
        try:
            result = fn(*args)
        except Exception as exc:  # noqa: BLE001 - un endpoint sin datos no debe tumbar el resto
            self.errors.setdefault(method, f"{type(exc).__name__}: {exc}"[:200])
            return None
        if cacheable and result is not None:
            self.cache[key] = result
        return result

    def save(self):
        CACHE_FILE.parent.mkdir(exist_ok=True)
        CACHE_FILE.write_text(json.dumps(self.cache), encoding="utf-8")


def is_closed_day(d: date, today: date) -> bool:
    """Los datos de hoy y ayer pueden cambiar (sincronización, sueño)."""
    return d < today - timedelta(days=1)


# --------------------------------------------------------------------------- #
# Extracción defensiva de campos
# --------------------------------------------------------------------------- #
def dig(obj, *path, default=None):
    for part in path:
        if isinstance(obj, dict):
            obj = obj.get(part)
        elif isinstance(obj, list) and isinstance(part, int) and len(obj) > part:
            obj = obj[part]
        else:
            return default
        if obj is None:
            return default
    return obj


def num(value):
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def is_run(act: dict) -> bool:
    key = (dig(act, "activityType", "typeKey") or "").lower()
    return "run" in key


def act_date(act: dict) -> date | None:
    raw = act.get("startTimeLocal") or act.get("startTimeGMT")
    if not raw:
        return None
    return datetime.fromisoformat(str(raw).replace(" ", "T")[:19]).date()


# --------------------------------------------------------------------------- #
# Descarga
# --------------------------------------------------------------------------- #
def fetch_all(api: CachedClient, cfg: dict, today: date) -> dict:
    weeks = cfg.get("weeks", 12)
    rec_days = cfg.get("recovery_days", 28)
    start_load = today - timedelta(weeks=weeks, days=LOAD_WARMUP_DAYS)

    # Actividades: lo cerrado se cachea por meses, lo reciente siempre se refresca.
    activities: list[dict] = []
    cursor = date(start_load.year, start_load.month, 1)
    while cursor <= today:
        nxt = date(cursor.year + cursor.month // 12, cursor.month % 12 + 1, 1)
        end = min(nxt - timedelta(days=1), today)
        chunk = api.call(
            "get_activities_by_date", cursor.isoformat(), end.isoformat(),
            cacheable=is_closed_day(end, today),
        ) or []
        activities.extend(chunk)
        cursor = nxt
    seen, uniq = set(), []
    for a in activities:
        aid = a.get("activityId") or (a.get("startTimeLocal"), a.get("distance"))
        if aid not in seen:
            seen.add(aid)
            uniq.append(a)

    daily = []
    for i in range(rec_days, -1, -1):
        d = today - timedelta(days=i)
        ds, closed = d.isoformat(), is_closed_day(d, today)
        daily.append({
            "date": ds,
            "hrv": api.call("get_hrv_data", ds, cacheable=closed),
            "rhr": api.call("get_rhr_day", ds, cacheable=closed),
            "sleep": api.call("get_sleep_data", ds, cacheable=closed),
        })

    vo2 = []
    for i in range(weeks + 4, -1, -1):
        d = today - timedelta(weeks=i)
        ds = d.isoformat()
        vo2.append({"date": ds, "data": api.call("get_max_metrics", ds,
                                                 cacheable=is_closed_day(d, today))})

    predictions = api.call("get_race_predictions", cacheable=False)
    return {"activities": uniq, "daily": daily, "vo2": vo2, "predictions": predictions}


# --------------------------------------------------------------------------- #
# Métricas
# --------------------------------------------------------------------------- #
def estimate_hr_limits(cfg: dict, acts: list[dict], daily_rhr: list) -> tuple[float, float, float]:
    athlete = cfg.get("athlete", {})
    max_hr = num(athlete.get("max_hr"))
    if not max_hr:
        observed = [num(a.get("maxHR")) for a in acts if num(a.get("maxHR"))]
        max_hr = max(observed) if observed else 190.0
    rhr_vals = [v for v in daily_rhr if v]
    rest_hr = statistics.median(rhr_vals) if rhr_vals else 50.0
    easy = num(athlete.get("easy_hr_ceiling"))
    if not easy:
        # ~ límite superior de Z2 por reserva de FC (Karvonen 70 %)
        easy = rest_hr + 0.70 * (max_hr - rest_hr)
    return max_hr, rest_hr, round(easy)


def activity_load(act: dict, max_hr: float, rest_hr: float) -> tuple[float, str]:
    load = num(act.get("activityTrainingLoad"))
    if load:
        return load, "garmin"
    avg = num(act.get("averageHR"))
    dur = num(act.get("duration")) or num(act.get("movingDuration"))
    if avg and dur and max_hr > rest_hr:
        ratio = max(0.0, min(1.0, (avg - rest_hr) / (max_hr - rest_hr)))
        return dur / 60 * ratio * 0.64 * math.exp(1.92 * ratio), "trimp"
    if dur:
        return dur / 60 * 0.5, "duración"
    return 0.0, "sin datos"


def training_load(acts, max_hr, rest_hr, today, weeks):
    per_day: dict[date, float] = {}
    sources: dict[str, int] = {}
    for a in acts:
        d = act_date(a)
        if not d:
            continue
        load, src = activity_load(a, max_hr, rest_hr)
        per_day[d] = per_day.get(d, 0.0) + load
        sources[src] = sources.get(src, 0) + 1
    start = today - timedelta(weeks=weeks, days=LOAD_WARMUP_DAYS)
    ctl = atl = 0.0
    out = []
    d = start
    while d <= today:
        tsb = ctl - atl  # la forma de hoy usa los valores de ayer
        load = per_day.get(d, 0.0)
        ctl += (load - ctl) / 42
        atl += (load - atl) / 7
        if d > today - timedelta(weeks=weeks):
            out.append({"date": d.isoformat(), "ctl": round(ctl, 1),
                        "atl": round(atl, 1), "tsb": round(tsb, 1), "load": round(load)})
        d += timedelta(days=1)
    return out, sources


def classify_run(act: dict, easy_ceiling: float, long_km: float) -> str:
    name = (act.get("activityName") or "").lower()
    event = (dig(act, "eventType", "typeKey") or "").lower()
    if event == "race" or any(w in name for w in RACE_WORDS):
        return "Carrera"
    label = (act.get("trainingEffectLabel") or "").upper()
    if label in WORKOUT_LABELS or any(w in name for w in WORKOUT_WORDS):
        return "Calidad"
    km = (num(act.get("distance")) or 0) / 1000
    if km >= long_km:
        return "Largo"
    avg = num(act.get("averageHR"))
    if avg and avg > easy_ceiling + 8:
        return "Calidad"
    return "Suave"


def runs_data(acts, cfg, easy_ceiling, today):
    unit_km = KM_PER_MI if cfg.get("units") == "mi" else 1.0
    runs = [a for a in acts if is_run(a) and act_date(a) and num(a.get("distance"))]
    dists = sorted((num(a["distance"]) or 0) / 1000 for a in runs)
    median = statistics.median(dists) if dists else 10
    long_km = max(16.0, median * 1.6)
    out = []
    for a in runs:
        km = num(a["distance"]) / 1000
        dur = num(a.get("movingDuration")) or num(a.get("duration")) or 0
        out.append({
            "date": act_date(a).isoformat(),
            "name": a.get("activityName") or "Carrera",
            "dist": round(km / unit_km, 2),
            "pace": round(dur / (km / unit_km)) if km and dur else None,
            "hr": round(num(a.get("averageHR"))) if num(a.get("averageHR")) else None,
            "type": classify_run(a, easy_ceiling, long_km),
            "te": a.get("trainingEffectLabel"),
            "load": round(num(a.get("activityTrainingLoad")) or 0) or None,
            "vo2": num(a.get("vO2MaxValue")),
        })
    out.sort(key=lambda r: r["date"])
    return out


def weekly_volume(runs, today, weeks):
    monday = today - timedelta(days=today.weekday())
    rows = []
    for i in range(weeks - 1, -1, -1):
        ws = monday - timedelta(weeks=i)
        we = ws + timedelta(days=6)
        sel = [r for r in runs if ws.isoformat() <= r["date"] <= we.isoformat()]
        rows.append({"week": ws.isoformat(), "dist": round(sum(r["dist"] for r in sel), 1),
                     "runs": len(sel), "partial": i == 0})
    done = [(i, r["dist"]) for i, r in enumerate(rows) if not r["partial"]]
    trend = [None] * len(rows)
    if len(done) >= 2:
        xs, ys = zip(*done)
        mx, my = statistics.fmean(xs), statistics.fmean(ys)
        sxx = sum((x - mx) ** 2 for x in xs)
        slope = sum((x - mx) * (y - my) for x, y in done) / sxx if sxx else 0
        trend = [round(my + slope * (i - mx), 1) for i in range(len(rows))]
        for r, t in zip(rows, trend):
            r["trend"] = t
        return rows, round(slope, 2)
    return rows, 0.0


def recovery_data(daily):
    out = []
    for d in daily:
        hrv = d.get("hrv") or {}
        summary = hrv.get("hrvSummary") or {}
        rhr = dig(d.get("rhr"), "allMetrics", "metricsMap", "WELLNESS_RESTING_HEART_RATE", 0, "value")
        sleep = dig(d.get("sleep"), "dailySleepDTO") or {}
        if rhr is None:
            rhr = dig(d.get("sleep"), "restingHeartRate")
        secs = num(sleep.get("sleepTimeSeconds"))
        out.append({
            "date": d["date"],
            "hrv": num(summary.get("lastNightAvg")),
            "hrv_week": num(summary.get("weeklyAvg")),
            "hrv_low": num(dig(summary, "baseline", "balancedLow")),
            "hrv_high": num(dig(summary, "baseline", "balancedUpper")),
            "hrv_status": summary.get("status"),
            "rhr": num(rhr),
            "sleep_h": round(secs / 3600, 2) if secs else None,
            "sleep_score": num(dig(sleep, "sleepScores", "overall", "value")),
        })
    return out


def vo2_data(vo2, runs):
    points = {}
    for s in vo2:
        data = s.get("data")
        entry = data[0] if isinstance(data, list) and data else data
        generic = dig(entry, "generic") or {}
        val = num(generic.get("vo2MaxPreciseValue")) or num(generic.get("vo2MaxValue"))
        if val:
            points[generic.get("calendarDate") or s["date"]] = round(val, 1)
    if not points:  # alternativa: el VO2 que Garmin adjunta a cada carrera
        for r in runs:
            if r.get("vo2"):
                points[r["date"]] = r["vo2"]
    return [{"date": k, "vo2": v} for k, v in sorted(points.items())]


def pace_summary(runs, easy_ceiling, today, days=42):
    since = (today - timedelta(days=days)).isoformat()
    sel = [r for r in runs if r["date"] >= since and r["pace"]]
    easy = [r for r in sel if r["type"] in ("Suave", "Largo")]
    work = [r for r in sel if r["type"] in ("Calidad", "Carrera")]
    easy_hr = [r for r in easy if r["hr"]]
    within = [r for r in easy_hr if r["hr"] <= easy_ceiling]
    return {
        "days": days,
        "easy_pace": round(statistics.fmean(r["pace"] for r in easy)) if easy else None,
        "work_pace": round(statistics.fmean(r["pace"] for r in work)) if work else None,
        "easy_hr": round(statistics.fmean(r["hr"] for r in easy_hr)) if easy_hr else None,
        "easy_ok_pct": round(100 * len(within) / len(easy_hr)) if easy_hr else None,
        "easy_n": len(easy), "work_n": len(work),
        "points": sel,
    }


def build_model(raw: dict, cfg: dict, today: date, demo: bool, errors: dict) -> dict:
    weeks = cfg.get("weeks", 12)
    recovery = recovery_data(raw["daily"])
    max_hr, rest_hr, easy_ceiling = estimate_hr_limits(
        cfg, raw["activities"], [r["rhr"] for r in recovery])
    load, sources = training_load(raw["activities"], max_hr, rest_hr, today, weeks)
    runs = runs_data(raw["activities"], cfg, easy_ceiling, today)
    weekly, slope = weekly_volume(runs, today, weeks)
    recent_since = (today - timedelta(days=cfg.get("recent_runs_days", 28))).isoformat()

    race = cfg.get("race", {})
    race_day = date.fromisoformat(race.get("date", today.isoformat()))
    preds = raw.get("predictions") or {}
    if isinstance(preds, list):
        preds = preds[-1] if preds else {}
    available = {
        "Actividades": bool(raw["activities"]),
        "Carga Garmin (activityTrainingLoad)": sources.get("garmin", 0) > 0,
        "VFC (HRV)": any(r["hrv"] for r in recovery),
        "FC en reposo": any(r["rhr"] for r in recovery),
        "Sueño": any(r["sleep_h"] for r in recovery),
        "Puntuación de sueño": any(r["sleep_score"] for r in recovery),
        "VO2 máx": bool(vo2_data(raw["vo2"], runs)),
        "Predicciones de carrera": bool(preds),
    }
    return {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "today": today.isoformat(),
        "demo": demo,
        "unit": cfg.get("units", "km"),
        "race": {**race, "days_left": (race_day - today).days},
        "athlete": cfg.get("athlete", {}),
        "hr": {"max": max_hr, "rest": rest_hr, "easy_ceiling": easy_ceiling},
        "load": load,
        "load_sources": sources,
        "weekly": weekly,
        "weekly_slope": slope,
        "recovery": recovery,
        "vo2": vo2_data(raw["vo2"], runs),
        "recent": [r for r in reversed(runs) if r["date"] >= recent_since],
        "pace": pace_summary(runs, easy_ceiling, today),
        "predictions": {k: preds.get(k) for k in
                        ("time5K", "time10K", "timeHalfMarathon", "timeMarathon")
                        if num(preds.get(k))},
        "available": available,
        "errors": errors,
    }


# --------------------------------------------------------------------------- #
# Modo sondeo: qué devuelve la cuenta
# --------------------------------------------------------------------------- #
def probe(api: CachedClient, today: date):
    y = (today - timedelta(days=1)).isoformat()
    checks = {
        "get_activities_by_date": ((today - timedelta(days=30)).isoformat(), today.isoformat()),
        "get_hrv_data": (y,), "get_rhr_day": (y,), "get_sleep_data": (y,),
        "get_max_metrics": (y,), "get_race_predictions": (),
        "get_training_status": (y,), "get_training_readiness": (y,),
    }
    for method, args in checks.items():
        res = api.call(method, *args, cacheable=False)
        if isinstance(res, list):
            sample = res[0] if res else {}
            info = f"lista[{len(res)}] claves: {sorted(sample)[:40] if isinstance(sample, dict) else type(sample).__name__}"
        elif isinstance(res, dict):
            info = f"claves: {sorted(res)[:40]}"
        else:
            info = f"sin datos ({api.errors.get(method, 'None')})"
        print(f"\n== {method}\n   {info}")
    acts = api.call("get_activities_by_date", *checks["get_activities_by_date"], cacheable=False) or []
    runs = [a for a in acts if is_run(a)]
    fields = ["distance", "duration", "movingDuration", "averageHR", "maxHR",
              "activityTrainingLoad", "trainingEffectLabel", "aerobicTrainingEffect",
              "vO2MaxValue", "averageSpeed", "eventType"]
    print(f"\nCampos en tus {len(runs)} carreras de los últimos 30 días:")
    for f in fields:
        n = sum(1 for a in runs if a.get(f) is not None)
        print(f"   {f:24s} {n}/{len(runs)}")


# --------------------------------------------------------------------------- #
# Datos de demostración (mismo formato que la API)
# --------------------------------------------------------------------------- #
class DemoClient:
    def __init__(self, today: date):
        rnd = random.Random(7)
        self.acts, self.vo2 = [], {}
        start = today - timedelta(days=200)
        plan = {0: None, 1: "intervals", 2: "easy", 3: "tempo", 4: None, 5: "easy", 6: "long"}
        d, k = start, 0
        while d <= today:
            k += 1
            prog = (d - start).days / 200
            kind = plan[d.weekday()]
            if kind and rnd.random() > 0.08:
                if kind == "easy":
                    km, pace, hr, label, name = rnd.uniform(8, 12), rnd.uniform(325, 345), rnd.uniform(138, 152), "AEROBIC_BASE", "Rodaje suave"
                elif kind == "long":
                    km, pace, hr, label, name = 18 + 10 * prog + rnd.uniform(-1, 1), rnd.uniform(315, 335), rnd.uniform(144, 152), "AEROBIC_BASE", "Tirada larga"
                elif kind == "tempo":
                    km, pace, hr, label, name = rnd.uniform(10, 14), 270 - 8 * prog, rnd.uniform(160, 168), "LACTATE_THRESHOLD", "Tempo"
                else:
                    km, pace, hr, label, name = rnd.uniform(9, 12), 285 - 6 * prog, rnd.uniform(155, 165), "VO2MAX", "Series 6x1000"
                dur = km * pace
                self.acts.append({
                    "activityId": k, "activityName": name,
                    "startTimeLocal": f"{d.isoformat()} 07:{rnd.randint(0, 59):02d}:00",
                    "activityType": {"typeKey": "running"},
                    "distance": km * 1000, "duration": dur * 1.02, "movingDuration": dur,
                    "averageHR": hr, "maxHR": hr + rnd.uniform(10, 22),
                    "activityTrainingLoad": dur / 60 * (hr - 100) / 30,
                    "trainingEffectLabel": label, "vO2MaxValue": round(50 + 3 * prog),
                })
            if d.weekday() == 0 and rnd.random() > 0.4:
                self.acts.append({
                    "activityId": f"b{k}", "activityName": "Bici",
                    "startTimeLocal": f"{d.isoformat()} 18:00:00",
                    "activityType": {"typeKey": "cycling"}, "distance": 25000,
                    "duration": 3600, "averageHR": 128, "activityTrainingLoad": 55,
                })
            self.vo2[d.isoformat()] = round(50.2 + 3.1 * prog + rnd.uniform(-0.3, 0.3), 1)
            d += timedelta(days=1)
        self.rnd = rnd

    def get_activities_by_date(self, s, e, *_):
        return [a for a in self.acts if s <= a["startTimeLocal"][:10] <= e]

    def get_hrv_data(self, d):
        v = 62 + self.rnd.uniform(-9, 9)
        return {"hrvSummary": {"calendarDate": d, "lastNightAvg": round(v), "weeklyAvg": 62,
                               "status": "BALANCED", "baseline": {"balancedLow": 55, "balancedUpper": 70}}}

    def get_rhr_day(self, d):
        return {"allMetrics": {"metricsMap": {"WELLNESS_RESTING_HEART_RATE": [
            {"value": round(46 + self.rnd.uniform(-2, 3)), "calendarDate": d}]}}}

    def get_sleep_data(self, d):
        return {"dailySleepDTO": {"calendarDate": d, "sleepTimeSeconds": int(3600 * self.rnd.uniform(6.2, 8.4)),
                                  "sleepScores": {"overall": {"value": self.rnd.randint(62, 90)}}}}

    def get_max_metrics(self, d):
        return [{"generic": {"calendarDate": d, "vo2MaxPreciseValue": self.vo2.get(d)}}]

    def get_race_predictions(self):
        return {"time5K": 1215, "time10K": 2540, "timeHalfMarathon": 5620, "timeMarathon": 11950}


# --------------------------------------------------------------------------- #
# HTML
# --------------------------------------------------------------------------- #
def render(model: dict, out: Path):
    template = (ROOT / "template.html").read_text(encoding="utf-8")
    payload = json.dumps(model, ensure_ascii=False).replace("</", "<\\/")
    page = template.replace("__DATA__", payload)
    out.write_text(page, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--demo", action="store_true", help="usar datos sintéticos")
    ap.add_argument("--probe", action="store_true", help="listar las métricas que devuelve tu cuenta")
    ap.add_argument("--refresh", action="store_true", help="ignorar la caché local")
    ap.add_argument("--out", help="ruta del HTML (por defecto, la de config.json)")
    args = ap.parse_args()

    cfg = load_config()
    today = date.today()
    if args.demo:
        api = CachedClient(DemoClient(today), use_cache=False)
    else:
        api = CachedClient(connect_garmin(cfg.get("tokenstore", "~/.garminconnect")),
                           use_cache=not args.refresh)
    if args.probe:
        probe(api, today)
        return

    print("Descargando datos…" if not args.demo else "Generando datos de demostración…")
    raw = fetch_all(api, cfg, today)
    if not args.demo:
        api.save()
    model = build_model(raw, cfg, today, args.demo, api.errors)
    out = Path(args.out) if args.out else ROOT / cfg.get("output", "index.html")
    render(model, out)

    missing = [k for k, v in model["available"].items() if not v]
    print(f"Listo: {out}")
    print(f"  {len(model['recent'])} carreras recientes · {len(raw['activities'])} actividades en total")
    if missing:
        print("  Sin datos en tu cuenta para: " + ", ".join(missing))
    for m, e in api.errors.items():
        print(f"  aviso {m}: {e}")


if __name__ == "__main__":
    main()
