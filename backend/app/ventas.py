"""Payload del tablero «Ventas semanales» (misma forma que consumían los componentes legacy).

Todo se calcula en vivo sobre ``ventas_ec``:

* Corte actual = fecha_corte más reciente de cada (línea, periodo) dentro de los filtros.
* Semana = semana ISO de ``fec_cre_acad`` (fecha de creación de la orden en SINU).
* Tasa de pago = órdenes con ``est_pag_financiero = 'PAGO'`` / órdenes del corte.
* Cartera pendiente = órdenes sin pago; su valor es ``valor_orden`` (SINU deja en 0 lo liquidado).
* Recaudo efectivo = ``val_pagado`` + ``val_becdtos`` (valor pagado menos becas y descuentos).

Solo se devuelven agregados: nada de nombres, documentos ni contacto de estudiantes.
"""

from __future__ import annotations

import unicodedata
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from .config import settings
from .db import fetch_all
from .queries import LINEAS, short_programa

S = settings.schema_sql

MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

# Paleta fija por diplomado (la misma del tablero legacy).
PROG_PALETTE = ["#1e50d0", "#d97706", "#0891b2", "#7c3aed", "#059669", "#dc2626", "#db2777", "#65a30d"]

# Etiquetas cortas al estilo del tablero legacy (clave = nombre sin tildes, en mayúsculas).
_SHORT = {
    "INTELIGENCIA ARTIFICIAL": "IA",
    "INTELIGENCIA ARTIFICIAL (IA)": "IA",
    "CIENCIA DE DATOS Y ANALITICA": "Ciencia Datos",
    "GERENCIA DE PROYECTOS": "Gest. Proyectos",
    "EXCEL Y POWER BI": "Excel & PBI",
    "GERENCIA, ADMINISTRACION Y GESTION DE PROYECTOS": "Ger. Adm. Proyectos",
    "GERENCIA FINANCIERA": "Ger. Financiera",
    "SEGURIDAD Y SALUD EN EL TRABAJO": "SST",
    "MACHINE LEARNING EN PYTHON": "Machine Learn.",
    "CONTRATACION ESTATAL": "Contrat. Est.",
    "GERENCIA DE MARKETING": "Ger. Marketing",
    "GERENCIA DEL TALENTO HUMANO": "Talento Humano",
    "MARKETING DIGITAL Y PUBLICIDAD OMNICANAL": "Mktg Digital",
    "ACTUALIZACION TRIBUTARIA": "Act. Tributaria",
    "DISENO DE PROYECTOS DE INGENIERIA": "Diseño Proy. Ing.",
    "GERENCIA ESTRATEGICA DEL TALENTO HUMANO": "Ger. Estrat. TH",
    "CIBERSEGURIDAD": "Ciberseguridad",
    "ALTA GERENCIA": "Alta Gerencia",
    "ANALITICA DE DATOS": "Analítica Datos",
    "DESARROLLO ORGANIZACIONAL Y GESTION DEL TALENTO HUMANO": "Desarrollo Org.",
    "GERENCIA EDUCATIVA": "Ger. Educativa",
    "GOBERNANZA DE LA INTELIGENCIA ARTIFICIAL (IA)": "Gobernanza IA",
    "INTELIGENCIA DE NEGOCIOS": "Intel. Negocios",
    "MARKETING DIGITAL": "Mktg Digital",
    "MARKETING POLITICO": "Mktg Político",
    "PAZ Y DESARROLLO TERRITORIAL": "Paz y Des. Terr.",
}

EDADES = ["≤24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55+"]


def _fold(text: str) -> str:
    t = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    return " ".join(t.upper().split())


def label_programa(nombre: str | None, linea: str) -> str:
    base = short_programa(nombre)
    short = _SHORT.get(_fold(base))
    if not short:
        short = base if len(base) <= 18 else base[:17].rstrip() + "."
    return f"Esp. {short}" if linea == "Especializacion" else short


def _ddmon(d: date) -> str:
    return f"{d.day:02d}-{MESES[d.month - 1]}"


