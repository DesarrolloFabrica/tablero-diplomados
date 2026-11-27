"""Configuración leída de variables de entorno.

Local: se cargan ``backend/.env`` y luego ``.env`` en la raíz del repo (el primero gana).
Cloud Run: las variables vienen del servicio y ``DB_PASSWORD`` desde Secret Manager.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env")

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip() != "":
            return value.strip().strip("'\"")
    return default


def _flag(name: str) -> bool:
    return _env(name, default="").lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    db_schema: str
    db_sslmode: str
    instance_connection_name: str
    cors_origins: list[str]
    cache_ttl_seconds: int
    google_client_id: str
    auth_allowed_domain: str
    auth_allowed_emails: frozenset[str]
    session_secret: str
    session_ttl_seconds: int
    auth_disabled: bool

    @property
    def schema_sql(self) -> str:
        """Nombre de schema validado y entrecomillado, seguro para interpolar en SQL."""
        return f'"{self.db_schema}"'

    @property
    def uses_socket(self) -> bool:
        return bool(self.instance_connection_name)

    def connect_kwargs(self) -> dict:
        if self.uses_socket:
            # Cloud Run monta el socket de Cloud SQL en /cloudsql/<conexión>.
            host = f"/cloudsql/{self.instance_connection_name}"
            sslmode = "disable"  # el conector ya cifra el canal
        else:
            host = self.db_host
            sslmode = self.db_sslmode
        return {
            "host": host,
            "port": self.db_port,
            "dbname": self.db_name,
            "user": self.db_user,
            "password": self.db_password,
            "sslmode": sslmode,
            "connect_timeout": 10,
            "application_name": "tablero-diplomados",
        }


def load_settings() -> Settings:
    schema = _env("DB_SCHEMA", default="ventas_ec")
    if not _IDENT.match(schema):
        raise ValueError(f"DB_SCHEMA inválido: {schema!r}")
    origins = _env("CORS_ORIGINS", default="")
    emails = _env("AUTH_ALLOWED_EMAILS", default="")
    # En Cloud Run (K_SERVICE) no se puede apagar el inicio de sesión por variable.
    auth_disabled = _flag("AUTH_DISABLED") and not os.getenv("K_SERVICE")
    return Settings(
        db_host=_env("DB_HOST", default="127.0.0.1"),
        db_port=int(_env("DB_PORT", default="5432")),
        db_name=_env("DB_NAME", default="core"),
        db_user=_env("DB_USER", "DB_USERNAME"),
        db_password=_env("DB_PASSWORD"),
        db_schema=schema,
        db_sslmode=_env("DB_SSLMODE", default="require"),
        instance_connection_name=_env("INSTANCE_CONNECTION_NAME"),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        cache_ttl_seconds=int(_env("CACHE_TTL_SECONDS", default="300")),
        google_client_id=_env("GOOGLE_CLIENT_ID"),
        auth_allowed_domain=_env("AUTH_ALLOWED_DOMAIN", default="cun.edu.co").lower(),
        auth_allowed_emails=frozenset(
            e.strip().lower() for e in emails.split(",") if e.strip() and "@" in e
        ),
        session_secret=_env("SESSION_SECRET"),
        session_ttl_seconds=int(_env("SESSION_TTL_SECONDS", default="43200")),
        auth_disabled=auth_disabled,
    )


settings = load_settings()
