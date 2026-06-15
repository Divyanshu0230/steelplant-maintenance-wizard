# Installation Guide — SteelPlant Maintenance Wizard

## Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Gemini API key for LLM
- (Optional) Ollama for local LLM fallback

## Quick Start

### 1. Backend Setup

```bash
cd steelplant-maintenance-wizard/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

**LLM providers (pick at least one — auto-fallback if one hits quota):**

| Provider | Env var | Get key |
|----------|---------|---------|
| **Groq** (recommended) | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) — free, fast |
| Gemini | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| Claude | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) |
| Grok | `XAI_API_KEY` | [console.x.ai](https://console.x.ai/) |

```bash
# Recommended for hackathon — Groq free tier, survives many conversations
GROQ_API_KEY=gsk_your_key_here
LLM_FALLBACK_ORDER=groq,gemini,anthropic,openai,xai,ollama
```

Verify: `python scripts/verify_llm.py`

**Production:** set keys as secret env vars on Render/Railway (never commit `.env`).

### 3. Seed Database & Knowledge Base

```bash
cd ..
python scripts/seed_data.py
```

### 4. Start Backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

### 5. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:3000

## Default Credentials

- Email: `engineer@steelplant.com`
- Password: `password123`

## Running Tests

```bash
cd backend
pytest tests/ -v
```

## Sample API Calls

### Chat with Maintenance Wizard

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is causing vibration on RM-MOTOR-03?", "equipment_code": "RM-MOTOR-03"}'
```

### Get Equipment Health

```bash
curl http://localhost:8000/api/v1/equipment/health
```

### Ingest Knowledge Documents

```bash
curl -X POST http://localhost:8000/api/v1/knowledge/ingest
```

## Deployment

- **Frontend:** Deploy `frontend/` to Vercel
- **Backend:** Deploy `backend/` to Render with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Database:** Set `DATABASE_URL` to Supabase PostgreSQL connection string
- **Vector DB:** Set Qdrant Cloud URL or use embedded mode for dev
