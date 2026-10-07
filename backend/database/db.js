/**
 * SQLite Database Connection & Data Access Layer
 * Smart City Dashboard (Backend)
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'data', 'smart_city.db');
const schemaPath = path.join(__dirname, 'schema.sql');
const jsonPath = path.join(__dirname, '..', 'data', 'cityData.json');

let dbInstance = null;

/**
 * Get or initialize SQLite database connection
 */
function getDb() {
  if (!dbInstance) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = new DatabaseSync(dbPath);
    ensureSchemaAndSeed(dbInstance);
  }
  return dbInstance;
}

/**
 * Ensures schema exists and automatically seeds initial data if database is empty
 */
function ensureSchemaAndSeed(db) {
  // Apply schema
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  // Check if areas table has rows
  const areaCountRow = db.prepare('SELECT COUNT(*) AS count FROM areas;').get();
  if (!areaCountRow || areaCountRow.count === 0) {
    console.log('[SQLite] Empty database detected. Running automatic initial migration from cityData.json...');
    const { runMigration } = require('./migrate');
    runMigration();
  }
}

/**
 * Query all areas
 */
function getAreas() {
  const db = getDb();
  return db.prepare('SELECT id, name FROM areas ORDER BY rowid ASC;').all();
}

/**
 * Query all supported time ranges
 */
function getTimeRanges() {
  const db = getDb();
  const rows = db.prepare('SELECT id FROM time_ranges ORDER BY display_order ASC;').all();
  return rows.map(r => r.id);
}

/**
 * Query traffic reading
 */
function getTrafficReading(areaId, timeRange) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM traffic_readings WHERE area_id = ? AND time_range = ?;').get(areaId, timeRange);
  if (!row) {
    // Fallback to Hubballi / Today if specific reading not found
    row = db.prepare('SELECT * FROM traffic_readings WHERE area_id = ? AND time_range = ?;').get('Hubballi', 'Today');
  }
  return row;
}

/**
 * Query electricity reading
 */
function getElectricityReading(areaId, timeRange) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM electricity_readings WHERE area_id = ? AND time_range = ?;').get(areaId, timeRange);
  if (!row) {
    row = db.prepare('SELECT * FROM electricity_readings WHERE area_id = ? AND time_range = ?;').get('Hubballi', 'Today');
  }
  return row;
}

/**
 * Query pollution reading
 */
function getPollutionReading(areaId, timeRange) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM pollution_readings WHERE area_id = ? AND time_range = ?;').get(areaId, timeRange);
  if (!row) {
    row = db.prepare('SELECT * FROM pollution_readings WHERE area_id = ? AND time_range = ?;').get('Hubballi', 'Today');
  }
  return row;
}

/**
 * Query water reading
 */
function getWaterReading(areaId, timeRange) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM water_readings WHERE area_id = ? AND time_range = ?;').get(areaId, timeRange);
  if (!row) {
    row = db.prepare('SELECT * FROM water_readings WHERE area_id = ? AND time_range = ?;').get('Hubballi', 'Today');
  }
  return row;
}

/**
 * Query alerts with optional area and module filters
 */
function getAlerts(areaId, moduleName) {
  const db = getDb();
  let query = 'SELECT id, module, area_id AS zone, severity, title, message, timestamp FROM alerts WHERE 1=1';
  const params = [];

  if (areaId && areaId !== 'Hubballi') {
    query += ' AND area_id = ?';
    params.push(areaId);
  }

  if (moduleName) {
    query += ' AND module = ?';
    params.push(moduleName);
  }

  query += ' ORDER BY rowid ASC;';
  return db.prepare(query).all(...params);
}

module.exports = {
  getDb,
  getAreas,
  getTimeRanges,
  getTrafficReading,
  getElectricityReading,
  getPollutionReading,
  getWaterReading,
  getAlerts
};
