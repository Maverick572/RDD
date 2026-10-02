# RoadSense AI

RoadSense AI is a road-condition monitoring application for Navi Mumbai. This
repository contains a React/TypeScript web interface and a Python FastAPI
service that connects to PostgreSQL/PostGIS, runs YOLO road-damage inference,
and stores annotated images in Supabase Storage.

This README describes the implementation currently checked into this repository.
The frontend is only partially connected to the FastAPI service: several pages
use local mock data, while the GIS dashboard, road inventory, defect registry,
gallery, and media detection pages make direct HTTP requests to the backend.

## What Is Implemented

| Area | Current implementation |
|---|---|
| Frontend | React 19, TypeScript, TanStack Start/Router, Vite, Tailwind CSS |
| Maps | Leaflet and OpenStreetMap tiles, with ward and road GeoJSON from the API |
| Charts | Recharts components in analytics and road-profile screens |
| Backend | FastAPI application in `backend/main.py` |
| Database | PostgreSQL with PostGIS functions used by the API and import scripts |
| Detection | Ultralytics YOLO model loaded from `ai/models/best.pt` |
| Image storage | Supabase Storage bucket named `road-images` |
| GIS seed data | Navi Mumbai ward GeoJSON and roads fetched from OpenStreetMap Overpass |

## Current Scope And Limitations

- The live database endpoints cover wards, roads, defects, dashboard data,
  nearest-road lookup, image detection, and ward-scoped maintenance workflows.
- There is no backend `/analytics/summary`, `/roads/{id}`, `/media/upload`, or
  `/analysis` endpoint in the current FastAPI application.
- The frontend routes `/analytics` and `/roads/$id` use service modules backed
  by in-memory mock data.
- `roads.service.ts`, `defects.service.ts`, `maintenance.service.ts`,
  `media.service.ts`, and `admin.service.ts` are not general API clients; they
  read and update the corresponding files in `frontend/src/mock-data/`.
- The media detection screen sends a single image to `POST /detect`. It is not
  the video-upload / asynchronous-analysis API described in older documentation.
- There is no checked-in Python requirements file, SQL schema/migration,
  Docker configuration, or frontend test script at the time this README was
  written.

## Screens And Routes

| Browser route | Screen | Data source in this checkout |
|---|---|---|
| `/` | GIS dashboard | FastAPI dashboard and ward endpoints |
| `/roads/` | Ward road inventory and map | FastAPI ward and road endpoints |
| `/roads/$id` | Road profile | Mock road, defect, and maintenance services |
| `/defects` | Ward defect registry | FastAPI ward defects and nearest-road endpoint |
| `/gallery` | Defect-image gallery | FastAPI ward defects and nearest-road endpoint |
| `/media` | Image upload and detection | FastAPI nearest-road and detection endpoints; road service data is mock-backed |
| `/maintenance` | Ward-scoped repair scheduling, active repair management, and history | FastAPI ward, road, and maintenance endpoints |
| `/analytics` | Analytics charts | In-memory mock analytics, roads, defects, and maintenance services |

The route definitions live in `frontend/src/routes/`. TanStack's generated route
tree is `frontend/src/routeTree.gen.ts`; it is generated from those route files.

## Repository Layout

```text
.
|-- ai/
|   `-- models/
|       |-- best.pt                  # Model loaded by backend/inference.py
|       |-- best (2).pt              # Present in the workspace; not selected by code
|       `-- mobilenet/               # Additional saved-model files; not selected by code
|-- backend/
|   |-- main.py                      # FastAPI app, static mounts, router registration
|   |-- detect.py                    # POST /detect workflow
|   |-- inference.py                 # YOLO inference and annotated output
|   |-- calculate_rhi.py             # Road health calculation and database update
|   |-- severity.py                  # Per-detection numeric severity score
|   |-- metadata.py                  # Image EXIF GPS extraction
|   |-- storage.py                   # Temporary original-image save
|   |-- cleanup.py                   # Removes files in uploads/ and outputs/
|   |-- supabase_storage.py          # Annotated-image upload
|   |-- find_nearest.py              # Nearest-road lookup and endpoint
|   |-- dashboard.py                 # Dashboard API endpoints
|   |-- ward_roads.py                # Roads intersecting a ward
|   |-- ward_defects.py              # Ward and ward-defect endpoints
|   |-- import_roads.py              # Imports road lines from OpenStreetMap
|   |-- import_wards.py              # Imports the ward GeoJSON into PostgreSQL
|   |-- Navi_Mumbai_Wards_with_nodes.geojson
|   `-- wards_navi_mumbai.geojson
|-- frontend/
|   |-- package.json                 # Frontend scripts and dependencies
|   |-- package-lock.json            # npm lockfile
|   |-- bun.lock                     # Bun lockfile
|   |-- vite.config.ts
|   `-- src/
|       |-- routes/                  # TanStack file-based pages
|       |-- services/                # In-memory mock-data services
|       |-- mock-data/               # Demo roads, defects, media, and tasks
|       |-- components/              # Layout, map, road, modal, and UI components
|       |-- hooks/
|       |-- lib/
|       `-- types/
|-- uploads/                         # Temporary original images; contents are ignored by Git
|-- outputs/                         # Temporary annotated images; contents are ignored by Git
`-- .env                             # Local secrets; ignored by Git, not included in this README
```

