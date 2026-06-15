# System Design Document

## Problem Statement Alignment

| Requirement | Implementation |
|-------------|----------------|
| LLM contextual reasoning | LangGraph 8-agent orchestration + Gemini/Ollama |
| Knowledge integration | RAG over manuals, SOPs, logs, failure reports |
| Natural language interaction | Multi-turn chat API with conversation history |
| Explainable recommendations | Citations, confidence scores, evidence chains |
| Abnormality detection | Isolation Forest + statistical thresholds |
| Failure prediction | RUL estimation via GradientBoosting + heuristics |
| Feedback-driven improvement | Feedback table injected into agent context |
| Real-time alerting | Alert engine with 4 severity levels |

## Agent Pipeline

```
User Query
    → Document Intelligence Agent (RAG retrieval)
    → Root Cause Analysis Agent (LLM + evidence)
    → Predictive Maintenance Agent (RUL + anomaly)
    → Maintenance Planner Agent (prioritized actions)
    → Spare Parts Agent (procurement recommendations)
    → Alert Agent (severity-based notifications)
    → Report Agent (structured summary + risk scoring)
    → Feedback Learning Agent (context enrichment)
    → Structured Response
```

## Data Flow

1. **Startup**: Seed script loads equipment, sensors, spare parts, documents
2. **Document Ingestion**: PDF/MD → chunk → embed → Qdrant
3. **Sensor Ingestion**: Real-time readings → anomaly check → alert if needed
4. **Chat Query**: Orchestrator runs full agent pipeline
5. **Output**: JSON with diagnosis, actions, citations, alerts
6. **Feedback**: Stored and injected into future agent prompts

## Assumptions

- NASA C-MAPSS patterns mapped to steel equipment (no real steel IoT data)
- Gemini API optional; mock LLM provides demo-quality responses
- SQLite for local dev; PostgreSQL for production deployment
- Embedded Qdrant for local dev; Qdrant Cloud for production

## Limitations

- ML models use heuristic fallback without pre-trained C-MAPSS artifacts
- No real-time WebSocket streaming (polling-based dashboard)
- PDF report generation scaffolded (JSON reports fully functional)
- Domain-specific SLM fine-tuning not implemented (prompt engineering used)
