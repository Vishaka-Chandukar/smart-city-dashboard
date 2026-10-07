/**
 * Analytics Service - Smart City Dashboard (Backend)
 * 
 * Provides deterministic mathematical analysis, period comparisons,
 * multi-factor trend evaluation, cross-module evidence compilation,
 * and locality ranking over SQLite data.
 * 
 * Grounded in actual SQLite records from smart_city.db.
 */

const db = require('../database/db');

const ALLOWED_MODULES = ['traffic', 'electricity', 'pollution', 'water'];
const ALLOWED_AREAS = ['Hubballi', 'Vidyanagar', 'Gokul Road', 'Keshwapur', 'Unkal'];
const ALLOWED_TIMERANGES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'];

/**
 * Primary metric name mapping per module
 */
const MODULE_METRIC_MAP = {
  traffic: {
    primary: 'congestion',
    unit: '%',
    secondaries: ['avg_speed', 'vehicle_count']
  },
  electricity: {
    primary: 'consumption',
    unit: 'MWh',
    secondaries: ['peak_demand', 'grid_load']
  },
  pollution: {
    primary: 'aqi',
    unit: 'AQI',
    secondaries: ['pm25', 'pm10', 'no2', 'status']
  },
  water: {
    primary: 'consumption',
    unit: 'kL',
    secondaries: ['flow_rate', 'pressure', 'reservoir_level']
  }
};

/**
 * Fetch raw reading from database for a given module, area, and timeRange.
 */
function getRawReading(moduleName, area, timeRange) {
  switch (moduleName) {
    case 'traffic':
      return db.getTrafficReading(area, timeRange);
    case 'electricity':
      return db.getElectricityReading(area, timeRange);
    case 'pollution':
      return db.getPollutionReading(area, timeRange);
    case 'water':
      return db.getWaterReading(area, timeRange);
    default:
      return null;
  }
}

/**
 * 1. PERIOD COMPARISON: Compares two explicit periods (periodA vs periodB).
 * Strictly separated from baseline comparison.
 * 
 * @param {string} moduleName 'traffic'|'electricity'|'pollution'|'water'
 * @param {string} area Locality name
 * @param {string} periodA First period (e.g. 'Today')
 * @param {string} periodB Second period (e.g. 'Yesterday')
 * @returns {Object} Deterministic comparison metrics
 */
function comparePeriods(moduleName, area, periodA, periodB) {
  if (!ALLOWED_MODULES.includes(moduleName)) {
    throw new Error(`Unsupported module for comparison: ${moduleName}`);
  }
  if (!ALLOWED_AREAS.includes(area)) {
    throw new Error(`Unsupported area for comparison: ${area}`);
  }
  if (!ALLOWED_TIMERANGES.includes(periodA) || !ALLOWED_TIMERANGES.includes(periodB)) {
    throw new Error(`Invalid comparison periods: ${periodA} vs ${periodB}`);
  }

  const rowA = getRawReading(moduleName, area, periodA);
  const rowB = getRawReading(moduleName, area, periodB);

  if (!rowA || !rowB) {
    throw new Error(`Data not found in database for ${area} in ${periodA} or ${periodB}`);
  }

  const meta = MODULE_METRIC_MAP[moduleName];
  const primaryKey = meta.primary;
  const valA = rowA[primaryKey];
  const valB = rowB[primaryKey];

  const diff = valA - valB;
  const diffPercent = valB !== 0 ? Math.round(((valA - valB) / valB) * 1000) / 10 : 0;
  const direction = diff > 0 ? 'increase' : (diff < 0 ? 'decrease' : 'unchanged');

  // Secondary metrics comparison
  const secondaryDiffs = {};
  for (const secKey of meta.secondaries) {
    if (typeof rowA[secKey] === 'number' && typeof rowB[secKey] === 'number') {
      const sA = rowA[secKey];
      const sB = rowB[secKey];
      const sDiff = sA - sB;
      const sPct = sB !== 0 ? Math.round(((sA - sB) / sB) * 1000) / 10 : 0;
      secondaryDiffs[secKey] = {
        periodA: sA,
        periodB: sB,
        diff: sDiff,
        diffPercent: sPct,
        direction: sDiff > 0 ? 'increase' : (sDiff < 0 ? 'decrease' : 'unchanged')
      };
    } else if (typeof rowA[secKey] === 'string') {
      secondaryDiffs[secKey] = {
        periodA: rowA[secKey],
        periodB: rowB[secKey]
      };
    }
  }

  const summaryText = `In ${area}, ${moduleName} ${primaryKey} for ${periodA} is ${valA.toLocaleString()} ${meta.unit}, compared with ${valB.toLocaleString()} ${meta.unit} for ${periodB} (a net ${direction} of ${Math.abs(diff).toLocaleString()} ${meta.unit}, or ${diffPercent > 0 ? '+' : ''}${diffPercent}%).`;

  return {
    type: 'period_comparison',
    module: moduleName,
    area,
    periodA,
    periodB,
    primaryMetric: {
      name: primaryKey,
      unit: meta.unit,
      periodAValue: valA,
      periodBValue: valB,
      diff,
      diffPercent,
      direction
    },
    secondaryMetrics: secondaryDiffs,
    summaryText
  };
}