Some folders contain test data or additional model artifacts not used by the
main application path. The backend model path in source is specifically
`ai/models/best.pt`.

## Prerequisites

### Frontend

- Node.js version supported by the Vite 8 toolchain. An active Node.js LTS
  release is recommended.
- npm, included with Node.js. The repository has a `frontend/package-lock.json`.
- Network access for package installation and OpenStreetMap tiles.

### Backend

- Python 3.10 or newer. The source uses Python's `X | None` type syntax.
- A PostgreSQL database with PostGIS installed and enabled.
- The tables and columns described in [Database Requirements](#database-requirements).
- A valid Supabase project and Storage credentials for annotated-image uploads.
- The YOLO weights file `ai/models/best.pt`.
- Network access to Supabase for detection image uploads. Road import also
  requires access to one of the configured OpenStreetMap Overpass endpoints.

PyTorch installation can vary by operating system and by CPU/GPU configuration.
Use a PyTorch build compatible with the Python version and hardware, then
install Ultralytics and the remaining backend packages.

## Configuration

The backend reads environment values through `python-dotenv`. Create a private
`.env` file in the repository root before starting the backend from that root.
There is no checked-in `.env.example` file.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_KEY=YOUR_SERVER_SIDE_SUPABASE_KEY
```

Configuration notes:

- `DATABASE_URL` is used by the road, ward, dashboard, detection, and import
  code to connect to PostgreSQL.
- `SUPABASE_URL` and `SUPABASE_KEY` are used by `backend/supabase_storage.py`.
- Keep real values private. Never commit `.env`, paste its values into issues,
  or put a server-side Supabase key into frontend code.
- The root `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, and
  `.dev.vars`. Check `git status` before committing configuration changes.
- The frontend currently hardcodes `http://localhost:8000` in the route files
  that call the backend. `VITE_API_URL` is not currently used for those calls.
- `backend/main.py` enables permissive CORS for development. Restrict origins
  before deploying the API publicly.

## Install And Run The Backend

Run backend commands from the repository root so dotenv loads the root `.env`
and the relative static directories resolve as expected.

### Create A Virtual Environment

PowerShell:

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

If PowerShell blocks activation, use the Python executable in `.venv\Scripts`
directly or follow your organization's PowerShell execution policy.

### Install Python Packages

There is no pinned backend dependency manifest in this repository. The imports
in the API and import scripts require the packages below. Install PyTorch using
the instructions matching your machine; Ultralytics uses PyTorch for inference.

```bash
python -m pip install fastapi "uvicorn[standard]" python-multipart python-dotenv psycopg2-binary supabase ultralytics opencv-python pillow numpy requests
```

`python-multipart` is needed for FastAPI's multipart file upload. If the command
cannot install a compatible PyTorch wheel through the Ultralytics dependency,
install the appropriate PyTorch build first and then rerun the package command.

### Start FastAPI

```bash
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Useful local URLs:

- API root: `http://localhost:8000/`
- Health check: `http://localhost:8000/health`
- Interactive OpenAPI docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

The API imports the YOLO model during application startup. A missing/incompatible
model or missing Python package can prevent startup. The Supabase client is also
constructed at import time, so valid Supabase configuration is required for the
current application startup path.

## Install And Run The Frontend

Open a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. The configured Vite/TanStack setup may select
a port based on availability; use the actual URL from the terminal output.

Available frontend scripts from `frontend/package.json`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Build using the development mode |
| `npm run preview` | Preview a built frontend |
| `npm run lint` | Run ESLint across the frontend |
| `npm run format` | Run Prettier in write mode across the frontend |

There is currently no `npm test` script. `npm run format` rewrites files; review
the resulting diff before accepting it.

## Database Requirements

The repository contains SQL queries and import scripts, but no schema migration
or `CREATE TABLE` script. Provision the database before running either importer
or the API. PostGIS must be available because the code uses geography values,
`ST_Intersects`, `ST_Distance`, `ST_MakeEnvelope`, and GeoJSON conversion.

The tables/columns referenced by the current Python code are:

| Table | Referenced columns | Notes |
|---|---|---|
| `roads` | `id`, `name`, `type`, `rhi`, `geometry`, `timestamp` | `geometry` must support the geography operations used in the code. `rhi` is updated after successful detection. |
| `wards` | `id`, `ward_number`, `node`, `municipal_corporation`, `geometry` | Ward geometry is used for spatial joins and map output. |
| `defects` | `id`, `road_id`, `type`, `confidence`, `severity`, `location`, `image_url`, `timestamp` | `location` is used for spatial lookups; `severity` stores a numeric score from detection. |
| `maintenance` | `id`, `road_id`, `scheduled_date`, `progress`, `status`, `maintenance_type` | Active repair records. |
| `maintenance_history` | `id`, `road_id`, `start_date`, `completed_date`, `maintenance_type` | A record is inserted here when an active repair is completed. |

The import and API code expects database-generated IDs for inserted roads,
wards, and defects. The geometry columns must accept the PostGIS casts and
functions in the source; the repository does not prescribe column types or
indexes in a migration. Review the actual SQL in `backend/` when creating or
changing the schema.

Do not treat the table list above as a complete production schema definition.
It is an inventory of the fields used by this checkout. Column nullability,
constraints, indexes, ownership, grants, backups, and retention policy must be
decided for the target database.

## Importing GIS Data

The importers are standalone Python modules. They require `DATABASE_URL` and a
compatible pre-created database schema.

### Ward Import

The importer reads `backend/Navi_Mumbai_Wards_with_nodes.geojson`:

```bash
python -m backend.import_wards
```

It reads each GeoJSON feature and inserts `ward_number`, `node`, the fixed
municipality label `NMMC`, and the feature geometry. The source property used
for the ward number is `sourcewardcode`; if that property is absent, the script
falls back to a sequential number.

**Destructive behavior:** each run executes
`TRUNCATE TABLE wards RESTART IDENTITY CASCADE` before inserting. This removes
existing ward rows and may cascade to related tables. Do not run it against a
populated database without understanding the foreign keys and cascade effects.
Take a backup and verify the target database before running the command.

### Road Import

The road importer requests highway ways in a bounding box around Navi Mumbai
from a list of public Overpass API endpoints:

```bash
python -m backend.import_roads
```

It converts OSM ways with at least two geometry points into line strings and
inserts them in batches. It selects the OSM `name`, then `ref`, then
`"Unnamed Road"`; `highway` is stored as the road type. The code does not
truncate roads or deduplicate repeated imports. Running it again can add
duplicate road segments unless the database has an appropriate policy.

Overpass is a public service and may throttle or reject large requests. The
script tries its configured endpoints in sequence and fails if none returns
data. It does not provide a local cache or a rollback of already committed
batches.

## Backend API

The FastAPI app is created in `backend/main.py`. The routers included there
provide the endpoints listed below. FastAPI's `/docs` page exposes the live
OpenAPI schema for the running server.

### Basic Endpoints

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/` | Returns a service-running message. |
| `GET` | `/health` | Returns `{"status":"healthy"}` when the process handles the request. |

### Wards And Roads

#### `GET /wards`

Returns wards with `id`, `ward_number`, `node`, `municipal_corporation`,
`defect_count`, and GeoJSON `geometry` fields. Defect counts are computed by
spatially joining defects to ward boundaries.

```json
{
  "wards": [
    {
      "id": 1,
      "ward_number": 1,
      "node": "Nerul",
      "municipal_corporation": "NMMC",
      "defect_count": 0,
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": []
      }
    }
  ]
}
```

The example demonstrates the response shape; real IDs, ward values, geometries,
and defect counts come from the database.

#### `GET /wards/{ward_number}/roads`

Returns road segments spatially intersecting the requested ward. The response
contains the requested `ward_number` and a `roads` array. Each road includes
`id`, `name`, `type`, `rhi`, and parsed GeoJSON `geometry`. Roads are ordered by
RHI descending with null values last.

#### `GET /roads/nearest`

Query parameters:

| Name | Required | Default | Meaning |
|---|---:|---:|---|
| `lat` | Yes | - | Latitude in decimal degrees. |
| `lng` | Yes | - | Longitude in decimal degrees. |
| `threshold` | No | `100` | Maximum accepted distance in metres. |

Returns `{"road": ..., "distance": ...}` when a road is within the threshold;
otherwise it returns `{"road": null}`. The road object contains `id`, `name`,
`type`, `rhi`, GeoJSON `geometry`, and distance in metres. The media page uses
this endpoint to show the road near the selected coordinates.

### Ward Defects

#### `GET /wards/{ward_number}/defects`

Returns defects spatially within a ward, newest first. Each item includes:

- `id` and `road_id`
- `type`, `confidence`, and numeric `severity`
- `latitude` and `longitude`
- `image_url` and `timestamp`

The top-level response is `{"ward_number": ..., "defects": [...]}`. Defect
location is derived from the PostGIS point stored in `defects.location`.

### Maintenance

Maintenance endpoints are scoped to roads intersecting the selected ward:

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/wards/{ward_number}/maintenance` | Lists active repair records with road details. |
| `GET` | `/wards/{ward_number}/maintenance/history` | Lists completed repair records from `maintenance_history`. |
| `POST` | `/maintenance/schedule` | Creates an active repair using `road_id`, `scheduled_date`, and `maintenance_type`. |
| `PUT` | `/maintenance/{maintenance_id}` | Updates a repair's `status` and percentage `progress`. |
| `POST` | `/maintenance/{maintenance_id}/complete` | Moves the active repair into history and removes it from `maintenance`. |

