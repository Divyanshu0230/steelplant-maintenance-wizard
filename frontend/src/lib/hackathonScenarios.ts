/** TATA hackathon + plant operational sample diagnosis scenarios */

export type HackathonScenario = {
  id: string;
  name: string;
  equipment: string;
  category: string;
  query: string;
  sensor_data: Record<string, number>;
  fault?: string;
};

export const HACKATHON_SCENARIOS: HackathonScenario[] = [
  {
    id: "bearing",
    name: "Bearing Failure Investigation",
    equipment: "RM-MOTOR-03",
    category: "Vibration",
    query:
      "Equipment has been showing increasing vibration over the past 2 weeks. Latest reading is 8.7 mm/s. Unusual grinding noise audible from bearing housing.",
    sensor_data: { vibration_mm_s: 8.7, temperature_c: 84.0, current_a: 98.0 },
    fault: "F-VIB-03 — Excessive vibration, bearing wear suspected",
  },
  {
    id: "lube-pressure",
    name: "Lubrication Pressure Low",
    equipment: "RM-MOTOR-03",
    category: "Lubrication",
    query:
      "DCS alarm: lube line pressure dropped to 0.42 MPa (SOP minimum 0.55 MPa). Vibration trending up on rolling mill drive. No external oil leak visible.",
    sensor_data: { vibration_mm_s: 6.8, temperature_c: 76.0, current_a: 92.0, pressure_bar: 42.0 },
    fault: "F-LUB-07 — Lubrication pressure below minimum",
  },
  {
    id: "strip-thickness",
    name: "Strip Thickness Variation",
    equipment: "RM-MOTOR-03",
    category: "Process",
    query:
      "Hot rolling operator reports intermittent strip thickness variation and roll gap instability. Motor current fluctuating with load. Vibration elevated on drive end.",
    sensor_data: { vibration_mm_s: 5.6, temperature_c: 58.0, current_a: 31.0 },
    fault: "F-VIB-03 — Vibration high during rolling pass",
  },
  {
    id: "motor-heat",
    name: "Motor Overheating",
    equipment: "BF-BLOWER-01",
    category: "Thermal",
    query:
      "Main drive motor temperature has risen from normal 65°C to 92°C over 3 days. Cooling fan appears to be running.",
    sensor_data: { temperature_c: 92.0, vibration_mm_s: 3.2, current_a: 112.0 },
    fault: "F-TEMP-01 — Motor winding temperature above SOP limit",
  },
  {
    id: "blower-surge",
    name: "Blower Outlet Pressure Surge",
    equipment: "BF-BLOWER-01",
    category: "Pressure",
    query:
      "SCADA flagged outlet pressure spike +12% above baseline during blast furnace gas flow change. Damper response sluggish. Intermittent surge noise from blower casing.",
    sensor_data: { pressure_bar: 128.0, temperature_c: 54.0, vibration_mm_s: 4.8, current_a: 88.0 },
    fault: "F-SPD-02 — Blower outlet pressure surge detected",
  },
  {
    id: "blower-flow",
    name: "Mass Flow Deviation",
    equipment: "BF-BLOWER-01",
    category: "Process",
    query:
      "DCS reports mass flow deviation 8% from setpoint for 45 minutes. Combustion efficiency trending down. op_setting drift observed on control panel.",
    sensor_data: { temperature_c: 56.0, pressure_bar: 118.0, vibration_mm_s: 3.5, current_a: 85.0 },
    fault: "F-FLW-11 — Mass flow deviation from setpoint",
  },
  {
    id: "conveyor-belt",
    name: "Conveyor Belt Misalignment",
    equipment: "CV-SYSTEM-12",
    category: "Mechanical",
    query:
      "Raw material feed conveyor showing belt drift 45 mm east of centerline. Spillage at transfer point. Tracking rollers may need adjustment.",
    sensor_data: { vibration_mm_s: 3.8, temperature_c: 46.0, current_a: 24.0 },
    fault: "F-BLT-06 — Belt drift beyond alignment tolerance",
  },
  {
    id: "conveyor-thermal",
    name: "Conveyor Drive Thermal Trip",
    equipment: "CV-SYSTEM-12",
    category: "Thermal",
    query:
      "Drive motor temperature reached 88°C approaching thermal trip. Belt was overloaded during peak feed rate. Motor restarted after 20 min cooldown.",
    sensor_data: { temperature_c: 88.0, current_a: 32.0, vibration_mm_s: 3.2 },
    fault: "F-THM-08 — Drive motor thermal overload warning",
  },
  {
    id: "crane-brake",
    name: "Hoist Brake Response Delay",
    equipment: "OH-CRANE-02",
    category: "Safety",
    query:
      "Melting shop crane hoist brake response time exceeded limit during lift cycle. Operator reports dragging sensation and slow deceleration. Last critical delay 12h on this asset.",
    sensor_data: { vibration_mm_s: 3.1, temperature_c: 44.0, current_a: 24.0 },
    fault: "F-BRK-04 — Hoist brake response time exceeded",
  },
  {
    id: "crane-encoder",
    name: "Hoist Encoder Dropout",
    equipment: "OH-CRANE-02",
    category: "Electrical",
    query:
      "PLC logged 3 hoist encoder signal dropouts in 10 minutes. Crane forced to slow mode. Cable chain and encoder coupling need inspection before next heavy lift.",
    sensor_data: { vibration_mm_s: 2.9, current_a: 22.5, temperature_c: 41.0 },
    fault: "F-ENC-09 — Encoder signal dropout on hoist axis",
  },
  {
    id: "pump-seal",
    name: "Cooling Pump Seal Leak",
    equipment: "BF-PUMP-05",
    category: "Utilities",
    query:
      "Seal leak sensor active — flow to drain detected on cooling water pump. Utilities header pressure dipping during peak demand. 5.5h downtime logged last month on this pump.",
    sensor_data: { pressure_bar: 88.0, temperature_c: 48.0, current_a: 26.0 },
    fault: "F-SEL-05 — Mechanical seal leak detected",
  },
  {
    id: "hydraulic",
    name: "Discharge Pressure Low",
    equipment: "BF-PUMP-05",
    category: "Pressure",
    query:
      "Discharge pressure dropped from 0.38 MPa SOP to 0.31 MPa. Suction strainer may be blocked. Heat exchanger efficiency loss suspected in utilities loop.",
    sensor_data: { pressure_bar: 31.0, temperature_c: 72.0, current_a: 29.0 },
    fault: "F-PRS-10 — Discharge pressure below minimum",
  },
  {
    id: "cavitation",
    name: "Pump Cavitation Suspected",
    equipment: "BF-PUMP-05",
    category: "Hydraulic",
    query:
      "High motor current at reduced discharge pressure. Cavitation noise at impeller. NPSH may be insufficient after recent intake valve adjustment.",
    sensor_data: { pressure_bar: 92.0, current_a: 30.0, temperature_c: 50.0, vibration_mm_s: 2.4 },
    fault: "F-PRS-10 — Low pressure with elevated current",
  },
  {
    id: "rul",
    name: "Predict Remaining Useful Life",
    equipment: "RM-MOTOR-03",
    category: "Predictive",
    query:
      "Estimate remaining useful life for this equipment based on current sensor trends, delay logs, and maintenance history. Include failure probability.",
    sensor_data: {},
    fault: undefined,
  },
  {
    id: "fleet-compare",
    name: "Compare Degradation Trend",
    equipment: "BF-BLOWER-01",
    category: "Predictive",
    query:
      "How degraded is this blower compared to normal baseline? What maintenance window do you recommend before risk becomes critical?",
    sensor_data: { temperature_c: 68.0, vibration_mm_s: 4.2, current_a: 90.0 },
    fault: undefined,
  },
];

export const SCENARIO_CATEGORIES = Array.from(new Set(HACKATHON_SCENARIOS.map((s) => s.category)));
