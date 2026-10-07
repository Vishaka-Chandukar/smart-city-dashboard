/**
 * Smart City Dashboard - Frontend Application Logic (Step 3)
 * 
 * Implements:
 * 1. Dynamic zone and time-range population from Express backend.
 * 2. Full manual navigation across all 6 views:
 *    - Overview (/api/city/overview)
 *    - Traffic (/api/city/traffic)
 *    - Electricity (/api/city/electricity)
 *    - Pollution (/api/city/pollution)
 *    - Water (/api/city/water)
 *    - Alerts (/api/city/alerts)
 * 3. Reactive updates when Zone or Time range changes.
 * 4. Dynamic Chart.js rendering driven by backend series data.
 * 5. Graceful loading and error states.
 * 6. AI Assistant placeholder integration (context synchronization only).
 */

// --- 1. APPLICATION STATE & CONFIGURATION ---
const state = {
  currentView: 'overview',     // 'overview' | 'traffic' | 'electricity' | 'pollution' | 'water' | 'alerts'
  selectedZone: 'Hubballi',    // Default area (Whole city)
  selectedTime: 'Today',       // Default time range
  isLoading: false
};

// Automatically use the current origin if hosted on Express (port 5000), otherwise fallback to localhost:5000
const API_BASE = window.location.origin.includes('5000') 
  ? window.location.origin 
  : 'http://localhost:5000';

// Global Chart instance
let mainChartInstance = null;

// --- 2. VIEW METADATA DICTIONARY ---
const viewMetadata = {
  overview: {
    title: 'City Overview',
    description: 'High-level operational summary across Traffic, Electricity, Pollution, and Water modules (Simulated Data).'
  },
  traffic: {
    title: 'Traffic & Mobility Dashboard',
    description: 'Arterial road congestion index, vehicle counts, and average transit velocity.'
  },
  electricity: {
    title: 'Electricity & Grid Dashboard',
    description: 'Municipal power demand, peak substation load, and industrial consumption variances.'
  },
  pollution: {
    title: 'Air Quality & Environmental Dashboard',
    description: 'Real-time AQI tracking, particulate matter (PM2.5, PM10), and NO2 concentrations.'
  },
  water: {
    title: 'Water Management & Utilities Dashboard',
    description: 'Reservoir storage levels, pipeline distribution pressure, and municipal consumption.'
  },
  alerts: {
    title: 'Active Municipal System Alerts',
    description: 'Real-time anomaly warnings, threshold breaches, and municipal incident feeds.'
  }
};

// --- 3. DOM ELEMENT REFERENCES ---
const elements = {
  zoneSelect: document.getElementById('zone-select'),
  timeSelect: document.getElementById('time-select'),
  navButtons: document.querySelectorAll('.nav-item'),
  viewTitle: document.getElementById('view-title'),
  viewDescription: document.getElementById('view-description'),
  currentContextTag: document.getElementById('current-context-tag'),
  loadingIndicator: document.getElementById('loading-indicator'),
  errorBannerContainer: document.getElementById('error-banner-container'),
  backendStatus: document.getElementById('backend-status'),
  backendStatusText: document.getElementById('backend-status-text'),
  kpiGrid: document.getElementById('kpi-grid'),
  chartTitle: document.getElementById('chart-title'),
  chartSubtitle: document.getElementById('chart-subtitle'),
  chartBadge: document.getElementById('chart-badge'),
  mainChartCanvas: document.getElementById('mainChart'),
  secondaryTitle: document.getElementById('secondary-title'),
  secondarySubtitle: document.getElementById('secondary-subtitle'),
  zoneBreakdownList: document.getElementById('zone-breakdown-list'),
  alertsContainer: document.getElementById('alerts-container'),
  alertCountBadge: document.getElementById('alert-count-badge'),
  aiPanel: document.getElementById('ai-panel'),
  aiToggleBtn: document.getElementById('ai-toggle-btn'),
  aiCloseBtn: document.getElementById('ai-close-btn'),
  aiCtxTab: document.getElementById('ai-ctx-tab'),
  aiCtxZone: document.getElementById('ai-ctx-zone'),
  aiCtxTime: document.getElementById('ai-ctx-time'),
  aiUserInput: document.getElementById('ai-user-input'),
  aiSendBtn: document.getElementById('ai-send-btn'),
  aiChatMessages: document.getElementById('ai-chat-messages')
};

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkBackendHealth();
  await loadFilterOptions();
  await loadViewData();
});