### Dashboard

#### `GET /dashboard/summary`

Returns aggregate counts and summary arrays:

- `total_wards`, `total_roads`, and `total_defects`
- `wards_with_defects`
- `defects_by_severity` and `defects_by_type`
- `top_distress_wards`
- `recent_defects`

The endpoint queries the database each time. Type labels are mapped in
`backend/dashboard.py`; unknown types are converted from underscore names to
title case.

#### `GET /dashboard/defects`

Returns every defect for the dashboard map, including its road name, road type,
and road RHI when a matching road exists. The response contains `defects` and
`count`.

#### `GET /dashboard/roads`

Returns road geometries intersecting a requested bounding box.

| Query parameter | Required | Default | Limit |
|---|---:|---:|---|
| `min_lat` | Yes | - | - |
| `min_lng` | Yes | - | - |
| `max_lat` | Yes | - | - |
| `max_lng` | Yes | - | - |
| `limit` | No | `500` | Maximum accepted value: `1500`. |

The response contains `roads` and `count`. The dashboard currently requests a
limit of 400 when the map is zoomed in.

### Image Detection

#### `POST /detect`

Accepts one image in `multipart/form-data` under the field name `file`.
Optional query parameters `lat` and `lng` provide a location when the image has
no usable GPS EXIF metadata.

