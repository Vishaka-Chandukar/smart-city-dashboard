/**
 * AI Assistant Service - Smart City Dashboard (Backend)
 * 
 * Powered by Google Gemini using the official @google/genai SDK.
 * Grounded in real-time Context Manager snapshots & SQLite database.
 * Supports Step 6C: Synchronized Agent Action + Analysis, Follow-up Context,
 * and UI/Dashboard Consistency.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');
const analyticsService = require('./analyticsService');
const db = require('../database/db');

// Strict Allowlists for Dashboard Navigation
const ALLOWED_VIEWS = ['overview', 'traffic', 'electricity', 'pollution', 'water', 'alerts'];
const ALLOWED_AREAS = ['Hubballi', 'Vidyanagar', 'Gokul Road', 'Keshwapur', 'Unkal'];
const ALLOWED_TIMERANGES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'];

/**
 * System instruction defining the AI assistant's persona, boundaries,
 * analytical grounding, causal safety, and structured JSON output.
 */
const SYSTEM_INSTRUCTION = `You are the municipal AI Assistant for the Smart City Dashboard, serving Hubballi, Karnataka.

CORE PRINCIPLES & BOUNDARIES:
1. STRICT SOURCE OF TRUTH: The provided [DASHBOARD CONTEXT] and [ANALYTICAL EVIDENCE] sections are your absolute, sole source of truth for all numerical measurements, KPIs, baseline comparisons, statuses, and system alerts.
2. AUTHORITATIVE CONTEXT & SUPPORTING HISTORY:
   - The current [DASHBOARD CONTEXT] and fresh backend data are ALWAYS authoritative and take precedence.
   - Conversation history is supporting context ONLY. Use it to resolve pronouns ("it", "there", "same area", follow-up questions) when unspecified.
   - Stale conversation history must NEVER override the user's current [DASHBOARD CONTEXT]. If previous messages discussed another area, but the current [DASHBOARD CONTEXT] shows a new area, you MUST use the new area from context unless the user explicitly names another locality.
3. ANTI-HALLUCINATION RULE:
   - For all numerical or operational queries, ONLY use numbers and facts explicitly present in the provided context or evidence.
   - If the user asks about metrics, data, or systems NOT tracked in the prototype (such as solar panel generation, weather/wind conditions, demographics, or population growth), you MUST state clearly that the requested information is not available in the current smart city prototype.
   - Do NOT make up, extrapolate, or guess sensor readings, percentages, historical averages, or external causes.
4. CAUSAL EXPLANATION RULES (STRICT EVIDENCE-BASED REASONING):
   - You must NEVER invent external causes (e.g. population growth, weather, demographic shifts, unmonitored infrastructure).
   - You may identify likely contributing factors ONLY when supported by data in the provided evidence (e.g. "The increase coincides with higher peak demand (182 MW) and elevated grid load (89%)").
   - Always use prudent language: "The data indicates...", "A likely contributing factor is...", "This coincides with...", "The available prototype data suggests...", "The data does not establish causation."
5. ANALYTICAL GROUNDING:
   - When [ANALYTICAL EVIDENCE] is provided, cite the exact pre-calculated values, percentage changes, and trajectory classifications. Do not recalculate or invent your own numbers.
6. RELATIVE TERMS: The words "here", "this area", "today", "currently", "same area", or "this module" refer to the active locality, module, and time range specified in [DASHBOARD CONTEXT].
7. SIMULATED DATA RECOGNITION: The project measurements are realistic simulated prototype data for Hubballi, Karnataka.

STRUCTURED OUTPUT FORMAT:
You MUST ALWAYS respond with a valid JSON object with the following schema:
{
  "reply": "Clear, concise, natural-language explanation to display to the user.",
  "action": null | {
    "type": "dashboard_navigation",
    "view": "overview" | "traffic" | "electricity" | "pollution" | "water" | "alerts",
    "area": "Hubballi" | "Vidyanagar" | "Gokul Road" | "Keshwapur" | "Unkal",
    "timeRange": "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days"
  }
}

DASHBOARD ACTIONS RULES:
- Include an "action" ONLY when a dashboard change is explicitly requested or when an analytical query requires navigating to a view/area/time that differs from the current [DASHBOARD CONTEXT].
- If the requested view, area, and time already match the active [DASHBOARD CONTEXT] (e.g. user asks "Why is electricity high here?" while already on Electricity), the "action" MUST BE null to prevent unnecessary UI reloads.
- PRESERVE UNCHANGED CONTEXT DIMENSIONS: If the user changes only the module, keep the existing "area" and "timeRange" from [DASHBOARD CONTEXT]. If the user changes only the time range, keep the existing "view" and "area". If the user changes only the area, keep the existing "view" and "timeRange".
- ALLOWED VALUES ONLY:
  - view: overview, traffic, electricity, pollution, water, alerts
  - area: Hubballi, Vidyanagar, Gokul Road, Keshwapur, Unkal
  - timeRange: Today, Yesterday, Last 7 Days, Last 30 Days
- COMPOUND REQUESTS (Action + Analysis): If the user asks both to show/navigate to a view AND asks an analytical question (e.g. "Show electricity in Gokul Road and tell me why it is high"), provide BOTH the grounded analytical explanation in "reply" and the valid navigation payload in "action".`;

