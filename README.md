# Tablero Diplomados

Tablero de ventas de educación continua (diplomados y especializaciones) de la CUN.
Muestra el avance de las órdenes de matrícula en cada **corte semanal**: registradas, pagadas,
valor vendido, becas, conversión por programa y asesor, y perfil de los estudiantes.

```
┌──────────────────────┐   /api/*   ┌──────────────────────┐  socket  ┌───────────────────────────┐
│ diplomados-frontend  │ ─────────▶ │ diplomados-backend   │ ───────▶ │ Cloud SQL core-database   │
│ React + nginx        │   proxy    │ FastAPI (solo lectura)│ cr-conn. │ base core · schema        │
│ Cloud Run            │            │ Cloud Run            │ VPC +SSL │ ventas_ec                 │
└──────────────────────┘            └──────────────────────┘          └───────────────────────────┘
       it-fab-contenido-edu-4 · us-central1                              it-fab-contenido-edu-6
```

El navegador solo habla con el frontend. nginx reenvía `/api/*` al backend, así que no hay CORS
ni URLs fijas en el código. El backend es de **solo lectura** y **devuelve únicamente agregados**:
nunca nombres, documentos ni datos de contacto de estudiantes.

El tablero pide **inicio de sesión con Google**. Solo entran los correos escritos en
`AUTH_ALLOWED_EMAILS`. Pertenecer a `@cun.edu.co` no alcanza. La API de datos
responde 401 si no hay cookie de sesión.

## Estructura

```
backend/            API FastAPI
  app/config.py     variables de entorno (.env local / Cloud Run)
  app/db.py         pool PostgreSQL de solo lectura
  app/queries.py    consultas sobre ventas_ec (definición de cada métrica)
  app/main.py       endpoints + caché en memoria
  Dockerfile
frontend/           SPA React + Vite + Chart.js (misma estética y componentes del tablero legacy)
  src/App.jsx       layout: barra CUN, filtros, KPIs y gráficos
  src/components/   un componente por gráfico (burbujas, desviación, edad, género, cascada, heatmap…)
  src/context/      filtros + carga de datos desde /api/ventas
  src/data/         paleta/semáforo y datos en vivo (live bindings)
  nginx/            plantilla nginx (proxy /api → backend)
  Dockerfile
cloudbuild.yaml     build + despliegue de los dos servicios
scripts/setup-gcp.ps1  configuración única de IAM y secretos
```

## Datos (`core.ventas_ec`)

| Tabla / vista | Contenido |
|---|---|
| `carga` | un registro por archivo de corte cargado (fecha_corte, periodo, línea) |
| `orden_foto` | estado de cada orden financiera en cada corte |
| `estudiante` | datos maestros (género, nacimiento, ubicación) |
| `programa` | catálogo de diplomados y especializaciones |
| `asesor` | asesores comerciales |

**Definiciones** (en `backend/app/queries.py`):

- **Corte actual**: la `fecha_corte` más reciente de cada (línea, periodo). Los KPIs suman el corte actual de cada periodo que pase los filtros.
- **Órdenes pagadas**: `est_pag_financiero = 'PAGO'`. **Conversión** = pagadas / registradas.
- **Valor vendido**: `SUM(val_pagado)`. Es el valor cubierto de las órdenes pagadas e incluye becas.
- **Becas y descuentos**: `−SUM(val_becdtos)`. **Ingreso neto** = vendido − becas.
- **Por convertir**: `SUM(valor_orden)` de las órdenes sin pagar (en SINU esas órdenes no tienen valor liquidado).
- **Movimiento entre cortes**: órdenes que aparecen por primera vez y órdenes que pasan de «NO PAGO» a «PAGO».

## Desarrollo local

Requisitos: Python 3.12+, Node 20+, y tu IP autorizada en la instancia `core-database`.

```powershell
# 1. Variables: copia backend/.env.example → backend/.env (o usa el .env de la raíz)
# 2. Backend
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8787     # http://localhost:8787/api/docs

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev                                              # http://localhost:5173
```