// --- 5. EVENT LISTENERS SETUP ---
function setupEventListeners() {
  // Sidebar Navigation Click Handlers
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      if (targetView && targetView !== state.currentView) {
        switchView(targetView);
      }
    });
  });

  // Zone Dropdown Change
  elements.zoneSelect.addEventListener('change', (e) => {
    state.selectedZone = e.target.value;
    if (window.contextManager) {
      window.contextManager.setFilters(state.selectedZone, state.selectedTime);
    }
    updateContextDisplays();
    loadViewData();
  });

  // Time Range Dropdown Change
  elements.timeSelect.addEventListener('change', (e) => {
    state.selectedTime = e.target.value;
    if (window.contextManager) {
      window.contextManager.setFilters(state.selectedZone, state.selectedTime);
    }
    updateContextDisplays();
    loadViewData();
  });

  // AI Assistant Panel Toggle
  elements.aiToggleBtn.addEventListener('click', () => {
    elements.aiPanel.classList.toggle('collapsed');
  });

  // AI Assistant Panel Close
  elements.aiCloseBtn.addEventListener('click', () => {
    elements.aiPanel.classList.add('collapsed');
  });

  // AI Assistant Send Button Click (Step 6A)
  if (elements.aiSendBtn) {
    elements.aiSendBtn.addEventListener('click', handleSendChatMessage);
  }

  // AI Assistant Input Enter Keypress (Step 6A)
  if (elements.aiUserInput) {
    elements.aiUserInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChatMessage();
      }
    });
  }
}

// --- 6. SWITCH VIEW FUNCTION ---
async function switchView(viewName) {
  state.currentView = viewName;
  if (window.contextManager) {
    window.contextManager.setView(viewName);
  }

  // Update active state in sidebar
  elements.navButtons.forEach(btn => {
    if (btn.getAttribute('data-view') === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Header title and description
  const meta = viewMetadata[viewName] || viewMetadata.overview;
  elements.viewTitle.textContent = meta.title;
  elements.viewDescription.textContent = meta.description;

  // Update context displays
  updateContextDisplays();

  // Load backend data for new view
  await loadViewData();
}

// --- 7. CONTEXT SYNCHRONIZATION ---
function updateContextDisplays() {
  elements.currentContextTag.innerHTML = `
    Context: <strong>${escapeHtml(state.selectedZone)}</strong> | <strong>${escapeHtml(state.selectedTime)}</strong>
    <span class="loading-indicator" id="loading-indicator" style="display: ${state.isLoading ? 'inline-flex' : 'none'};">
      <span class="spinner"></span> Loading...
    </span>
  `;

  // Update AI Assistant Context Chips
  elements.aiCtxTab.textContent = `Tab: ${state.currentView.charAt(0).toUpperCase() + state.currentView.slice(1)}`;
  elements.aiCtxZone.textContent = `Area: ${state.selectedZone}`;
  elements.aiCtxTime.textContent = `Time: ${state.selectedTime}`;
}

// --- 8. BACKEND HEALTH CHECK ---
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      elements.backendStatus.classList.add('status-online');
      elements.backendStatusText.textContent = 'Backend: Online';
    } else {
      setBackendOffline();
    }
  } catch (err) {
    setBackendOffline();
  }
}

function setBackendOffline() {
  elements.backendStatus.classList.remove('status-online');
  elements.backendStatusText.textContent = 'Backend: Offline';
}

// --- 9. FETCH FILTER OPTIONS (ZONES & TIMERANGES) ---
async function loadFilterOptions() {
  try {
    // 1. Fetch Zones
    const zonesRes = await fetch(`${API_BASE}/api/city/zones`);
    if (zonesRes.ok) {
      const { data: zones } = await zonesRes.json();
      if (Array.isArray(zones)) {
        elements.zoneSelect.innerHTML = zones.map(z => 
          `<option value="${z.id}" ${z.id === state.selectedZone ? 'selected' : ''}>${z.name}</option>`
        ).join('');
      }
    }

    // 2. Fetch Time Ranges
    const timesRes = await fetch(`${API_BASE}/api/city/timeranges`);
    if (timesRes.ok) {
      const { data: timeRanges } = await timesRes.json();
      if (Array.isArray(timeRanges)) {
        elements.timeSelect.innerHTML = timeRanges.map(t => 
          `<option value="${t}" ${t === state.selectedTime ? 'selected' : ''}>${t}</option>`
        ).join('');
      }
    }
  } catch (err) {
    console.warn('[Notice] Could not load dynamic filter options, using initial defaults.', err);
  }
}

