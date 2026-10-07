/**
 * Context Service - Smart City Dashboard (Step 4 Backend)
 * 
 * Generates structured context snapshots for the active dashboard state.
 * Bridges dashboard operational data and the future AI Assistant.
 */

const dataService = require('./dataService');

/**
 * Build a structured context snapshot for a given view, zone, and timeRange.
 * 
 * @param {string} rawView 'overview' | 'traffic' | 'electricity' | 'pollution' | 'water' | 'alerts'
 * @param {string} rawZone Locality name (defaults to 'Hubballi')
 * @param {string} rawTimeRange Time range (defaults to 'Today')
 * @returns {Promise<Object>} Structured context object
 */
async function getDashboardContext(rawView = 'overview', rawZone = 'Hubballi', rawTimeRange = 'Today') {
  const view = rawView ? rawView.toLowerCase().trim() : 'overview';
  const zone = rawZone && rawZone.trim() ? rawZone.trim() : 'Hubballi';
  const timeRange = rawTimeRange && rawTimeRange.trim() ? rawTimeRange.trim() : 'Today';

  const city = 'Hubballi';
  const region = 'Karnataka';

  let viewTitle = 'Overview';
  let activeMetric = 'allModules';
  let kpis = {};
  let baseline = {};
  let anomalies = [];
  let alerts = [];

  if (view === 'overview') {
    viewTitle = 'City Overview';
    activeMetric = 'allModules';
    const overviewData = await dataService.getOverview(zone, timeRange);
    kpis = overviewData.summary;
    alerts = overviewData.alerts;
    anomalies = extractOverviewAnomalies(overviewData.summary);

  } else if (['traffic', 'electricity', 'pollution', 'water'].includes(view)) {
    const titles = {
      traffic: 'Traffic & Mobility',
      electricity: 'Electricity & Grid',
      pollution: 'Air Quality & Environmental',
      water: 'Water Management'
    };
    const metrics = {
      traffic: 'congestion',
      electricity: 'consumption',
      pollution: 'aqi',
      water: 'consumption'
    };

    viewTitle = titles[view] || view;
    activeMetric = metrics[view] || 'primary';

    const moduleData = await dataService.getModuleData(view, zone, timeRange);
    kpis = moduleData.kpi;
    baseline = moduleData.baseline;
    anomalies = extractModuleAnomalies(moduleData.comparison);
    alerts = await dataService.getAlerts(zone, view);

  } else if (view === 'alerts') {
    viewTitle = 'Active System Alerts';
    activeMetric = 'activeCount';
    const alertsList = await dataService.getAlerts(zone);
    alerts = alertsList;
    kpis = {
      total: alertsList.length,
      high: alertsList.filter(a => a.severity === 'high').length,
      medium: alertsList.filter(a => a.severity === 'medium').length,
      low: alertsList.filter(a => a.severity === 'low').length
    };
  }

  // Generate summary narrative
  const summaryNarrative = generateSummaryNarrative({
    city,
    viewTitle,
    selectedArea: zone,
    selectedTimeRange: timeRange,
    anomalies,
    alerts
  });

  // Generate AI prompt context string
  const aiPromptContext = generateAIPromptContext({
    city,
    region,
    viewTitle,
    currentView: view,
    selectedArea: zone,
    selectedTimeRange: timeRange,
    activeMetric,
    kpis,
    baseline,
    anomalies,
    alerts,
    summaryNarrative
  });

  return {
    timestamp: new Date().toISOString(),
    city,
    region,
    currentView: view,
    viewTitle,
    selectedArea: zone,
    selectedTimeRange: timeRange,
    activeMetric,
    kpis,
    baseline,
    anomalies,
    alerts,
    summaryNarrative,
    aiPromptContext
  };
}

function extractOverviewAnomalies(summary) {
  const list = [];
  if (!summary) return list;

  if (summary.traffic && summary.traffic.status === 'High') {
    list.push({
      module: 'traffic',
      metric: 'congestion',
      value: summary.traffic.value,
      severity: 'high',
      description: `Traffic congestion is high (${summary.traffic.value}) on arterial corridors.`
    });
  }
  if (summary.electricity && summary.electricity.status === 'Heavy Load') {
    list.push({
      module: 'electricity',
      metric: 'consumption',
      value: summary.electricity.value,
      severity: 'high',
      description: `Heavy electrical grid stress load (${summary.electricity.value}).`
    });
  }
  if (summary.pollution && summary.pollution.status && (summary.pollution.status.includes('Unhealthy') || summary.pollution.status.includes('Sensitive'))) {
    list.push({
      module: 'pollution',
      metric: 'aqi',
      value: summary.pollution.value,
      severity: summary.pollution.status.includes('Unhealthy') ? 'high' : 'medium',
      description: `Air quality degradation detected: AQI ${summary.pollution.value} (${summary.pollution.status}).`
    });
  }
  if (summary.water && summary.water.status === 'Low Pressure') {
    list.push({
      module: 'water',
      metric: 'pressure',
      value: summary.water.value,
      severity: 'medium',
      description: `Distribution pipeline pressure drop detected (${summary.water.value}).`
    });
  }
  return list;
}

function extractModuleAnomalies(comparison) {
  const list = [];
  if (!comparison) return list;

  for (const [metric, comp] of Object.entries(comparison)) {
    if (comp.isSpike) {
      list.push({
        metric,
        type: 'spike',
        severity: 'high',
        current: comp.current,
        baseline: comp.baseline,
        diffPercent: comp.diffPercent,
        description: `${metric} spiked by +${comp.diffPercent}% above baseline (${comp.current} vs ${comp.baseline})`
      });
    } else if (comp.isDrop) {
      list.push({
        metric,
        type: 'drop',
        severity: 'medium',
        current: comp.current,
        baseline: comp.baseline,
        diffPercent: comp.diffPercent,
        description: `${metric} dropped by ${comp.diffPercent}% below baseline (${comp.current} vs ${comp.baseline})`
      });
    }
  }
  return list;
}

function generateSummaryNarrative({ city, viewTitle, selectedArea, selectedTimeRange, anomalies, alerts }) {
  let narrative = `User is viewing the ${viewTitle} module for ${selectedArea}, ${city} (${selectedTimeRange}).`;

  if (anomalies.length > 0) {
    narrative += ` Anomalies detected: ${anomalies.map(a => a.description).join('; ')}.`;
  } else {
    narrative += ` Operating parameters are within standard baseline.`;
  }

  if (alerts.length > 0) {
    narrative += ` There are ${alerts.length} active system alert(s) for this scope.`;
  } else {
    narrative += ` No active system alerts for this scope.`;
  }

  return narrative;
}

function generateAIPromptContext(ctx) {
  const alertSummary = ctx.alerts.length > 0
    ? ctx.alerts.map(a => `[${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join(' | ')
    : 'None';
  const anomalySummary = ctx.anomalies.length > 0
    ? ctx.anomalies.map(a => a.description).join('; ')
    : 'None';

  return `[CURRENT DASHBOARD CONTEXT]
City: ${ctx.city}, ${ctx.region}
Current Module: ${ctx.viewTitle} (${ctx.currentView})
Selected Locality: ${ctx.selectedArea}
Time Range: ${ctx.selectedTimeRange}
Active Metric: ${ctx.activeMetric}
Current KPIs: ${JSON.stringify(ctx.kpis)}
Baseline: ${JSON.stringify(ctx.baseline)}
Anomalies: ${anomalySummary}
Active Alerts (${ctx.alerts.length}): ${alertSummary}
Summary Narrative: ${ctx.summaryNarrative}`;
}

module.exports = {
  getDashboardContext
};
