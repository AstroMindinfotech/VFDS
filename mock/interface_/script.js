
// Voice Fraud Detection Frontend
class VoiceFraudDetectorUI {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.ws = null;
        this.audioContext = null;
        this.analyser = null;
        this.canvasContext = null;
        this.animationId = null;

        this.initializeElements();
        this.setupEventListeners();
        this.setupWebSocket();
    }

    initializeElements() {
        // Buttons
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.testBtn = document.getElementById('testBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');

        // Status elements
        this.statusText = document.getElementById('statusText');
        this.riskBar = document.getElementById('riskBar');

        // Results elements
        this.authenticityScore = document.getElementById('authenticityScore');
        this.syntheticScore = document.getElementById('syntheticScore');
        this.replayRisk = document.getElementById('replayRisk');
        this.confidence = document.getElementById('confidence');

        // Breakdown elements
        this.breakdownSpectral = document.getElementById('breakdownSpectral');
        this.breakdownPitch = document.getElementById('breakdownPitch');
        this.breakdownNoise = document.getElementById('breakdownNoise');
        this.breakdownProsody = document.getElementById('breakdownProsody');

        // Other elements
        this.transcriptionBox = document.getElementById('transcriptionBox');
        this.alertsContainer = document.getElementById('alertsContainer');
        this.sensitivitySlider = document.getElementById('sensitivity');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.modelSelect = document.getElementById('modelSelect');
        this.audioVisualizer = document.getElementById('audioVisualizer');

        this.canvasContext = this.audioVisualizer.getContext('2d');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.testBtn.addEventListener('click', () => this.testConnection());
        this.copyBtn.addEventListener('click', () => this.copyTranscription());
        this.clearBtn.addEventListener('click', () => this.clearTranscription());

        this.sensitivitySlider.addEventListener('input', (e) => {
            const value = e.target.value;
            let label = '';
            if (value <= 3) label = 'Low';
            else if (value <= 7) label = 'Medium';
            else label = 'High';
            this.sensitivityValue.textContent = label;
        });
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8000/ws`;

        console.log('🔌 Connecting to WebSocket:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.addAlert('Connected to analysis server', 'success');
            this.updateStatus('IDLE', 'status-idle');
            
            // Send test message
            this.ws.send(JSON.stringify({ type: 'ping' }));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received:', data);
                this.handleAnalysisResults(data);
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.addAlert('Connection error. Check if server is running.', 'danger');
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            this.addAlert('Disconnected from server', 'warning');
            
            // Try to reconnect
            setTimeout(() => {
                console.log('🔄 Attempting to reconnect...');
                this.setupWebSocket();
            }, 3000);
        };
    }

    async startRecording() {
        try {
            console.log('🎤 Starting recording...');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            this.setupAudioVisualizer(stream);

            // Create MediaRecorder with proper MIME type
            const options = { mimeType: 'audio/webm;codecs=opus' };
            this.mediaRecorder = new MediaRecorder(stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.processAudioChunk(event.data);
                }
            };

            // Start recording with 500ms chunks (more reliable)
            this.mediaRecorder.start(500);

            this.isRecording = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.updateStatus('LISTENING', 'status-listening');
            this.addAlert('Recording started. Speak now...', 'info');

            console.log('✅ Recording started');

        } catch (error) {
            console.error('❌ Error accessing microphone:', error);
            this.addAlert('Cannot access microphone. Please check permissions.', 'danger');
        }
    }

    setupAudioVisualizer(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            const source = this.audioContext.createMediaStreamSource(stream);

            source.connect(this.analyser);
            this.analyser.fftSize = 256;

            this.drawVisualizer();
        } catch (error) {
            console.error('❌ Error setting up visualizer:', error);
        }
    }

    drawVisualizer() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);
            this.analyser.getByteFrequencyData(dataArray);

            // Clear canvas
            this.canvasContext.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.canvasContext.fillRect(0, 0, this.audioVisualizer.width, this.audioVisualizer.height);

            // Draw bars
            const barWidth = (this.audioVisualizer.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i];
                
                // Create gradient
                const gradient = this.canvasContext.createLinearGradient(
                    0, this.audioVisualizer.height - barHeight,
                    0, this.audioVisualizer.height
                );

                // Color based on frequency range
                if (i < bufferLength / 3) {
                    gradient.addColorStop(0, '#3498db');
                    gradient.addColorStop(1, '#2980b9');
                } else if (i < (bufferLength * 2) / 3) {
                    gradient.addColorStop(0, '#2ecc71');
                    gradient.addColorStop(1, '#27ae60');
                } else {
                    gradient.addColorStop(0, '#e74c3c');
                    gradient.addColorStop(1, '#c0392b');
                }

                this.canvasContext.fillStyle = gradient;
                this.canvasContext.fillRect(
                    x,
                    this.audioVisualizer.height - barHeight,
                    barWidth,
                    barHeight
                );

                x += barWidth + 1;
            }
        };

        draw();
    }

    async processAudioChunk(audioBlob) {
        if (this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not ready');
            return;
        }

        try {
            // Convert blob to ArrayBuffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Convert to base64
            const base64Audio = this.arrayBufferToBase64(arrayBuffer);
            
            // Send to server
            const message = {
                type: 'audio',
                data: base64Audio,
                timestamp: Date.now(),
                sensitivity: this.sensitivitySlider.value,
                model: this.modelSelect.value
            };

            this.ws.send(JSON.stringify(message));
            console.log('📤 Sent audio chunk:', audioBlob.size, 'bytes');
            
        } catch (error) {
            console.error('❌ Error processing audio chunk:', error);
        }
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    handleAnalysisResults(data) {
        // Handle errors
        if (data.error) {
            console.error('❌ Server error:', data.error);
            this.addAlert(`Server error: ${data.error}`, 'danger');
            return;
        }

        // Update fraud scores
        if (data.fraud_score !== undefined) {
            const fraudPercent = Math.round(data.fraud_score * 100);
            this.updateRiskBar(fraudPercent);

            // Update all score displays
            this.authenticityScore.textContent = `${100 - fraudPercent}%`;
            this.syntheticScore.textContent = `${fraudPercent}%`;
            this.replayRisk.textContent = `${Math.round(data.replay_risk * 100 || 0)}%`;
            this.confidence.textContent = `${Math.round((data.confidence || 0.5) * 100)}%`;

            // Update breakdown
            this.breakdownSpectral.textContent = data.breakdown?.spectral || 'Normal';
            this.breakdownPitch.textContent = data.breakdown?.pitch || 'Natural';
            this.breakdownNoise.textContent = data.breakdown?.noise || 'Clean';
            this.breakdownProsody.textContent = data.breakdown?.prosody || 'Human-like';

            // Update status based on fraud score
            if (fraudPercent > 70) {
                this.updateStatus('FRAUD DETECTED', 'status-fraud');
                this.addAlert(`🚨 High fraud risk detected (${fraudPercent}%)`, 'danger');
                
                if (document.getElementById('enableAlerts').checked) {
                    this.playAlertSound();
                }
            } else if (fraudPercent > 30) {
                this.updateStatus('SUSPICIOUS', 'status-processing');
                this.addAlert(`⚠️ Moderate fraud risk (${fraudPercent}%)`, 'warning');
            } else {
                this.updateStatus('GENUINE', 'status-genuine');
                this.addAlert(`✅ Voice appears genuine (${fraudPercent}% risk)`, 'success');
            }
        }

        // Update transcription
        if (data.transcription) {
            this.updateTranscription(data.transcription);
        }

        // Handle alerts from server
        if (data.alert) {
            this.addAlert(data.alert.message, data.alert.type);
        }
    }

    updateRiskBar(percentage) {
        this.riskBar.style.width = `${percentage}%`;
        
        // Update color based on percentage
        if (percentage < 30) {
            this.riskBar.style.background = 'linear-gradient(to right, #2ecc71, #27ae60)';
        } else if (percentage < 70) {
            this.riskBar.style.background = 'linear-gradient(to right, #f1c40f, #f39c12)';
        } else {
            this.riskBar.style.background = 'linear-gradient(to right, #e74c3c, #c0392b)';
        }
    }

    updateTranscription(text) {
        if (!document.getElementById('enableTranscription').checked) return;
        
        const placeholder = this.transcriptionBox.querySelector('.placeholder');
        if (placeholder) placeholder.remove();
        
        const div = document.createElement('div');
        div.className = 'transcription-line';
        div.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        
        this.transcriptionBox.appendChild(div);
        this.transcriptionBox.scrollTop = this.transcriptionBox.scrollHeight;
    }

    updateStatus(text, className) {
        this.statusText.textContent = text;
        this.statusText.className = className;
    }

    addAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;

        let icon = 'info-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        if (type === 'danger') icon = 'exclamation-circle';
        if (type === 'success') icon = 'check-circle';

        alertDiv.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
            <button class="alert-close"><i class="fas fa-times"></i></button>
        `;

        this.alertsContainer.appendChild(alertDiv);

        // Auto-remove info alerts after 5 seconds
        if (type === 'info') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.style.opacity = '0';
                    setTimeout(() => alertDiv.remove(), 300);
                }
            }, 5000);
        }

        // Add close button functionality
        alertDiv.querySelector('.alert-close').addEventListener('click', () => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        });

        // Scroll to bottom
        this.alertsContainer.scrollTop = this.alertsContainer.scrollHeight;
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            console.log('🛑 Stopping recording...');
            
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }

            if (this.audioContext) {
                this.audioContext.close();
            }

            this.isRecording = false;
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.updateStatus('IDLE', 'status-idle');
            this.addAlert('Recording stopped', 'info');

            // Clear visualizer
            this.canvasContext.clearRect(0, 0, this.audioVisualizer.width, this.audioVisualizer.height);
            
            console.log('✅ Recording stopped');
        }
    }

    testConnection() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.addAlert('Sending test request...', 'info');
            this.ws.send(JSON.stringify({ type: 'test' }));
        } else {
            this.addAlert('WebSocket not connected', 'danger');
        }
    }

    playAlertSound() {
        try {
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
            audio.volume = 0.3;
            audio.play();
        } catch (error) {
            console.error('Error playing alert sound:', error);
        }
    }

    copyTranscription() {
        const text = this.transcriptionBox.textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.addAlert('Transcription copied to clipboard', 'success');
        });
    }

    clearTranscription() {
        this.transcriptionBox.innerHTML = '<div class="placeholder">Speech will appear here...</div>';
        this.addAlert('Transcription cleared', 'info');
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Voice Fraud Detection System...');
    
    window.voiceDetector = new VoiceFraudDetectorUI();

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Space to start/stop recording
        if (e.ctrlKey && e.code === 'Space') {
            e.preventDefault();
            if (window.voiceDetector.isRecording) {
                window.voiceDetector.stopRecording();
            } else {
                window.voiceDetector.startRecording();
            }
        }

        // Escape to stop recording
        if (e.code === 'Escape' && window.voiceDetector.isRecording) {
            window.voiceDetector.stopRecording();
        }
    });

    console.log('%c🔍 Voice Fraud Detection System Ready', 'color: #3498db; font-size: 16px; font-weight: bold;');
    console.log('%c🎯 Press Ctrl+Space to start/stop recording', 'color: #2ecc71;');
    console.log('%c🛑 Press Escape to stop recording', 'color: #e74c3c;');
});