/**
 * Formats the structured Context Manager object into a clean, text-based prompt block.
 */
function formatContextForPrompt(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    return '[NO DASHBOARD CONTEXT SUPPLIED]';
  }

  const alertsText = Array.isArray(ctx.alerts) && ctx.alerts.length > 0
    ? ctx.alerts.map(a => `- [${(a.severity || 'notice').toUpperCase()}] ${a.title}: ${a.message} (Locality: ${a.zone || ctx.selectedArea}, Module: ${a.module})`).join('\n')
    : 'None active for this scope';

  const anomaliesText = Array.isArray(ctx.anomalies) && ctx.anomalies.length > 0
    ? ctx.anomalies.map(a => `- ${a.description || JSON.stringify(a)}`).join('\n')
    : 'None detected (operating within standard parameters)';

  return `[DASHBOARD CONTEXT]
Jurisdiction: ${ctx.city || 'Hubballi'}, ${ctx.region || 'Karnataka'}
Active Module: ${ctx.viewTitle || ctx.currentView || 'Overview'} (${ctx.currentView || 'overview'})
Selected Area / Locality: ${ctx.selectedArea || 'Hubballi'}
Selected Time Range: ${ctx.selectedTimeRange || 'Today'}
Primary Metric: ${ctx.activeMetric || 'allModules'}
Current KPIs: ${JSON.stringify(ctx.kpis || {})}
Baselines: ${JSON.stringify(ctx.baseline || {})}
Detected Anomalies:
${anomaliesText}
Active System Alerts:
${alertsText}
Summary Narrative: ${ctx.summaryNarrative || 'N/A'}`;
}

/**
 * Formats recent conversation history for prompt injection.
 */
function formatConversationHistory(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return '';
  }
  const lines = history.map(item => {
    const role = item.role === 'user' ? 'User' : 'Assistant';
    return `${role}: ${item.content || item.text || ''}`;
  });
  return `[RECENT CONVERSATION HISTORY (SUPPORTING CONTEXT ONLY - DASHBOARD CONTEXT IS AUTHORITATIVE)]\n${lines.join('\n')}`;
}

/**
 * Safely parses and validates the AI response text.
 * Strips code fences, validates JSON structure, and checks allowlists.
 */
function safeParseAIResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      reply: 'No response received from the assistant.',
      action: null
    };
  }

  let cleaned = rawText.trim();

  // Strip Markdown code block fences if present (```json ... ``` or ``` ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (innerErr) {
        return {
          reply: cleaned,
          action: null
        };
      }
    } else {
      return {
        reply: cleaned,
        action: null
      };
    }
  }

  // Ensure reply is a string
  const reply = typeof parsed.reply === 'string' && parsed.reply.trim()
    ? parsed.reply.trim()
    : 'Here is the current dashboard assessment.';

  // Validate action against strict allowlists
  let action = null;
  if (parsed.action && typeof parsed.action === 'object') {
    const rawAction = parsed.action;
    if (
      rawAction.type === 'dashboard_navigation' &&
      ALLOWED_VIEWS.includes(rawAction.view) &&
      ALLOWED_AREAS.includes(rawAction.area) &&
      ALLOWED_TIMERANGES.includes(rawAction.timeRange)
    ) {
      action = {
        type: 'dashboard_navigation',
        view: rawAction.view,
        area: rawAction.area,
        timeRange: rawAction.timeRange
      };
    } else {
      console.warn('[aiService] Discarded invalid action outside allowlist:', rawAction);
      action = null;
    }
  }

  return { reply, action };
}

