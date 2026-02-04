# Voice Fraud Detection System (VFDS)

# Project Structure

```text
voice-fraud-detector/
├── mock/                    # Demo version
│   ├── app.py
│   ├── voice_analyzer.py
│   └── requirements.txt
│
├── prod/                    # Production version
│   ├── app.py
│   ├── voice_analyzer.py
│   ├── models/
│   │   ├── fraud_detector.py
│   │   └── feature_extractor.py
│   ├── requirements.txt
│   ├── config.yaml
│   └── README.md
│
└── interface_/              # Shared frontend
    ├── index.html
    ├── style.css
    └── script.js
```

## Overview
Production-ready voice fraud detection system using ensemble machine learning models.

## Features
- Real-time audio analysis via WebSocket
- Ensemble fraud detection (XGBoost, Random Forest, SVM, Deep Learning)
- 200+ audio feature extraction
- Configurable sensitivity and thresholds
- Comprehensive fraud type classification
- Production logging and monitoring

## Installation

```bash
# Mock
> cd mock

# Production
> cd prod
 
# Install dependencies
chmod +x setup.sh
./setup.sh

# Run the program
python app.py

# Create necessary directories
mkdir -p logs models
