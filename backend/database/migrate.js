/**
 * SQLite Data Migration Script
 * Migrates simulated prototype dataset from backend/data/cityData.json into SQLite.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'data', 'smart_city.db');
const jsonPath = path.join(__dirname, '..', 'data', 'cityData.json');
const schemaPath = path.join(__dirname, 'schema.sql');

function runMigration() {
  console.log('--- Starting SQLite Migration for Smart City Dashboard ---');
  console.log(`Database target: ${dbPath}`);
  console.log(`JSON source:     ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Source JSON file not found at: ${jsonPath}`);
  }

  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const cityData = JSON.parse(rawJson);

  // Initialize SQLite database
  const db = new DatabaseSync(dbPath);

  // Apply schema
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('✓ SQLite schema applied successfully.');

  // Begin transaction
  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Clear existing rows for a clean idempotent migration
    db.exec('DELETE FROM alerts;');
    db.exec('DELETE FROM water_readings;');
    db.exec('DELETE FROM pollution_readings;');
    db.exec('DELETE FROM electricity_readings;');
    db.exec('DELETE FROM traffic_readings;');
    db.exec('DELETE FROM time_ranges;');
    db.exec('DELETE FROM areas;');

    // 2. Insert Areas
    const insertArea = db.prepare('INSERT INTO areas (id, name) VALUES (?, ?);');
    for (const zone of cityData.zones) {
      insertArea.run(zone.id, zone.name);
    }
    console.log(`✓ Inserted ${cityData.zones.length} areas into 'areas' table.`);

    // 3. Insert Time Ranges
    const insertTime = db.prepare('INSERT INTO time_ranges (id, display_order) VALUES (?, ?);');
    cityData.timeRanges.forEach((tr, idx) => {
      insertTime.run(tr, idx + 1);
    });
    console.log(`✓ Inserted ${cityData.timeRanges.length} time ranges into 'time_ranges' table.`);

    // 4. Insert Traffic Readings
    const insertTraffic = db.prepare(`
      INSERT INTO traffic_readings (
        area_id, time_range, congestion, avg_speed, vehicle_count,
        baseline_congestion, baseline_avg_speed, baseline_vehicle_count,
        chart_labels, chart_series_name, chart_values
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    let trafficCount = 0;
    for (const [areaId, timeMap] of Object.entries(cityData.metrics.traffic)) {
      for (const [timeRange, item] of Object.entries(timeMap)) {
        insertTraffic.run(
          areaId,
          timeRange,
          item.kpi.congestion,
          item.kpi.avgSpeed,
          item.kpi.vehicleCount,
          item.baseline.congestion,
          item.baseline.avgSpeed,
          item.baseline.vehicleCount,
          JSON.stringify(item.chart.labels),
          item.chart.seriesName,
          JSON.stringify(item.chart.values)
        );
        trafficCount++;
      }
    }
    console.log(`✓ Inserted ${trafficCount} readings into 'traffic_readings' table.`);

    // 5. Insert Electricity Readings
    const insertElectricity = db.prepare(`
      INSERT INTO electricity_readings (
        area_id, time_range, consumption, peak_demand, grid_load,
        baseline_consumption, baseline_peak_demand, baseline_grid_load,
        chart_labels, chart_series_name, chart_values
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    let elecCount = 0;
    for (const [areaId, timeMap] of Object.entries(cityData.metrics.electricity)) {
      for (const [timeRange, item] of Object.entries(timeMap)) {
        insertElectricity.run(
          areaId,
          timeRange,
          item.kpi.consumption,
          item.kpi.peakDemand,
          item.kpi.gridLoad,
          item.baseline.consumption,
          item.baseline.peakDemand,
          item.baseline.gridLoad,
          JSON.stringify(item.chart.labels),
          item.chart.seriesName,
          JSON.stringify(item.chart.values)
        );
        elecCount++;
      }
    }
    console.log(`✓ Inserted ${elecCount} readings into 'electricity_readings' table.`);

    // 6. Insert Pollution Readings
    const insertPollution = db.prepare(`
      INSERT INTO pollution_readings (
        area_id, time_range, aqi, pm25, pm10, no2, status,
        baseline_aqi, baseline_pm25, baseline_pm10, baseline_no2, baseline_status,
        chart_labels, chart_series_name, chart_values
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    let pollutionCount = 0;
    for (const [areaId, timeMap] of Object.entries(cityData.metrics.pollution)) {
      for (const [timeRange, item] of Object.entries(timeMap)) {
        insertPollution.run(
          areaId,
          timeRange,
          item.kpi.aqi,
          item.kpi.pm25,
          item.kpi.pm10,
          item.kpi.no2,
          item.kpi.status,
          item.baseline.aqi,
          item.baseline.pm25,
          item.baseline.pm10,
          item.baseline.no2,
          item.baseline.status,
          JSON.stringify(item.chart.labels),
          item.chart.seriesName,
          JSON.stringify(item.chart.values)
        );
        pollutionCount++;
      }
    }
    console.log(`✓ Inserted ${pollutionCount} readings into 'pollution_readings' table.`);

    // 7. Insert Water Readings
    const insertWater = db.prepare(`
      INSERT INTO water_readings (
        area_id, time_range, consumption, flow_rate, pressure, reservoir_level,
        baseline_consumption, baseline_flow_rate, baseline_pressure, baseline_reservoir_level,
        chart_labels, chart_series_name, chart_values
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    let waterCount = 0;
    for (const [areaId, timeMap] of Object.entries(cityData.metrics.water)) {
      for (const [timeRange, item] of Object.entries(timeMap)) {
        insertWater.run(
          areaId,
          timeRange,
          item.kpi.consumption,
          item.kpi.flowRate,
          item.kpi.pressure,
          item.kpi.reservoirLevel,
          item.baseline.consumption,
          item.baseline.flowRate,
          item.baseline.pressure,
          item.baseline.reservoirLevel,
          JSON.stringify(item.chart.labels),
          item.chart.seriesName,
          JSON.stringify(item.chart.values)
        );
        waterCount++;
      }
    }
    console.log(`✓ Inserted ${waterCount} readings into 'water_readings' table.`);

    // 8. Insert Alerts
    const insertAlert = db.prepare(`
      INSERT INTO alerts (id, module, area_id, severity, title, message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `);

    for (const alert of cityData.alerts) {
      insertAlert.run(
        alert.id,
        alert.module,
        alert.zone,
        alert.severity,
        alert.title,
        alert.message,
        alert.timestamp
      );
    }
    console.log(`✓ Inserted ${cityData.alerts.length} alerts into 'alerts' table.`);

    db.exec('COMMIT;');
    console.log('✓ Transaction committed successfully.');
    console.log('--- Migration completed successfully! ---');

    return {
      areasCount: cityData.zones.length,
      timeRangesCount: cityData.timeRanges.length,
      trafficCount,
      elecCount,
      pollutionCount,
      waterCount,
      alertsCount: cityData.alerts.length
    };
  } catch (error) {
    db.exec('ROLLBACK;');
    console.error('✗ Migration failed, rolled back changes:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
