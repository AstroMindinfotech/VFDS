import asyncio
import json
import base64
import numpy as np
from typing import Dict, List, Optional
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from datetime import datetime
import logging
import struct
import io

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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


class VoiceAnalyzer:
    """Simple voice analyzer for fraud detection"""

    def __init__(self):
        self.sample_rate = 16000

    def analyze_audio(self, audio_np: np.ndarray) -> Dict:
        """Analyze audio and return fraud detection results"""
        try:
            if len(audio_np) < 100:
                return self._get_default_response("Audio too short")

            # Calculate basic features
            rms = np.sqrt(np.mean(audio_np ** 2))
            zero_crossings = np.sum(np.diff(np.sign(audio_np)) != 0) / len(audio_np)

            # Simple fraud score calculation
            fraud_score = min((rms * 3 + zero_crossings * 2) / 2, 1.0)

            # Add some randomness for demo
            fraud_score = fraud_score * (0.8 + np.random.random() * 0.4)
            fraud_score = min(fraud_score, 1.0)

            # Generate breakdown
            if fraud_score < 0.3:
                status = "Normal"
                transcription = "Voice appears genuine"
            elif fraud_score < 0.6:
                status = "Suspicious"
                transcription = "Some unusual characteristics detected"
            else:
                status = "Anomalous"
                transcription = "Potential fraud detected"

            return {
                "fraud_score": float(fraud_score),
                "replay_risk": float(fraud_score * 0.7),
                "confidence": float(0.7 + np.random.random() * 0.3),
                "breakdown": {
                    "spectral": status,
                    "pitch": status,
                    "noise": "Clean" if rms < 0.1 else "Noisy",
                    "prosody": "Natural" if fraud_score < 0.5 else "Robotic"
                },
                "transcription": transcription,
                "timestamp": datetime.now().isoformat(),
                "audio_length": len(audio_np) / self.sample_rate,
                "model_used": "basic"
            }

        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return self._get_default_response(str(e))

    def _get_default_response(self, error: str = "") -> Dict:
        """Return default response on error"""
        return {
            "error": error,
            "fraud_score": 0.5,
            "replay_risk": 0.5,
            "confidence": 0.0,
            "breakdown": {
                "spectral": "Unknown",
                "pitch": "Unknown",
                "noise": "Unknown",
                "prosody": "Unknown"
            },
            "transcription": "Analysis failed",
            "timestamp": datetime.now().isoformat()
        }


analyzer = VoiceAnalyzer()


def decode_base64_audio(audio_b64: str) -> Optional[np.ndarray]:
    """
    Decode base64 audio data with robust error handling
    """
    try:
        # Remove data URL prefix if present
        if audio_b64.startswith('data:'):
            if ',' in audio_b64:
                audio_b64 = audio_b64.split(',')[1]

        # Decode base64
        audio_bytes = base64.b64decode(audio_b64)

        if len(audio_bytes) == 0:
            logger.warning("Empty audio data received")
            return None

        # Try different audio formats
        formats_to_try = [
            (np.int16, 32768.0),  # 16-bit PCM
            (np.float32, 1.0),  # 32-bit float
            (np.int8, 128.0)  # 8-bit PCM
        ]

        for dtype, scale in formats_to_try:
            try:
                # Calculate expected size
                element_size = np.dtype(dtype).itemsize
                if len(audio_bytes) % element_size != 0:
                    continue  # Wrong format, try next

                audio_np = np.frombuffer(audio_bytes, dtype=dtype).astype(np.float32) / scale

                # Validate the data
                if len(audio_np) > 0 and not np.all(np.isnan(audio_np)):
                    logger.info(f"Successfully decoded audio: {len(audio_np)} samples, dtype={dtype}")
                    return audio_np

            except Exception as e:
                continue  # Try next format

        # If all formats fail, try to parse as raw bytes
        logger.warning("Could not parse with standard formats, trying raw conversion")
        try:
            # Convert bytes to int8, then normalize
            audio_int8 = np.frombuffer(audio_bytes, dtype=np.int8)
            audio_np = audio_int8.astype(np.float32) / 128.0
            return audio_np
        except:
            pass

        logger.error("Failed to decode audio data with any format")
        return None

    except Exception as e:
        logger.error(f"Audio decoding error: {str(e)}")
        return None


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New WebSocket connection established")

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            message_type = message.get("type", "")

            if message_type == "audio":
                # Process audio
                audio_b64 = message.get("data", "")
                if not audio_b64:
                    await websocket.send_json({"error": "No audio data"})
                    continue

                # Decode audio
                audio_np = decode_base64_audio(audio_b64)

                if audio_np is None:
                    await websocket.send_json({
                        "error": "Failed to decode audio",
                        "fraud_score": 0.5
                    })
                    continue

                # Get sensitivity
                try:
                    sensitivity = float(message.get("sensitivity", 6)) / 10.0
                except:
                    sensitivity = 0.6

                # Analyze
                results = analyzer.analyze_audio(audio_np)

                # Adjust with sensitivity
                if "fraud_score" in results:
                    results["fraud_score"] = min(results["fraud_score"] * sensitivity, 1.0)
                    results["replay_risk"] = results["fraud_score"] * 0.7

                # Send results
                await websocket.send_json(results)

            elif message_type == "ping":
                # Heartbeat
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })

            elif message_type == "test":
                # Test endpoint
                await websocket.send_json({
                    "message": "Test successful",
                    "fraud_score": 0.3,
                    "replay_risk": 0.2,
                    "confidence": 0.9,
                    "breakdown": {
                        "spectral": "Normal",
                        "pitch": "Natural",
                        "noise": "Clean",
                        "prosody": "Human-like"
                    },
                    "transcription": "System is working correctly",
                    "timestamp": datetime.now().isoformat()
                })

            else:
                await websocket.send_json({"error": f"Unknown message type: {message_type}"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")


@app.get("/")
async def root():
    return FileResponse("interface_/index.html")


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/test")
async def test():
    return {"message": "API is working"}


# Serve static files
app.mount("/", StaticFiles(directory="interface_", html=True), name="static")

if __name__ == "__main__":
    logger.info("🚀 Starting Mock Voice Fraud Detection Server")
    logger.info("📡 WebSocket Mock available at: ws://localhost:8000/ws")
    logger.info("🌐 Web interface Mock available at: http://localhost:8000")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )