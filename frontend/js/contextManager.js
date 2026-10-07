/**
 * Context Manager - Smart City Dashboard (Step 4)
 * 
 * Centralized state and situational-awareness manager.
 * Tracks the user's active view, area, time range, KPIs, anomalies, and alerts.
 * Designed so that the future AI Assistant can immediately access the current
 * dashboard context as a clean, structured object without reading the DOM.
 */

class ContextManager {
  constructor() {
    this.state = {
      city: 'Hubballi',
      stateRegion: 'Karnataka',
      currentView: 'overview',
      selectedArea: 'Hubballi',
      selectedTimeRange: 'Today',
      activeMetric: 'allModules',
      kpis: {},
      baseline: {},
      anomalies: [],
      alerts: [],
      lastUpdated: new Date().toISOString()
    };

    this.subscribers = [];
  }

  /**
   * Subscribe to context updates (Observer pattern)
   * @param {Function} callback Function invoked with latest context snapshot
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all subscribers when context state changes
   */
  notify() {
    const snapshot = this.getContext();
    this.subscribers.forEach(cb => {
      try {
        cb(snapshot);
      } catch (err) {
        console.error('[ContextManager] Error in subscriber callback:', err);
      }
    });
  }

  /**
   * Update active view/module
   * @param {string} view 'overview' | 'traffic' | 'electricity' | 'pollution' | 'water' | 'alerts'
   */
  setView(view) {
    if (!view) return;
    this.state.currentView = view;
    this.state.activeMetric = this.getDefaultMetricForView(view);
    this.state.lastUpdated = new Date().toISOString();
    this.notify();
  }

  /**
   * Update area and time range filters
   * @param {string} area Selected locality (Hubballi, Vidyanagar, Gokul Road, Keshwapur, Unkal)
   * @param {string} timeRange Selected time range (Today, Yesterday, Last 7 Days, Last 30 Days)
   */
  setFilters(area, timeRange) {
    let changed = false;
    if (area && this.state.selectedArea !== area) {
      this.state.selectedArea = area;
      changed = true;
    }
    if (timeRange && this.state.selectedTimeRange !== timeRange) {
      this.state.selectedTimeRange = timeRange;
      changed = true;
    }
    if (changed) {
      this.state.lastUpdated = new Date().toISOString();
      this.notify();
    }
  }

  /**
   * Set active specific metric
   * @param {string} metricName 
   */
  setActiveMetric(metricName) {
    this.state.activeMetric = metricName;
    this.state.lastUpdated = new Date().toISOString();
    this.notify();
  }

  /**
   * Synchronize full dashboard state after API fetch
   * @param {Object} payload { view, area, timeRange, data, alerts }
   */
  syncDashboardData({ view, area, timeRange, data, alerts }) {
    if (view) this.state.currentView = view;
    if (area) this.state.selectedArea = area;
    if (timeRange) this.state.selectedTimeRange = timeRange;
    this.state.activeMetric = this.getDefaultMetricForView(this.state.currentView);

    if (view === 'overview' && data && data.summary) {
      this.state.kpis = { ...data.summary };
      this.state.baseline = {};
      this.state.anomalies = this.extractOverviewAnomalies(data.summary);
    } else if (data && data.kpi) {
      this.state.kpis = { ...data.kpi };
      this.state.baseline = data.baseline ? { ...data.baseline } : {};
      this.state.anomalies = this.extractModuleAnomalies(data.comparison, data.kpi, data.baseline);
    } else if (view === 'alerts' && Array.isArray(data)) {
      this.state.kpis = {
        total: data.length,
        high: data.filter(a => a.severity === 'high').length,
        medium: data.filter(a => a.severity === 'medium').length,
        low: data.filter(a => a.severity === 'low').length
      };
      this.state.baseline = {};
      this.state.anomalies = [];
    }

    if (Array.isArray(alerts)) {
      this.state.alerts = alerts;
    } else if (data && Array.isArray(data.alerts)) {
      this.state.alerts = data.alerts;
    } else if (view === 'alerts' && Array.isArray(data)) {
      this.state.alerts = data;
    }

    this.state.lastUpdated = new Date().toISOString();
    this.notify();
  }

  /**
   * Determine default primary metric for a module
   */
  getDefaultMetricForView(view) {
    switch (view) {
      case 'traffic': return 'congestion';
      case 'electricity': return 'consumption';
      case 'pollution': return 'aqi';
      case 'water': return 'consumption';
      case 'alerts': return 'activeCount';
      case 'overview':
      default:
        return 'allModules';
    }
  }

  /**
   * Extract anomaly indicators from overview summary
   */
  extractOverviewAnomalies(summary) {
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

  /**
   * Extract anomalies from module comparison object
   */
  extractModuleAnomalies(comparison, kpi, baseline) {
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

  /**
   * Return clean, complete, structured snapshot of current context
   */
  getContext() {
    return {
      timestamp: this.state.lastUpdated,
      city: this.state.city,
      region: this.state.stateRegion,
      currentView: this.state.currentView,
      viewTitle: this.formatViewTitle(this.state.currentView),
      selectedArea: this.state.selectedArea,
      selectedTimeRange: this.state.selectedTimeRange,
      activeMetric: this.state.activeMetric,
      kpis: { ...this.state.kpis },
      baseline: { ...this.state.baseline },
      anomalies: [...this.state.anomalies],
      alerts: [...this.state.alerts],
      summaryNarrative: this.generateSummaryNarrative()
    };
  }

  formatViewTitle(view) {
    const titles = {
      overview: 'Overview',
      traffic: 'Traffic',
      electricity: 'Electricity',
      pollution: 'Pollution',
      water: 'Water',
      alerts: 'Alerts'
    };
    return titles[view] || view;
  }

  generateSummaryNarrative() {
    const { city, currentView, selectedArea, selectedTimeRange, anomalies, alerts } = this.state;
    const viewName = this.formatViewTitle(currentView);
    let narrative = `User is viewing the ${viewName} module for ${selectedArea}, ${city} (${selectedTimeRange}).`;

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

  /**
   * Returns a concise textual summary formatted specifically for LLM prompt context injection
   */
  getAIPromptContext() {
    const ctx = this.getContext();
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
}

// Global singleton instance accessible anywhere in application
window.contextManager = new ContextManager();
