# RoadSense AI — Smart Road Infrastructure GIS & Predictive Maintenance System

A minimalistic enterprise admin GIS dashboard for AI-powered road condition monitoring, distress detection, and predictive maintenance management.

---

## 🚀 Overview & Tech Stack

- **Framework**: React 19 + TypeScript
- **Routing & Server**: TanStack Start / TanStack Router + Vite
- **Styling**: Tailwind CSS + Custom GIS Enterprise Design Tokens (`styles.css`)
- **Cartography / GIS**: Leaflet + OpenStreetMap / CartoDB Positron tiles + GeoJSON Polylines & Administrative Polygons
- **Visualizations**: Recharts (Health progression curves, distress distributions, throughput metrics)
- **Architecture**: Strict decoupling between UI components, service abstractions (`src/services/`), and mock data (`src/mock-data/`) for zero-friction FastAPI backend integration.

---

## 📁 Folder Structure

```
frontend/
├── src/
│   ├── assets/               # High-res inspection frame captures (potholes, cracks, markings, good)
│   ├── components/
│   │   ├── layout/           # AppShell, GIS Navigation sidebar, Multi-level area breadcrumb filter
│   │   ├── map/              # RoadGisMap (Leaflet, RHI styling, boundary polygons, defect markers)
│   │   ├── road/             # RhiBadge, PriorityBadge, RoadPreviewCard
│   │   ├── gallery/          # ImageViewerModal (AI BBoxes, zoom), ImageComparisonModal
│   │   ├── defects/          # DefectDetailModal (AI box overlay, status transition)
│   │   ├── maintenance/      # MaintenanceModal (Work order scheduling)
│   │   └── ui/               # shadcn/ui base primitives
│   ├── hooks/
│   │   └── useAreaFilter.ts  # India → State → District → City hierarchy filter hook
│   ├── lib/
│   │   ├── rhi.ts            # RHI calculation, color scales, label helpers, date formatters
│   │   └── utils.ts          # Classname merger
│   ├── mock-data/            # Deterministic mock datasets
│   │   ├── admin.ts          # India bounds, 5 States, 7 Districts, 8 Municipalities
│   │   ├── boundaries.ts     # State GeoJSON polygons & bounding rings
│   │   ├── roads.ts          # 26 road corridors with GeoJSON LineStrings & 12-month RHI history
│   │   ├── defects.ts        # Potholes, cracks, faded markings, rutting with chainage locations
│   │   ├── images.ts         # Multi-epoch inspection frames & sensor telemetry
│   │   ├── maintenance.ts    # Work orders with contractors, costs, statuses
│   │   └── media.ts          # Uploaded footage & simulated YOLOv8m detection results
│   ├── routes/               # TanStack file-based routes
│   │   ├── __root.tsx        # App root shell & metadata
│   │   ├── index.tsx         # GIS Command Center Dashboard (Map dominant + KPIs + Watchlist)
│   │   ├── roads/
│   │   │   ├── index.tsx     # Filterable Road Corridors Inventory
│   │   │   └── $id.tsx       # Road Profile (RHI Gauge, 12M trend, mini map, chainage distress log)
│   │   ├── gallery.tsx       # Inspection Frame Gallery & Temporal Epoch Comparison
│   │   ├── defects.tsx       # Pavement Distress Registry with AI inspection drawer
│   │   ├── media.tsx         # Media Dropzone & YOLOv8m Inference Simulation
│   │   ├── maintenance.tsx   # Predictive Work Order Tracker & Scheduler
│   │   └── analytics.tsx     # Infrastructure Health Analytics & Multi-Region Breakdown
│   ├── services/             # Async API abstraction layer (Mirrors FastAPI endpoints)
│   │   ├── admin.service.ts
│   │   ├── roads.service.ts
│   │   ├── defects.service.ts
│   │   ├── maintenance.service.ts
│   │   ├── media.service.ts
│   │   ├── analytics.service.ts
│   │   └── index.ts
│   └── styles.css            # Enterprise GIS theme, Leaflet styles & RHI tokens
└── package.json
```

---

## 🛠️ Setup & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
The app will start at `http://localhost:3000` (or `http://localhost:5173`).

### 3. Production Build
```bash
npm run build
```

---

## 🗺️ Core User Flow & Features

1. **India-Wide Administrative Navigation**:
   - `India → State (MH, KA, TN, DL, GJ) → District (Pune, Bengaluru, Chennai...) → Municipality (PMC, BBMP, NDMC...) → Corridors`.
   - Selecting any region smoothly zooms and pans the map to its administrative bounding polygon.

