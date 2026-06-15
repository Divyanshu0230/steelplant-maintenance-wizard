-- SteelPlant Maintenance Wizard — Database Schema

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    equipment_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    criticality VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'operational',
    installation_date DATE,
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_equipment_type ON equipment(equipment_type);
CREATE INDEX idx_equipment_status ON equipment(status);

CREATE TABLE IF NOT EXISTS sensor_data (
    id BIGSERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    temperature FLOAT,
    vibration FLOAT,
    pressure FLOAT,
    motor_current FLOAT,
    operational_setting_1 FLOAT,
    operational_setting_2 FLOAT,
    operational_setting_3 FLOAT,
    cycle INTEGER,
    health_indicator FLOAT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sensor_equipment_time ON sensor_data(equipment_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS failure_history (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    failure_date TIMESTAMPTZ NOT NULL,
    failure_mode VARCHAR(255),
    root_cause TEXT,
    downtime_hours FLOAT,
    repair_action TEXT,
    severity VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_records (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(50) NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL,
    performed_by VARCHAR(255),
    description TEXT NOT NULL,
    parts_used TEXT,
    duration_hours FLOAT,
    cost FLOAT,
    outcome VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_equipment ON maintenance_records(equipment_id, performed_at DESC);

CREATE TABLE IF NOT EXISTS spare_parts (
    id SERIAL PRIMARY KEY,
    part_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100),
    quantity_available INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 1,
    unit_cost FLOAT,
    supplier VARCHAR(255),
    lead_time_days INTEGER DEFAULT 7,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_requests (
    id SERIAL PRIMARY KEY,
    spare_part_id INTEGER REFERENCES spare_parts(id),
    equipment_id INTEGER REFERENCES equipment(id),
    quantity_requested INTEGER NOT NULL,
    urgency VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'pending',
    requested_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    equipment_type VARCHAR(100),
    file_path VARCHAR(1000),
    content_hash VARCHAR(64),
    chunk_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    prediction_type VARCHAR(50) NOT NULL,
    failure_probability FLOAT,
    rul_cycles INTEGER,
    degradation_score FLOAT,
    risk_level VARCHAR(20),
    model_version VARCHAR(50),
    features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_equipment ON predictions(equipment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS equipment_health_scores (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    health_score FLOAT NOT NULL,
    anomaly_score FLOAT,
    risk_level VARCHAR(20),
    factors JSONB DEFAULT '{}',
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomaly_events (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ NOT NULL,
    anomaly_type VARCHAR(100),
    severity VARCHAR(20),
    sensor_name VARCHAR(100),
    observed_value FLOAT,
    expected_range VARCHAR(100),
    detection_method VARCHAR(50),
    is_resolved BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    alert_level VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(100),
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_level ON alerts(alert_level, created_at DESC);
CREATE INDEX idx_alerts_equipment ON alerts(equipment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    alert_id INTEGER REFERENCES alerts(id),
    channel VARCHAR(50),
    status VARCHAR(50),
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    equipment_id INTEGER REFERENCES equipment(id),
    title VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    conversation_id INTEGER REFERENCES conversations(id),
    equipment_id INTEGER REFERENCES equipment(id),
    feedback_type VARCHAR(50) NOT NULL,
    original_recommendation TEXT,
    correction TEXT,
    rating INTEGER,
    outcome VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL,
    equipment_id INTEGER REFERENCES equipment(id),
    title VARCHAR(500) NOT NULL,
    content JSONB NOT NULL,
    generated_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
