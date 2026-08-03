# AED Inspection Platform

**AI-powered, fully automated AED inspection using a single live camera.**

Inspector presses **Start Inspection** → AI identifies the AED → guides through every step → generates a signed PDF report. No buttons to click, no photos to upload.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser  (Next.js 15 · React 19 · TypeScript · Tailwind)      │
│  ┌──────────────────┐  ┌───────────────────────────────────┐   │
│  │  getUserMedia    │  │  Socket.IO Client                  │   │
│  │  canvas.toBlob() │→ │  video_frame events (binary JPEG) │   │
│  └──────────────────┘  └───────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Socket.IO (JWT auth)
┌──────────────────────────────▼──────────────────────────────────┐
│  Node.js 22 · Express · Socket.IO Server                        │
│  REST API: auth / inspections / reports / users                 │
│  PDF generation: PDFKit                                         │
│  MongoDB: Mongoose (inspections, users)                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │ WebSocket proxy → binary frames
┌──────────────────────────────▼──────────────────────────────────┐
│  Python 3.12 · FastAPI · Google Gemini (gemini-2.5-flash)       │
│                                                                 │
│  Inspection State Machine                                       │
│  WAIT → IDENTIFY → SERIAL → PADS → BATTERY → STATUS → REPORT  │
│                                                                 │
│  Frame Throttling                                                │
│  ├── ~1 Gemini call every 1.5–2.0s (not per raw video frame)    │
│  ├── Gated on a local blur/brightness quality check             │
│  └── Forced retry after 6s if quality never passes              │
│                                                                 │
│  Gemini Vision Service (services/gemini_service.py)             │
│  ├── One multimodal call per analysed frame                     │
│  ├── Structured JSON output (step/progress/instruction/         │
│  │   completed/status/data) — no local YOLO or OCR pipeline    │
│  └── Handles manufacturer ID, serial/expiry OCR, and status     │
│      indicator reading for any AED brand, generically           │
└─────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│  MongoDB 7.0                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start — Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/your-org/aed-inspection-platform
cd aed-inspection-platform

# 2. Environment
cp .env.example .env
# Edit .env — set MONGO_PASSWORD, JWT_SECRET, SECRET_KEY, GEMINI_API_KEY
# (get a Gemini key from https://aistudio.google.com/apikey)

# 3. Start all services
docker compose up -d

# 4. Open browser
open http://localhost:3000

# Register first user:
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@org.com","password":"yourpassword","role":"admin"}'
```

Services:
- Frontend:   http://localhost:3000
- Backend:    http://localhost:3001
- CV service: http://localhost:8001
- Mongo:      localhost:27017

---

## Local Development

### Prerequisites
- Node.js 22+
- Python 3.12+
- MongoDB 7.0
- A Gemini API key — https://aistudio.google.com/apikey

### Python CV Service

```bash
cd python-cv

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install deps
pip install -r requirements.txt

# Copy env and set GEMINI_API_KEY
cp .env.example .env

# Run
uvicorn app.main:app --reload --port 8001

# Tests
pytest tests/ -v
```

### Node.js Backend

```bash
cd backend
npm install
cp .env.example .env   # or create src/config/.env
npm run dev            # ts-node-dev with hot reload
```

### Next.js Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:3001" > .env.local
npm run dev            # http://localhost:3000
```

---

## Adding a New AED Manufacturer

There's nothing to add. Gemini identifies manufacturer and model directly
from the camera frame and reads serial numbers, expiry dates, and status
indicators generically — no per-brand plugin, training data, or code change
is needed to support a new AED brand.

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register | Create account |
| POST | /api/v1/auth/login | Get JWT token |
| GET | /api/v1/auth/me | Current user |

### Inspections
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/inspections | List (paginated, filterable) |
| POST | /api/v1/inspections | Create session |
| GET | /api/v1/inspections/:id | Get single |
| PATCH | /api/v1/inspections/:id | Update |
| GET | /api/v1/inspections/stats/summary | Dashboard stats |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/reports/:id/pdf | Download PDF |
| GET | /api/v1/reports/:id/json | Get JSON data |

### WebSocket (Socket.IO)
Connect to `ws://localhost:3001` with `auth: { token }`.

| Event (emit) | Payload | Description |
|---|---|---|
| `start_inspection` | `{ inspectionId, sessionId }` | Begin AI inspection |
| `video_frame` | `ArrayBuffer` (JPEG) | Send camera frame |
| `stop_inspection` | — | End session |