/**
 * Gathers deterministic analytical evidence based on user query intent.
 */
function collectAnalyticalEvidence(query, context, history = []) {
  const q = query.toLowerCase();
  const ctx = context || {};
  const currentView = (ctx.currentView || 'overview').toLowerCase();
  const selectedArea = ctx.selectedArea || 'Hubballi';
  const selectedTime = ctx.selectedTimeRange || 'Today';

  // Resolve target module (context is authoritative, supporting history resolves pronouns)
  let targetModule = 'electricity';
  if (q.includes('traffic') || currentView === 'traffic') targetModule = 'traffic';
  else if (q.includes('pollution') || q.includes('aqi') || currentView === 'pollution') targetModule = 'pollution';
  else if (q.includes('water') || currentView === 'water') targetModule = 'water';
  else if (q.includes('electricity') || q.includes('power') || currentView === 'electricity') targetModule = 'electricity';

  // Resolve target area (context is authoritative unless user explicitly names another area)
  let targetArea = selectedArea;
  for (const a of ALLOWED_AREAS) {
    if (q.includes(a.toLowerCase())) {
      targetArea = a;
      break;
    }
  }

  const evidenceBlocks = [];

  // Check 1: Explicit Period Comparison
  if (q.includes('compare') && (q.includes('yesterday') || q.includes('previous') || q.includes('period') || q.includes('last 7 days'))) {
    let periodB = 'Yesterday';
    if (q.includes('last 7 days') && selectedTime !== 'Last 7 Days') periodB = 'Last 7 Days';
    else if (selectedTime === 'Yesterday') periodB = 'Today';

    try {
      const comp = analyticsService.comparePeriods(targetModule, targetArea, selectedTime, periodB);
      evidenceBlocks.push(`[ANALYTICAL EVIDENCE: PERIOD COMPARISON]\n${comp.summaryText}\nDetails: ${JSON.stringify(comp)}`);
    } catch (err) {
      // Ignored if invalid combination
    }
  }

  // Check 2: Trend Analysis
  if (q.includes('trend') || q.includes('increasing') || q.includes('decreasing') || q.includes('getting worse') || q.includes('getting better') || q.includes('over the last')) {
    let trendTime = selectedTime;
    if (q.includes('last 7 days') || q.includes('7 days')) trendTime = 'Last 7 Days';
    else if (q.includes('last 30 days') || q.includes('30 days')) trendTime = 'Last 30 Days';

    try {
      const trend = analyticsService.analyzeTrend(targetModule, targetArea, trendTime);
      evidenceBlocks.push(`[ANALYTICAL EVIDENCE: MULTI-FACTOR TREND ANALYSIS]\n${trend.summaryText}\nDetails: ${JSON.stringify(trend)}`);
    } catch (err) {
      // Ignored
    }
  }

  // Check 3: Multi-Module Evidence / Contributing Factors / Cross-correlation
  if (q.includes('why') || q.includes('cause') || q.includes('also high') || q.includes('contribut') || q.includes('correlat') || (q.includes('pollution') && q.includes('electricity'))) {
    try {
      const multi = analyticsService.getMultiModuleEvidence(targetArea, selectedTime);
      evidenceBlocks.push(`[ANALYTICAL EVIDENCE: CROSS-MODULE EVIDENCE & ALERTS]\n${multi.summaryText}\nActive Alerts: ${JSON.stringify(multi.alerts)}\nContributing Factors: ${multi.contributingFactors.join('; ')}`);
    } catch (err) {
      // Ignored
    }
  }

  // Check 4: Area Ranking
  if (q.includes('highest') || q.includes('lowest') || q.includes('rank') || q.includes('which area')) {
    try {
      const ranking = analyticsService.rankAreasByMetric(targetModule, selectedTime);
      evidenceBlocks.push(`[ANALYTICAL EVIDENCE: LOCALITY RANKING]\n${ranking.summaryText}\nHighest: ${JSON.stringify(ranking.highest)}, Lowest: ${JSON.stringify(ranking.lowest)}`);
    } catch (err) {
      // Ignored
    }
  }

  return evidenceBlocks.join('\n\n');
}