```bash
curl -X POST \
  -F "file=@./road-inspection.jpg" \
  "http://localhost:8000/detect?lat=19.0330&lng=73.0297"
```

On success, the response contains these fields:

```json
{
  "filename": "road-inspection.jpg",
  "location": {
    "latitude": 19.033,
    "longitude": 73.0297
  },
  "road": {
    "id": 1,
    "name": "Example Road",
    "type": "road",
    "rhi": 80.12,
    "geometry": null,
    "distance": 0.0
  },
  "defects": [
    {
      "id": 1,
      "type": "D40",
      "confidence": 0.91,
      "severity": 42.7
    }
  ],
  "annotated_image": "https://PROJECT.supabase.co/storage/v1/object/public/road-images/defects/example.jpg"
}
```

The values above are illustrative; IDs, scores, road data, and public image URL
are generated from the model and configured services.

Current early error objects include `{"error":"Location not found"}`,
`{"error":"Defects not found"}`, and `{"error":"Image upload failed"}`.
These are returned by the handler as JSON objects. A request that has no EXIF
GPS must include both `lat` and `lng`.

## Detection And RHI Flow

For a successful detection request, the backend performs the following steps:

1. Saves the original upload under the repository's `uploads/` directory.
2. Attempts to read GPS coordinates from the image's EXIF metadata.
3. Uses the supplied `lat` and `lng` if the image has no GPS coordinates.
4. Runs the model in `backend/inference.py` with a confidence threshold of
   `0.25`.