/**
 * 2. BASELINE COMPARISON: Compares reading against its designated baseline.
 * Strictly separate from period-to-period comparison.
 * 
 * @param {string} moduleName 'traffic'|'electricity'|'pollution'|'water'
 * @param {string} area Locality name
 * @param {string} timeRange Active time range
 * @returns {Object} Deterministic baseline comparison metrics
 */
function compareBaseline(moduleName, area, timeRange) {
  if (!ALLOWED_MODULES.includes(moduleName) || !ALLOWED_AREAS.includes(area)) {
    throw new Error(`Invalid parameters for baseline comparison`);
  }

  const row = getRawReading(moduleName, area, timeRange);
  if (!row) {
    throw new Error(`Data not found for ${area} - ${timeRange}`);
  }

  const meta = MODULE_METRIC_MAP[moduleName];
  const primaryKey = meta.primary;
  const currentVal = row[primaryKey];
  const baselineKey = `baseline_${primaryKey}`;
  const baselineVal = row[baselineKey];

  const diff = currentVal - baselineVal;
  const diffPercent = baselineVal !== 0 ? Math.round(((currentVal - baselineVal) / baselineVal) * 1000) / 10 : 0;
  const direction = diff > 0 ? 'above_baseline' : (diff < 0 ? 'below_baseline' : 'at_baseline');

  const summaryText = `For ${area} (${timeRange}), ${moduleName} ${primaryKey} is ${currentVal.toLocaleString()} ${meta.unit} versus a standard baseline of ${baselineVal.toLocaleString()} ${meta.unit} (${diffPercent > 0 ? '+' : ''}${diffPercent}%).`;

  return {
    type: 'baseline_comparison',
    module: moduleName,
    area,
    timeRange,
    primaryMetric: {
      name: primaryKey,
      unit: meta.unit,
      current: currentVal,
      baseline: baselineVal,
      diff,
      diffPercent,
      direction
    },
    summaryText
  };
}

/**
 * 3. MULTI-FACTOR TREND EVALUATION:
 * Analyzes the ordered time series considering start, end, average, minimum,
 * maximum, net change, peaks/drops, and overall trajectory.
 * Does NOT classify a trend using only start-vs-end percentage.
 * 
 * @param {string} moduleName 'traffic'|'electricity'|'pollution'|'water'
 * @param {string} area Locality name
 * @param {string} timeRange Time range with time-series data
 * @returns {Object} Comprehensive statistical trend assessment
 */
