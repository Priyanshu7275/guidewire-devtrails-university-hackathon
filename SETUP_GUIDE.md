# GigInsure — Complete Setup Guide
### DEVTrails 2026 | Phase 2 | Fixed Version

---

## Folder Structure (Keep This Exactly)

```
giginsure_final/
├── backend/
│   ├── main.py              ← FastAPI entry point
│   ├── database.py          ← SQLite database + tables
│   ├── routes.py            ← All API endpoints
│   ├── ml_service.py        ← XGBoost + Isolation Forest
│   ├── weather_service.py   ← Real weather API
│   └── requirements.txt     ← Python packages
├── frontend/
│   └── index.html           ← Complete website
├── ml/
│   └── models/
│       ├── zone_model.pkl       ← Pretrained XGBoost
│       ├── fraud_model.pkl      ← Pretrained Isolation Forest
│       ├── fraud_scaler.pkl     ← Feature scaler
│       └── pincode_lookup.pkl   ← Pincode risk table
├── data/                    ← Database folder (auto-created)
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

---

## Option A — Run Without Docker (Recommended for Development)

### Step 1 — Open VS Code
```
File → Open Folder → select giginsure_final
```

### Step 2 — Open terminal and create virtual environment
```bash
python -m venv venv
```

### Step 3 — Activate virtual environment

**Windows PowerShell:**
```bash
venv\Scripts\activate
```
**Mac / Linux:**
```bash
source venv/bin/activate
```
You will see `(venv)` at the start of your terminal line.

### Step 4 — Install packages
```bash
cd backend
pip install -r requirements.txt
```
This takes 2-3 minutes. Wait for it to finish.

### Step 5 — (Optional) Add real weather API key
Get a free key in 2 minutes at: https://openweathermap.org/api

**Windows PowerShell:**
```bash
$env:OPENWEATHERMAP_API_KEY="paste_your_key_here"
```
**Mac / Linux:**
```bash
export OPENWEATHERMAP_API_KEY="paste_your_key_here"
```
Without this key the app still works using mock weather data.

### Step 6 — Start the server
```bash
uvicorn main:app --reload
```

You will see:
```
✓ All ML models loaded
Database initialized
GigInsure API started → http://localhost:8000
INFO: Application startup complete.
```

### Step 7 — Open the website
Open `frontend/index.html` directly in Chrome.

**Windows:** Double-click the file in File Explorer
**Mac:** Right-click → Open With → Chrome

---

## Option B — Run With Docker (For Demo / Submission)

### Step 1 — Install Docker Desktop
Download from: https://www.docker.com/products/docker-desktop
Start Docker Desktop and wait for it to fully load.

### Step 2 — Open terminal in giginsure_final folder

### Step 3 — Start everything
```bash
docker-compose up --build
```
First time takes 3-5 minutes to download and build.

### Step 4 — Open in browser

| What | URL |
|---|---|
| Website | http://localhost:3000 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Step 5 — Stop
```bash
docker-compose down
```

---

## Verify Everything is Working

After starting the server open: **http://localhost:8000/docs**

You will see all API endpoints. Test these manually:

**1. Register a worker:**
Click `POST /api/auth/register` → Try it out → paste:
```json
{
  "name": "Ravi Kumar",
  "phone": "+919876543210",
  "password": "test123",
  "platform": "zepto",
  "pincode": 201301,
  "city": "Ghaziabad",
  "vehicle": "scooter",
  "daily_income": 600
}
```
Expected: returns `zone_risk_score: 72.0` and `plans` with 3 different prices.

**2. Check triggers:**
Click `GET /api/triggers/check/{pincode}` → pincode: `201301`
Expected: returns `weather`, `aqi`, all 5 triggers with real or mock values.

**3. Check health:**
Visit http://localhost:8000/api/health
Expected:
```json
{"status": "ok", "ml_loaded": true, "weather_live": false}
```
`weather_live: true` only shows when API key is set.

---

## Full Demo Flow (For 2-Minute Video)

Do this in your browser with the website open:

```
1. Register new worker → see real ML zone risk score
2. View 3 plans with different ML-calculated prices
3. Select Standard Shield → proceed to payment
4. Complete payment → policy activates for 7 days
5. Go to Triggers page → click Check Live Triggers
6. See weather data + which triggers fired
7. Click Simulate Auto-Claim → see fraud score + payout
8. Admin page → see real DB stats
```

---

## Bugs Fixed in This Version

| Bug | Was | Fixed |
|---|---|---|
| Wrong name on dashboard | Hardcoded "Ravi Kumar" | Reads from DB using worker_id |
| Premium always ₹52 | Hardcoded in HTML | Reads from ML backend per plan |
| Weather simulated | API key hardcoded in code | Key from environment, mock clearly labeled |
| Only 6 cities supported | Hardcoded pincode list | OWM geocoding works for all Indian pincodes |

---

## Common Problems

| Problem | Fix |
|---|---|
| `✗ ML model load error` | Make sure `ml/models/` folder has all 4 `.pkl` files |
| `Phone already registered` | Delete `giginsure.db` file from `backend/` folder and restart |
| Weather shows "mock_data" | Set `OPENWEATHERMAP_API_KEY` env var before starting server |
| CORS error in browser | Make sure server is running on port 8000 |
| `(venv)` not showing | Run `venv\Scripts\activate` again in VS Code terminal |
| Port 8000 already in use | Run `uvicorn main:app --reload --port 8001` then change API URL in index.html |

---

## API Key New Session Reminder

Every time you open a NEW terminal in VS Code you must:
```bash
# 1. Activate venv
venv\Scripts\activate

# 2. Set API key (if you have one)
$env:OPENWEATHERMAP_API_KEY="your_key"

# 3. Go to backend and start
cd backend
uvicorn main:app --reload
```
