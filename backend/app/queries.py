"""Consultas del tablero sobre el schema de ventas de educación continua (``ventas_ec``).

Modelo de datos (una "foto" = un corte semanal cargado desde Excel):

* ``carga``        → una fila por archivo cargado (fecha_corte, periodo, línea).
* ``orden_foto``   → estado de cada orden financiera en cada corte.
* ``estudiante``   → datos maestros del estudiante (género, nacimiento, ubicación).
* ``programa``     → catálogo de diplomados / especializaciones.
* ``asesor``       → asesores comerciales.

"Corte actual" de un periodo = su fecha_corte más reciente. Los KPIs se calculan
sobre el corte actual de cada (línea, periodo) que pase los filtros.

El tablero es público: aquí solo se exponen agregados, nunca datos personales
de estudiantes (nombres, documentos, correos, teléfonos).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from .config import settings
from .db import fetch_all

S = settings.schema_sql

LINEAS = ("Diplomado", "Especializacion")

_BASE_CTE = f"""
WITH f AS (
    SELECT
        c.linea,
        o.periodo,
        o.fecha_corte,
        o.orden,
        o.documento,
        o.cod_unidad,
        COALESCE(p.nom_unidad, o.nom_cencos) AS programa,
        o.nuevo,
        o.est_pag_financiero,
        COALESCE(o.valor_orden, 0)      AS valor_orden,
        COALESCE(o.val_pagado, 0)       AS val_pagado,
        COALESCE(o.val_becdtos, 0)      AS val_becdtos,
        o.asesor_crea
    FROM {S}.orden_foto o
    JOIN {S}.carga c ON c.id = o.carga_id
    LEFT JOIN {S}.programa p ON p.cod_unidad = o.cod_unidad
    WHERE (%(linea)s::text IS NULL OR c.linea = %(linea)s)
      AND (%(periodo)s::text IS NULL OR o.periodo = %(periodo)s)
),
cortes AS (
    SELECT linea, periodo, fecha_corte,
           DENSE_RANK() OVER (PARTITION BY linea, periodo ORDER BY fecha_corte DESC) AS rk
    FROM (SELECT DISTINCT linea, periodo, fecha_corte FROM f) d
),
actual AS (
    SELECT f.* FROM f JOIN cortes k USING (linea, periodo, fecha_corte) WHERE k.rk = 1
),
anterior AS (
    SELECT f.* FROM f JOIN cortes k USING (linea, periodo, fecha_corte) WHERE k.rk = 2
)
"""

_KPI_COLUMNS = """
    COUNT(*)::int                                                AS ordenes,
    COUNT(DISTINCT documento)::int                               AS estudiantes,
    COUNT(*) FILTER (WHERE est_pag_financiero = 'PAGO')::int     AS pagadas,
    COUNT(*) FILTER (WHERE est_pag_financiero <> 'PAGO')::int    AS no_pagadas,
    COUNT(*) FILTER (WHERE nuevo = 'NUEVO')::int                 AS nuevos,
    COALESCE(SUM(val_pagado), 0)                                 AS vendido,
    COALESCE(-SUM(val_becdtos), 0)                               AS becas,
    COALESCE(SUM(val_pagado) + SUM(val_becdtos), 0)              AS ingreso_neto,
    COALESCE(SUM(valor_orden) FILTER (WHERE est_pag_financiero <> 'PAGO'), 0) AS por_convertir
