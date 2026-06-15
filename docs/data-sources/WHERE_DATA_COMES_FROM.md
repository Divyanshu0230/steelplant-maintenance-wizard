# Where Data Comes From — Complete Feature Map

> **One-page honesty guide for the Steel Plant Maintenance Wizard hackathon demo.**  
> Nothing here is live Tata SCADA. The app uses **NASA C-MAPSS** sensor history + **ML models** + **demo/simulated UI layers**.

---

## Quick legend

| Tag | Meaning |
|-----|---------|
| **C-MAPSS** | Real NASA research dataset imported into our database |
| **ML computed** | Calculated by our models from C-MAPSS sensor rows |
| **Formula** | Rule-based math on top of ML outputs (not a real meter) |
| **Demo / synthetic** | Made for UI storytelling — not from any real plant |
| **Static seed** | Hardcoded fictional records (names, spare parts, docs) |
| **Simulated tick** | User clicks "Simulate" / "Live Stream" → app invents the next sensor row |

---

## What is C-MAPSS? (You don't need to open the files)

**C-MAPSS** = *Commercial Modular Aero-Propulsion System Simulation* — a **NASA public research dataset**.

| Property | Detail |
|----------|--------|
| **What it really is** | Time-series data from **simulated aircraft jet engines** running until failure |
| **File we use** | `data/cmapss/train_FD001.txt` |
| **FD001** | One operating condition, one fault mode, ~100 engine "units" |
| **Each row** | One engine **cycle** (one flight-like operation) |
| **Columns per row** | `unit`, `cycle`, 3 operating settings, **21 sensor readings** (26 columns total, space-separated, no header) |
| **Not included** | Steel plant names, blast furnaces, Tata locations — we invented those |

### How we map C-MAPSS → "steel plant"

Script: `scripts/import_cmapss.py` → called by `scripts/seed_data.py`

| C-MAPSS unit | Our fictional equipment |
|--------------|-------------------------|
| Unit 1 | BF-BLOWER-01 (Blast Furnace Blower) |
| Unit 11 | RM-MOTOR-03 (Rolling Mill Motor — picked for high degradation demo) |
| Unit 25 | CV-SYSTEM-12 (Conveyor) |
| Unit 50 | OH-CRANE-02 (Overhead Crane) |
| Unit 75 | BF-PUMP-05 (Blast Furnace Pump) |

| C-MAPSS column | Stored as plant sensor |
|----------------|------------------------|
| `sensor_2` | temperature |
| `sensor_4` | vibration |
| `sensor_7` | pressure |
| `sensor_11` | motor_current |
| `op_setting_1..3` | operational_setting_1..3 |

