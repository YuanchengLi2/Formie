FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libegl1 libgl1 libgles2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml ./
COPY form_worker ./form_worker
RUN pip install --no-cache-dir .
RUN mkdir -p /app/models && python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task', '/app/models/pose_landmarker_full.task')"
ENV POSE_LANDMARKER_MODEL_PATH=/app/models/pose_landmarker_full.task
CMD ["python", "-m", "form_worker.main"]
