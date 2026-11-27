"""API del Tablero de Diplomados (FastAPI)."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Callable

from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from . import queries, ventas
from .auth import (
    COOKIE,
    auth_block_reason,
    cookie_secure,
    issue_session,
    local_user,
    public_config,
    read_session,
    verify_google_credential,
)
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
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )


class GoogleLogin(BaseModel):
    credential: str = Field(min_length=1, max_length=8192)


def require_user(tablero_session: str | None = Cookie(default=None, alias=COOKIE)) -> dict[str, str]:
    if settings.auth_disabled:
        return local_user()
    reason = auth_block_reason()
    if reason:
        raise HTTPException(status_code=503, detail=reason)
    user = read_session(tablero_session)
    if not user:
        raise HTTPException(status_code=401, detail="Inicia sesión para ver el tablero.")
    return user


def _set_session_cookie(response: Response, request: Request, token: str) -> None:
    response.set_cookie(
        key=COOKIE,
        value=token,
        httponly=True,
        secure=cookie_secure(request),
        samesite="lax",
        max_age=settings.session_ttl_seconds,
        path="/",
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


@app.get("/api/auth/config")
def auth_config() -> dict[str, Any]:
    return public_config()


@app.get("/api/auth/me")
def auth_me(tablero_session: str | None = Cookie(default=None, alias=COOKIE)) -> dict[str, str]:
    if settings.auth_disabled:
        return local_user()
    reason = auth_block_reason()
    if reason:
        raise HTTPException(status_code=503, detail=reason)
    user = read_session(tablero_session)
    if not user:
        raise HTTPException(status_code=401, detail="Sin sesión.")
    return user


@app.post("/api/auth/google")
def auth_google(body: GoogleLogin, request: Request, response: Response) -> dict[str, str]:
    user = verify_google_credential(body.credential)
    _set_session_cookie(response, request, issue_session(user))
    return user


@app.post("/api/auth/logout")
def auth_logout(request: Request, response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE, path="/", samesite="lax", secure=cookie_secure(request))
    return {"ok": True}


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        return {"status": "ok", "database": ping()}
    except Exception as exc:  # noqa: BLE001
        log.exception("Health check falló")
        return {"status": "degraded", "database": {"ok": False, "error": type(exc).__name__}}


@app.get("/api/filtros")
def filtros(_: dict[str, str] = Depends(require_user)) -> dict[str, Any]:
    return _run(lambda: _cached(("filtros",), queries.filtros))


@app.get("/api/tablero")
def tablero(
    linea: str | None = Query(None, description="Diplomado | Especializacion"),
    periodo: str | None = Query(None, max_length=12, pattern=r"^[A-Za-z0-9]+$"),
    _: dict[str, str] = Depends(require_user),
) -> dict[str, Any]:
    if linea is not None and linea not in queries.LINEAS:
        raise HTTPException(status_code=422, detail=f"linea debe ser una de {list(queries.LINEAS)}")
    return _run(lambda: _cached(("tablero", linea, periodo), lambda: queries.tablero(linea, periodo)))


_CODE = r"^[A-Za-z0-9_-]+$"


@app.get("/api/ventas/filtros")
def ventas_filtros(_: dict[str, str] = Depends(require_user)) -> dict[str, Any]:
    return _run(lambda: _cached(("ventas-filtros",), ventas.filtros))


@app.get("/api/ventas")
def ventas_tablero(
    linea: str | None = Query(None, description="Diplomado | Especializacion"),
    periodo: str | None = Query(None, max_length=12, pattern=_CODE),
    programa: str | None = Query(None, max_length=12, pattern=_CODE, description="cod_unidad"),
    semana: str | None = Query(None, max_length=8, pattern=r"^\d{4}-W\d{2}$", description="Semana ISO de creación"),
    _: dict[str, str] = Depends(require_user),
) -> dict[str, Any]:
    if linea is not None and linea not in queries.LINEAS:
        raise HTTPException(status_code=422, detail=f"linea debe ser una de {list(queries.LINEAS)}")
    key = ("ventas", linea, periodo, programa, semana)
    return _run(lambda: _cached(key, lambda: ventas.ventas(linea, periodo, programa, semana)))