2. **Map-Dominant GIS Dashboard**:
   - **RHI Color Coding**: Good (≥75: Green), Fair (50–74: Amber), Poor (30–49: Orange), Critical (<30: Red).
   - **Clickable Roads**: Selecting any road polyline displays the floating `RoadPreviewCard` with metrics and rapid navigation.
   - **Defect Markers**: Color-coded circular markers pinpoint potholes, cracks, and distress along the road geometry.
   - **Layer Controls**: Toggle Roads, Distress Markers, and Admin Boundaries, with RHI band filters.

3. **Road Profile (`/roads/:id`)**:
   - 12-month historical RHI degradation curve.
   - Dedicated corridor mini GIS map.
   - Pavement distress log sorted by chainage (km).

4. **Multi-Epoch Inspection Image Gallery (`/gallery`)**:
   - Multi-camera frame viewer with AI detection bounding box toggles and zoom.
   - **Temporal Inspection Comparison**: Side-by-side comparison of 2 inspection runs to verify deterioration or post-maintenance improvements.

5. **AI Inference & Media Analysis (`/media`)**:
   - Drag-and-drop dashcam/drone video and image footage upload.
   - Real-time simulation of YOLOv8m inference with bounding box detection overlays and confidence percentages.

6. **Predictive Maintenance Work Orders (`/maintenance`)**:
   - Status tracking: Scheduled, Pending, In Progress, Completed.
   - Create new maintenance work orders with chainage limits, contractors, and budget estimations.

---

## 🔌 Connecting to FastAPI Backend

To switch from mock data to a live FastAPI server, update the `src/services/` layer with `fetch` / `axios` calls pointing to the FastAPI endpoints.

### Target API Endpoints Contract

| Method | Endpoint | Description | Query / Body Payload |
|---|---|---|---|
| `GET` | `/roads` | List all roads with optional area filter | `?stateId=MH&districtId=MH-PUN&cityId=PMC` |
| `GET` | `/roads/{id}` | Get detailed profile of a single road | Path param: `id` |
| `GET` | `/roads/map` | Get GeoJSON FeatureCollection of roads for GIS layers | `?stateId=MH` |
| `GET` | `/roads/{id}/images` | Get inspection images for a specific road | Path param: `id` |
| `GET` | `/defects` | List detected defects with filtering | `?roadId=R-PMC-001&type=pothole&severity=high` |
| `GET` | `/analytics/summary` | Aggregated RHI distributions and trend statistics | `?stateId=MH` |
| `GET` | `/maintenance` | List maintenance work orders | `?status=in_progress` |
| `POST` | `/maintenance` | Create a new maintenance work order | JSON payload (see below) |
| `PATCH`| `/maintenance/{id}` | Update status or details of a maintenance work order | `{"status": "completed"}` |
| `POST` | `/media/upload` | Upload dashcam video or inspection image | `multipart/form-data` |
| `POST` | `/analysis/run/{media_id}` | Trigger YOLOv8 inference pipeline on uploaded media | Path param: `media_id` |
| `GET` | `/analysis/{id}` | Fetch inference results with bounding box coordinates | Path param: `id` |

---

### Expected GeoJSON Structure (`GET /roads/map`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "R-PMC-001",
      "properties": {
        "id": "R-PMC-001",
        "code": "MH-SH-27",
        "name": "Pune - Ahmednagar Highway (Yerawada - Wagholi)",
        "rhi": 68,
        "band": "fair",
        "priority": "medium",
        "defectCount": 6,
        "cityId": "PMC"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [73.882, 18.553],
          [73.914, 18.568],
          [73.948, 18.579],
          [73.985, 18.583]
        ]
      }
    }
  ]
}
```

---

### Expected Image Gallery Response (`GET /roads/{id}/images`)

```json
[
  {
    "id": "IMG-R-PMC-001-1-1",
    "roadId": "R-PMC-001",
    "inspectionId": "INS-R-PMC-001-1",
    "url": "https://assets.roadsense.ai/inspections/img-001.jpg",
    "thumbnailUrl": "https://assets.roadsense.ai/inspections/thumb-001.jpg",
    "capturedAt": "2026-09-02T09:00:00+05:30",
    "location": [18.558, 73.892],
    "chainageKm": 1.25,
    "defectsDetected": 2,
    "rhiAtCapture": 68,
    "cameraId": "CAM-FRONT"
  }
]
```

---

### Expected Maintenance Task Creation Payload (`POST /maintenance`)

```json
{
  "roadId": "R-PMC-003",
  "type": "Pothole patching",
  "status": "scheduled",
  "priority": "high",
  "scheduledDate": "2026-10-05",
  "contractor": "PMC Road Dept – Zone 1",
  "estimatedCostLakh": 14.5,
  "chainageFrom": 0.5,
  "chainageTo": 2.8,
  "notes": "Cold-mix asphalt patching for high-severity potholes."
}
```