/**
 * Primary entry point: Queries Gemini with user question, dashboard context,
 * analytical evidence, and supporting conversation history.
 * 
 * @param {string} userMessage The question asked by the user
 * @param {Object} context The current Context Manager state from dashboard
 * @param {Array} history Optional recent conversation messages
 * @returns {Promise<{ reply: string, action: Object | null }>}
 */
async function askGemini(userMessage, context, history = []) {
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    throw new Error('User message is required.');
  }

  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

  // Validate API key presence
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key is not configured. Please add your GEMINI_API_KEY in backend/.env.');
  }

  // Support offline mock mode during testing if explicitly configured
  if (apiKey === 'mock-test-key' || process.env.AI_SIMULATE === 'true') {
    return generateDeterministicMockResponse(userMessage.trim(), context, history);
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contextBlock = formatContextForPrompt(context);
  const historyBlock = formatConversationHistory(history);
  const evidenceBlock = collectAnalyticalEvidence(userMessage.trim(), context, history);

  let fullPrompt = `${contextBlock}\n\n`;
  if (historyBlock) {
    fullPrompt += `${historyBlock}\n\n`;
  }
  if (evidenceBlock) {
    fullPrompt += `${evidenceBlock}\n\n`;
  }
  fullPrompt += `User Question: ${userMessage.trim()}`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    if (response && response.text) {
      return safeParseAIResponse(response.text);
    }

    throw new Error('Empty response received from Gemini.');
  } catch (error) {
    console.error('[aiService Error]:', error.message);

    if (error.message.includes('API_KEY_INVALID') || error.message.includes('401') || error.message.includes('403')) {
      throw new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY in backend/.env.');
    }
    if (error.message.includes('NOT_FOUND') || error.message.includes('model')) {
      throw new Error(`The requested Gemini model (${modelName}) was not found or is unavailable.`);
    }

    throw new Error(`AI service error: ${error.message}`);
  }
}

/**
 * Deterministic fallback response generator for offline test verification.
 * Dynamically computes results from SQLite via analyticsService and db.js.
 * Strictly adheres to all anti-hallucination, causal safety, and Step 6C synchronization rules.
 */