5. Keeps detections whose model class is one of `D10`, `D20`, `D30`, or `D40`.
6. Saves an annotated JPEG under `outputs/`.
7. Finds the nearest road within the default 100-metre threshold.
8. Uploads the annotated image to the Supabase `road-images` bucket.
9. Calculates a numeric severity score for each detection and inserts the
   defect rows using one database connection and transaction.
10. Recalculates the road RHI using all defects currently associated with that
    road, updates `roads.rhi`, and commits the transaction.
11. Returns the filename, location, road, inserted defects, and image URL.

`backend/calculate_rhi.py` calculates:

```text
N = count of all defects for the road
S = sum of numeric severity for those defects (NULL values count as zero)

damage_score = (N / (N + 5)) * 40 + (S / (S + 200)) * 60
RHI = clamp(100 - damage_score, 0, 100)
```

A road with no defects receives an RHI of `100`. The recalculation runs after
new rows are inserted, using the same transaction, so the new detections are
included in the aggregate. The returned `road.rhi` is the newly calculated
value. This logic updates the existing `roads.rhi` field; it does not require
an extra table or column.

`backend/severity.py` calculates a numeric image-based score using the model
class, confidence, bounding-box footprint and shape, and image contrast/edge
features. The score is rounded to two decimals before insertion. This numeric
score is the value consumed by the RHI calculation.

There is a current severity-format mismatch to keep in mind: detection writes
the numeric `severity_score` to `defects.severity`, while
`backend/dashboard.py` groups `defects.severity` using text values such as
`high`, `medium`, and `low`. Newly detected numeric rows therefore do not map
into those dashboard severity buckets as written. Align the schema and data
contract before treating that chart as a reliable classification.

## Image Storage And Cleanup

- `backend/storage.py` writes the incoming image to `uploads/` for EXIF reading,
  inference, and severity calculation.
- `backend/inference.py` writes the annotated result to `outputs/`.
- `backend/supabase_storage.py` uploads the annotated result to the Supabase
  bucket `road-images` under a `defects/` key and returns a public URL.
- The Supabase helper attempts to create the bucket if it does not exist and
  attempts to make it public. Bucket setup errors are suppressed by the current
  helper; verify the bucket and permissions in Supabase if uploads fail.
- `backend/detect.py` calls `cleanup_directories()` from a `finally` block.
  Consequently, it attempts to remove all local contents of both `uploads/` and
  `outputs/` after each detection request, including error paths. The directories
  themselves remain in place.
- The cleanup is global to those two directories, not limited to one request's
  files. Concurrent requests or multiple server workers can remove another
  request's temporary files. The current implementation is intended for a
  single local detection at a time.
- The saved defect `image_url` points to Supabase, not to a durable file in
  `outputs/`. The local result file is temporary.

The FastAPI app mounts `/uploads` and `/outputs` as static directories, but the
detection cleanup removes their contents after each request. Do not rely on
those local URLs as persistent media storage.

## Frontend Data Sources

The frontend currently has two data paths.

### Pages Calling FastAPI Directly

| Page | Requests made by the current route |
|---|---|
| Dashboard `/` | `/dashboard/summary`, `/wards`, `/dashboard/defects`, and `/dashboard/roads` for the visible map bounds. |
| Road inventory `/roads/` | `/wards` and `/wards/{ward_number}/roads`. |
| Defect registry `/defects` | `/wards`, `/wards/{ward_number}/defects`, and `/roads/nearest` when a defect is selected. |
| Gallery `/gallery` | `/wards`, `/wards/{ward_number}/defects`, and `/roads/nearest` when an image is selected. |
| Media `/media` | `/roads/nearest` and `/detect`; it also calls the mock-backed road service for some road data. |

These routes define `API_BASE` as `http://localhost:8000` or call that URL
directly. Changing the API host currently requires editing the relevant route
source; setting `VITE_API_URL` alone will not reconfigure these requests.

### Pages Using Mock Services

The following service modules read data from `frontend/src/mock-data/`:

| Service module | Source data | State behavior |
|---|---|---|
| `admin.service.ts` | `admin.ts` | Returns local state, district, city, and hierarchy data. |
| `roads.service.ts` | `roads.ts`, `images.ts` | Filters local roads and returns mock inspections and images. |
| `defects.service.ts` | `defects.ts`, `roads.ts` | Filters defects and updates status in memory. |
| `maintenance.service.ts` | `maintenance.ts` | Creates and updates tasks in memory. |
| `media.service.ts` | `media.ts` | Simulates uploads and analysis results in memory. |
| `analytics.service.ts` | Other mock services | Computes summary data and trends from mock records. |

