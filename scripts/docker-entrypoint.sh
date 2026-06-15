#!/bin/sh
set -e

if [ ! -f data/steelplant.db ]; then
  echo "First run: seeding database and knowledge base..."
  python scripts/seed_data.py
fi

cd backend
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
