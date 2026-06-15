# Data Sources Documentation

This folder explains **where every number, chart, and alert in the project comes from**.

**Start here:** [WHERE_DATA_COMES_FROM.md](./WHERE_DATA_COMES_FROM.md)

Use this when judges, teammates, or you ask:
- Is this real Tata plant data?
- Is this from C-MAPSS?
- Is this fake / simulated?
- Why do alert counts show 50, 70, or 1?

**Short honest answer:** Sensor time series come from the **real NASA C-MAPSS research dataset** (jet engines, not a steel plant). Equipment names, plant layout, downtime ticker, vibration spectrum, and live-stream ticks are **demo/synthetic layers** on top. Health, RUL, risk, and alerts are **computed by ML** from that imported data.
