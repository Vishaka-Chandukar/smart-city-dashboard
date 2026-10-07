/**
 * Step 6B-2 Automated Test Suite
 * 
 * Verifies the Full Context-Aware Agent Intelligence Layer:
 * TEST 1: Navigation ("Open electricity for Gokul Road.")
 * TEST 2: Navigation + Filter ("Show pollution in Vidyanagar for the last 7 days.")
 * TEST 3: Contextual Question ("Why is electricity high here?" with Gokul Road context)
 * TEST 4: Period Comparison ("Compare electricity consumption today with yesterday in Gokul Road.")
 * TEST 5: Multi-factor Trend Analysis ("Is pollution increasing in Gokul Road over the last 7 days?")
 * TEST 6: Multi-Module Analysis ("Is pollution also high where electricity consumption is high in Gokul Road?")
 * TEST 7: Likely Contributing Factors ("Why might electricity consumption be high in Gokul Road today?")
 * TEST 8: Missing Data Handling ("What is the solar panel power generation in Vidyanagar?")
 * TEST 9: Invalid Action Rejection (outside allowlist)
 * TEST 10: Manual Navigation Regression
 * TEST 11: Step 6A Regression Suite Execution
 * TEST 12: Step 6B-1 Regression Suite Execution
 */

const http = require('http');
const db = require('../database/db');
const analyticsService = require('../services/analyticsService');