In-memory service changes are lost on page reload. The presence of a service
module does not mean its data is stored by FastAPI or PostgreSQL.

## Local Troubleshooting

### Frontend Shows A Network Error

- Confirm the backend is running at `http://localhost:8000`.
- Open `http://localhost:8000/health` and check for a healthy response.
- Check the browser console and the backend terminal for the failing endpoint.
- The currently live-connected pages use a hardcoded localhost base URL.
- Confirm CORS and network access if the frontend and backend are on different
  hosts or ports.

### Backend Does Not Start

- Activate the intended virtual environment and install the backend packages.
- Confirm `.env` is in the repository root and `DATABASE_URL` is valid.
- Confirm `SUPABASE_URL` and `SUPABASE_KEY` are configured; storage creates its
  client while importing the backend app.
- Confirm `ai/models/best.pt` exists and the installed PyTorch/Ultralytics build
  can load it.
- Inspect the first traceback from `uvicorn`; import errors happen before the
  health endpoint can serve requests.

### Database Queries Fail

- Confirm PostgreSQL is reachable from the backend environment.
- Confirm PostGIS is enabled and the required `roads`, `wards`, and `defects`
  tables already exist.
- Compare the deployed columns with the SQL used by the relevant endpoint.
- Confirm the database user has the required `SELECT`, `INSERT`, `UPDATE`, and
  importer permissions.
- Check coordinate order: API and SQL calls construct points as longitude,
  latitude, while API query parameters are named `lat` and `lng`.

### Detection Returns An Error

- If GPS extraction fails, pass both query parameters `lat` and `lng`.
- Confirm the uploaded file is a readable image and the model returns at least
  one allowed class (`D10`, `D20`, `D30`, `D40`).
- Confirm a road exists within 100 metres of the selected coordinate. The
  detection route uses the default nearest-road threshold.
- Confirm Supabase credentials, Storage availability, and the `road-images`
  bucket configuration.
- Confirm the database schema supports the defect insert and the RHI update.
- The current handler hides the exception from the image-upload step and returns
  a generic `Image upload failed` error; inspect backend-side logging or add
  diagnostic logging before relying on this in production.

### Ward Or Road Lists Are Empty

- Confirm ward GeoJSON has been imported and the endpoint can query `wards`.
- Confirm road lines exist and spatially overlap the selected ward.
- The road inventory uses `ST_Intersects`; roads outside ward polygons are not
  returned for that ward.
- Check that the map is selecting the expected numeric `ward_number`.

## Development And Validation

From the repository root, Python syntax can be checked with:

```bash
python -m compileall backend
```

From `frontend/`, the current lint and production build commands are:

```bash
npm run lint
npm run build
```

The frontend package currently defines no automated unit or integration test
script. The backend has no checked-in test runner configuration or test
requirements file. Do not interpret a successful frontend build as validation
of database connectivity, PostGIS functions, Supabase uploads, or model results.

For API exploration while the backend is running, use `/docs`; for spatial data
or detection issues, inspect the endpoint response and backend process output.

## Security And Deployment Notes

- Keep database and Supabase credentials server-side. The frontend does not
  need the database URL or Supabase service key.
- Use a least-privilege database account and a restricted Supabase Storage
  policy in production.
- The current storage helper configures the `road-images` bucket as public, so
  its public image URLs are accessible to anyone who has the URL. Review this
  behavior before storing sensitive imagery.
- The current CORS policy allows every origin. Replace it with the deployed
  frontend origin list before exposing the backend.
- The API has no authentication or authorization middleware in the current
  implementation. Do not expose write-capable endpoints publicly without
  adding an appropriate access-control layer.
- Configure upload size limits, request timeouts, database connection policy,
  structured logs, and error handling for the deployment environment.
- The global uploads/outputs cleanup assumes serial detection requests. Replace
  it with request-scoped temporary files or a concurrency-safe lifecycle before
  scaling to multiple workers.
- Use HTTPS for browser-to-API and API-to-storage traffic outside local
  development.

## Source Of Truth

When documentation and code disagree, the current implementation is defined by:

- `backend/main.py` for application setup and router registration.
- The endpoint modules in `backend/` for HTTP contracts and database queries.
- `frontend/src/routes/` for page routes and direct HTTP requests.
- `frontend/src/services/` and `frontend/src/mock-data/` for mock-backed pages.
- `frontend/package.json` for frontend scripts and dependency versions.

This README intentionally does not describe planned endpoints as implemented
features. Update the endpoint inventory and frontend integration notes when the
service layer or backend routes change.
