from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import init_db
from routes import router

app = FastAPI(title="GigInsure API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/api/health")
def health():
    from ml_service import ZONE_MODEL, FRAUD_MODEL
    from weather_service import OWM_KEY
    return {
        "status": "ok", "version": "2.0.0",
        "ml_loaded": ZONE_MODEL is not None and FRAUD_MODEL is not None,
        "weather_live": OWM_KEY != "",
    }

# Serve frontend — works for both folder structures
_here     = os.path.dirname(os.path.abspath(__file__))
_frontend = os.path.join(_here, "..", "frontend")
if not os.path.exists(_frontend):
    _frontend = _here

if os.path.exists(os.path.join(_frontend, "index.html")):
    app.mount("/static", StaticFiles(directory=_frontend), name="static")
    @app.get("/")
    def serve():
        return FileResponse(os.path.join(_frontend, "index.html"))

@app.on_event("startup")
def startup():
    init_db()
    print("GigInsure API started → http://localhost:8000")
    print("API docs            → http://localhost:8000/docs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