function analyzeTrend(moduleName, area, timeRange) {
  if (!ALLOWED_MODULES.includes(moduleName) || !ALLOWED_AREAS.includes(area)) {
    throw new Error(`Invalid module or area for trend analysis`);
  }

  const row = getRawReading(moduleName, area, timeRange);
  if (!row) {
    throw new Error(`Data not found for ${area} - ${timeRange}`);
  }

  const labels = JSON.parse(row.chart_labels || '[]');
  const values = JSON.parse(row.chart_values || '[]');

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`No time-series data points available for trend analysis`);
  }

  const count = values.length;
  const startValue = values[0];
  const endValue = values[count - 1];
  const netChange = endValue - startValue;
  const netChangePercent = startValue !== 0 ? Math.round(((endValue - startValue) / startValue) * 1000) / 10 : 0;

  // Calculate sum, min, max, average
  let sum = 0;
  let minVal = values[0];
  let minLabel = labels[0] || 'Start';
  let maxVal = values[0];
  let maxLabel = labels[0] || 'Start';

  for (let i = 0; i < count; i++) {
    const val = values[i];
    sum += val;
    if (val < minVal) {
      minVal = val;
      minLabel = labels[i] || `${i}`;
    }
    if (val > maxVal) {
      maxVal = val;
      maxLabel = labels[i] || `${i}`;
    }
  }

  const average = Math.round((sum / count) * 10) / 10;

  // Step-by-step movement across the ordered series
  let positiveSteps = 0;
  let negativeSteps = 0;
  let flatSteps = 0;

  for (let i = 1; i < count; i++) {
    if (values[i] > values[i - 1]) positiveSteps++;
    else if (values[i] < values[i - 1]) negativeSteps++;
    else flatSteps++;
  }

  // Detect individual peaks or drops (>15% deviation from average)
  const peaksAndDrops = [];
  for (let i = 0; i < count; i++) {
    const val = values[i];
    const devPct = average !== 0 ? Math.round(((val - average) / average) * 100) : 0;
    if (devPct >= 15) {
      peaksAndDrops.push({ type: 'peak', label: labels[i], value: val, deviationPercent: devPct });
    } else if (devPct <= -15) {
      peaksAndDrops.push({ type: 'drop', label: labels[i], value: val, deviationPercent: devPct });
    }
  }

  // Trajectory classification considering ALL factors together:
  // - start, end, net change
  // - directional steps (monotonic tendency)
  // - min and max position
  // - peaks and drops
  let trajectory = 'stable';
  const midIndex = Math.floor(count / 2);
  const maxOccursInMiddle = (labels.indexOf(maxLabel) > 0 && labels.indexOf(maxLabel) < count - 1);

  if (netChangePercent > 6 && positiveSteps > negativeSteps) {
    trajectory = 'increasing';
  } else if (netChangePercent < -6 && negativeSteps > positiveSteps) {
    trajectory = 'decreasing';
  } else if (maxOccursInMiddle && maxVal > average * 1.15) {
    trajectory = 'peaked_mid_period';
  } else if (peaksAndDrops.length > 2) {
    trajectory = 'fluctuating';
  } else if (Math.abs(netChangePercent) <= 5 && (maxVal - minVal) / average < 0.15) {
    trajectory = 'stable';
  } else {
    trajectory = netChange > 0 ? 'slight_upward' : 'slight_downward';
  }

  const meta = MODULE_METRIC_MAP[moduleName];
  const summaryText = `Time-series trend for ${area} (${timeRange}, ${row.chart_series_name}): started at ${startValue} ${meta.unit} (${labels[0]}), concluded at ${endValue} ${meta.unit} (${labels[count - 1]}), with a net change of ${netChange > 0 ? '+' : ''}${netChange} ${meta.unit} (${netChangePercent > 0 ? '+' : ''}${netChangePercent}%). Recorded minimum: ${minVal} at ${minLabel}; maximum: ${maxVal} at ${maxLabel}; average: ${average}. Trajectory classification: ${trajectory.replace(/_/g, ' ')}.`;

  return {
    type: 'trend_analysis',
    module: moduleName,
    area,
    timeRange,
    seriesName: row.chart_series_name,
    count,
    startValue,
    startLabel: labels[0],
    endValue,
    endLabel: labels[count - 1],
    netChange,
    netChangePercent,
    min: { value: minVal, label: minLabel },
    max: { value: maxVal, label: maxLabel },
    average,
    movement: {
      positiveSteps,
      negativeSteps,
      flatSteps
    },
    peaksAndDrops,
    trajectory,
    summaryText
  };
}

/**
 * 4. CROSS-MODULE EVIDENCE GATHERING:
 * Retrieves readings across multiple modules and active alerts for an area
 * to compile unified, deterministic evidence for causal reasoning.
 * 
 * @param {string} area Locality name
 * @param {string} timeRange Active time range
 * @param {Array<string>} modules Array of module names (defaults to all 4)
 * @returns {Object} Multi-module evidence snapshot
 */