Vite reenvía `/api` a `localhost:8787` (se cambia con `VITE_API_PROXY`).

Para ver datos en local sin Google, agrega `AUTH_DISABLED=1` en `backend/.env`.
Esa variable se ignora en Cloud Run. Con Google en local hace falta `GOOGLE_CLIENT_ID`,
`SESSION_SECRET` (32+ caracteres) y `http://localhost:5173` como origen JavaScript autorizado.

## Despliegue en GCP

**Una sola vez** (secreto `DB_PASSWORD`, secreto de la cookie `diplomados-session-secret`
y acceso de Cloud Run a ambos):

```powershell
.\scripts\setup-gcp.ps1
```

**Cada despliegue:**

```powershell
gcloud builds submit --config cloudbuild.yaml --project it-fab-contenido-edu-4
```

El log termina con la URL del tablero. Para desplegar automáticamente con cada push a `main`,
crea un trigger de Cloud Build conectado a este repositorio que use `cloudbuild.yaml`
(Cloud Build → Activadores → Conectar repositorio → GitHub).

### Variables del backend

| Variable | Local | Cloud Run |
|---|---|---|
| `DB_HOST` / `DB_PORT` | IP pública de la instancia | la misma IP, saliendo por el conector VPC `cr-connector` (IP fija autorizada) |
| `DB_SSLMODE` | `require` | `require` |
| `DB_NAME`, `DB_USER` (o `DB_USERNAME`), `DB_SCHEMA` | `.env` | `--set-env-vars` |
| `DB_PASSWORD` | `.env` | Secret Manager `diplomados-db-password` |
| `CACHE_TTL_SECONDS` | opcional (300) | opcional |
| `GOOGLE_CLIENT_ID` | cliente OAuth web | `--substitutions=_GOOGLE_CLIENT_ID=…` en el build |
| `AUTH_ALLOWED_DOMAIN` | sugerencia del botón de Google (`cun.edu.co`) | igual (sustitución `_AUTH_ALLOWED_DOMAIN`) |
| `AUTH_ALLOWED_EMAILS` | correos que pueden ver el tablero, separados por coma | obligatorio en el servicio |
| `SESSION_SECRET` | `.env` (32+ caracteres) | Secret Manager `diplomados-session-secret` |

Cliente OAuth (consola de Google Cloud → APIs y servicios → Credenciales → ID de cliente OAuth, tipo **Aplicación web**):

- Orígenes de JavaScript autorizados: `http://localhost:5173` y la URL `https://` del servicio `diplomados-frontend`.
- No hace falta URI de redirección: el botón de Google devuelve un ID token y el backend lo verifica.

El backend sale a internet por el conector VPC (`--vpc-egress=all-traffic`). Esa salida tiene que poder llegar a `https://www.googleapis.com` para validar el token (Cloud NAT, si el conector no tiene ruta directa).

## Endpoints

| Ruta | Descripción |
|---|---|
| `GET /api/auth/config` | cliente de Google y dominio permitido (público) |
| `GET /api/auth/me` | sesión actual |
| `POST /api/auth/google` | verifica el ID token y deja la cookie `tablero_session` |
| `POST /api/auth/logout` | borra la cookie |
| `GET /api/health` | estado de la API y de la conexión a la base |
| `GET /api/filtros` | líneas y periodos disponibles, con su rango de cortes |
| `GET /api/ventas/filtros` | opciones de filtros: líneas, periodos, diplomados, semanas |
| `GET /api/ventas?linea=&periodo=&programa=&semana=` | payload completo del tablero, sin recortar programas (KPIs, burbujas, desviación, edad, género, cascada, heatmap, trayectoria, flujo semanal) |
| `GET /api/tablero?linea=&periodo=` | resumen alterno por corte (KPIs, evolución, programas, asesores) |
| `GET /api/docs` | documentación interactiva (OpenAPI) |
