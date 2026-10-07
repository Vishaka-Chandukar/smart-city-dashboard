-- Smart City Dashboard SQLite Schema (Hubballi, Karnataka)
-- Step 5: Database Migration

PRAGMA foreign_keys = ON;

-- Areas Table
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Time Ranges Table
CREATE TABLE IF NOT EXISTS time_ranges (
  id TEXT PRIMARY KEY,
  display_order INTEGER NOT NULL
);

-- Traffic Readings Table
CREATE TABLE IF NOT EXISTS traffic_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id TEXT NOT NULL,
  time_range TEXT NOT NULL,
  congestion INTEGER NOT NULL,
  avg_speed INTEGER NOT NULL,
  vehicle_count INTEGER NOT NULL,
  baseline_congestion INTEGER NOT NULL,
  baseline_avg_speed INTEGER NOT NULL,
  baseline_vehicle_count INTEGER NOT NULL,
  chart_labels TEXT NOT NULL,
  chart_series_name TEXT NOT NULL,
  chart_values TEXT NOT NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE INDEX IF NOT EXISTS idx_traffic_lookup ON traffic_readings(area_id, time_range);

-- Electricity Readings Table
CREATE TABLE IF NOT EXISTS electricity_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id TEXT NOT NULL,
  time_range TEXT NOT NULL,
  consumption INTEGER NOT NULL,
  peak_demand INTEGER NOT NULL,
  grid_load INTEGER NOT NULL,
  baseline_consumption INTEGER NOT NULL,
  baseline_peak_demand INTEGER NOT NULL,
  baseline_grid_load INTEGER NOT NULL,
  chart_labels TEXT NOT NULL,
  chart_series_name TEXT NOT NULL,
  chart_values TEXT NOT NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE INDEX IF NOT EXISTS idx_electricity_lookup ON electricity_readings(area_id, time_range);

-- Pollution Readings Table
CREATE TABLE IF NOT EXISTS pollution_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id TEXT NOT NULL,
  time_range TEXT NOT NULL,
  aqi INTEGER NOT NULL,
  pm25 INTEGER NOT NULL,
  pm10 INTEGER NOT NULL,
  no2 INTEGER NOT NULL,
  status TEXT NOT NULL,
  baseline_aqi INTEGER NOT NULL,
  baseline_pm25 INTEGER NOT NULL,
  baseline_pm10 INTEGER NOT NULL,
  baseline_no2 INTEGER NOT NULL,
  baseline_status TEXT NOT NULL,
  chart_labels TEXT NOT NULL,
  chart_series_name TEXT NOT NULL,
  chart_values TEXT NOT NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE INDEX IF NOT EXISTS idx_pollution_lookup ON pollution_readings(area_id, time_range);

-- Water Readings Table
CREATE TABLE IF NOT EXISTS water_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id TEXT NOT NULL,
  time_range TEXT NOT NULL,
  consumption INTEGER NOT NULL,
  flow_rate INTEGER NOT NULL,
  pressure INTEGER NOT NULL,
  reservoir_level INTEGER NOT NULL,
  baseline_consumption INTEGER NOT NULL,
  baseline_flow_rate INTEGER NOT NULL,
  baseline_pressure INTEGER NOT NULL,
  baseline_reservoir_level INTEGER NOT NULL,
  chart_labels TEXT NOT NULL,
  chart_series_name TEXT NOT NULL,
  chart_values TEXT NOT NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE INDEX IF NOT EXISTS idx_water_lookup ON water_readings(area_id, time_range);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  area_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_lookup ON alerts(area_id, module);