function getMultiModuleEvidence(area, timeRange, modules = ALLOWED_MODULES) {
  if (!ALLOWED_AREAS.includes(area)) {
    throw new Error(`Unsupported area: ${area}`);
  }

  const validModules = Array.isArray(modules)
    ? modules.filter(m => ALLOWED_MODULES.includes(m))
    : ALLOWED_MODULES;

  const moduleData = {};
  for (const mod of validModules) {
    const row = getRawReading(mod, area, timeRange);
    if (row) {
      const meta = MODULE_METRIC_MAP[mod];
      const primaryKey = meta.primary;
      const baselineKey = `baseline_${primaryKey}`;
      const currentVal = row[primaryKey];
      const baselineVal = row[baselineKey];
      const diffPercent = baselineVal !== 0 ? Math.round(((currentVal - baselineVal) / baselineVal) * 100) : 0;

      moduleData[mod] = {
        primaryMetric: primaryKey,
        currentValue: currentVal,
        baselineValue: baselineVal,
        diffPercent,
        unit: meta.unit,
        details: { ...row }
      };
    }
  }

  // Active alerts for this area
  const alerts = db.getAlerts(area);

  // Compile coinciding contributing evidence
  const contributingFactors = [];
  if (moduleData.electricity) {
    const el = moduleData.electricity;
    if (el.diffPercent > 15) {
      contributingFactors.push(`Electricity consumption is elevated (+${el.diffPercent}% above baseline, peak demand: ${el.details.peak_demand} MW, grid load: ${el.details.grid_load}%)`);
    }
  }
  if (moduleData.pollution) {
    const pol = moduleData.pollution;
    if (pol.currentValue > 100) {
      contributingFactors.push(`Air Quality Index is elevated (AQI: ${pol.currentValue}, category: "${pol.details.status}", PM2.5: ${pol.details.pm25} µg/m³)`);
    }
  }
  if (moduleData.traffic) {
    const tr = moduleData.traffic;
    if (tr.currentValue > 60) {
      contributingFactors.push(`Traffic congestion is heavy (${tr.currentValue}%, vehicle count: ${tr.details.vehicle_count})`);
    }
  }
  if (moduleData.water) {
    const wt = moduleData.water;
    if (wt.details.pressure < 45) {
      contributingFactors.push(`Water distribution pressure is depressed (${wt.details.pressure} PSI vs ${wt.details.baseline_pressure} PSI baseline)`);
    }
  }

  return {
    type: 'multi_module_evidence',
    area,
    timeRange,
    modules: moduleData,
    alerts,
    contributingFactors,
    summaryText: `Evidence compiled for ${area} (${timeRange}): ${contributingFactors.length > 0 ? contributingFactors.join('; ') : 'All monitored systems operating within standard baseline parameters.'}`
  };
}

/**
 * 5. AREA RANKING:
 * Deterministically ranks all 5 Hubballi localities for a module metric.
 * 
 * @param {string} moduleName 'traffic'|'electricity'|'pollution'|'water'
 * @param {string} timeRange Active time range
 * @returns {Object} Ranking and highest/lowest area
 */
function rankAreasByMetric(moduleName, timeRange) {
  if (!ALLOWED_MODULES.includes(moduleName)) {
    throw new Error(`Unsupported module for ranking: ${moduleName}`);
  }

  const meta = MODULE_METRIC_MAP[moduleName];
  const primaryKey = meta.primary;

  const rankings = [];
  for (const area of ALLOWED_AREAS) {
    const row = getRawReading(moduleName, area, timeRange);
    if (row && typeof row[primaryKey] === 'number') {
      rankings.push({
        area,
        value: row[primaryKey],
        unit: meta.unit
      });
    }
  }

  rankings.sort((a, b) => b.value - a.value);

  return {
    type: 'area_ranking',
    module: moduleName,
    metric: primaryKey,
    timeRange,
    highest: rankings[0] || null,
    lowest: rankings[rankings.length - 1] || null,
    rankings,
    summaryText: `For ${moduleName} (${timeRange}), ${rankings[0]?.area} has the highest ${primaryKey} (${rankings[0]?.value} ${meta.unit}), while ${rankings[rankings.length - 1]?.area} has the lowest (${rankings[rankings.length - 1]?.value} ${meta.unit}).`
  };
}

module.exports = {
  comparePeriods,
  compareBaseline,
  analyzeTrend,
  getMultiModuleEvidence,
  rankAreasByMetric,
  ALLOWED_MODULES,
  ALLOWED_AREAS,
  ALLOWED_TIMERANGES
};
