# Submission Checklist

## Deliverables

- [x] Complete source code (backend + frontend)
- [x] System architecture document
- [x] Technology stack documentation
- [x] Data flow and system flow
- [x] Model design and reasoning pipeline
- [x] Alerting and prediction logic
- [x] Assumptions and limitations
- [x] Installation and configuration guide
- [x] Sample input/output demonstration
- [ ] Screen recording (user to record using DEMO_SCRIPT.md)

## Data integration (complete)

- [x] NASA C-MAPSS FD001 sensor history
- [x] Operational CSVs (delay logs, fault codes, fault messages)
- [x] TATA hackathon samples (`data/tata-hackathon/`)
- [x] Diagnosis API + scenario demos on dashboard

## Functional Requirements

- [x] FR1: LLM contextual reasoning + **domain-adapted steel SLM** (bonus merit)
- [x] FR2: Knowledge integration (manuals, SOPs, logs, reports)
- [x] FR3: Natural language multi-turn conversation
- [x] FR4: Explainable recommendations with citations
- [x] FR5: Abnormality detection + failure prediction
- [x] FR6: Feedback-driven improvement loop (diagnosis stars + domain retrain)
- [x] FR7: Real-time alerting capability

## Bonus / Merit Points

- [x] FR1 fine-tune domain-specific model (`SteelDomainSLM` + `train_domain_adapter.py`)
- [x] TATA `POST /knowledge/ai-answer` with role-aware answers
- [x] TATA diagnosis + feedback APIs
- [x] ISO 10816 vibration thresholds on sensor ingest
- [x] C-MAPSS-trained RUL + anomaly models
- [x] All §7 optional enhancements (6/6)

## Optional Enhancements

- [x] Conversational interface
- [x] Visualization dashboard
- [x] Simulated IoT sensor ingestion
- [x] Dynamic knowledge base per equipment
- [x] Digital maintenance logbook
- [x] Role-based access (JWT + roles)

## Pre-Submission Steps

1. Run `python scripts/seed_data.py` (includes domain adapter train)
2. Start backend: `uvicorn app.main:app --port 8000`
3. Start frontend: `npm run dev`
4. Login: `engineer@steelplant.com` / `password123` (or supervisor/admin demo buttons)
5. Record demo following `docs/DEMO_SCRIPT.md`
6. ZIP entire `steelplant-maintenance-wizard/` folder
