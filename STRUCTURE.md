# GigInsure — Project Structure Guide

A complete MERN stack (MongoDB, Express, React, Node.js) parametric income insurance
platform for Indian gig workers. This document explains every folder and file.

---

## Top-Level Layout

```
GitInsure/
├── server/          Node.js + Express backend  (port 5000)
├── client/          React + Vite frontend       (port 5173)
├── gitinsure/       Original Python FastAPI backend (kept for reference)
└── STRUCTURE.md     This file
```

---

## server/ — Backend

All the API logic lives here. It handles database access, ML scoring,
weather data fetching, fraud detection, and more.

### How to run
```bash
cd server
cp .env.example .env      # fill in your API keys (see below)
npm install
npm run dev               # starts on http://localhost:5000
```

---

### server/.env.example → server/.env

**This is where you put all your API keys.** Copy this file to `.env` and fill in
your real values. The `.env` file is never committed to Git.

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/giginsure   # local MongoDB
JWT_SECRET=change_this_to_a_long_random_string

# OpenWeatherMap (free tier) — for live rain, temperature, AQI
OPENWEATHERMAP_API_KEY=your_key_here

# NewsAPI (free tier) — for disruption news headlines
NEWS_API_KEY=your_key_here

# Razorpay (test/sandbox mode) — for UPI payment simulation
RAZORPAY_KEY_ID=rzp_test_your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
```

**Where to get keys:**
- OpenWeatherMap: https://openweathermap.org/api (free, sign up)
- NewsAPI: https://newsapi.org (free for development)
- Razorpay: https://razorpay.com/docs/payments/payment-gateway/test-integration/

---

### server/server.js
The main entry point. It:
- Connects to MongoDB
- Registers all route files under /api
- Starts the Express HTTP server
- Starts the background scheduler (checks triggers every 5 minutes)

---

### server/config/

| File     | Purpose |
|----------|---------|
| `db.js`  | Connects Mongoose to MongoDB. Exits the process if connection fails. |
| `keys.js`| Single place to read all environment variables. Every other file imports from here instead of calling `process.env` directly. |

---

### server/models/

Mongoose schemas define the shape of data stored in MongoDB.

| File           | What it stores |
|----------------|----------------|
| `Worker.js`    | Gig worker profile: name, phone, platform, pincode, daily income, zone risk score |
| `Policy.js`    | Weekly insurance policy: plan type, premium paid, coverage cap, start/end dates |
| `Claim.js`     | Filed claim: trigger type, fraud score, decision, payout amount, GPS coordinates |
| `TriggerLog.js`| Every trigger event detected by the scheduler or manual check |
| `Payment.js`   | UPI transactions: both premium collections (in) and claim payouts (out) |

---

### server/routes/

Each file handles one group of API endpoints. All routes are prefixed `/api`.

| File           | Endpoints | What it does |
|----------------|-----------|--------------|
| `auth.js`      | POST /auth/register, POST /auth/login, GET /auth/worker/:id | Worker account management with bcrypt + JWT |
| `premium.js`   | GET /premium/calculate | Returns AI-calculated weekly premiums for 3 plans |
| `policy.js`    | POST /policy/create, GET /policy/active/:id, GET /policy/history/:id | 7-day rolling policy management |
| `triggers.js`  | GET /triggers/check/:pincode, GET /triggers/zone-summary | Live weather + AQI + news check |
| `claims.js`    | POST /claims/initiate, GET /claims/history/:id, GET /claims/status/:id | Full zero-touch claim pipeline with fraud detection |
| `payments.js`  | POST /payments/create-order, POST /payments/verify, GET /payments/history/:id | Razorpay UPI payment simulation |
| `analytics.js` | GET /analytics/zone/:pincode, GET /analytics/predict/:pincode | Zone behaviour analysis + next-week forecast |
| `admin.js`     | GET /admin/dashboard, GET /admin/workers, GET /admin/claims | Operational KPIs for the admin dashboard |
| `demo.js`      | POST /demo/simulate-disruption | Demo: inject a fake disruption and auto-process claims for all zone workers |

---

### server/services/

Business logic separated from route handlers. Routes call these functions.

| File                 | What it does |
|----------------------|--------------|
| `weatherService.js`  | Calls OpenWeatherMap API for rain/temperature and AQI. Falls back to mock data if no key is set. Thresholds: rain >15mm = trigger, temp >43°C = trigger, AQI >200 = trigger. |
| `newsService.js`     | Calls NewsAPI for recent headlines about floods, strikes, and curfews in the worker's city. Returns up to 5 articles. Falls back to empty array if no key. |
| `fraudService.js`    | Rule-based fraud scoring (0.0 to 1.0). Checks 8 signals including GPS spoofing (Haversine distance), claim speed, claim frequency, and whether a matching trigger exists in the TriggerLog. |
| `premiumService.js`  | Implements the XGBoost-equivalent premium formula in JavaScript: BASE × riskAdjustment × seasonFactor × planMultiplier − tenureDiscount. Clipped to Rs.25–79. |
| `schedulerService.js`| node-cron job that runs every 5 minutes. Finds all pincodes with active policies, checks triggers for each, and writes new TriggerLog entries (with 30-minute deduplication). |

---

### server/middleware/

| File              | What it does |
|-------------------|--------------|
| `auth.js`         | JWT verification. Reads `Authorization: Bearer <token>` header and attaches the decoded user to `req.user`. Returns 401 if token is missing or invalid. |
| `errorHandler.js` | Global Express error handler. Logs errors in development, hides stack traces in production. |

---

## client/ — Frontend

The React application. Users open this in their browser.

### How to run
```bash
cd client
npm install
npm run dev               # starts on http://localhost:5173
```

The `vite.config.js` proxies all `/api` requests to `http://localhost:5000`,
so both dev servers work together without CORS issues.