def _week_key(d: date | None) -> str | None:
    if d is None:
        return None
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _week_label(key: str, sep: str = " · ") -> str:
    y, w = key.split("-W")
    monday = date.fromisocalendar(int(y), int(w), 1)
    return f"W{w}{sep}{_ddmon(monday)}"


def _edad_bucket(nac: date | None, ref: date) -> str | None:
    if not nac:
        return None
    edad = ref.year - nac.year - ((ref.month, ref.day) < (nac.month, nac.day))
    if edad < 25:
        return "≤24"
    if edad >= 55:
        return "55+"
    lo = 25 + ((edad - 25) // 5) * 5
    return f"{lo}-{lo + 4}"


def _pct(a: int, b: int) -> float:
    return round(100.0 * a / b, 1) if b else 0.0


def _money_m(v: float) -> str:
    """$3337,2M (formato de KPI legacy)."""
    return f"${v / 1e6:,.1f}M".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_int(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def _fecha_larga(d: date) -> str:
    return f"{d.day} {MESES[d.month - 1]} {d.year}"


# ── Datos base ─────────────────────────────────────────────────────────────


def _rows(linea: str | None, periodo: str | None, programa: str | None) -> list[dict[str, Any]]:
    return fetch_all(
        f"""
        SELECT c.linea, o.periodo, o.fecha_corte, o.orden, o.cod_unidad,
               COALESCE(p.nom_unidad, o.nom_cencos) AS programa,
               (o.est_pag_financiero = 'PAGO') AS pago,
               COALESCE(o.valor_orden, 0)::float AS valor_orden,
               COALESCE(o.val_pagado, 0)::float AS val_pagado,
               COALESCE(o.val_becdtos, 0)::float AS val_becdtos,
               o.fec_cre_acad,
               e.genero, e.fecha_nacimiento
        FROM {S}.orden_foto o
        JOIN {S}.carga c ON c.id = o.carga_id
        LEFT JOIN {S}.programa p ON p.cod_unidad = o.cod_unidad
        LEFT JOIN {S}.estudiante e ON e.documento = o.documento
        WHERE (%(linea)s::text IS NULL OR c.linea = %(linea)s)
          AND (%(periodo)s::text IS NULL OR o.periodo = %(periodo)s)
          AND (%(programa)s::text IS NULL OR o.cod_unidad = %(programa)s)
        """,
        {"linea": linea, "periodo": periodo, "programa": programa},
    )


def filtros() -> dict[str, Any]:
    periodos = fetch_all(
        f"""
        SELECT linea, periodo, MIN(fecha_corte) AS primer_corte, MAX(fecha_corte) AS ultimo_corte
        FROM {S}.carga GROUP BY 1, 2 ORDER BY MAX(fecha_corte) DESC, linea
        """
    )
    programas = fetch_all(
        f"""
        SELECT DISTINCT c.linea, o.cod_unidad, COALESCE(p.nom_unidad, o.nom_cencos) AS programa
        FROM {S}.orden_foto o
        JOIN {S}.carga c ON c.id = o.carga_id
        LEFT JOIN {S}.programa p ON p.cod_unidad = o.cod_unidad
        WHERE o.cod_unidad IS NOT NULL
        """
    )
    semanas = fetch_all(
        f"""
        SELECT DISTINCT to_char(fec_cre_acad, 'IYYY-"W"IW') AS semana
        FROM {S}.orden_foto WHERE fec_cre_acad IS NOT NULL ORDER BY 1
        """
    )
    return {
        "lineas": [{"value": l, "label": "Especializaciones" if l == "Especializacion" else "Diplomados"} for l in LINEAS],
        "periodos": [
            {
                "value": p["periodo"],
                "linea": p["linea"],
                "label": f"{p['periodo']} · {_ddmon(p['primer_corte'])} a {_ddmon(p['ultimo_corte'])}",
            }
            for p in periodos
        ],
        "programas": sorted(
            (
                {"value": p["cod_unidad"], "linea": p["linea"], "label": short_programa(p["programa"])
                 + (" (esp.)" if p["linea"] == "Especializacion" else "")}
                for p in programas
            ),
            key=lambda x: (x["linea"], x["label"]),
        ),
        "semanas": [{"value": s["semana"], "label": _week_label(s["semana"])} for s in semanas],
    }


# ── Payload principal ──────────────────────────────────────────────────────


def ventas(linea: str | None, periodo: str | None, programa: str | None, semana: str | None) -> dict[str, Any]:
    rows = _rows(linea, periodo, programa)
    if semana:
        rows = [r for r in rows if _week_key(r["fec_cre_acad"]) == semana]

    # Cortes por (línea, periodo)
    cortes: dict[tuple, list[date]] = defaultdict(list)
    for r in rows:
        key = (r["linea"], r["periodo"])
        if r["fecha_corte"] not in cortes[key]:
            cortes[key].append(r["fecha_corte"])
    for v in cortes.values():
        v.sort()
    ultimo = {k: v[-1] for k, v in cortes.items()}
    previo = {k: v[-2] for k, v in cortes.items() if len(v) > 1}

    actual = [r for r in rows if ultimo.get((r["linea"], r["periodo"])) == r["fecha_corte"]]
    anterior = [r for r in rows if previo.get((r["linea"], r["periodo"])) == r["fecha_corte"]]

    if not actual:
        return {"vacio": True, "meta": {"corte": None}}

    hoy = date.today()
    corte_max = max(ultimo.values())

    # Programas (corte actual)
    prog: dict[str, dict[str, Any]] = {}
    for r in actual:
        cod = r["cod_unidad"] or "?"
        p = prog.setdefault(
            cod,
            {"cod": cod, "linea": r["linea"], "nombre": r["programa"], "n": 0, "pag": 0, "pend": 0.0, "f": 0, "m": 0},
        )
        p["n"] += 1
        p["pag"] += 1 if r["pago"] else 0
        if not r["pago"]:
            p["pend"] += r["valor_orden"]
        g = (r["genero"] or "").upper()
        if g == "F":
            p["f"] += 1
        elif g == "M":
            p["m"] += 1
    for p in prog.values():
        p["l"] = label_programa(p["nombre"], p["linea"])
        p["tasa"] = _pct(p["pag"], p["n"])
    color_de = {cod: PROG_PALETTE[i % len(PROG_PALETTE)] for i, cod in enumerate(sorted(prog))}
    por_volumen = sorted(prog.values(), key=lambda p: p["n"], reverse=True)
    top8 = por_volumen[:8]

    n = len(actual)
    pagadas = sum(1 for r in actual if r["pago"])
    avg_pago = _pct(pagadas, n)

    # KPIs
    vendido = sum(r["val_pagado"] for r in actual)
    becas = -sum(r["val_becdtos"] for r in actual)
    recaudo = vendido - becas
    sin_pago = n - pagadas
    pend_valor = sum(r["valor_orden"] for r in actual if not r["pago"])
    fem = [r for r in actual if (r["genero"] or "").upper() == "F"]
    mas = [r for r in actual if (r["genero"] or "").upper() == "M"]
    t_f = _pct(sum(1 for r in fem if r["pago"]), len(fem))
    t_m = _pct(sum(1 for r in mas if r["pago"]), len(mas))
    brecha = round(t_f - t_m, 1)

    unico = len(ultimo) == 1
    if unico and anterior:
        diff = n - len(anterior)
        delta_mat = f"{'▲' if diff >= 0 else '▼'} {'+' if diff >= 0 else ''}{_fmt_int(diff)} vs corte anterior"
        delta_mat_type = "up" if diff >= 0 else "dn"
    else:
        delta_mat = f"{len(ultimo)} periodo(s) en filtro"
        delta_mat_type = "up"

    semanas_act = sorted({k for k in (_week_key(r["fec_cre_acad"]) for r in actual) if k})
    ultima_semana = _week_label(semanas_act[-1]) if semanas_act else "—"

    kpis = [
        {
            "label": "Matriculados",
            "value": _fmt_int(n),
            "delta": delta_mat,
            "deltaType": delta_mat_type,
            "ctx": f"Órdenes en el último corte · última semana: {ultima_semana}",
            "color": "c-blue",
        },
        {
            "label": "Tasa de pago",
            "value": f"{avg_pago:.1f}%",
            "delta": f"{_fmt_int(pagadas)} órdenes pagadas",
            "deltaType": "up" if avg_pago >= 65 else "dn",
            "ctx": f"Corte {_fecha_larga(corte_max)}",
            "color": "c-green",
        },
        {
            "label": "Recaudo efectivo",
            "value": _money_m(recaudo),
            "delta": f"Pagado {_money_m(vendido)} − becas {_money_m(becas)}",
            "deltaType": "wa",
            "ctx": "COP · Cloud SQL core",
            "color": "c-navy",
        },
        {
            "label": "Cartera pendiente",
            "value": _fmt_int(sin_pago),
            "delta": f"{_pct(sin_pago, n):.1f}% sin pago",
            "deltaType": "dn",
            "ctx": f"{_money_m(pend_valor)} en órdenes sin pagar",
            "color": "c-red",
        },
        {
            "label": "Brecha género pago",
            "value": f"{'+' if brecha > 0 else ''}{brecha:.1f}pp",
            "delta": f"Mujeres {t_f:.1f}% · Hombres {t_m:.1f}%",
            "deltaType": "wa",
            "ctx": f"M={_fmt_int(len(mas))} / F={_fmt_int(len(fem))}",
            "color": "c-amber",
        },
    ]

    # Burbujas y desviación
    bubble = [{"l": p["l"], "x": p["n"], "y": p["tasa"], "c": round(p["pend"] / 1e6, 1)} for p in por_volumen]
    diverging = [
        {"l": p["l"], "v": round(p["tasa"] - avg_pago, 1)} for p in por_volumen[:14] if p["n"] >= 5
    ]

    # Pirámide de género (top 8)
    gender = [{"l": p["l"], "f": p["f"], "m": p["m"]} for p in top8]

    # Cascada: facturado → pendientes por programa → pagado
    facturado = sum(r["valor_orden"] for r in actual) / 1e6
    pend_prog = sorted((p for p in prog.values() if p["pend"] > 0), key=lambda p: p["pend"], reverse=True)
    bars = [{"l": "Facturado\ntotal", "v": [0, round(facturado, 1)], "lbl": f"${facturado:.1f}M", "kind": "facturado"}]
    nivel = facturado
    for p in pend_prog[:7]:
        v = p["pend"] / 1e6
        bars.append(
            {
                "l": "Pend.\n" + p["l"],
                "v": [round(nivel - v, 1), round(nivel, 1)],
                "lbl": f"-${v:.1f}M",
                "kind": "pendiente_critico" if p["tasa"] < 65 else "pendiente_moderado",
            }
        )
        nivel -= v
    otros = sum(p["pend"] for p in pend_prog[7:]) / 1e6
    if otros > 0:
        bars.append({"l": "Pend.\nOtros", "v": [round(nivel - otros, 1), round(nivel, 1)], "lbl": f"-${otros:.1f}M", "kind": "pendiente_otros"})
        nivel -= otros
    bars.append({"l": "Pagado\n(órdenes)", "v": [0, round(nivel, 1)], "lbl": f"${nivel:.1f}M", "kind": "recaudo"})

    # Edad vs tasa de pago
    edad_n = dict.fromkeys(EDADES, 0)
    edad_p = dict.fromkeys(EDADES, 0)
    for r in actual:
        b = _edad_bucket(r["fecha_nacimiento"], hoy)
        if b:
            edad_n[b] += 1
            edad_p[b] += 1 if r["pago"] else 0
    age = {"labels": EDADES, "counts": [edad_n[b] for b in EDADES], "pagos": [_pct(edad_p[b], edad_n[b]) for b in EDADES]}

    # Heatmap programa × semana de creación (top 8) y flujo semanal
    weeks = semanas_act
    hm: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    wk_n: dict[str, int] = defaultdict(int)
    wk_p: dict[str, int] = defaultdict(int)
    for r in actual:
        k = _week_key(r["fec_cre_acad"])
        if not k:
            continue
        hm[r["cod_unidad"] or "?"][k] += 1
        wk_n[k] += 1
        wk_p[k] += 1 if r["pago"] else 0
    heat_rows = [{"l": p["l"], "data": [hm[p["cod"]].get(w, 0) for w in weeks]} for p in top8]
    weekly = {
        "labels": [_week_label(w, "\n") for w in weeks],
        "counts": [wk_n[w] for w in weeks],
        "pagos": [_pct(wk_p[w], wk_n[w]) for w in weeks],
    }

    # Trayectoria: tasa de pago por programa en los últimos 3 cortes del periodo más reciente
    key_slope = max(ultimo, key=lambda k: ultimo[k])
    ult3 = cortes[key_slope][-3:]
    slope_rows = []
    sem_avgs = []
    by_corte: dict[date, list[dict]] = defaultdict(list)
    for r in rows:
        if (r["linea"], r["periodo"]) == key_slope and r["fecha_corte"] in ult3:
            by_corte[r["fecha_corte"]].append(r)
    top_slope = sorted(
        {r["cod_unidad"] for r in by_corte[ult3[-1]]},
        key=lambda c: -sum(1 for r in by_corte[ult3[-1]] if r["cod_unidad"] == c),
    )[:8]
    for cod in top_slope:
        vals = []
        for fc in ult3:
            sub = [r for r in by_corte[fc] if r["cod_unidad"] == cod]
            vals.append(_pct(sum(1 for r in sub if r["pago"]), len(sub)) if sub else None)
        while len(vals) < 3:
            vals.append(None)
        p = prog.get(cod)
        nombre = p["l"] if p else label_programa(None, key_slope[0])
        slope_rows.append({"l": nombre, "s1": vals[0], "s2": vals[1], "s3": vals[2], "c": color_de.get(cod, PROG_PALETTE[0])})
    alphas = ["rgba(71,85,105,0.4)", "rgba(71,85,105,0.35)", "rgba(30,80,208,.5)"]
    for i, fc in enumerate(ult3):
        sub = by_corte[fc]
        sem_avgs.append(
            {"val": _pct(sum(1 for r in sub if r["pago"]), len(sub)), "lbl": f"Sem{i + 1} ({_ddmon(fc)})", "color": alphas[i]}
        )

    return {
        "vacio": False,
        "meta": {
            "corte": corte_max.isoformat(),
            "corte_label": _fecha_larga(corte_max),
            "ultima_semana": ultima_semana,
            "semanas_heatmap": len(weeks),
            "periodos": [{"linea": k[0], "periodo": k[1], "ultimo_corte": v.isoformat()} for k, v in sorted(ultimo.items(), key=lambda kv: kv[1], reverse=True)],
            "slope_periodo": key_slope[1],
            "fuente": f"{settings.db_name}.{settings.db_schema}",
            "generado": datetime.now(timezone.utc).isoformat(),
        },
        "KPIS": kpis,
        "AVG_PAGO": avg_pago,
        "BUBBLE_DATA": bubble,
        "DIVERGING_DATA": diverging,
        "GENDER_DATA": gender,
        "WATERFALL_BARS": bars,
        "AGE_DATA": age,
        "HEATMAP_WEEKS": [_week_label(w) for w in weeks],
        "HEATMAP_ROWS": heat_rows,
        "WEEKLY_FLOW": weekly,
        "SLOPE_DATA": slope_rows,
        "SEM_AVGS": sem_avgs,
        "SLOPE_WEEK_LABELS": [_ddmon(fc) for fc in ult3],
    }
