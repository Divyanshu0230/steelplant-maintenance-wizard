# SteelPlant Maintenance Wizard — System Architecture

## Overview

An AI Maintenance Command Center for steel manufacturing plants combining RAG, predictive analytics, anomaly detection, multi-agent reasoning, real-time alerting, and explainable recommendations.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | FastAPI, Python 3.11+ |
| AI Orchestration | LangGraph, LangChain |
| LLM | Gemini (primary), Ollama (fallback) |
| Embeddings | BAAI/bge-small-en-v1.5 |
| ML | XGBoost, Isolation Forest, scikit-learn |
| Database | PostgreSQL (SQLite for local dev) |
| Vector DB | Qdrant (embedded local mode) |
| Auth | JWT + RBAC |
| Monitoring | OpenTelemetry hooks |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                             │
│  Dashboard │ Chat │ Alerts │ Equipment │ Reports │ Logbook    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                      FastAPI Gateway                             │
│  Auth │ Validation │ Logging │ Rate Limiting │ OpenTelemetry    │
└─────┬──────────┬──────────┬──────────┬──────────┬───────────────┘
      │          │          │          │          │
┌─────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────────────┐
│ LangGraph│ │  RAG   │ │   ML   │ │ Alert  │ │ Report/Logbook │
│ 8 Agents │ │ Engine │ │ Engine │ │ Engine │ │    Services    │
└─────┬───┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬──────────────┘
      │         │          │          │          │
┌─────▼─────────▼──────────▼──────────▼──────────▼───────────────┐
│  PostgreSQL  │  Qdrant (vectors)  │  Redis (cache, optional)    │
└─────────────────────────────────────────────────────────────────┘
```

## Multi-Agent Architecture

| Agent | Responsibility |
|-------|----------------|
| Document Intelligence | Retrieve manuals, SOPs, logs, failure reports |
| Root Cause Analysis | Analyze symptoms, identify probable causes |
| Predictive Maintenance | RUL, failure probability, degradation |
| Maintenance Planner | Recommend and prioritize maintenance actions |
| Spare Parts | Inventory analysis, procurement recommendations |
| Alert | Generate and escalate alerts |
| Report | Generate summaries and structured reports |
| Feedback Learning | Capture corrections, improve recommendations |

## Data Flow

1. **Ingestion**: Documents → chunk → embed → Qdrant; Sensors → PostgreSQL; Logs → PostgreSQL
2. **Query**: User question → Orchestrator routes to relevant agents
3. **Reasoning**: Knowledge Agent retrieves context → RCA Agent analyzes → Predictive Agent scores risk
4. **Action**: Planner Agent generates maintenance plan → Alert Agent notifies if critical
5. **Output**: Report Agent structures response with citations → Feedback stored

## Deployment

- Frontend: Vercel
- Backend: Render
- Database: Supabase PostgreSQL
- Vector DB: Qdrant Cloud (or embedded for dev)
