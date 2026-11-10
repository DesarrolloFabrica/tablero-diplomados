"""Pool de conexiones PostgreSQL (solo lectura)."""

from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

from .config import settings

_pool: ThreadedConnectionPool | None = None
_lock = threading.Lock()


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                _pool = ThreadedConnectionPool(1, 5, **settings.connect_kwargs())
    return _pool


@contextmanager
def connection() -> Iterator[psycopg2.extensions.connection]:
    pool = _get_pool()
    conn = pool.getconn()
    broken = False
    try:
        conn.set_session(readonly=True, autocommit=True)
        yield conn
    except psycopg2.OperationalError:
        broken = True
        raise
    finally:
        pool.putconn(conn, close=broken or conn.closed != 0)


def fetch_all(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params or {})
        return [dict(r) for r in cur.fetchall()]


def ping() -> dict[str, Any]:
    rows = fetch_all(
        f"SELECT current_database() AS database, COUNT(*)::int AS cargas FROM {settings.schema_sql}.carga"
    )
    return {"ok": True, "schema": settings.db_schema, **rows[0]}