| Event (on) | Payload | Description |
|---|---|---|
| `state_update` | `StateResult` | AI step result |
| `inspection_complete` | `{ data }` | Full inspection data |
| `inspection_ready` | — | CV service connected |
| `cv_error` | `{ message }` | CV processing error |

### Frame-throttling workflow

The browser streams JPEG frames continuously (10–30fps) over the WebSocket,
but the CV service does **not** call Gemini on every frame — that would blow
through API quota and add latency for no benefit. Instead
(`python-cv/app/api/websockets/inspection_ws.py`):

1. Every incoming frame is decoded once for a cheap local blur/brightness
   check (OpenCV, no network call).
2. A Gemini call fires only when **both** of these hold:
   - at least **1.5–2.0s** have passed since the last call, **and**
   - the frame passes the local quality check (or **6s** have elapsed with
     no acceptable frame — Gemini is called anyway so the inspector always
     gets feedback, e.g. "move to better lighting").
3. Between Gemini calls, the last known `state_update` is replayed on every
   frame so the UI (frame quality meter, instruction text) still feels live,
   without spending additional quota.
4. `REPORT` and `COMPLETE` are resolved locally with no Gemini call at all —
   only the six AI-driven steps (`WAIT`, `IDENTIFY`, `SERIAL`, `PADS`,
   `BATTERY`, `STATUS`) cost an API call.

### Gemini structured JSON schema

Each Gemini call (`python-cv/app/services/gemini_service.py`) receives one
JPEG frame plus the current step name, and returns strict structured JSON
(enforced via `response_schema` / `response_mime_type="application/json"`,
model `gemini-2.5-flash`):

```json
{
  "step": "SERIAL",
  "progress": 35,
  "instruction": "Move closer to the serial number label.",
  "completed": false,
  "status": "in_progress",
  "data": {
    "manufacturer": null,
    "model": null,
    "serial_number": "A1B2C3D4",
    "pads_expiry": null,
    "battery_expiry": null,
    "status_indicator_ok": null
  }
}
```

The state machine merges non-null `data` fields into the session, advances
to the next step once `completed: true`, and forwards a `StateResult` to the
frontend over Socket.IO:

```json
{
  "step": "serial_number",
  "progress": 35,
  "instruction": "Move closer to the serial number label.",
  "completed": false,
  "status": "in_progress",
  "detections": [],
  "frame_quality": { "blur": 142.3, "brightness": 118.6, "acceptable": true },
  "data": { "serial_number": "A1B2C3D4" }
}
```

`detections` is always empty — there's no local object detector anymore —
kept only for wire compatibility with the frontend's camera overlay UI.

---

## Project Structure

```
aed-inspection-platform/
├── python-cv/                    # AI / CV microservice
│   ├── app/
│   │   ├── main.py               # FastAPI app
│   │   ├── core/                 # Config, logging
│   │   ├── api/
│   │   │   ├── routes/           # REST endpoints
│   │   │   └── websockets/       # WS frame handler
│   │   ├── services/
│   │   │   ├── gemini_service.py # Gemini vision calls (★ core)
│   │   │   └── inspection/       # State machine
│   │   ├── schemas/              # Pydantic models
│   │   └── utils/                # Date parser, frame utils
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── backend/                      # Node.js API server
│   ├── src/
│   │   ├── server.ts             # Entry point
│   │   ├── app.ts                # Express factory
│   │   ├── api/
│   │   │   ├── middleware/       # JWT auth, error handler
│   │   │   └── routes/           # REST routes
│   │   ├── models/               # Mongoose schemas
│   │   ├── websocket/            # Socket.IO server
│   │   ├── config/               # Env, database
│   │   └── utils/                # Logger
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                     # Next.js 15 app
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── dashboard/        # Main dashboard
│   │   │   ├── inspection/       # Live inspection ★
│   │   │   ├── login/            # Auth
│   │   │   └── reports/          # Report list
│   │   ├── components/
│   │   │   ├── inspection/       # Camera, timeline, guidance, result
│   │   │   └── dashboard/        # Stats, table, sidebar
│   │   ├── hooks/                # useInspection (Socket.IO + WebRTC)
│   │   ├── stores/               # Zustand (inspection, auth)
│   │   ├── lib/                  # API client (Axios + interceptors)
│   │   └── types/                # TypeScript types
│   ├── package.json
│   └── Dockerfile
│
├── docker/
│   └── mongo-init.js
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Supported AED Manufacturers

Any manufacturer, out of the box. Gemini reads manufacturer/model, serial
number, pads/battery expiry, and status indicator directly from the frame —
there's no fixed brand list or per-manufacturer detection logic to maintain.

---

## License

Proprietary — Think Health Care and Safety. All rights reserved.
