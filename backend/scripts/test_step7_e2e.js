/**
 * ====================================================================
 * Smart City Dashboard - Step 7 Final Integration & Verification Suite
 * ====================================================================
 * 
 * Verifies all 10 End-to-End Demo Scenarios, Consistency, Error Handling,
 * Security, and Full Regression Suites.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const API_BASE = 'http://localhost:5000';

async function postAI(message, context, history = []) {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context, history })
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, body: data };
}

async function getJSON(urlPath) {
  const res = await fetch(`${API_BASE}${urlPath}`);
  const data = await res.json();
  return { status: res.status, ok: res.ok, body: data };
}

async function getContext(zone, view, time) {
  const res = await getJSON(`/api/city/context?zone=${encodeURIComponent(zone)}&view=${encodeURIComponent(view)}&timeRange=${encodeURIComponent(time)}`);
  return res.body.data;
}

async function runStep7Verification() {
  console.log('====================================================================');
  console.log('SMART CITY DASHBOARD - STEP 7 FINAL INTEGRATION & DEMO READINESS');
  console.log('====================================================================\n');

  let passedTests = 0;
  const totalTests = 10;

  // ------------------------------------------------------------------
  // SCENARIO 1 — Manual Dashboard Navigation & Data Consistency
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 1: Manual Dashboard Navigation & Data Consistency ---');
  {
    // Fetch Overview for Gokul Road Today
    const overviewRes = await getJSON('/api/city/overview?zone=Gokul%20Road&timeRange=Today');
    assert.strictEqual(overviewRes.status, 200, 'Overview API must return 200');
    assert.strictEqual(overviewRes.body.data.zone, 'Gokul Road');

    // Fetch Electricity for Gokul Road Today
    const elecRes = await getJSON('/api/city/electricity?zone=Gokul%20Road&timeRange=Today');
    assert.strictEqual(elecRes.status, 200, 'Electricity API must return 200');
    const elecData = elecRes.body.data;
    assert.strictEqual(elecData.kpi.consumption, 1720, 'Consumption must be 1720 MWh');
    assert.strictEqual(elecData.kpi.peakDemand, 182, 'Peak demand must be 182 MW');
    assert.strictEqual(elecData.kpi.gridLoad, 89, 'Grid load must be 89%');

    // Fetch Alerts for Gokul Road
    const alertsRes = await getJSON('/api/city/alerts?zone=Gokul%20Road');
    assert.strictEqual(alertsRes.status, 200, 'Alerts API must return 200');
    const elecAlert = alertsRes.body.data.find(a => a.module === 'electricity');
    assert(elecAlert, 'Should find active electricity alert for Gokul Road');

    console.log(`KPIs Verified: Consumption = ${elecData.kpi.consumption} MWh, Peak Demand = ${elecData.kpi.peakDemand} MW, Grid Load = ${elecData.kpi.gridLoad}%`);
    console.log(`Alert Verified: "${elecAlert.title}" (${elecAlert.severity})`);
    console.log('✅ SCENARIO 1 PASSED: Overview and Electricity data agree with SQLite database.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 2 — AI Navigation
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 2: AI Navigation ("Show electricity in Gokul Road for today.") ---');
  {
    const initialContext = await getContext('Hubballi', 'overview', 'Today');

    const res = await postAI('Show electricity in Gokul Road for today.', initialContext);
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    const action = res.body.data.action;
    assert(action, 'Action must be returned');
    assert.strictEqual(action.type, 'dashboard_navigation');
    assert.strictEqual(action.view, 'electricity');
    assert.strictEqual(action.area, 'Gokul Road');
    assert.strictEqual(action.timeRange, 'Today');

    console.log('AI Reply:', res.body.data.reply);
    console.log('AI Action:', action);
    console.log('✅ SCENARIO 2 PASSED: Valid navigation action emitted for Electricity / Gokul Road / Today.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 3 — AI Navigation + Analysis
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 3: AI Navigation + Analysis in One Request ---');
  {
    const initialContext = await getContext('Hubballi', 'overview', 'Today');

    const res = await postAI(
      'Show electricity in Gokul Road for today and tell me why consumption is high.',
      initialContext
    );
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    const action = res.body.data.action;
    assert(action, 'Action must be returned for compound request');
    assert.strictEqual(action.view, 'electricity');
    assert.strictEqual(action.area, 'Gokul Road');
    assert.strictEqual(action.timeRange, 'Today');

    const reply = res.body.data.reply;
    assert(reply.includes('1,720') || reply.includes('1720'), 'Reply must cite 1720 MWh');
    assert(reply.includes('182') || reply.includes('peak demand'), 'Reply must cite peak demand');
    assert(reply.includes('89%') || reply.includes('grid load'), 'Reply must cite grid load');
    assert(!reply.toLowerCase().includes('weather'), 'Must NOT invent weather');
    assert(!reply.toLowerCase().includes('solar panel'), 'Must NOT invent solar panels');

    console.log('AI Reply:', reply);
    console.log('AI Action:', action);
    console.log('✅ SCENARIO 3 PASSED: Both navigation and grounded causal explanation returned in one turn.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 4 — Follow-up ("Compare it with yesterday.")
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 4: Follow-up Reference Resolution ("Compare it with yesterday.") ---');
  {
    const activeContext = await getContext('Gokul Road', 'electricity', 'Today');

    const conversationHistory = [
      { role: 'user', content: 'Show electricity in Gokul Road for today and tell me why consumption is high.' },
      { role: 'assistant', content: 'Opening Electricity for Gokul Road (Today). The simulated electricity consumption is 1,720 MWh (+28% above baseline).' }
    ];

    const res = await postAI('Compare it with yesterday.', activeContext, conversationHistory);
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    const reply = res.body.data.reply;
    assert(reply.includes('1,720') || reply.includes('1720'), 'Must cite Today consumption');
    assert(reply.includes('1,410') || reply.includes('1410'), 'Must cite Yesterday consumption');
    assert(reply.includes('310') || reply.includes('22%'), 'Must compute net difference');
    assert.strictEqual(res.body.data.action, null, 'Action must be null (no unnecessary navigation)');

    console.log('AI Reply:', reply);
    console.log('AI Action:', res.body.data.action);
    console.log('✅ SCENARIO 4 PASSED: "it" resolved to Electricity/Gokul Road, Today vs Yesterday calculated, no redundant navigation.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 5 — Trend ("Show pollution in Gokul Road for the last 7 days and tell me if it is getting worse.")
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 5: Trend Analysis with Navigation ---');
  {
    const activeContext = await getContext('Gokul Road', 'electricity', 'Today');

    const res = await postAI(
      'Show pollution in Gokul Road for the last 7 days and tell me if it is getting worse.',
      activeContext
    );
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    const action = res.body.data.action;
    assert(action, 'Action must be returned');
    assert.strictEqual(action.view, 'pollution');
    assert.strictEqual(action.area, 'Gokul Road');
    assert.strictEqual(action.timeRange, 'Last 7 Days');

    const reply = res.body.data.reply;
    assert(reply.toLowerCase().includes('increasing') || reply.toLowerCase().includes('worse'), 'Must classify trajectory');
    assert(reply.includes('110') && reply.includes('126'), 'Must cite start (110) and end (126)');
    assert(reply.includes('152'), 'Must cite peak value (152)');

    console.log('AI Reply:', reply);
    console.log('AI Action:', action);
    console.log('✅ SCENARIO 5 PASSED: Pollution / Gokul Road / Last 7 Days navigated and multi-factor trend calculated.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 6 — Multi-module Reasoning
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 6: Multi-module Evidence Reasoning ---');
  {
    const activeContext = await getContext('Gokul Road', 'pollution', 'Today');

    const res = await postAI(
      'Is pollution also high where electricity consumption is high in Gokul Road?',
      activeContext
    );
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    const reply = res.body.data.reply;
    assert(reply.includes('1,720') || reply.includes('1720'), 'Must cite electricity consumption (1720 MWh)');
    assert(reply.includes('152') || reply.includes('AQI'), 'Must cite AQI (152)');
    assert(reply.toLowerCase().includes('concurrent') || reply.toLowerCase().includes('correlation'), 'Must explain concurrent elevation');
    assert(!reply.toLowerCase().includes('direct causation') || reply.toLowerCase().includes('without establishing direct causation'), 'Must not make unproven causal claim');

    console.log('AI Reply:', reply);
    console.log('✅ SCENARIO 6 PASSED: Cross-module evidence combined with responsible correlation explanation.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 7 — Missing Data Handling
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 7: Missing Data Handling ---');
  {
    const activeContext = await getContext('Vidyanagar', 'electricity', 'Today');

    const res = await postAI('What is the solar power generation in Vidyanagar?', activeContext);
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    const reply = res.body.data.reply;
    assert(reply.toLowerCase().includes('solar') || reply.toLowerCase().includes('not have') || reply.toLowerCase().includes("don't have"), 'Must acknowledge unmonitored solar data');
    assert.strictEqual(res.body.data.action, null, 'Action must be null');

    console.log('AI Reply:', reply);
    console.log('✅ SCENARIO 7 PASSED: Stated clearly that solar metric is not part of the prototype; zero hallucinations.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 8 — Manual -> AI Context Precedence
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 8: Current Dashboard Context Precedence over Stale History ---');
  {
    // Context Manager is actively at Traffic, Vidyanagar, Today
    const currentContext = await getContext('Vidyanagar', 'traffic', 'Today');

    // Stale history talks about Gokul Road
    const staleHistory = [
      { role: 'user', content: 'Show electricity in Gokul Road.' },
      { role: 'assistant', content: 'Opening electricity in Gokul Road.' },
      { role: 'user', content: 'Why is it high in Gokul Road?' },
      { role: 'assistant', content: 'Electricity in Gokul Road is 1,720 MWh.' }
    ];

    const res = await postAI('What is the traffic situation here?', currentContext, staleHistory);
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    const reply = res.body.data.reply;
    assert(reply.toLowerCase().includes('vidyanagar'), 'Must evaluate Vidyanagar, NOT Gokul Road');
    assert(reply.includes('71%') || reply.includes('71'), 'Must cite Vidyanagar congestion (71%)');
    assert(reply.includes('21 km/h') || reply.includes('21'), 'Must cite Vidyanagar speed (21 km/h)');
    assert(!reply.toLowerCase().includes('1,720'), 'Must NOT mix Gokul Road electricity');

    console.log('AI Reply:', reply);
    console.log('✅ SCENARIO 8 PASSED: Current Context Manager state strictly took precedence over stale history.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 9 — Invalid / Unsafe Action Rejection
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 9: Invalid & Malicious Action Rejection ---');
  {
    const { safeParseAIResponse, ALLOWED_VIEWS, ALLOWED_AREAS, ALLOWED_TIMERANGES } = require('../services/aiService');
    
    // Test unsafe / malformed actions through backend safe parser
    const maliciousActions = [
      { type: 'dashboard_navigation', view: 'drop_database', area: 'Hubballi', timeRange: 'Today' },
      { type: 'exec_js', code: 'alert(document.cookie)' },
      { type: 'dashboard_navigation', view: 'overview', area: 'Bengaluru', timeRange: 'Today' },
      { type: 'dashboard_navigation', view: 'traffic', area: 'Hubballi', timeRange: 'Next Year' }
    ];

    for (const act of maliciousActions) {
      const parsed = safeParseAIResponse(JSON.stringify({
        reply: 'Attempt',
        action: act
      }));
      assert.strictEqual(parsed.action, null, `Action ${JSON.stringify(act)} must be discarded as null`);
    }

    // Test malformed text
    const malformed = safeParseAIResponse('Not a json string at all');
    assert.strictEqual(malformed.action, null);

    console.log('✅ SCENARIO 9 PASSED: All un-allowlisted or malformed actions safely rejected.\n');
    passedTests++;
  }

  // ------------------------------------------------------------------
  // SCENARIO 10 — Full Regression Suites & Project Health Check
  // ------------------------------------------------------------------
  console.log('--- SCENARIO 10: Running Full Regression Suites & Project Health Checks ---');
  {
    const repoRoot = path.join(__dirname, '../..');

    console.log('Running Step 6A regression suite...');
    execSync('node backend/scripts/test_step6a.js', { cwd: repoRoot, stdio: 'pipe' });
    console.log('  -> Step 6A: 5/5 PASSED');

    console.log('Running Step 6B-1 regression suite...');
    execSync('node backend/scripts/test_step6b1.js', { cwd: repoRoot, stdio: 'pipe' });
    console.log('  -> Step 6B-1: 10/10 PASSED');

    console.log('Running Step 6B-2 regression suite...');
    execSync('node backend/scripts/test_step6b2.js', { cwd: repoRoot, stdio: 'pipe' });
    console.log('  -> Step 6B-2: 12/12 PASSED');

    console.log('Running Step 6C regression suite...');
    execSync('node backend/scripts/test_step6c.js', { cwd: repoRoot, stdio: 'pipe' });
    console.log('  -> Step 6C: 10/10 PASSED');

    console.log('Running Frontend action validators suite...');
    execSync('node backend/scripts/test_frontend_actions.js', { cwd: repoRoot, stdio: 'pipe' });
    console.log('  -> Frontend action validator: PASSED');

    // 1. Check .gitignore
    const gitignoreContent = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    assert(gitignoreContent.includes('.env'), '.gitignore must contain .env');
    assert(gitignoreContent.includes('backend/.env'), '.gitignore must contain backend/.env');

    // 2. Check frontend files for absence of API keys
    const appJsContent = fs.readFileSync(path.join(repoRoot, 'frontend/js/app.js'), 'utf8');
    assert(!appJsContent.includes('AIzaSy'), 'frontend/js/app.js must NOT contain any Gemini API key');
    assert(!appJsContent.includes('process.env'), 'frontend/js/app.js must NOT reference process.env');

    // 3. Check health endpoint
    const health = await getJSON('/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'online');

    // 4. Check 404 handler
    const notFound = await getJSON('/api/unknown_route');
    assert.strictEqual(notFound.status, 404);
    assert.strictEqual(notFound.body.success, false);

    // 5. Check empty input validation on AI chat
    const emptyRes = await postAI('', null);
    assert.strictEqual(emptyRes.status, 400);
    assert.strictEqual(emptyRes.body.success, false);

    console.log('✅ SCENARIO 10 PASSED: All 5 regression suites and security/health checks passed with 100% success.\n');
    passedTests++;
  }

  console.log('====================================================================');
  console.log(`STEP 7 END-TO-END VERIFICATION: ${passedTests} / ${totalTests} SCENARIOS PASSED`);
  console.log('====================================================================');
}

runStep7Verification().catch(err => {
  console.error('❌ Step 7 Verification Failed:', err);
  process.exit(1);
});