---

### client/src/services/api.js

The single file where all axios API calls are defined. Every component imports
functions from here (e.g., `loginWorker`, `checkTriggers`, `initiateClaim`).

An axios interceptor automatically attaches the JWT token from localStorage to
every request. A 401 response clears storage and redirects to /login.

---

### client/src/context/AuthContext.jsx

React Context that stores the logged-in worker object and JWT token.
Available anywhere in the app via `const { worker, login, logout } = useAuth()`.
Data is persisted in localStorage so the session survives page refresh.

---

### client/src/hooks/useGPS.js

Custom React hook that wraps the browser's Geolocation API.
Returns `{ lat, lng, accuracy, error, loading, request }`.
Called on login and when a claim is filed — the coordinates are sent
to the backend for GPS spoofing detection.

---

### client/src/components/

Reusable UI components used across multiple pages.

| File                  | What it renders |
|-----------------------|-----------------|
| `Navbar.jsx`          | Top navigation bar. Shows worker name + GPS status dot when logged in. |
| `StatCard.jsx`        | KPI metric card (large number + icon + label). Used on both dashboards. |
| `PolicyCard.jsx`      | Shows the active policy with plan name, days remaining, coverage cap, and "File Claim" button. |
| `WeatherWidget.jsx`   | Live weather + AQI card. Fetches data every 5 minutes. Colour-codes values by severity. |
| `AlertBanner.jsx`     | Red banner shown when active triggers are detected. Has a "File Claim" button. |
| `ClaimModal.jsx`      | Overlay modal for filing a claim. Captures GPS automatically, shows fraud signals after submission. |
| `FraudSignalBadge.jsx`| Small coloured badge for each fraud signal (CRITICAL / HIGH / MEDIUM / LOW). |

---

### client/src/pages/

Full-page components rendered by React Router.

| File                   | URL         | Who sees it |
|------------------------|-------------|-------------|
| `Landing.jsx`          | /           | Everyone — hero, features, pricing |
| `Login.jsx`            | /login      | Unauthenticated workers |
| `Register.jsx`         | /register   | New workers — 2-step: form then plan selection |
| `WorkerDashboard.jsx`  | /dashboard  | Logged-in workers only (protected route) |
| `AdminDashboard.jsx`   | /admin      | Open — for judges and insurer team |

---

## GPS Spoofing Detection — How it Works

1. When a worker files a claim, `ClaimModal.jsx` calls `navigator.geolocation.getCurrentPosition()`.
2. The GPS coordinates (`lat`, `lng`) are sent with the claim to `POST /api/claims/initiate`.
3. The server's `fraudService.js` fetches the coordinates of the worker's *registered* pincode using OpenWeatherMap's geocoding API.
4. It calculates the Haversine distance (straight-line km) between the worker's current GPS and their registered zone centre.
5. If distance > 50 km, the `GPS_ZONE_MISMATCH` fraud signal is raised, adding +0.35 to the fraud score.
6. A fraud score > 0.85 leads to `AUTO_REJECT`.

---

## How to Run Everything Together

```bash
# Terminal 1 — MongoDB (must be running)
mongod

# Terminal 2 — Backend
cd server
npm run dev          # http://localhost:5000/api/health

# Terminal 3 — Frontend
cd client
npm run dev          # http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## Key API Keys Summary

| Key                      | Used for                    | Free tier |
|--------------------------|-----------------------------|-----------|
| OPENWEATHERMAP_API_KEY   | Rain, temperature, AQI      | Yes       |
| NEWS_API_KEY             | Disruption news headlines    | Yes       |
| RAZORPAY_KEY_ID/SECRET   | UPI payment simulation       | Yes (test)|
| MONGODB_URI              | Database connection          | Local     |

Put all keys in `server/.env` — that is the only file you need to edit.