**RUL in import:** `rul = max_cycle - current_cycle` per engine unit (remaining cycles until that engine's last recorded cycle in the file).

**If C-MAPSS file is missing:** `seed_data.py` generates **fully synthetic** 120-cycle series per equipment (`metadata.source = "synthetic_seed"`).

**Chart display note:** Frontend `sensorNormalize.ts` rescales raw C-MAPSS numbers into readable plant units (e.g. 42–92°C). **Charts show scaled values; ML on the backend uses raw DB values.**

---

## The 3 layers of truth (tell judges this)

```
Layer 1 — REAL research data     →  C-MAPSS sensor cycles in SQLite (SensorData table)
Layer 2 — COMPUTED intelligence  →  Health %, RUL, risk, alerts (ML + rules on Layer 1)
Layer 3 — DEMO presentation      →  3D layout, vibration bars, downtime ticker, live-stream ticks
```

---

## 8-Agent AI Pipeline — why only 6 were ticked before

The dashboard panel lists **8 conceptual agents**. The green check means **“implemented on at least one path”** — not “8 separate LLM calls on every chat message.”

| Agent | Actually runs where | Real or label? |
|-------|---------------------|----------------|
| **Document Agent** | Chat fast pipeline (RAG) | Real — Qdrant search over `data/documents/` |
| **RCA Agent** | Chat (LLM + sensor context) | Real step in fast pipeline / orchestrator |
| **Predictive Agent** | Chat + 60s monitoring scan | Real — RUL + anomaly ML |
| **Planner Agent** | Chat (recommended actions) | Real — ranked actions in response |
| **Spare Parts Agent** | Chat (stock lookup) | Real — `SparePart` DB query |
| **Alert Agent** | Chat + 60s monitoring | Real — `MonitoringService` creates `Alert` rows |
| **Report Agent** | PDF report API only | Real — `POST /reports`, not every chat |
| **Feedback Agent** | Chat context + thumbs up/down | Real — `feedback_learning.py`, passive learning |

**Why 6 looked ticked before:** Old UI only checked `chat` OR `dashboard`. **Report Agent** (PDF only) and **Feedback Agent** (on submit, not dashboard loop) had both flags `false`, so they showed empty circles even though they work.

**Important for judges:** Normal chat uses **one fast pipeline** (RAG + ML + 1 Gemini call). The full **8-node LangGraph orchestrator** runs mainly for report generation, not on every dashboard load.

---


| Feature | What you see | Data source | How it's produced |
|---------|--------------|-------------|-------------------|
| **Total / Healthy / Warning assets** | StatCards | **ML computed** + thresholds | `GET /plant/fleet-summary`. Buckets from `EquipmentHealthScore`: critical/high or score&lt;40 → critical; medium or score&lt;70 → warning; else healthy |
| **Active Alerts (top StatCard)** | Number | **ML-generated alerts** in DB | Counts **all** unacknowledged rows in `Alert` table — **no 50 cap** on this number |
| **Plant Bottleneck** | Equipment code | **ML computed** | `GET /plant/command-center`. Highest `priority_score = (100 - health) + failure_probability×50` |
| **Critical Alerts (command center card)** | Number | **ML alerts** (subset) | Only **high + critical** levels among the **last 20** unacknowledged alerts — can show **1** even if many alerts exist |
| **Active Alerts (command center)** | Number | **ML alerts** (subset) | Count of those same **20** recent unacknowledged alerts (not total) |
| **Low Stock Parts** | Count | **Static seed** | `SparePart` rows from `seed_data.py` where `quantity < minimum_stock` |
| **Alert list panel** | List of alerts | **ML alerts** | `GET /api/v1/alerts` — **hard limit 50** rows returned. UI shows badge = `filteredAlerts.length` (max **50**). Only **8** rendered on screen |
| **Sensor chart** | Temp / vibration lines | **C-MAPSS** (+ simulated ticks if you ran demo) | `GET /sensors/history?limit=120` from `SensorData` table |
| **Equipment health cards** | Health %, risk | **ML computed** | Latest `EquipmentHealthScore` per asset |
| **Simulate Cycle button** | Graph moves, alerts may rise | **Simulated tick** | `POST /sensors/simulate-tick` → multiplies last reading ×**1.02**, reruns ML scan |
| **Failure Demo / Guided Demo** | Faster degradation | **Simulated tick ×5** | Same as above, repeated quickly |
| **Agent Pipeline panel** | Agent names | **Static UI labels** | Describes pipeline steps; chat uses fast pipeline (1 LLM call), not 8 separate live agents |
| **Data Source banner** | C-MAPSS notice | **Static text** | Explains mapping |

### Why alert numbers look confusing (50 vs 70 vs 1)

| Number you see | Why |
|----------------|-----|
| **Active alerts stuck at 50** | The **alert list API** returns max **50** (`alert_service.py` `limit=50`, `alerts.py`). The list badge counts from that response, so it **cannot exceed 50** even if the database has more. |
| **Active alerts increasing** | **Not random fake.** Each **Simulate Cycle**, **Failure Demo**, or **Live Stream** tick adds degraded sensor rows → ML scan runs → new alerts if thresholds hit. Dedup blocks same equipment+source for **2 hours** if still unacknowledged. |
| **70** | **Not an alert count.** Used as **health threshold**: maintenance debt only counts assets with `health_score < 70`; fleet "warning" bucket uses `score < 70`. |
| **Critical alert = 1** | Command center `critical_alert_count` only looks at **20 most recent** unacknowledged alerts and counts how many are `high` or `critical`. If only 1 of those 20 qualifies, you see **1**. |
| **Fleet active_alerts vs list 50** | Fleet summary counts **all** unacknowledged alerts (can be &gt;50). Alert panel list is capped at 50 — **two different queries**. |

---

## Live Monitoring (`/live`)

| Feature | What you see | Data source | How it's produced |
|---------|--------------|-------------|-------------------|
| **3D Plant Digital Twin** | Colored blocks, health height | **ML computed** + **demo layout** | `GET /monitoring/status`. Health/risk from DB. Screen positions are **fixed CSS map** in `Plant3DScene.tsx` — not real coordinates |
| **Map / 3D toggle** | Two views | **Demo layout** | Same ML data, different visualization |
| **Downtime Risk Ticker** | ₹/min scrolling numbers | **Formula + demo animation** | `debtInr` from maintenance-debt API. `ratePerMin = max(1200, debt/480 + criticalCount×850)`. **Accumulated ₹** increments every **1 second in the browser** — **not real downtime** |
| **Failure Replay** | Scrubber + chart | **C-MAPSS** (DB history) | `GET /sensors/history?limit=120`. Replays stored cycles. Labels NORMAL / DEGRADING / FAILURE ZONE are **frontend thresholds** on `health_indicator` |
| **Vibration Spectrum** | 24 bars from last 24 cycles | **C-MAPSS** (DB history) | `GET /sensors/history` for selected equipment — real vibration trend, not random |
| **Operations Scorecard** | Grade A–F, ops score | **ML computed** (client math) | `avgHealth` from assets; `opsScore = avgHealth - criticalCount×12` |
| **Live Stream button** | "LIVE", events appear | **Simulated tick** | Every **3s** calls `simulate-tick` round-robin on all 5 equipment → new `SensorData` row (×1.02 degradation) → ML scan → WebSocket `sensor_tick` |
| **WebSocket indicator** | Green dot | **Connection status** | `WS /api/v1/ws/monitoring` — pushes ticks + scan updates |
| **Event feed** | `[sensor_tick]`, `[alert]` lines | **In-memory log** | `monitoring_events.py` deque (max 200). Populated by ML scans + simulate. API returns max **50** events |
| **Shift Briefing** | Text summary | **DB alerts + logs + ML** | Alerts last 8h + maintenance records + lowest health asset |
| **Maintenance Debt card** | ₹ total | **Formula on ML health** | `GET /monitoring/maintenance-debt`. Only assets with **health &lt; 70**. `debt = hourly_cost × 8 × defer_days × failure_probability × 0.01`. Hourly costs are **static table** by equipment criticality |
| **Contagion Risk** | Parent → child edges | **Static graph + ML probability** | Hardcoded `CONTAGION_GRAPH` in `monitoring.py` + `failure_probability` from predictions |
| **What-If Simulator** | Projected RUL / cost | **Formula on ML** | `projected_rul = base_rul - delay_days×3`, `projected_prob = base_prob + delay_days×0.04` |
| **Predictive Calendar** | Service dates | **ML RUL + assumption** | `days_until = rul_cycles // 3` (assumes 3 cycles/day) |
| **Asset cards (bottom row)** | Health, RUL, pulse | **ML computed** | From `/monitoring/status` |
| **Background ML scan** | Alerts without clicking | **ML computed** | `main.py` runs `run_full_scan()` every **60 seconds** on all equipment |

### What "Live Stream" actually is

**Not** a connection to Tata plant sensors.

1. You click **Start Live Stream**
2. Frontend calls `POST /sensors/simulate-tick` every 3 seconds
3. Backend copies the latest DB row, multiplies sensors by **1.02**, adds `metadata.live_simulated: true`
4. ML scan runs → health/risk/alerts update
5. WebSocket broadcasts the tick

So live stream values are **real C-MAPSS history extended by simulated degradation**, not a live industrial feed.

---

## Equipment pages (`/equipment`, `/equipment/[code]`)

| Feature | Data source | How |
|---------|-------------|-----|
| Fleet list | **Static seed** + **ML health** | Equipment from `seed_data.py`; health from latest scan |
| Detail graphs | **C-MAPSS** (+ simulated if demo ran) | `GET /sensors/history` |
| Health / RUL / risk badges | **ML computed** | `EquipmentHealthScore`, `Prediction` tables |
| On-demand Predict button | **ML computed** | Runs RUL + anomaly on latest readings |

---

## Chat (`/chat`)

| Feature | Data source | How |
|---------|-------------|-----|
| Sensor context in reply | **C-MAPSS** (latest DB row) | `fast_pipeline.py` reads latest `SensorData` |
| RAG citations | **Static seed docs** | Markdown in `data/documents/` → Qdrant vectors |
| Health / RUL / risk in answer | **ML computed** | Same models as monitoring scan |
| Spare part suggestions | **Static seed** | `SparePart` table |
| Full Gemini answer | **External LLM** | When API key works |
| Offline / quota fallback | **Rule-based templates** | `enhanced_offline` — **not** full Gemini |
| Alerts from chat | **ML rules** | Created if anomaly or `failure_probability ≥ 0.7` |

---

## Other sections

| Section | Data source | Notes |
|---------|-------------|-------|
| **Spare Parts** | **Static seed** | Fictional inventory; request/procurement writes to DB |
| **Procurement** | **Static seed** + user actions | Seeded orders; new requests from UI |
| **Logbook** | **Static seed** + AI/chat entries | Manual + chat-saved diagnoses |
| **Knowledge base** | **Static seed markdown** | `data/documents/*.md` ingested to Qdrant |
| **Reports / PDF** | **ML + chat state** | Generated from last analysis |
| **Feedback** | **User input** | Stored in DB + `data/feedback_learnings.json` |
| **Delay logs** | **Operational CSV** | `data/operational/delay_logs.csv` → DB → risk prioritization |
| **Fault messages** | **Operational CSV** | `data/operational/fault_messages.csv` → DB → chat + dashboard |
| **Process defects** | **Rules + sensors** | `process_defect_service.py` + `process_defects_steel_operations.md` |

---

## How HIGH / MEDIUM / CRITICAL risk and alerts are created

**Not manually faked.** They come from ML scan (`monitoring_service.py` → `_scan_equipment`) on every 60s scan and every simulate tick.

### Health score
```
health_score = max(0, (1 - degradation_score) × 100)
```
`degradation_score` from RUL model (`rul_predictor.py`).

### RUL & failure probability
- **Trained model** if `data/models/rul_*.joblib` exists (trained from C-MAPSS via `scripts/train_models.py`)
- **Heuristic fallback** if no model: combines vibration, temperature, motor_current

### Risk level (stored in DB)
`RiskEngine.assess()` — weighted score from:
- Equipment criticality (seeded)
- Failure probability
- Anomaly severity
- Spare stock & lead time

Thresholds: critical ≥ 0.8, high ≥ 0.6, medium ≥ 0.35, else low.

### When alerts are created

| Source tag | Condition |
|------------|-----------|
| `anomaly_monitor` | ML anomaly detector flags abnormal readings |
| `predictive_maintenance` | `failure_probability ≥ 0.6` (critical if ≥ 0.85) |
| `risk_engine` | `risk_level == critical` AND `health_score < 50` |
| `realtime_sensor_ingest` | External POST to `/sensors/ingest` |
| `anomaly_detector` (chat) | Chat pipeline detects anomaly |

**Dedup:** Same equipment + same source won't create another alert for **2 hours** if previous is still unacknowledged.

### Why C-MAPSS engines look "critical" in a steel plant demo

Unit **11** (RM-MOTOR-03) was chosen because it has **strong degradation** in FD001 — so failure probability and alerts are **real for that dataset**, just **re-labelled** as a rolling mill motor. The high/critical readings reflect **engine wear patterns in C-MAPSS**, not a real Tata motor.

---

## Equipment graphs — exact pipeline

```
train_FD001.txt
    → import_cmapss.py (seed)
    → SensorData table (per cycle, per equipment)
    → [optional] simulate-tick appends new rows (×1.02)
    → GET /sensors/history
    → frontend sensorNormalize.ts (display scaling)
    → SensorChart / FailureReplay chart
```

---

## File reference (for developers)

| Path | Role |
|------|------|
| `data/cmapss/train_FD001.txt` | Raw C-MAPSS FD001 training data |
| `scripts/import_cmapss.py` | Parse & map units → equipment |
| `scripts/seed_data.py` | Seed DB, import C-MAPSS or synthetic fallback |
| `scripts/train_models.py` | Train ML from C-MAPSS |
| `backend/app/services/monitoring_service.py` | ML scan, alerts, simulate tick |
| `backend/app/api/routes/monitoring.py` | Live status, debt, contagion, what-if |
| `backend/app/api/routes/plant.py` | Fleet summary, command center |
| `backend/app/api/routes/sensors.py` | Sensor history, simulate-tick |
| `backend/app/services/alert_service.py` | Alerts (list limit **50**) |
| `backend/app/services/monitoring_events.py` | In-memory event feed (max **200**, return **50**) |
| `backend/app/ml/rul_predictor.py` | RUL, degradation, failure probability |
| `backend/app/ml/risk_engine.py` | Risk level |
| `backend/app/ml/anomaly_detector.py` | Anomaly detection |
| `frontend/src/lib/sensorNormalize.ts` | Display scaling for charts |
| `frontend/src/components/DowntimeTicker.tsx` | Client-side ₹ counter (demo) |
| `frontend/src/components/VibrationSpectrum.tsx` | Random bars (demo) |
| `frontend/src/components/FailureReplayScrubber.tsx` | Replay DB sensor history |
| `frontend/src/components/Plant3DScene.tsx` | Visual twin (layout is fictional) |

---

## One-line answers for demo Q&A

| Question | Answer |
|----------|--------|
| Is this live Tata plant data? | **No.** Research dataset + ML + demo layers. |
| Is sensor history real? | **Yes — real C-MAPSS cycles**, mapped to fictional steel equipment names. |
| Are equipment names real? | **No — fictional** (seeded in `seed_data.py`). |
| Are health/RUL/alerts real? | **Computed by our ML** from that sensor history — not from Tata SCADA. |
| Is the 3D plant real? | **No — visual demo** with fixed layout. |
| Is downtime ticker real? | **No — animated formula** for storytelling. |
| Is vibration spectrum real? | **Yes — last 24 C-MAPSS vibration cycles** for selected equipment. |
| What is Failure Replay? | **Replay of stored C-MAPSS cycles** from the database. |
| What is Live Stream? | **Simulated sensor ticks** (×1.02 degradation every 3s). |
| Why so many alerts? | ML thresholds + simulate/demo adding degraded cycles. |
| Why alerts stop at 50 in the list? | **API limit=50** on `GET /alerts`. |
| Why critical alert shows 1? | Command center only counts **high/critical in last 20** alerts. |

---

*Last updated: project hackathon build. Read this before recording your demo or answering judge questions.*
