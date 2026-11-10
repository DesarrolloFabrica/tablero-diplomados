"""API del Tablero de Diplomados (FastAPI)."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import queries, ventas
from .config import settings
from .db import ping

log = logging.getLogger("tablero")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Tablero Diplomados API", version="2.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1024)
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

_cache: dict[tuple, tuple[float, Any]] = {}
_cache_lock = threading.Lock()


def _cached(key: tuple, fn: Callable[[], Any]) -> Any:
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < settings.cache_ttl_seconds:
            return hit[1]
    value = fn()
    with _cache_lock:
        _cache[key] = (now, value)
    return value


def _run(fn: Callable[[], Any]) -> Any:
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        log.exception("Error consultando la base de datos")
        raise HTTPException(status_code=503, detail="No fue posible consultar la base de datos.") from exc


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        return {"status": "ok", "database": ping()}
    except Exception as exc:  # noqa: BLE001
        log.exception("Health check falló")
        return {"status": "degraded", "database": {"ok": False, "error": type(exc).__name__}}


@app.get("/api/filtros")
def filtros() -> dict[str, Any]:
    return _run(lambda: _cached(("filtros",), queries.filtros))


@app.get("/api/tablero")
def tablero(
    linea: str | None = Query(None, description="Diplomado | Especializacion"),
    periodo: str | None = Query(None, max_length=12, pattern=r"^[A-Za-z0-9]+$"),
) -> dict[str, Any]:
    if linea is not None and linea not in queries.LINEAS:
        raise HTTPException(status_code=422, detail=f"linea debe ser una de {list(queries.LINEAS)}")
    return _run(lambda: _cached(("tablero", linea, periodo), lambda: queries.tablero(linea, periodo)))


_CODE = r"^[A-Za-z0-9_-]+$"


@app.get("/api/ventas/filtros")
def ventas_filtros() -> dict[str, Any]:
    return _run(lambda: _cached(("ventas-filtros",), ventas.filtros))


@app.get("/api/ventas")
def ventas_tablero(
    linea: str | None = Query(None, description="Diplomado | Especializacion"),
    periodo: str | None = Query(None, max_length=12, pattern=_CODE),
    programa: str | None = Query(None, max_length=12, pattern=_CODE, description="cod_unidad"),
    semana: str | None = Query(None, max_length=8, pattern=r"^\d{4}-W\d{2}$", description="Semana ISO de creación"),
) -> dict[str, Any]:
    if linea is not None and linea not in queries.LINEAS:
        raise HTTPException(status_code=422, detail=f"linea debe ser una de {list(queries.LINEAS)}")
    key = ("ventas", linea, periodo, programa, semana)
    return _run(lambda: _cached(key, lambda: ventas.ventas(linea, periodo, programa, semana)))
