# Process Defects Guide — Steel Plant Operations

This document maps **process-related defects** to sensor and operational indicators for maintenance engineers.

## Rolling Mill (RM-MOTOR-03)

| Process defect | Indicators | Typical cause |
|----------------|------------|---------------|
| Strip thickness variation | Vibration rise + motor current fluctuation | Roll gap / bearing wear |
| Thermal overload in rolling | Temperature rise + current rise at constant speed | Insufficient cooling, excessive reduction |
| Lubrication starvation | Pressure drop + vibration increase | Clogged filter, pump fault |

## Blast Furnace Blower (BF-BLOWER-01)

| Process defect | Indicators | Typical cause |
|----------------|------------|---------------|
| Furnace gas flow instability | Pressure surge + op_setting deviation | Impeller fouling, damper fault |
| Combustion efficiency drop | op_setting_2 drift + temperature rise | Inlet filter blockage |

## Conveyor (CV-SYSTEM-12)

| Process defect | Indicators | Typical cause |
|----------------|------------|---------------|
| Feed rate interruption | Motor current drop then thermal rise | Belt slip, misalignment |
| Material segregation | Intermittent current spikes | Uneven loading, idler wear |

## Overhead Crane (OH-CRANE-02)

| Process defect | Indicators | Typical cause |
|----------------|------------|---------------|
| Lift cycle delay | Motor current plateau + encoder faults | Brake drag, alignment |
| Load swing instability | Vibration on hoist axis | Hook wear, rail misalignment |

## Cooling Pump (BF-PUMP-05)

| Process defect | Indicators | Typical cause |
|----------------|------------|---------------|
| Utilities pressure deficit | Pressure below SOP + seal leak fault | Seal wear, cavitation |
| Heat exchanger efficiency loss | Flow rate drop at constant speed | Strainer blockage |

## Maintenance rule
When a process defect is suspected, cross-check **SCADA fault codes**, **delay logs**, and **sensor trends** before scheduling shutdown.
