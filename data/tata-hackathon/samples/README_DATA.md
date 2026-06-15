# Data Sources — Maintenance Wizard

## About the Data Approach

No proprietary Tata Steel operational data was available for this hackathon submission.
The system is designed to work with **any data source** — real plant data, Kaggle datasets,
or synthetic data — through the sensor ingestion API.

## Data Used in This Submission

### 1. Synthetic Operational Data (seeded at startup)
- 8 equipment assets modeled after real steel plant equipment
- 96 hours of sensor readings per equipment (vibration, temperature, pressure, current)
- Parameters follow real-world standards: ISO 10816 vibration thresholds, industry-standard alarm levels
- 3 active alerts based on real fault scenarios
- 5 spare parts with realistic procurement data
- 10 maintenance log entries with realistic root causes

### 2. Domain Knowledge Base (built-in)
The knowledge base contains real engineering information compiled from:
- ISO 10816: Mechanical vibration — evaluation of machine vibration
- SKF Bearing Maintenance Handbook
- Steel plant maintenance best practices
- PLC/SCADA fault code reference standards

### 3. Sample RUL Dataset (rul_sensor_data_sample.csv)
- Simulates progressive bearing degradation over 90 days
- Compatible with NASA CMAPSS bearing dataset format (public domain)
- Shows real degradation curve: slow initial wear, accelerating near failure
- Used to demonstrate RUL prediction capability

### 4. Equipment Delay Log (sample_equipment_delay_log.csv)
- 10 realistic equipment delay records
- Based on common failure modes in blast furnaces, CCM, and rolling mills
- Includes fault codes, root causes, and corrective actions

### 5. Sensor Readings Log (sample_sensor_readings.csv)
- 29 sensor readings across 3 equipment types
- Shows normal operation progressing to anomaly states
- Demonstrates threshold breach detection

## How to Use Real Data

To connect real plant data, use the sensor ingestion API:

```
POST /api/v1/sensors/ingest
{
  "equipment_id": "<id>",
  "readings": [
    {"sensor_type": "vibration_mm_s", "value": 4.2, "unit": "mm/s"},
    {"sensor_type": "temperature_c", "value": 71.3, "unit": "deg C"}
  ]
}
```

For bulk historical data, iterate over CSV rows and POST each reading.
The system will automatically detect anomalies and generate alerts.

## Compatible Public Datasets

The system is compatible with these public datasets (available on Kaggle):
- NASA CMAPSS Turbofan Engine Degradation dataset
- Case Western Reserve University Bearing Dataset
- PRONOSTIA Bearing Dataset (IEEE PHM 2012 Challenge)
- Any time-series sensor dataset with vibration/temperature readings
