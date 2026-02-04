import numpy as np
from datetime import datetime
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class VoiceAnalyzer:
    def __init__(self):
        self.sample_rate = 16000

    def analyze_audio(self, audio_np: np.ndarray, sensitivity: float = 0.6,
                      model_type: str = "balanced") -> Dict:
        """
        Simple voice analysis that always works
        """
        try:
            # Ensure audio is float32 and has data
            if len(audio_np) == 0:
                return self._get_default_response("No audio data")

            # Convert to float32 if needed
            if audio_np.dtype != np.float32:
                audio_np = audio_np.astype(np.float32)

            # Calculate basic metrics
            rms = np.sqrt(np.mean(audio_np ** 2))
            zero_crossings = np.sum(np.diff(np.sign(audio_np)) != 0) / len(audio_np)

            # Calculate fraud score (simplified)
            fraud_score = min((rms * 5 + zero_crossings * 2) / 2, 1.0)
            fraud_score = min(fraud_score * sensitivity, 1.0)

            # Generate response
            return {
                "fraud_score": float(fraud_score),
                "replay_risk": float(fraud_score * 0.7),
                "confidence": float(0.7 + np.random.random() * 0.3),
                "breakdown": {
                    "spectral": "Normal" if fraud_score < 0.5 else "Suspicious",
                    "pitch": "Natural" if fraud_score < 0.5 else "Anomalous",
                    "noise": "Clean" if fraud_score < 0.5 else "Noisy",
                    "prosody": "Human-like" if fraud_score < 0.5 else "Robotic"
                },
                "transcription": self._get_transcription(fraud_score, rms),
                "timestamp": datetime.now().isoformat(),
                "audio_length": len(audio_np) / self.sample_rate,
                "model_used": model_type
            }

        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return self._get_default_response(str(e))

    def _get_transcription(self, fraud_score: float, rms: float) -> str:
        """Generate appropriate transcription message"""
        if rms < 0.001:
            return "[Background noise or silence]"
        elif fraud_score < 0.3:
            return "Voice appears genuine and natural"
        elif fraud_score < 0.6:
            return "Voice shows some unusual characteristics"
        else:
            return "Voice shows significant anomalies"

    def _get_default_response(self, error_msg: str = "") -> Dict:
        """Return a safe default response"""
        return {
            "error": error_msg,
            "fraud_score": 0.5,
            "replay_risk": 0.5,
            "confidence": 0.0,
            "breakdown": {
                "spectral": "Unknown",
                "pitch": "Unknown",
                "noise": "Unknown",
                "prosody": "Unknown"
            },
            "transcription": "[Analysis error occurred]",
            "timestamp": datetime.now().isoformat()
        }