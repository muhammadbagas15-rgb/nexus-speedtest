
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import os

app = FastAPI(
    title="NEXUS SPEEDTEST API",
    description="Precision Network Measurement Backend",
    version="1.0.0"
)

# Izinkan frontend mengakses backend.
# Untuk produksi, nanti batasi ke domain website NEXUS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.get("/")
async def home():
    return {
        "name": "NEXUS SPEEDTEST",
        "message": "Backend is running",
        "version": "1.0.0"
    }

@app.get("/api/health")
async def health():
    return {
        "status": "online",
        "name": "NEXUS Test Node"
    }

@app.get("/api/download")
async def download(size: int = 5_000_000):
    # Batasi ukuran data agar server tidak disalahgunakan.
    if size < 1 or size > 5_000_000:
        raise HTTPException(
            status_code=400,
            detail="Invalid download size"
        )

    data = os.urandom(size)

    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "Content-Length": str(len(data)),
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff"
        }
    )

@app.post("/api/upload")
async def upload(request: Request):
    content_length = request.headers.get("content-length")

    if content_length:
        if int(content_length) > 10_000_000:
            raise HTTPException(
                status_code=413,
                detail="Upload too large"
            )

    data = await request.body()

    if len(data) > 10_000_000:
        raise HTTPException(
            status_code=413,
            detail="Upload too large"
        )

    return {
        "status": "success",
        "bytes_received": len(data)
    }