// --- 10. MAIN DATA FETCHER FOR CURRENT VIEW ---
async function loadViewData() {
  setLoading(true);
  clearError();

  const query = `zone=${encodeURIComponent(state.selectedZone)}&timeRange=${encodeURIComponent(state.selectedTime)}`;

  try {
    if (state.currentView === 'overview') {
      const res = await fetch(`${API_BASE}/api/city/overview?${query}`);
      const json = await handleApiResponse(res);
      renderOverviewView(json.data);

    } else if (state.currentView === 'traffic') {
      const res = await fetch(`${API_BASE}/api/city/traffic?${query}`);
      const json = await handleApiResponse(res);
      renderTrafficView(json.data);

    } else if (state.currentView === 'electricity') {
      const res = await fetch(`${API_BASE}/api/city/electricity?${query}`);
      const json = await handleApiResponse(res);
      renderElectricityView(json.data);

    } else if (state.currentView === 'pollution') {
      const res = await fetch(`${API_BASE}/api/city/pollution?${query}`);
      const json = await handleApiResponse(res);
      renderPollutionView(json.data);

    } else if (state.currentView === 'water') {
      const res = await fetch(`${API_BASE}/api/city/water?${query}`);
      const json = await handleApiResponse(res);
      renderWaterView(json.data);

    } else if (state.currentView === 'alerts') {
      const res = await fetch(`${API_BASE}/api/city/alerts?zone=${encodeURIComponent(state.selectedZone)}`);
      const json = await handleApiResponse(res);
      renderAlertsView(json.data);
    }
  } catch (err) {
    showError(`Failed to load ${state.currentView} data: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

// --- 11. RESPONSE HANDLER & ERROR HELPERS ---
async function handleApiResponse(res) {
  if (!res.ok) {
    throw new Error(`Server returned HTTP ${res.status}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Server returned unsuccessful response');
  }
  return json;
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  updateContextDisplays();
}

function showError(msg) {
  elements.errorBannerContainer.style.display = 'block';
  elements.errorBannerContainer.innerHTML = `
    <div class="error-banner">
      <span>⚠️ ${escapeHtml(msg)}</span>
      <button onclick="loadViewData()">Retry</button>
    </div>
  `;
}

function clearError() {
  elements.errorBannerContainer.style.display = 'none';
  elements.errorBannerContainer.innerHTML = '';
}

// --- 12. RENDER OVERVIEW VIEW ---
function renderOverviewView(data) {
  const { summary, chart, alerts } = data;

  // 1. KPI Cards
  elements.kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Traffic Congestion</span><span class="kpi-icon">🚗</span></div>
      <div class="kpi-value">${summary.traffic.value}</div>
      <div class="kpi-footer">
        <span class="badge ${getBadgeClass(summary.traffic.status)}">${summary.traffic.status}</span>
        <span class="kpi-subtext">Arterial Roads</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Electricity Demand</span><span class="kpi-icon">⚡</span></div>
      <div class="kpi-value">${summary.electricity.value}</div>
      <div class="kpi-footer">
        <span class="badge ${getBadgeClass(summary.electricity.status)}">${summary.electricity.status}</span>
        <span class="kpi-subtext">Municipal Grid</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Air Quality (AQI)</span><span class="kpi-icon">🌿</span></div>
      <div class="kpi-value">${summary.pollution.value} AQI</div>
      <div class="kpi-footer">
        <span class="badge ${getBadgeClass(summary.pollution.status)}">${summary.pollution.status}</span>
        <span class="kpi-subtext">Environmental Index</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Water Consumption</span><span class="kpi-icon">💧</span></div>
      <div class="kpi-value">${summary.water.value}</div>
      <div class="kpi-footer">
        <span class="badge ${getBadgeClass(summary.water.status)}">${summary.water.status}</span>
        <span class="kpi-subtext">Distribution Pressure</span>
      </div>
    </div>
  `;

  // 2. Main Chart
  elements.chartTitle.textContent = 'City Operational Pulse';
  elements.chartSubtitle.textContent = `Activity trend for ${state.selectedZone} (${state.selectedTime})`;
  renderChart(chart.labels, chart.seriesName, chart.values, '#2563eb');

  // 3. Localities Breakdown
  elements.secondaryTitle.textContent = 'Localities Summary';
  elements.secondarySubtitle.textContent = 'Simulated conditions across Hubballi areas';
  elements.zoneBreakdownList.innerHTML = `
    <div class="zone-row"><span class="zone-name">Vidyanagar</span><span class="zone-stat">Peak Traffic (71%)</span></div>
    <div class="zone-row"><span class="zone-name">Gokul Road</span><span class="zone-stat">Power Spike (+28%) & High AQI</span></div>
    <div class="zone-row"><span class="zone-name">Keshwapur</span><span class="zone-stat">Pressure Drop (41 PSI)</span></div>
    <div class="zone-row"><span class="zone-name">Unkal</span><span class="zone-stat">Normal Flow & Clean Air</span></div>
  `;

  // 4. Alerts
  renderAlertsList(alerts);

  // Sync with Context Manager
  if (window.contextManager) {
    window.contextManager.syncDashboardData({
      view: 'overview',
      area: state.selectedZone,
      timeRange: state.selectedTime,
      data,
      alerts
    });
  }
}

// --- 13. RENDER TRAFFIC VIEW ---
function renderTrafficView(data) {
  const { kpi, baseline, comparison, chart } = data;

  const diffCongestion = comparison.congestion?.diffPercent ?? 0;
  const isSpike = comparison.congestion?.isSpike ?? false;

  elements.kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Congestion Index</span><span class="kpi-icon">🚗</span></div>
      <div class="kpi-value">${kpi.congestion}%</div>
      <div class="kpi-footer">
        <span class="badge ${kpi.congestion > 65 ? 'badge-danger' : (kpi.congestion > 45 ? 'badge-warning' : 'badge-success')}">
          ${kpi.congestion > 65 ? 'Heavy Congestion' : (kpi.congestion > 45 ? 'Moderate Flow' : 'Free Flow')}
        </span>
        <span class="kpi-subtext">Baseline: ${baseline.congestion}%</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Average Transit Speed</span><span class="kpi-icon">⚡</span></div>
      <div class="kpi-value">${kpi.avgSpeed} km/h</div>
      <div class="kpi-footer">
        <span class="badge badge-light">Baseline: ${baseline.avgSpeed} km/h</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Active Vehicle Volume</span><span class="kpi-icon">📍</span></div>
      <div class="kpi-value">${kpi.vehicleCount.toLocaleString()}</div>
      <div class="kpi-footer">
        <span class="badge badge-primary">Monitored Junctions</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Congestion Variance</span><span class="kpi-icon">📈</span></div>
      <div class="kpi-value">${diffCongestion >= 0 ? '+' : ''}${diffCongestion}%</div>
      <div class="kpi-footer">
        <span class="badge ${isSpike ? 'badge-danger' : 'badge-success'}">
          ${isSpike ? 'Spike Detected' : 'Normal Variance'}
        </span>
        <span class="kpi-subtext">vs Historical Avg</span>
      </div>
    </div>
  `;

  elements.chartTitle.textContent = `${state.selectedZone} Traffic Congestion Trend`;
  elements.chartSubtitle.textContent = `${chart.seriesName} across ${state.selectedTime}`;
  renderChart(chart.labels, chart.seriesName, chart.values, '#f59e0b');

  // Breakdown
  elements.secondaryTitle.textContent = 'Mobility Observations';
  elements.secondarySubtitle.textContent = 'Key corridor speed monitoring';
  elements.zoneBreakdownList.innerHTML = `
    <div class="zone-row"><span class="zone-name">Arterial Highway 1</span><span class="zone-stat">${kpi.avgSpeed + 6} km/h</span></div>
    <div class="zone-row"><span class="zone-name">Downtown Ring Road</span><span class="zone-stat">${Math.max(12, kpi.avgSpeed - 8)} km/h</span></div>
    <div class="zone-row"><span class="zone-name">Commercial Ave</span><span class="zone-stat">${kpi.avgSpeed} km/h</span></div>
  `;

  // Sync with Context Manager
  if (window.contextManager) {
    window.contextManager.syncDashboardData({
      view: 'traffic',
      area: state.selectedZone,
      timeRange: state.selectedTime,
      data
    });
  }

  // Fetch alerts for this module & zone
  fetchAndRenderAlerts('traffic');
}

// --- 14. RENDER ELECTRICITY VIEW ---
function renderElectricityView(data) {
  const { kpi, baseline, comparison, chart } = data;
  const diffCons = comparison.consumption?.diffPercent ?? 0;
  const isSpike = comparison.consumption?.isSpike ?? false;

  elements.kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Power Consumption</span><span class="kpi-icon">⚡</span></div>
      <div class="kpi-value">${kpi.consumption.toLocaleString()} MWh</div>
      <div class="kpi-footer">
        <span class="badge ${isSpike ? 'badge-danger' : 'badge-primary'}">
          ${isSpike ? 'Surge Load' : 'Standard Demand'}
        </span>
        <span class="kpi-subtext">Baseline: ${baseline.consumption} MWh</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Peak Demand</span><span class="kpi-icon">🔥</span></div>
      <div class="kpi-value">${kpi.peakDemand} MW</div>
      <div class="kpi-footer">
        <span class="badge badge-light">Capacity: ${baseline.peakDemand} MW</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Grid Stress Load</span><span class="kpi-icon">⚙️</span></div>
      <div class="kpi-value">${kpi.gridLoad}%</div>
      <div class="kpi-footer">
        <span class="badge ${kpi.gridLoad > 80 ? 'badge-danger' : 'badge-success'}">
          ${kpi.gridLoad > 80 ? 'Heavy Grid Stress' : 'Stable Capacity'}
        </span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Consumption Delta</span><span class="kpi-icon">📊</span></div>
      <div class="kpi-value">${diffCons >= 0 ? '+' : ''}${diffCons}%</div>
      <div class="kpi-footer">
        <span class="badge ${isSpike ? 'badge-danger' : 'badge-success'}">
          ${isSpike ? 'Significant Spike' : 'Nominal'}
        </span>
        <span class="kpi-subtext">Deviation from baseline</span>
      </div>
    </div>
  `;

  elements.chartTitle.textContent = `${state.selectedZone} Electricity Load Curve`;
  elements.chartSubtitle.textContent = `${chart.seriesName} during ${state.selectedTime}`;
  renderChart(chart.labels, chart.seriesName, chart.values, '#2563eb');

  elements.secondaryTitle.textContent = 'Grid Distribution Status';
  elements.secondarySubtitle.textContent = 'Substation load levels';
  elements.zoneBreakdownList.innerHTML = `
    <div class="zone-row"><span class="zone-name">Substation Alpha</span><span class="zone-stat">${kpi.gridLoad}% Load</span></div>
    <div class="zone-row"><span class="zone-name">Industrial Feeder 4</span><span class="zone-stat">${isSpike ? 'Spike Active' : 'Normal'}</span></div>
    <div class="zone-row"><span class="zone-name">Reserve Storage</span><span class="zone-stat">94% Charged</span></div>
  `;

  // Sync with Context Manager
  if (window.contextManager) {
    window.contextManager.syncDashboardData({
      view: 'electricity',
      area: state.selectedZone,
      timeRange: state.selectedTime,
      data
    });
  }

  fetchAndRenderAlerts('electricity');
}

// --- 15. RENDER POLLUTION VIEW ---
function renderPollutionView(data) {
  const { kpi, baseline, chart } = data;

  elements.kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Air Quality Index</span><span class="kpi-icon">🌿</span></div>
      <div class="kpi-value">${kpi.aqi} AQI</div>
      <div class="kpi-footer">
        <span class="badge ${getBadgeClass(kpi.status)}">${kpi.status}</span>
        <span class="kpi-subtext">Baseline: ${baseline.aqi} AQI</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">PM2.5 Concentration</span><span class="kpi-icon">💨</span></div>
      <div class="kpi-value">${kpi.pm25} µg/m³</div>
      <div class="kpi-footer">
        <span class="badge ${kpi.pm25 > 50 ? 'badge-danger' : 'badge-light'}">
          ${kpi.pm25 > 50 ? 'Above WHO Limit' : 'Acceptable'}
        </span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">PM10 Coarse Dust</span><span class="kpi-icon">🏭</span></div>
      <div class="kpi-value">${kpi.pm10} µg/m³</div>
      <div class="kpi-footer">
        <span class="badge badge-light">Baseline: ${baseline.pm10} µg/m³</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Nitrogen Dioxide (NO2)</span><span class="kpi-icon">🧪</span></div>
      <div class="kpi-value">${kpi.no2} ppb</div>
      <div class="kpi-footer">
        <span class="badge ${kpi.no2 > 40 ? 'badge-warning' : 'badge-success'}">
          ${kpi.no2 > 40 ? 'Vehicle Emissions' : 'Safe Levels'}
        </span>
      </div>
    </div>
  `;

  elements.chartTitle.textContent = `${state.selectedZone} Air Quality Trend`;
  elements.chartSubtitle.textContent = `${chart.seriesName} during ${state.selectedTime}`;
  renderChart(chart.labels, chart.seriesName, chart.values, '#16a34a');

  elements.secondaryTitle.textContent = 'Pollutant Breakdown';
  elements.secondarySubtitle.textContent = 'Concentrations vs Standards';
  elements.zoneBreakdownList.innerHTML = `
    <div class="zone-row"><span class="zone-name">Fine Particles (PM2.5)</span><span class="zone-stat">${kpi.pm25} µg/m³</span></div>
    <div class="zone-row"><span class="zone-name">Coarse Dust (PM10)</span><span class="zone-stat">${kpi.pm10} µg/m³</span></div>
    <div class="zone-row"><span class="zone-name">NO2 Levels</span><span class="zone-stat">${kpi.no2} ppb</span></div>
  `;

  // Sync with Context Manager
  if (window.contextManager) {
    window.contextManager.syncDashboardData({
      view: 'pollution',
      area: state.selectedZone,
      timeRange: state.selectedTime,
      data
    });
  }

  fetchAndRenderAlerts('pollution');
}

// --- 16. RENDER WATER VIEW ---
function renderWaterView(data) {
  const { kpi, baseline, chart } = data;

  elements.kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Water Consumption</span><span class="kpi-icon">💧</span></div>
      <div class="kpi-value">${kpi.consumption.toLocaleString()} kL</div>
      <div class="kpi-footer">
        <span class="badge badge-primary">Baseline: ${baseline.consumption} kL</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Main Flow Rate</span><span class="kpi-icon">🌊</span></div>
      <div class="kpi-value">${kpi.flowRate} L/s</div>
      <div class="kpi-footer">
        <span class="badge badge-light">Flow Sensor Net</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Distribution Pressure</span><span class="kpi-icon">🚰</span></div>
      <div class="kpi-value">${kpi.pressure} PSI</div>
      <div class="kpi-footer">
        <span class="badge ${kpi.pressure < 45 ? 'badge-warning' : 'badge-success'}">
          ${kpi.pressure < 45 ? 'Pressure Drop' : 'Normal Pressure'}
        </span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Reservoir Capacity</span><span class="kpi-icon">🏊</span></div>
      <div class="kpi-value">${kpi.reservoirLevel}%</div>
      <div class="kpi-footer">
        <span class="badge badge-success">Sufficient Supply</span>
      </div>
    </div>
  `;

  elements.chartTitle.textContent = `${state.selectedZone} Water Distribution Trend`;
  elements.chartSubtitle.textContent = `${chart.seriesName} for ${state.selectedTime}`;
  renderChart(chart.labels, chart.seriesName, chart.values, '#0284c7');

  elements.secondaryTitle.textContent = 'Storage & Pipeline Health';
  elements.secondarySubtitle.textContent = 'Municipal reservoir levels';
  elements.zoneBreakdownList.innerHTML = `
    <div class="zone-row"><span class="zone-name">North Reservoir</span><span class="zone-stat">82% Full</span></div>
    <div class="zone-row"><span class="zone-name">Sector Pipeline Pressure</span><span class="zone-stat">${kpi.pressure} PSI</span></div>
    <div class="zone-row"><span class="zone-name">Pumping Station</span><span class="zone-stat">Operational</span></div>
  `;

  // Sync with Context Manager
  if (window.contextManager) {
    window.contextManager.syncDashboardData({
      view: 'water',
      area: state.selectedZone,
      timeRange: state.selectedTime,
      data
    });
  }

  fetchAndRenderAlerts('water');
}

// --- 17. RENDER ALERTS VIEW ---
function renderAlertsView(alerts) {
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const medCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  elements.kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Total Active Alerts</span><span class="kpi-icon">🔔</span></div>
      <div class="kpi-value">${alerts.length}</div>
      <div class="kpi-footer"><span class="badge badge-light">Monitored Range</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">High Severity</span><span class="kpi-icon">🚨</span></div>
      <div class="kpi-value">${highCount}</div>
      <div class="kpi-footer"><span class="badge badge-danger">Immediate Attention</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Medium Severity</span><span class="kpi-icon">⚠️</span></div>
      <div class="kpi-value">${medCount}</div>
      <div class="kpi-footer"><span class="badge badge-warning">Advisory</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-header"><span class="kpi-title">Low Severity</span><span class="kpi-icon">ℹ️</span></div>
      <div class="kpi-value">${lowCount}</div>
      <div class="kpi-footer"><span class="badge badge-primary">Informational</span></div>
    </div>
  `;

  elements.chartTitle.textContent = 'Alert Severity Breakdown';
  elements.chartSubtitle.textContent = `Incident distribution for ${state.selectedZone}`;
  renderChart(['High', 'Medium', 'Low'], 'Alert Count', [highCount, medCount, lowCount], '#dc2626', 'bar');

  elements.secondaryTitle.textContent = 'Municipal Response Protocol';
  elements.secondarySubtitle.textContent = 'Escalation status';
  elements.zoneBreakdownList.innerHTML = `
    <div class="zone-row"><span class="zone-name">Grid Dispatch</span><span class="zone-stat">Active Monitoring</span></div>
    <div class="zone-row"><span class="zone-name">Traffic Management</span><span class="zone-stat">Signal Optimization</span></div>
    <div class="zone-row"><span class="zone-name">Environmental Agency</span><span class="zone-stat">Advisory Issued</span></div>
  `;

  renderAlertsList(alerts);

  // Sync with Context Manager
  if (window.contextManager) {
    window.contextManager.syncDashboardData({
      view: 'alerts',
      area: state.selectedZone,
      timeRange: state.selectedTime,
      data: alerts,
      alerts
    });
  }
}

// --- 18. HELPER TO FETCH MODULE-SPECIFIC ALERTS ---
async function fetchAndRenderAlerts(moduleName) {
  try {
    const res = await fetch(`${API_BASE}/api/city/alerts?zone=${encodeURIComponent(state.selectedZone)}&module=${encodeURIComponent(moduleName)}`);
    const json = await handleApiResponse(res);
    renderAlertsList(json.data);
    if (window.contextManager) {
      window.contextManager.syncDashboardData({
        view: state.currentView,
        area: state.selectedZone,
        timeRange: state.selectedTime,
        alerts: json.data
      });
    }
  } catch (err) {
    console.warn(`Could not load alerts for ${moduleName}:`, err);
  }
}

// --- 19. RENDER ALERTS LIST ---
function renderAlertsList(alerts) {
  if (!alerts || alerts.length === 0) {
    elements.alertsContainer.innerHTML = `
      <div class="alert-item alert-low">
        <div class="alert-icon">✅</div>
        <div class="alert-content">
          <div class="alert-header-row"><span class="alert-title">No Active Alerts</span></div>
          <p class="alert-message">All municipal systems in ${escapeHtml(state.selectedZone)} are currently operating within nominal parameters.</p>
        </div>
      </div>
    `;
    elements.alertCountBadge.textContent = '0 Critical';
    elements.alertCountBadge.className = 'badge badge-success';
    return;
  }

  const criticalCount = alerts.filter(a => a.severity === 'high').length;
  elements.alertCountBadge.textContent = `${criticalCount} Critical`;
  elements.alertCountBadge.className = criticalCount > 0 ? 'badge badge-danger' : 'badge badge-warning';

  elements.alertsContainer.innerHTML = alerts.map(a => {
    const severityClass = a.severity === 'high' ? 'alert-high' : (a.severity === 'medium' ? 'alert-medium' : 'alert-low');
    const badgeClass = a.severity === 'high' ? 'badge-danger' : (a.severity === 'medium' ? 'badge-warning' : 'badge-primary');
    const icon = a.module === 'traffic' ? '🚗' : (a.module === 'electricity' ? '⚡' : (a.module === 'pollution' ? '🌿' : '💧'));

    return `
      <div class="alert-item ${severityClass}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
          <div class="alert-header-row">
            <span class="alert-title">${escapeHtml(a.title)}</span>
            <span class="alert-time">${escapeHtml(a.timestamp)}</span>
          </div>
          <p class="alert-message">${escapeHtml(a.message)}</p>
          <div class="alert-meta">
            <span class="badge ${badgeClass}">${capitalize(a.severity)} Severity</span>
            <span class="badge badge-light">${escapeHtml(a.zone)}</span>
            <span class="badge badge-light">${capitalize(a.module)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- 20. CHART.JS RENDERING ---
function renderChart(labels, seriesName, values, color = '#2563eb', type = 'line') {
  if (!elements.mainChartCanvas || typeof Chart === 'undefined') {
    return;
  }

  // Destroy previous chart instance before drawing a new one
  if (mainChartInstance) {
    mainChartInstance.destroy();
  }

  const ctx = elements.mainChartCanvas.getContext('2d');

  mainChartInstance = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [
        {
          label: seriesName,
          data: values,
          borderColor: color,
          backgroundColor: type === 'line' ? `${color}15` : `${color}80`,
          fill: type === 'line',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: color
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { family: 'Inter', size: 12 },
            color: '#475569',
            boxWidth: 12
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Inter', size: 13 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: '#e2e8f0' },
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          beginAtZero: true
        }
      }
    }
  });
}

// --- 21. UTILITY FUNCTIONS ---
function getBadgeClass(status) {
  if (!status) return 'badge-light';
  const s = status.toLowerCase();
  if (s.includes('high') || s.includes('unhealthy') || s.includes('heavy')) return 'badge-danger';
  if (s.includes('mod') || s.includes('sensitive') || s.includes('drop')) return 'badge-warning';
  if (s.includes('good') || s.includes('stable') || s.includes('normal') || s.includes('low')) return 'badge-success';
  return 'badge-primary';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- 22. AI CHAT HANDLER (STEP 6A & 6C) ---
const conversationHistory = [];

async function handleSendChatMessage() {
  if (!elements.aiUserInput || !elements.aiChatMessages) return;

  const messageText = elements.aiUserInput.value.trim();
  if (!messageText) return;

  // 1. Append user message bubble to chat UI & track history
  appendChatMessage('user', messageText);
  conversationHistory.push({ role: 'user', content: messageText });
  elements.aiUserInput.value = '';
  elements.aiUserInput.disabled = true;
  if (elements.aiSendBtn) elements.aiSendBtn.disabled = true;

  // 2. Append temporary loading indicator bubble
  const loadingId = 'ai-loading-' + Date.now();
  const loadingElement = document.createElement('div');
  loadingElement.className = 'ai-message assistant-message';
  loadingElement.id = loadingId;
  loadingElement.innerHTML = `
    <div class="message-sender">Assistant</div>
    <div class="message-bubble loading-bubble">
      <span class="spinner"></span> Consulting city intelligence...
    </div>
  `;
  elements.aiChatMessages.appendChild(loadingElement);
  elements.aiChatMessages.scrollTop = elements.aiChatMessages.scrollHeight;

  // 3. Obtain current real-time context from Context Manager
  const currentContext = window.contextManager ? window.contextManager.getContext() : null;

  try {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: messageText,
        context: currentContext,
        history: conversationHistory.slice(-6)
      })
    });

    const json = await res.json();

    // Remove loading indicator
    const loader = document.getElementById(loadingId);
    if (loader) loader.remove();

    if (res.ok && json.success && json.data) {
      if (json.data.reply) {
        appendChatMessage('assistant', json.data.reply);
        conversationHistory.push({ role: 'assistant', content: json.data.reply });
        if (conversationHistory.length > 10) {
          conversationHistory.splice(0, conversationHistory.length - 10);
        }
      }
      // Step 6B-1 & 6C: Safely execute validated dashboard action asynchronously
      if (json.data.action) {
        await executeDashboardAction(json.data.action);
      }
    } else {
      const errorMsg = json.error || 'AI Assistant is temporarily unavailable. Please try again.';
      appendChatMessage('assistant', `⚠️ ${errorMsg}`, true);
    }
  } catch (err) {
    // Remove loading indicator
    const loader = document.getElementById(loadingId);
    if (loader) loader.remove();

    appendChatMessage('assistant', '⚠️ Unable to connect to the backend AI service. Please verify server status.', true);
  } finally {
    if (elements.aiUserInput) {
      elements.aiUserInput.disabled = false;
      elements.aiUserInput.focus();
    }
    if (elements.aiSendBtn) {
      elements.aiSendBtn.disabled = false;
    }
  }
}

// --- 23. SAFE DASHBOARD ACTION EXECUTION (STEP 6B-1 & 6C) ---
const ALLOWED_VIEWS = ['overview', 'traffic', 'electricity', 'pollution', 'water', 'alerts'];
const ALLOWED_AREAS = ['Hubballi', 'Vidyanagar', 'Gokul Road', 'Keshwapur', 'Unkal'];
const ALLOWED_TIMERANGES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'];

/**
 * Validates action object strictly against allowlists.
 * Discards any action attempting arbitrary execution or invalid values.
 */
function validateDashboardAction(action) {
  if (!action || typeof action !== 'object') return null;
  if (action.type !== 'dashboard_navigation') return null;
  if (!ALLOWED_VIEWS.includes(action.view)) return null;
  if (!ALLOWED_AREAS.includes(action.area)) return null;
  if (!ALLOWED_TIMERANGES.includes(action.timeRange)) return null;
  return action;
}

/**
 * Executes a validated dashboard navigation action.
 * Reuses existing switchView, loadViewData, and dropdown controls.
 * Guarantees fresh data fetch and context synchronization before completion.
 */
async function executeDashboardAction(rawAction) {
  const validAction = validateDashboardAction(rawAction);
  if (!validAction) {
    if (rawAction) {
      console.warn('[AI Action Security] Action rejected - outside strict allowlist:', rawAction);
    }
    return false;
  }

  const { view, area, timeRange } = validAction;

  // 1. Synchronize dropdown controls
  if (elements.zoneSelect) {
    elements.zoneSelect.value = area;
  }
  if (elements.timeSelect) {
    elements.timeSelect.value = timeRange;
  }

  // 2. Determine state differences
  const viewChanged = (view !== state.currentView);
  const filtersChanged = (area !== state.selectedZone || timeRange !== state.selectedTime);

  // If nothing changed, avoid unnecessary reload
  if (!viewChanged && !filtersChanged) {
    return true;
  }

  // 3. Update internal state
  state.selectedZone = area;
  state.selectedTime = timeRange;

  // 4. Update Context Manager filters
  if (window.contextManager) {
    window.contextManager.setFilters(area, timeRange);
  }

  // 5. Reuse existing navigation / render cycle asynchronously
  if (viewChanged) {
    await switchView(view);
  } else if (filtersChanged) {
    updateContextDisplays();
    await loadViewData();
  }

  return true;
}

function appendChatMessage(sender, text, isError = false) {
  if (!elements.aiChatMessages) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `ai-message ${sender === 'user' ? 'user-message' : 'assistant-message'}${isError ? ' error-message' : ''}`;

  const senderLabel = sender === 'user' ? 'You' : 'Assistant';
  msgDiv.innerHTML = `
    <div class="message-sender">${senderLabel}</div>
    <div class="message-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
  `;

  elements.aiChatMessages.appendChild(msgDiv);
  elements.aiChatMessages.scrollTop = elements.aiChatMessages.scrollHeight;
}