"""


def _num(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _clean(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: _num(v) for k, v in r.items()} for r in rows]


def _strip_accents(text: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")


_SMALL_WORDS = {"de", "del", "la", "las", "los", "el", "en", "y", "e", "o", "para", "a"}


def _title_es(text: str) -> str:
    words = text.lower().split()
    out = []
    for i, w in enumerate(words):
        if w in {"(ia)", "ia"}:
            out.append(w.upper())
        elif i > 0 and w in _SMALL_WORDS:
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


_PREFIX = re.compile(r"^(DIPLOMADO|ESPECIALIZACI[OÓ]N)\s+(EN\s+)?", re.IGNORECASE)


def short_programa(name: str | None) -> str:
    if not name:
        return "Sin programa"
    return _title_es(_PREFIX.sub("", name.strip()))


def _region(ubicacion: str | None) -> str:
    """'COLOMBIA - CUNDINAMARCA - BOGOTA' → 'Bogotá D.C.' / 'Antioquia'."""
    if not ubicacion:
        return "Sin dato"
    parts = [p.strip() for p in ubicacion.split(" - ") if p.strip()]
    if len(parts) < 2:
        return "Sin dato"
    country, dept = parts[0], parts[1]
    city = parts[2] if len(parts) > 2 else ""
    if _strip_accents(country).upper() != "COLOMBIA":
        return "Exterior"
    if "BOGOTA" in _strip_accents(dept).upper() or _strip_accents(city).upper() == "BOGOTA":
        return "Bogotá D.C."
    return _title_es(dept)


def _params(linea: str | None, periodo: str | None) -> dict[str, Any]:
    return {"linea": linea, "periodo": periodo}


# ── Consultas ──────────────────────────────────────────────────────────────


def filtros() -> dict[str, Any]:
    rows = fetch_all(
        f"""
        SELECT c.linea, c.periodo,
               MIN(c.fecha_corte) AS primer_corte,
               MAX(c.fecha_corte) AS ultimo_corte,
               COUNT(DISTINCT c.fecha_corte)::int AS cortes
        FROM {S}.carga c
        GROUP BY c.linea, c.periodo
        ORDER BY MAX(c.fecha_corte) DESC, c.linea
        """
    )
    return {"periodos": _clean(rows), "lineas": list(LINEAS)}


def tablero(linea: str | None, periodo: str | None) -> dict[str, Any]:
    p = _params(linea, periodo)

    kpis = _clean(fetch_all(_BASE_CTE + f"SELECT {_KPI_COLUMNS} FROM actual", p))[0]
    prev = _clean(fetch_all(_BASE_CTE + f"SELECT {_KPI_COLUMNS} FROM anterior", p))[0]

    alcance = _clean(
        fetch_all(
            _BASE_CTE
            + """
            SELECT linea, periodo, MAX(fecha_corte) AS ultimo_corte,
                   (SELECT MAX(fecha_corte) FROM cortes k
                     WHERE k.linea = c.linea AND k.periodo = c.periodo AND k.rk = 2) AS corte_anterior
            FROM cortes c GROUP BY linea, periodo ORDER BY ultimo_corte DESC
            """,
            p,
        )
    )

    evolucion = _clean(
        fetch_all(
            _BASE_CTE
            + """
            , mov AS (
                SELECT linea, periodo, fecha_corte, orden, est_pag_financiero,
                       LAG(est_pag_financiero) OVER w AS est_anterior,
                       ROW_NUMBER() OVER w AS n
                FROM f
                WINDOW w AS (PARTITION BY linea, periodo, orden ORDER BY fecha_corte)
            )
            SELECT f.linea, f.periodo, f.fecha_corte,
                   COUNT(*)::int AS ordenes,
                   COUNT(*) FILTER (WHERE f.est_pag_financiero = 'PAGO')::int AS pagadas,
                   SUM(f.val_pagado) AS vendido,
                   SUM(f.val_pagado) + SUM(f.val_becdtos) AS ingreso_neto,
                   (SELECT COUNT(*) FROM mov m
                     WHERE m.linea = f.linea AND m.periodo = f.periodo
                       AND m.fecha_corte = f.fecha_corte AND m.n = 1)::int AS nuevas,
                   (SELECT COUNT(*) FROM mov m
                     WHERE m.linea = f.linea AND m.periodo = f.periodo
                       AND m.fecha_corte = f.fecha_corte
                       AND m.est_anterior = 'NO PAGO' AND m.est_pag_financiero = 'PAGO')::int AS pasan_a_pago
            FROM f
            GROUP BY f.linea, f.periodo, f.fecha_corte
            ORDER BY f.fecha_corte, f.linea, f.periodo
            """,
            p,
        )
    )

    programas = _clean(
        fetch_all(
            _BASE_CTE
            + """
            SELECT linea, cod_unidad, MAX(programa) AS programa,
                   COUNT(*)::int AS ordenes,
                   COUNT(*) FILTER (WHERE est_pag_financiero = 'PAGO')::int AS pagadas,
                   SUM(val_pagado) AS vendido,
                   COALESCE(SUM(valor_orden) FILTER (WHERE est_pag_financiero <> 'PAGO'), 0) AS por_convertir
            FROM actual
            GROUP BY linea, cod_unidad
            ORDER BY ordenes DESC
            """,
            p,
        )
    )
    for row in programas:
        row["nombre"] = short_programa(row.pop("programa"))

    asesores = _clean(
        fetch_all(
            _BASE_CTE
            + f"""
            SELECT COALESCE(a.nombre, 'Sin asesor') AS asesor,
                   COUNT(*)::int AS ordenes,
                   COUNT(*) FILTER (WHERE x.est_pag_financiero = 'PAGO')::int AS pagadas,
                   SUM(x.val_pagado) AS vendido
            FROM actual x
            LEFT JOIN {S}.asesor a ON a.documento = x.asesor_crea
            GROUP BY 1
            ORDER BY ordenes DESC
            """,
            p,
        )
    )
    for row in asesores:
        row["asesor"] = _title_es(row["asesor"])


    estudiantes = fetch_all(
        _BASE_CTE
        + f"""
        , est AS (SELECT DISTINCT documento FROM actual)
        SELECT e.genero,
               CASE
                 WHEN e.fecha_nacimiento IS NULL THEN 'Sin dato'
                 WHEN date_part('year', age(e.fecha_nacimiento)) < 25 THEN '18–24'
                 WHEN date_part('year', age(e.fecha_nacimiento)) < 30 THEN '25–29'
                 WHEN date_part('year', age(e.fecha_nacimiento)) < 35 THEN '30–34'
                 WHEN date_part('year', age(e.fecha_nacimiento)) < 40 THEN '35–39'
                 WHEN date_part('year', age(e.fecha_nacimiento)) < 45 THEN '40–44'
                 WHEN date_part('year', age(e.fecha_nacimiento)) < 50 THEN '45–49'
                 ELSE '50+'
               END AS rango_edad,
               e.ubicacion
        FROM est
        JOIN {S}.estudiante e ON e.documento = est.documento
        """,
        p,
    )
    rangos = ["18–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50+"]
    edad: dict[str, dict[str, int]] = {r: {"F": 0, "M": 0} for r in rangos}
    genero = {"F": 0, "M": 0, "Otro": 0}
    regiones: dict[str, int] = {}
    for r in estudiantes:
        g = (r["genero"] or "").upper()
        g = g if g in ("F", "M") else "Otro"
        genero[g] += 1
        if r["rango_edad"] in edad and g in ("F", "M"):
            edad[r["rango_edad"]][g] += 1
        reg = _region(r["ubicacion"])
        regiones[reg] = regiones.get(reg, 0) + 1

    top_regiones = sorted(regiones.items(), key=lambda kv: kv[1], reverse=True)
    regiones_out = [{"region": k, "estudiantes": v} for k, v in top_regiones[:9]]
    resto = sum(v for _, v in top_regiones[9:])
    if resto:
        regiones_out.append({"region": "Otras regiones", "estudiantes": resto})

    return {
        "filtros": {"linea": linea, "periodo": periodo},
        "alcance": alcance,
        "kpis": kpis,
        "kpis_anterior": prev if prev["ordenes"] else None,
        "evolucion": evolucion,
        "programas": programas,
        "asesores": asesores,
        "genero": [{"genero": k, "estudiantes": v} for k, v in genero.items() if v],
        "edad": [{"rango": k, **v} for k, v in edad.items()],
        "regiones": regiones_out,
        "generado": datetime.now(timezone.utc).isoformat(),
    }
