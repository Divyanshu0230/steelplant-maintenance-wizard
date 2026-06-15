# Demo Script — SteelPlant Maintenance Wizard

**Duration:** 5-7 minutes

## Setup Before Recording

1. Start backend: `uvicorn app.main:app --reload --port 8000`
2. Run seed: `python scripts/seed_data.py`
3. Start frontend: `npm run dev`
4. Open http://localhost:3000

## Demo Flow

### Scene 1: Dashboard Overview (30 sec)
- Show equipment health bar chart
- Point out RM-MOTOR-03 in **critical** risk state
- Highlight active alerts panel

### Scene 2: Real-Time Alert Context (45 sec)
- Explain RM-MOTOR-03 has elevated vibration from sensor data
- Show health score and RUL estimate
- Reference prior incident INC-2024-087 in knowledge base

### Scene 3: Conversational Troubleshooting (2 min)
- Select RM-MOTOR-03
- Ask: *"What's causing the vibration spike on Motor 03?"*
- Show response with:
  - Root cause analysis (bearing wear, confidence scores)
  - Citations from SOP and incident report
  - Risk level: Critical
  - RUL and failure probability

### Scene 4: Maintenance Recommendations (1 min)
- Show immediate, short-term, long-term actions
- Show spare parts recommendation (BRG-RMM-450, 3-day lead time)
- Explain risk scoring considers criticality + spares

### Scene 5: Feedback Loop (30 sec)
- Click "Mark recommendation as helpful"
- Explain feedback improves future recommendations

### Scene 6: Technical Depth (1 min)
- Open http://localhost:8000/docs
- Show multi-agent chat API, prediction API, alert API
- Mention: LangGraph, RAG, XGBoost/Isolation Forest, Qdrant

### Scene 7: Closing (30 sec)
- Summarize: Not a chatbot — an AI Maintenance Command Center
- Reduces downtime, improves diagnostic accuracy, enables proactive maintenance

## Key Talking Points

- 8 specialized AI agents orchestrated via LangGraph
- Explainable outputs with document citations
- Predictive maintenance with RUL estimation
- Real-time anomaly detection and alerting
- Feedback-driven continuous improvement