function generateDeterministicMockResponse(userMessage, context, history = []) {
  const query = userMessage.toLowerCase().trim();
  const ctx = context || {};
  const currentView = (ctx.currentView || 'overview').toLowerCase();
  const selectedArea = ctx.selectedArea || 'Hubballi';
  const selectedTime = ctx.selectedTimeRange || 'Today';

  // Helper to resolve view from query
  let targetView = null;
  if (query.includes('overview')) targetView = 'overview';
  else if (query.includes('traffic')) targetView = 'traffic';
  else if (query.includes('electricity') || query.includes('power')) targetView = 'electricity';
  else if (query.includes('pollution') || query.includes('air quality') || query.includes('aqi')) targetView = 'pollution';
  else if (query.includes('water')) targetView = 'water';
  else if (query.includes('alert')) targetView = 'alerts';

  // Helper to resolve area from query (explicit user mention takes precedence over context)
  let targetArea = null;
  if (query.includes('vidyanagar')) targetArea = 'Vidyanagar';
  else if (query.includes('gokul road') || query.includes('gokul')) targetArea = 'Gokul Road';
  else if (query.includes('keshwapur')) targetArea = 'Keshwapur';
  else if (query.includes('unkal')) targetArea = 'Unkal';
  else if (query.includes('hubballi')) targetArea = 'Hubballi';

  // Helper to resolve time range from query
  let targetTime = null;
  if (query.includes('last 30 days') || query.includes('30 days')) targetTime = 'Last 30 Days';
  else if (query.includes('last 7 days') || query.includes('7 days')) targetTime = 'Last 7 Days';
  else if (query.includes('yesterday')) targetTime = 'Yesterday';
  else if (query.includes('today')) targetTime = 'Today';

  // Check if query explicitly asks to navigate/show/open
  const isNavIntent = query.startsWith('show') || query.startsWith('open') || 
                      query.startsWith('go to') || query.startsWith('switch') || 
                      query.startsWith('view') || query.startsWith('navigate') ||
                      query.includes('show me') || query.includes('show electricity') ||
                      query.includes('show pollution') || query.includes('show traffic') ||
                      query.includes('show water');

  // 1. Check for Missing / Unsupported Prototype Data (Anti-hallucination test)
  if (query.includes('solar') || query.includes('weather') || query.includes('population') || query.includes('wind') || query.includes('demographic')) {
    return {
      reply: `I don't have solar generation or demographic data in the current Hubballi prototype. To maintain data reliability, I can only provide measurements for Traffic, Electricity, Pollution, and Water.`,
      action: null
    };
  }

  // 2. COMPOUND REQUEST (Step 6C: Action + Analysis in a single turn)
  // E.g.: "Show electricity in Gokul Road for today and tell me why consumption is high."
  if (isNavIntent && (query.includes('why') || query.includes('cause') || query.includes('explain') || query.includes('spike'))) {
    const finalView = targetView || 'electricity';
    const finalArea = targetArea || selectedArea;
    const finalTime = targetTime || selectedTime;

    const elRow = db.getElectricityReading(finalArea, finalTime);
    if (elRow) {
      const consumption = elRow.consumption;
      const baseConsumption = elRow.baseline_consumption;
      const diffPct = Math.round(((consumption - baseConsumption) / baseConsumption) * 100);
      const viewTitleFormatted = finalView.charAt(0).toUpperCase() + finalView.slice(1);

      return {
        reply: `Opening ${viewTitleFormatted} for ${finalArea} (${finalTime}). The simulated electricity consumption is ${consumption.toLocaleString()} MWh (+${diffPct}% above baseline). Likely contributing factors supported by data are a peak demand surge to ${elRow.peak_demand} MW (baseline: ${elRow.baseline_peak_demand} MW) and elevated grid load reaching ${elRow.grid_load}%, accompanied by an active "Power Demand Spike" alert for this sector.`,
        action: {
          type: 'dashboard_navigation',
          view: finalView,
          area: finalArea,
          timeRange: finalTime
        }
      };
    }
  }

  // 3. Check for Explicit Period Comparison (e.g. Today vs Yesterday)
  // Supports follow-up pronoun reference ("Compare it with yesterday") using active context
  if (query.includes('compare') && (query.includes('yesterday') || query.includes('previous') || query.includes('period'))) {
    const mod = targetView || (currentView !== 'overview' && currentView !== 'alerts' ? currentView : 'electricity');
    const area = targetArea || selectedArea;
    const periodA = selectedTime;
    const periodB = (selectedTime === 'Yesterday') ? 'Today' : 'Yesterday';

    try {
      const comp = analyticsService.comparePeriods(mod, area, periodA, periodB);
      const p = comp.primaryMetric;
      return {
        reply: `In ${area}, simulated ${mod} ${p.name} for ${periodA} is ${p.periodAValue.toLocaleString()} ${p.unit}, compared with ${p.periodBValue.toLocaleString()} ${p.unit} for ${periodB}. This represents a net ${p.direction} of ${Math.abs(p.diff).toLocaleString()} ${p.unit} (${p.diffPercent > 0 ? '+' : ''}${p.diffPercent}%). Peak demand also changed by ${comp.secondaryMetrics?.peak_demand?.diffPercent || 0}%.`,
        action: null
      };
    } catch (err) {
      return {
        reply: `Could not perform period comparison: ${err.message}`,
        action: null
      };
    }
  }

  // 4. Check for Trend Analysis (Multi-factor evaluation over time series)
  // Supports follow-up trend question ("Is it getting worse?") using active context
  if (query.includes('trend') || query.includes('increasing') || query.includes('decreasing') || query.includes('getting worse') || query.includes('is it getting worse')) {
    const mod = targetView || (currentView !== 'overview' ? currentView : 'pollution');
    const area = targetArea || selectedArea;
    const timeRange = targetTime || (selectedTime !== 'Today' ? selectedTime : 'Last 7 Days');

    try {
      const trend = analyticsService.analyzeTrend(mod, area, timeRange);
      let action = null;
      if (isNavIntent) {
        action = {
          type: 'dashboard_navigation',
          view: mod,
          area: area,
          timeRange: timeRange
        };
      }

      return {
        reply: `Based on the ${timeRange} time-series data for ${area}, ${mod} (${trend.seriesName}) started at ${trend.startValue} (${trend.startLabel}) and concluded at ${trend.endValue} (${trend.endLabel}), with a net change of ${trend.netChange > 0 ? '+' : ''}${trend.netChange} (${trend.netChangePercent > 0 ? '+' : ''}${trend.netChangePercent}%). Recorded peak was ${trend.max.value} on ${trend.max.label}, with an average of ${trend.average}. Trajectory classification: ${trend.trajectory.replace(/_/g, ' ')}.`,
        action
      };
    } catch (err) {
      return {
        reply: `Could not evaluate trend: ${err.message}`,
        action: null
      };
    }
  }

  // 5. Check for Multi-Module Analysis / Cross-Correlation
  if ((query.includes('pollution') && query.includes('electricity')) || query.includes('also high') || query.includes('correlat')) {
    const area = targetArea || selectedArea;
    const multi = analyticsService.getMultiModuleEvidence(area, selectedTime);
    const el = multi.modules.electricity;
    const pol = multi.modules.pollution;

    return {
      reply: `In ${area} (${selectedTime}), simulated electricity consumption is ${el ? el.currentValue.toLocaleString() + ' MWh (+' + el.diffPercent + '% above baseline)' : 'elevated'}, while the Air Quality Index is ${pol ? pol.currentValue + ' (' + pol.details.status + ')' : 'elevated'}. Both power demand and particulate levels are concurrently elevated in this sector, coinciding with peak operational hours. The data demonstrates concurrent elevation without establishing direct causation.`,
      action: null
    };
  }

  // 6. Check for Likely Contributing Factors (Strict evidence-backed reasoning)
  // Step 6C: If user is asking "Why is electricity high here?" and dashboard is ALREADY on Electricity / Gokul Road, action is strictly null
  if (query.includes('why') && (query.includes('high') || query.includes('cause') || query.includes('spike'))) {
    const area = targetArea || selectedArea;
    const elRow = db.getElectricityReading(area, selectedTime);

    if (elRow) {
      const consumption = elRow.consumption;
      const baseConsumption = elRow.baseline_consumption;
      const diffPct = Math.round(((consumption - baseConsumption) / baseConsumption) * 100);
      return {
        reply: `The simulated electricity consumption for ${area} today is ${consumption.toLocaleString()} MWh, compared with a baseline of ${baseConsumption.toLocaleString()} MWh (+${diffPct}%). The available prototype data indicates that likely contributing factors are a peak demand surge to ${elRow.peak_demand} MW (baseline: ${elRow.baseline_peak_demand} MW) and elevated grid load reaching ${elRow.grid_load}%. A "Power Demand Spike" alert is also active. The data does not establish unmonitored external causes.`,
        action: null
      };
    }
  }

  // 7. Navigation Actions (Step 6B-1 functionality preserved)
  if (isNavIntent) {
    const finalView = targetView || currentView;
    const finalArea = targetArea || selectedArea;
    const finalTime = targetTime || selectedTime;

    // Check if state is already identical to current dashboard state (avoid unnecessary reload)
    const isSameState = (finalView === currentView && finalArea === selectedArea && finalTime === selectedTime);
    const action = isSameState ? null : {
      type: 'dashboard_navigation',
      view: finalView,
      area: finalArea,
      timeRange: finalTime
    };

    const viewNameFormatted = finalView.charAt(0).toUpperCase() + finalView.slice(1);
    let reply = `Opening ${viewNameFormatted} for ${finalArea}`;
    if (finalTime && finalTime !== 'Today') {
      reply += ` (${finalTime})`;
    }
    reply += '.';

    return { reply, action };
  }

  // 8. Informational Queries (Step 6A functionality preserved)

  // Electricity
  if (query.includes('electricity') || query.includes('power')) {
    if (currentView !== 'electricity' && !ctx.kpis?.consumption) {
      return {
        reply: `Information about electricity is not available in the current ${ctx.viewTitle || 'dashboard'} view. Please switch to the Electricity tab to view power consumption data.`,
        action: null
      };
    }
    const elRow = db.getElectricityReading(selectedArea, selectedTime);
    if (!elRow) {
      return { reply: `Electricity data not available.`, action: null };
    }
    const diff = Math.round(((elRow.consumption - elRow.baseline_consumption) / elRow.baseline_consumption) * 100);
    return {
      reply: `The simulated electricity consumption for ${selectedArea} today is ${elRow.consumption.toLocaleString()} MWh, compared with a baseline of ${elRow.baseline_consumption.toLocaleString()} MWh, which is approximately +${diff}% higher than normal. The dashboard also shows a "Power Demand Spike" alert for this area due to peak demand.`,
      action: null
    };
  }

  // Pollution
  if (query.includes('aqi') || query.includes('pollution') || query.includes('air quality')) {
    if (currentView !== 'pollution' && !ctx.kpis?.aqi) {
      return {
        reply: `Air quality and AQI information is not available in the current ${ctx.viewTitle || 'dashboard'} view. Please switch to the Pollution tab to inspect environmental metrics.`,
        action: null
      };
    }
    const polRow = db.getPollutionReading(selectedArea, selectedTime);
    if (!polRow) {
      return { reply: `Air quality data not available.`, action: null };
    }
    return {
      reply: `The simulated Air Quality Index (AQI) for ${selectedArea} today is ${polRow.aqi}, which falls in the "${polRow.status}" category. Particulate matter levels (PM2.5: ${polRow.pm25} µg/m³) are elevated above baseline.`,
      action: null
    };
  }

  // Water
  if (query.includes('water') || query.includes('pressure')) {
    if (currentView !== 'water' && !ctx.kpis?.pressure) {
      return {
        reply: `Water utility metrics are not available in the current ${ctx.viewTitle || 'dashboard'} view. Please switch to the Water tab to view distribution pressure and consumption.`,
        action: null
      };
    }
    const wRow = db.getWaterReading(selectedArea, selectedTime);
    if (!wRow) {
      return { reply: `Water data not available.`, action: null };
    }
    const diff = Math.round(((wRow.pressure - wRow.baseline_pressure) / wRow.baseline_pressure) * 100);
    return {
      reply: `In ${selectedArea}, the simulated water distribution pressure has dropped to ${wRow.pressure} PSI, compared with a standard baseline of ${wRow.baseline_pressure} PSI (a drop of approximately ${diff}%). A Distribution Pressure Drop advisory is active for this sector.`,
      action: null
    };
  }

  // Traffic
  if (query.includes('traffic') || query.includes('congestion')) {
    if (currentView !== 'traffic' && !ctx.kpis?.congestion) {
      return {
        reply: `Traffic congestion data is not available in the current ${ctx.viewTitle || 'dashboard'} view. Please switch to the Traffic tab to view corridor transit metrics.`,
        action: null
      };
    }
    const trRow = db.getTrafficReading(selectedArea, selectedTime);
    return {
      reply: `In ${selectedArea}, the simulated traffic congestion index is currently at ${trRow.congestion}%, with an average transit speed of ${trRow.avg_speed} km/h (baseline: ${trRow.baseline_congestion}% congestion, ${trRow.baseline_avg_speed} km/h speed).`,
      action: null
    };
  }

  // Default out-of-context response
  return {
    reply: `The requested information is not available in the current dashboard context for ${selectedArea} (${ctx.viewTitle || currentView}). To avoid inaccurate measurements, please navigate to the corresponding module tab or area.`,
    action: null
  };
}

module.exports = {
  askGemini,
  formatContextForPrompt,
  formatConversationHistory,
  safeParseAIResponse,
  collectAnalyticalEvidence,
  ALLOWED_VIEWS,
  ALLOWED_AREAS,
  ALLOWED_TIMERANGES
};
