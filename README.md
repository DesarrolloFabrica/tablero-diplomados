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

## Despliegue en GCP

**Una sola vez** (secreto `DB_PASSWORD` y acceso de Cloud Run a ese secreto):

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

## Endpoints

| Ruta | Descripción |
|---|---|
| `GET /api/health` | estado de la API y de la conexión a la base |
| `GET /api/filtros` | líneas y periodos disponibles, con su rango de cortes |
| `GET /api/ventas/filtros` | opciones de filtros: líneas, periodos, diplomados, semanas |
| `GET /api/ventas?linea=&periodo=&programa=&semana=` | payload completo del tablero, sin recortar programas (KPIs, burbujas, desviación, edad, género, cascada, heatmap, trayectoria, flujo semanal) |
| `GET /api/tablero?linea=&periodo=` | resumen alterno por corte (KPIs, evolución, programas, asesores) |
| `GET /api/docs` | documentación interactiva (OpenAPI) |
