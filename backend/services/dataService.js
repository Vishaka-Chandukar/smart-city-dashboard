/**
 * Data Service - Smart City Dashboard (Backend)
 * 
 * Abstraction layer for smart city data retrieval.
 * Backed by local SQLite database (smart_city.db).
 */

const db = require('../database/db');

/**
 * Get available zones/areas
 */
async function getZones() {
  return db.getAreas();
}

/**
 * Get supported time ranges
 */
async function getTimeRanges() {
  return db.getTimeRanges();
}

/**
 * Normalize and validate zone and time range filters
 */
function normalizeFilters(zone, timeRange) {
  const validZone = zone && zone.trim() ? zone.trim() : 'Hubballi';
  const validTime = timeRange && timeRange.trim() ? timeRange.trim() : 'Today';
  return { zone: validZone, timeRange: validTime };
}

/**
 * Get data for a specific module (traffic, electricity, pollution, water)
 */
async function getModuleData(moduleName, rawZone, rawTimeRange) {
  const { zone, timeRange } = normalizeFilters(rawZone, rawTimeRange);

  let kpi = {};
  let baseline = {};
  let chart = {};

  switch (moduleName) {
    case 'traffic': {
      const row = db.getTrafficReading(zone, timeRange);
      if (!row) throw new Error(`Traffic data not found for ${zone} - ${timeRange}`);
      kpi = {
        congestion: row.congestion,
        avgSpeed: row.avg_speed,
        vehicleCount: row.vehicle_count
      };
      baseline = {
        congestion: row.baseline_congestion,
        avgSpeed: row.baseline_avg_speed,
        vehicleCount: row.baseline_vehicle_count
      };
      chart = {
        labels: JSON.parse(row.chart_labels),
        seriesName: row.chart_series_name,
        values: JSON.parse(row.chart_values)
      };
      break;
    }

    case 'electricity': {
      const row = db.getElectricityReading(zone, timeRange);
      if (!row) throw new Error(`Electricity data not found for ${zone} - ${timeRange}`);
      kpi = {
        consumption: row.consumption,
        peakDemand: row.peak_demand,
        gridLoad: row.grid_load
      };
      baseline = {
        consumption: row.baseline_consumption,
        peakDemand: row.baseline_peak_demand,
        gridLoad: row.baseline_grid_load
      };
      chart = {
        labels: JSON.parse(row.chart_labels),
        seriesName: row.chart_series_name,
        values: JSON.parse(row.chart_values)
      };
      break;
    }

    case 'pollution': {
      const row = db.getPollutionReading(zone, timeRange);
      if (!row) throw new Error(`Pollution data not found for ${zone} - ${timeRange}`);
      kpi = {
        aqi: row.aqi,
        pm25: row.pm25,
        pm10: row.pm10,
        no2: row.no2,
        status: row.status
      };
      baseline = {
        aqi: row.baseline_aqi,
        pm25: row.baseline_pm25,
        pm10: row.baseline_pm10,
        no2: row.baseline_no2,
        status: row.baseline_status
      };
      chart = {
        labels: JSON.parse(row.chart_labels),
        seriesName: row.chart_series_name,
        values: JSON.parse(row.chart_values)
      };
      break;
    }

    case 'water': {
      const row = db.getWaterReading(zone, timeRange);
      if (!row) throw new Error(`Water data not found for ${zone} - ${timeRange}`);
      kpi = {
        consumption: row.consumption,
        flowRate: row.flow_rate,
        pressure: row.pressure,
        reservoirLevel: row.reservoir_level
      };
      baseline = {
        consumption: row.baseline_consumption,
        flowRate: row.baseline_flow_rate,
        pressure: row.baseline_pressure,
        reservoirLevel: row.baseline_reservoir_level
      };
      chart = {
        labels: JSON.parse(row.chart_labels),
        seriesName: row.chart_series_name,
        values: JSON.parse(row.chart_values)
      };
      break;
    }

    default:
      throw new Error(`Unknown module: ${moduleName}`);
  }

  // Anomaly calculation against baseline
  const comparison = calculateAnomaly(kpi, baseline);

  return {
    module: moduleName,
    zone,
    timeRange,
    kpi,
    baseline,
    comparison,
    chart
  };
}

/**
 * Compare current KPI with baseline to find percentage deviation
 */
function calculateAnomaly(kpi, baseline) {
  if (!kpi || !baseline) return {};

  const result = {};
  for (const key of Object.keys(kpi)) {
    if (typeof kpi[key] === 'number' && typeof baseline[key] === 'number' && baseline[key] !== 0) {
      const diffPercent = Math.round(((kpi[key] - baseline[key]) / baseline[key]) * 100);
      result[key] = {
        current: kpi[key],
        baseline: baseline[key],
        diffPercent: diffPercent,
        isSpike: diffPercent > 15,
        isDrop: diffPercent < -15
      };
    }
  }
  return result;
}

/**
 * Get overview combining summary KPIs for all 4 modules
 */
async function getOverview(rawZone, rawTimeRange) {
  const { zone, timeRange } = normalizeFilters(rawZone, rawTimeRange);

  const traffic = await getModuleData('traffic', zone, timeRange);
  const electricity = await getModuleData('electricity', zone, timeRange);
  const pollution = await getModuleData('pollution', zone, timeRange);
  const water = await getModuleData('water', zone, timeRange);
  const alerts = await getAlerts(zone);

  return {
    zone,
    timeRange,
    summary: {
      traffic: {
        primaryLabel: 'Congestion',
        value: `${traffic.kpi.congestion}%`,
        status: traffic.kpi.congestion > 65 ? 'High' : (traffic.kpi.congestion > 45 ? 'Moderate' : 'Low')
      },
      electricity: {
        primaryLabel: 'Demand',
        value: `${electricity.kpi.consumption} MWh`,
        status: electricity.kpi.gridLoad > 80 ? 'Heavy Load' : 'Normal'
      },
      pollution: {
        primaryLabel: 'Air Quality (AQI)',
        value: `${pollution.kpi.aqi}`,
        status: pollution.kpi.status
      },
      water: {
        primaryLabel: 'Consumption',
        value: `${water.kpi.consumption} kL`,
        status: water.kpi.pressure < 45 ? 'Low Pressure' : 'Stable'
      }
    },
    chart: {
      labels: traffic.chart.labels,
      seriesName: 'City Congestion & Activity (%)',
      values: traffic.chart.values
    },
    alerts: alerts.slice(0, 3) // Return top active alerts for overview
  };
}

/**
 * Get active alerts, optionally filtered by zone or module
 */
async function getAlerts(rawZone, moduleName) {
  return db.getAlerts(rawZone, moduleName);
}

module.exports = {
  getZones,
  getTimeRanges,
  getModuleData,
  getOverview,
  getAlerts
};
