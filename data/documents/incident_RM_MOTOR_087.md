# Failure Analysis Report — INC-2024-087

**Equipment:** RM-MOTOR-03 (Rolling Mill Motor 03)
**Date:** 2024-09-15
**Severity:** High
**Downtime:** 18.5 hours

## Incident Summary
Motor exhibited progressive vibration increase over 72 hours before catastrophic bearing failure. Production loss: 450 tonnes hot rolled coil.

## Timeline
- Day 1: Vibration 3.2 mm/s (normal)
- Day 2: Vibration 5.1 mm/s — anomaly alert generated
- Day 3: Vibration 7.8 mm/s — load reduced 15%
- Day 4: Bearing seizure — emergency shutdown

## Root Cause Analysis
**Primary Cause:** Bearing wear due to inadequate lubrication
**Contributing Factors:**
1. Lubrication pump pressure drop (undetected for 48h)
2. Misalignment from thermal expansion after speed increase
3. Delayed response to vibration alert

## Corrective Actions Taken
1. Replaced bearing assembly (BRG-RMM-450)
2. Realigned motor shaft and coupling
3. Repaired lubrication pump
4. Installed continuous vibration monitoring

## Lessons Learned
- Vibration alerts above 5.5 mm/s require inspection within 24 hours
- Motor current fluctuation correlates with bearing degradation
- Maintain minimum 2 bearing kits in stock for rolling mill motors

## Recommendations
Implement predictive maintenance model for RUL estimation. Review spare parts inventory levels quarterly.
