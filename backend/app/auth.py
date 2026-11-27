"""Inicio de sesión con Google y cookie de sesión firmada.

El navegador obtiene un ID token (Google Identity Services) y lo envía a
``POST /api/auth/google``. Aquí se verifica contra Google y, si el correo
pertenece al dominio permitido o a la lista explícita, se deja una cookie
httpOnly. Los endpoints de datos exigen esa cookie.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Any

from fastapi import HTTPException, Request

from .config import settings

log = logging.getLogger("tablero")

COOKIE = "tablero_session"
_MAX_AGE_SKEW = 30


def auth_block_reason() -> str | None:
    """Mensaje si el inicio de sesión no puede usarse. None cuando está listo o desactivado."""
    if settings.auth_disabled:
        return None
    if not settings.google_client_id:
        return "Falta GOOGLE_CLIENT_ID."
    if len(settings.session_secret) < 32:
        return "Falta SESSION_SECRET (mínimo 32 caracteres)."
    return None


def public_config() -> dict[str, Any]:
    reason = auth_block_reason()
    return {
        "enabled": reason is None and not settings.auth_disabled,
        "clientId": settings.google_client_id if reason is None else "",
        "hostedDomain": settings.auth_allowed_domain,
        "authDisabled": settings.auth_disabled,
        "reason": reason or "",
    }


def local_user() -> dict[str, str]:
    return {"email": "local@localhost", "name": "Desarrollo local", "picture": ""}


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def issue_session(user: dict[str, str]) -> str:
    payload = {
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture") or "",
        "exp": int(time.time()) + settings.session_ttl_seconds,
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(settings.session_secret.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64(sig)}"


def read_session(token: str | None) -> dict[str, str] | None:
    if not token or not settings.session_secret:
        return None
    body, dot, sig = token.partition(".")
    if not dot or not body or not sig:
        return None
    expected = hmac.new(settings.session_secret.encode(), body.encode(), hashlib.sha256).digest()
    try:
        given = _b64decode(sig)
    except (ValueError, TypeError):
        return None
    if not hmac.compare_digest(expected, given):
        return None
    try:
        payload = json.loads(_b64decode(body))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    exp = payload.get("exp")
    email = payload.get("email")
    if not isinstance(exp, int) or exp < int(time.time()) - _MAX_AGE_SKEW:
        return None
    if not isinstance(email, str) or "@" not in email:
        return None
    name = payload.get("name") if isinstance(payload.get("name"), str) else email
    picture = payload.get("picture") if isinstance(payload.get("picture"), str) else ""
    if picture and not picture.startswith("https://"):
        picture = ""
    return {"email": email, "name": name[:80], "picture": picture}


def cookie_secure(request: Request) -> bool:
    forwarded = request.headers.get("x-forwarded-proto", "")
    scheme = forwarded.split(",")[0].strip() if forwarded else request.url.scheme
    return scheme == "https"


def verify_google_credential(credential: str) -> dict[str, str]:
    reason = auth_block_reason()
    if reason:
        raise HTTPException(status_code=503, detail=reason)
    if not credential or len(credential) > 8192:
        raise HTTPException(status_code=401, detail="Credencial de Google vacía o inválida.")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        info = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.google_client_id)
    except ValueError as exc:
        log.info("Token de Google rechazado: %s", exc)
        raise HTTPException(status_code=401, detail="No se pudo validar el inicio de sesión de Google.") from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        log.exception("No se pudo contactar a Google para validar el token")
        raise HTTPException(
            status_code=503,
            detail="No fue posible contactar a Google para validar la sesión.",
        ) from exc

    email = str(info.get("email") or "").strip().lower()
    verified = info.get("email_verified")
    if verified not in (True, "true") or "@" not in email:
        raise HTTPException(status_code=403, detail="El correo de Google no está verificado.")

    if not settings.auth_allowed_emails:
        raise HTTPException(status_code=403, detail="El tablero no tiene cuentas autorizadas.")
    if email not in settings.auth_allowed_emails:
        raise HTTPException(status_code=403, detail="Esta cuenta no tiene acceso al tablero.")

    name = str(info.get("name") or email).strip()[:80]
    picture = str(info.get("picture") or "")
    if not picture.startswith("https://"):
        picture = ""
    return {"email": email, "name": name, "picture": picture}
