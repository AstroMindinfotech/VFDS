#!/bin/bash

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

# Create directories
mkdir -p logs models

echo "✅ Setup complete!"
echo "To start the server: python app.py"
echo "Access API at: http://localhost:8000"
echo "Access Dashboard das: http://localhost:8000/index.html"