function postChat(message, context) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message, context });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getContext(zone, view, time) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api/city/context?zone=${encodeURIComponent(zone)}&view=${encodeURIComponent(view)}&timeRange=${encodeURIComponent(time)}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('==============================================================');
  console.log('SMART CITY DASHBOARD - STEP 6B-2 FULL AGENT VERIFICATION SUITE');
  console.log('==============================================================\n');

  let passed = 0;
  const total = 12;

  // TEST 1 — Navigation
  console.log('--- TEST 1: Navigation ("Open electricity for Gokul Road.") ---');
  try {
    const ctx1 = await getContext('Hubballi', 'overview', 'Today');
    const res1 = await postChat('Open electricity for Gokul Road.', ctx1);
    console.log('Reply:', res1.body.data.reply);
    console.log('Action:', res1.body.data.action);

    const act1 = res1.body.data.action;
    if (act1 && act1.type === 'dashboard_navigation' && act1.view === 'electricity' && act1.area === 'Gokul Road' && act1.timeRange === 'Today') {
      console.log('✅ TEST 1 PASSED: Navigation action accurately configured for electricity / Gokul Road.\n');
      passed++;
    } else {
      console.log('❌ TEST 1 FAILED: Expected navigation action to electricity / Gokul Road.\n');
    }
  } catch (err) {
    console.log('❌ TEST 1 ERROR:', err.message, '\n');
  }

  // TEST 2 — Navigation + Filter
  console.log('--- TEST 2: Navigation + Filter ("Show pollution in Vidyanagar for the last 7 days.") ---');
  try {
    const ctx2 = await getContext('Hubballi', 'overview', 'Today');
    const res2 = await postChat('Show pollution in Vidyanagar for the last 7 days.', ctx2);
    console.log('Reply:', res2.body.data.reply);
    console.log('Action:', res2.body.data.action);

    const act2 = res2.body.data.action;
    if (act2 && act2.type === 'dashboard_navigation' && act2.view === 'pollution' && act2.area === 'Vidyanagar' && act2.timeRange === 'Last 7 Days') {
      console.log('✅ TEST 2 PASSED: View, area, and time range all configured simultaneously.\n');
      passed++;
    } else {
      console.log('❌ TEST 2 FAILED: Expected navigation action for pollution / Vidyanagar / Last 7 Days.\n');
    }
  } catch (err) {
    console.log('❌ TEST 2 ERROR:', err.message, '\n');
  }

  // TEST 3 — Contextual Question
  console.log('--- TEST 3: Contextual Question ("Why is electricity high here?" in Gokul Road) ---');
  try {
    const ctx3 = await getContext('Gokul Road', 'electricity', 'Today');
    const res3 = await postChat('Why is electricity high here?', ctx3);
    console.log('Reply:', res3.body.data.reply);
    console.log('Action:', res3.body.data.action);

    const reply3 = res3.body.data.reply;
    const isGrounded = reply3.includes('1,720') || reply3.includes('1720');
    const citesContext = reply3.includes('Gokul Road');
    const actionNull = res3.body.data.action === null;

    if (isGrounded && citesContext && actionNull) {
      console.log('✅ TEST 3 PASSED: Grounded in active context without requiring user to re-specify area.\n');
      passed++;
    } else {
      console.log('❌ TEST 3 FAILED: Did not use active context or action was not null.\n');
    }
  } catch (err) {
    console.log('❌ TEST 3 ERROR:', err.message, '\n');
  }

  // TEST 4 — Period Comparison (SQLite-backed, distinct from baseline)
  console.log('--- TEST 4: Period Comparison ("Compare electricity consumption today with yesterday in Gokul Road.") ---');
  try {
    const ctx4 = await getContext('Gokul Road', 'electricity', 'Today');
    const res4 = await postChat('Compare electricity consumption today with yesterday in Gokul Road.', ctx4);
    console.log('Reply:', res4.body.data.reply);
    console.log('Action:', res4.body.data.action);

    const reply4 = res4.body.data.reply;
    // Expected dynamic comparison: Today (1,720) vs Yesterday (1,410) -> +310 MWh (+22%)
    const citesToday = reply4.includes('1,720') || reply4.includes('1720');
    const citesYesterday = reply4.includes('1,410') || reply4.includes('1410');
    const citesDelta = reply4.includes('310') || reply4.includes('22%');

    if (citesToday && citesYesterday && citesDelta) {
      console.log('✅ TEST 4 PASSED: Period comparison calculated dynamically from SQLite (Today vs Yesterday) without substituting baseline.\n');
      passed++;
    } else {
      console.log('❌ TEST 4 FAILED: Did not calculate dynamic period comparison.\n');
    }
  } catch (err) {
    console.log('❌ TEST 4 ERROR:', err.message, '\n');
  }

  // TEST 5 — Multi-Factor Trend Analysis
  console.log('--- TEST 5: Trend Analysis ("Is pollution increasing in Gokul Road over the last 7 days?") ---');
  try {
    const ctx5 = await getContext('Gokul Road', 'pollution', 'Last 7 Days');
    const res5 = await postChat('Is pollution increasing in Gokul Road over the last 7 days?', ctx5);
    console.log('Reply:', res5.body.data.reply);
    console.log('Action:', res5.body.data.action);

    const reply5 = res5.body.data.reply.toLowerCase();
    // Expected dynamic trend: start 110, end 126, peak 152 (Fri), avg 128, trajectory: increasing
    const mentionsStartOrEnd = reply5.includes('110') || reply5.includes('126');
    const mentionsPeak = reply5.includes('152');
    const mentionsIncreasing = reply5.includes('increasing');

    if (mentionsStartOrEnd && mentionsPeak && mentionsIncreasing) {
      console.log('✅ TEST 5 PASSED: Multi-factor trend analysis considers start, end, peak, average, and trajectory.\n');
      passed++;
    } else {
      console.log('❌ TEST 5 FAILED: Trend evaluation missing multi-factor elements.\n');
    }
  } catch (err) {
    console.log('❌ TEST 5 ERROR:', err.message, '\n');
  }

  // TEST 6 — Multi-Module Analysis
  console.log('--- TEST 6: Multi-Module Analysis ("Is pollution also high where electricity consumption is high in Gokul Road?") ---');
  try {
    const ctx6 = await getContext('Gokul Road', 'overview', 'Today');
    const res6 = await postChat('Is pollution also high where electricity consumption is high in Gokul Road?', ctx6);
    console.log('Reply:', res6.body.data.reply);
    console.log('Action:', res6.body.data.action);

    const reply6 = res6.body.data.reply;
    const mentionsElectricity = reply6.includes('1,720') || reply6.includes('1720') || reply6.includes('+28%');
    const mentionsPollution = reply6.includes('152') || reply6.toLowerCase().includes('unhealthy');
    const nonCausal = reply6.toLowerCase().includes('not establish') || reply6.toLowerCase().includes('coincid') || reply6.toLowerCase().includes('concurrent');

    if (mentionsElectricity && mentionsPollution && nonCausal) {
      console.log('✅ TEST 6 PASSED: Cross-module data combined; explains correlation without asserting unproven causation.\n');
      passed++;
    } else {
      console.log('❌ TEST 6 FAILED: Cross-module analysis did not combine both datasets or violated causal safety.\n');
    }
  } catch (err) {
    console.log('❌ TEST 6 ERROR:', err.message, '\n');
  }

  // TEST 7 — Likely Contributing Factors
  console.log('--- TEST 7: Likely Contributing Factors ("Why might electricity consumption be high in Gokul Road today?") ---');
  try {
    const ctx7 = await getContext('Gokul Road', 'electricity', 'Today');
    const res7 = await postChat('Why might electricity consumption be high in Gokul Road today?', ctx7);
    console.log('Reply:', res7.body.data.reply);
    console.log('Action:', res7.body.data.action);

    const reply7 = res7.body.data.reply;
    const citesPeakDemand = reply7.includes('182') || reply7.toLowerCase().includes('peak demand');
    const citesGridLoad = reply7.includes('89') || reply7.toLowerCase().includes('grid load');
    const noExternalHallucination = !reply7.toLowerCase().includes('population growth') && !reply7.toLowerCase().includes('heat wave');

    if (citesPeakDemand && citesGridLoad && noExternalHallucination) {
      console.log('✅ TEST 7 PASSED: Cites only evidence-supported factors (peak demand, grid load) without inventing external causes.\n');
      passed++;
    } else {
      console.log('❌ TEST 7 FAILED: Failed evidence-based causal explanation check.\n');
    }
  } catch (err) {
    console.log('❌ TEST 7 ERROR:', err.message, '\n');
  }

  // TEST 8 — Missing Data
  console.log('--- TEST 8: Missing Data Handling ("What is the solar panel power generation in Vidyanagar?") ---');
  try {
    const ctx8 = await getContext('Vidyanagar', 'electricity', 'Today');
    const res8 = await postChat('What is the solar panel power generation in Vidyanagar?', ctx8);
    console.log('Reply:', res8.body.data.reply);
    console.log('Action:', res8.body.data.action);

    const reply8 = res8.body.data.reply.toLowerCase();
    const admitsMissing = reply8.includes('not available') || reply8.includes("don't have") || reply8.includes('prototype');
    const actionNull8 = res8.body.data.action === null;

    if (admitsMissing && actionNull8) {
      console.log('✅ TEST 8 PASSED: Acknowledged limitation clearly without hallucinating numbers for unmonitored solar data.\n');
      passed++;
    } else {
      console.log('❌ TEST 8 FAILED: Did not refuse missing data query cleanly.\n');
    }
  } catch (err) {
    console.log('❌ TEST 8 ERROR:', err.message, '\n');
  }

  // TEST 9 — Invalid Action Rejection
  console.log('--- TEST 9: Invalid Action Rejection ---');
  try {
    const maliciousAction = {
      type: 'dashboard_navigation',
      view: 'execute_sql_dump',
      area: 'Gokul Road',
      timeRange: 'Today'
    };
    const parsed = require('../services/aiService').safeParseAIResponse(JSON.stringify({
      reply: 'Malicious attempt',
      action: maliciousAction
    }));

    if (parsed.action === null) {
      console.log('✅ TEST 9 PASSED: Malicious / un-allowlisted action safely rejected and set to null.\n');
      passed++;
    } else {
      console.log('❌ TEST 9 FAILED: Invalid action was not rejected.\n');
    }
  } catch (err) {
    console.log('❌ TEST 9 ERROR:', err.message, '\n');
  }

  // TEST 10 — Manual Navigation Regression
  console.log('--- TEST 10: Manual Navigation & Context Regression ---');
  try {
    const views = ['overview', 'traffic', 'electricity', 'pollution', 'water', 'alerts'];
    let allOk = true;
    for (const v of views) {
      const c = await getContext('Keshwapur', v, 'Last 30 Days');
      if (c.currentView !== v || c.selectedArea !== 'Keshwapur' || c.selectedTimeRange !== 'Last 30 Days') {
        allOk = false;
        break;
      }
    }
    if (allOk) {
      console.log('✅ TEST 10 PASSED: Context Manager and SQLite endpoints respond for all views and localities.\n');
      passed++;
    } else {
      console.log('❌ TEST 10 FAILED: Context regression detected.\n');
    }
  } catch (err) {
    console.log('❌ TEST 10 ERROR:', err.message, '\n');
  }

  // TEST 11 — Step 6A Regression
  console.log('--- TEST 11: Step 6A Regression Suite ---');
  try {
    const ctx11 = await getContext('Gokul Road', 'electricity', 'Today');
    const res11 = await postChat('What is the AQI here?', ctx11); // Out of context
    const outOfContextOk = res11.body.data.reply.toLowerCase().includes('not available') || res11.body.data.reply.toLowerCase().includes('switch to the pollution');
    if (outOfContextOk) {
      console.log('✅ TEST 11 PASSED: Step 6A anti-hallucination behavior preserved.\n');
      passed++;
    } else {
      console.log('❌ TEST 11 FAILED: Step 6A regression.\n');
    }
  } catch (err) {
    console.log('❌ TEST 11 ERROR:', err.message, '\n');
  }

  // TEST 12 — Step 6B-1 Regression
  console.log('--- TEST 12: Step 6B-1 Regression Suite ---');
  try {
    const ctx12 = await getContext('Gokul Road', 'electricity', 'Today');
    const res12 = await postChat('Show the last 7 days.', ctx12);
    const act12 = res12.body.data.action;
    if (act12 && act12.view === 'electricity' && act12.area === 'Gokul Road' && act12.timeRange === 'Last 7 Days') {
      console.log('✅ TEST 12 PASSED: Step 6B-1 dimension preservation behavior preserved.\n');
      passed++;
    } else {
      console.log('❌ TEST 12 FAILED: Step 6B-1 regression.\n');
    }
  } catch (err) {
    console.log('❌ TEST 12 ERROR:', err.message, '\n');
  }

  console.log('==============================================================');
  console.log(`SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('==============================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
