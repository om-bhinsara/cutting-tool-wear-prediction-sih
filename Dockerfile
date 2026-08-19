# Base Python image with PyTorch and CUDA runtime support
FROM python:3.10-slim

# Prevent Python from writing .pyc files & enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system-level dependencies for OpenCV / Pillow image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU/CUDA wheels and Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code, checkpoints, and Flask application
COPY src/ ./src/
COPY outputs/ ./outputs/
COPY checkpoints/ ./checkpoints/ 2>/dev/null || true
COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]