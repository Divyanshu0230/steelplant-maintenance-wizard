# Failure Analysis Report — INC-2025-042

**Equipment:** BF-BLOWER-01 (Blast Furnace Blower Unit 01)
**Date:** 2025-05-15
**Severity:** High
**Downtime:** 3.2 hours

## Incident Summary
Blower outlet pressure surge during peak blast furnace operation. Automatic damper response insufficient; operators reduced furnace output 15%.

## Root Cause Analysis
**Primary Cause:** Impeller fouling from dust accumulation
**Contributing Factors:**
1. Missed 90-day impeller inspection
2. Inlet filter differential pressure not alarmed
3. Process gas temperature spike increased deposit rate

## Corrective Actions
1. Online washing of impeller blades
2. Replaced inlet filter elements
3. Added differential pressure alarm at 2.5 kPa

## Recommendations
Correlate pressure (`sensor_7` proxy) with mass flow deviations. Schedule impeller inspection when surge events exceed 2 per week.
