FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY scripts/ scripts/
COPY data/ data/

RUN chmod +x scripts/docker-entrypoint.sh

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "scripts/docker-entrypoint.sh"]
