import asyncio
import json
import base64
import numpy as np
import torch
import torchaudio
import librosa
from scipy import signal
from typing import Dict, List, Optional
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from datetime import datetime
import logging
from voice_analyzer import VoiceAnalyzer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Voice Fraud Detection API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize voice analyzer
analyzer = VoiceAnalyzer()

# WebSocket connections pool
active_connections: List[WebSocket] = []


@app.get("/")
async def root():
    return {"message": "Voice Fraud Detection API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "audio":
                # Process audio chunk
                results = await process_audio_chunk(
                    message["data"],
                    message.get("sensitivity", 6),
                    message.get("model", "balanced")
                )

                # Send results back to client
                await websocket.send_json(results)

            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})

    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        active_connections.remove(websocket)


async def process_audio_chunk(base64_audio: str, sensitivity: int, model_type: str) -> Dict:
    """
    Process an audio chunk and return fraud detection results
    """
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(base64_audio)

        # Convert to numpy array
        audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

        # Analyze for fraud
        results = analyzer.analyze_audio(
            audio_np,
            sample_rate=16000,
            sensitivity=sensitivity,
            model_type=model_type
        )

        # Add transcription if requested
        if len(audio_np) > 16000:  # Only transcribe if we have at least 1 second
            transcription = analyzer.transcribe_audio(audio_np)
            results["transcription"] = transcription

        return results

    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        return {
            "error": str(e),
            "fraud_score": 0.5,
            "confidence": 0.0,
            "alert": {
                "message": "Error processing audio",
                "type": "danger"
            }
        }


@app.post("/api/analyze")
async def analyze_audio_endpoint():
    """HTTP endpoint for batch audio analysis"""
    return {"message": "Use WebSocket for real-time analysis"}


# Serve frontend files
app.mount("/", StaticFiles(directory="interface_", html=True), name="static")

# @app.get("/dashboard")
# async def serve_dashboard():
#     return FileResponse("interface_/index.html")


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )