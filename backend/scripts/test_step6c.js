/**
 * Step 6C Automated Test Suite
 * 
 * Tests the 10 mandated scenarios for Step 6C:
 * TEST 1: Synchronized Action + Analysis in One Turn ("Show electricity in Gokul Road for today and tell me why consumption is high.")
 * TEST 2: Follow-up Pronoun Reference ("it") ("Compare it with yesterday.")
 * TEST 3: Follow-up Trend Question ("Is it getting worse?" following Vidyanagar pollution 7-day view)
 * TEST 4: No Unnecessary Navigation ("Why is electricity high here?" on Electricity/Gokul Road/Today -> action = null)
 * TEST 5: Context Precedence Over Stale History (Manual context switch to Vidyanagar takes precedence over prior Gokul Road conversation)
 * TEST 6: Invalid Action Rejection
 * TEST 7: Manual Navigation & Context Refresh
 * TEST 8: Step 6A Regression Suite Execution
 * TEST 9: Step 6B-1 Regression Suite Execution
 * TEST 10: Step 6B-2 Regression Suite Execution
 */

const http = require('http');

function postChat(message, context, history = []) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message, context, history });
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
  console.log('SMART CITY DASHBOARD - STEP 6C END-TO-END VERIFICATION SUITE');
  console.log('==============================================================\n');

  let passed = 0;
  const total = 10;

  // TEST 1 — Synchronized Action + Analysis in One Turn
  console.log('--- TEST 1: Synchronized Action + Analysis in One Turn ---');
  try {
    const ctx1 = await getContext('Hubballi', 'overview', 'Today');
    const res1 = await postChat('Show electricity in Gokul Road for today and tell me why consumption is high.', ctx1);
    console.log('Reply:', res1.body.data.reply);
    console.log('Action:', res1.body.data.action);

    const reply1 = res1.body.data.reply;
    const act1 = res1.body.data.action;

    const hasNavAction = act1 && act1.type === 'dashboard_navigation' && act1.view === 'electricity' && act1.area === 'Gokul Road' && act1.timeRange === 'Today';
    const hasAnalysis = (reply1.includes('1,720') || reply1.includes('1720') || reply1.includes('+28%')) && 
                        (reply1.includes('182') || reply1.includes('peak demand') || reply1.includes('grid load'));

    if (hasNavAction && hasAnalysis) {
      console.log('✅ TEST 1 PASSED: Returned both grounded analysis and valid navigation action in a single turn.\n');
      passed++;
    } else {
      console.log('❌ TEST 1 FAILED: Expected both navigation action and in-depth analysis.\n');
    }
  } catch (err) {
    console.log('❌ TEST 1 ERROR:', err.message, '\n');
  }

  // TEST 2 — Follow-up Pronoun Reference ("it")
  console.log('--- TEST 2: Follow-up Pronoun Reference ("it") ---');
  try {
    // Current context is already Electricity in Gokul Road (after Turn 1)
    const ctx2 = await getContext('Gokul Road', 'electricity', 'Today');
    const history2 = [
      { role: 'user', content: 'Show electricity in Gokul Road.' },
      { role: 'assistant', content: 'Opening Electricity for Gokul Road.' }
    ];
    const res2 = await postChat('Compare it with yesterday.', ctx2, history2);
    console.log('Reply:', res2.body.data.reply);
    console.log('Action:', res2.body.data.action);

    const reply2 = res2.body.data.reply;
    const citesToday = reply2.includes('1,720') || reply2.includes('1720');
    const citesYesterday = reply2.includes('1,410') || reply2.includes('1410');
    const citesDelta = reply2.includes('310') || reply2.includes('22%');
    const noUnnecessaryNav = res2.body.data.action === null;

    if (citesToday && citesYesterday && citesDelta && noUnnecessaryNav) {
      console.log('✅ TEST 2 PASSED: Resolved "it" to electricity in Gokul Road from context/history and compared Today vs Yesterday without unnecessary reload.\n');
      passed++;
    } else {
      console.log('❌ TEST 2 FAILED: Could not resolve pronoun or compare periods.\n');
    }
  } catch (err) {
    console.log('❌ TEST 2 ERROR:', err.message, '\n');
  }

  // TEST 3 — Follow-up Trend Question ("Is it getting worse?")
  console.log('--- TEST 3: Follow-up Trend Question ("Is it getting worse?") ---');
  try {
    // Current context is Pollution in Vidyanagar for Last 7 Days
    const ctx3 = await getContext('Vidyanagar', 'pollution', 'Last 7 Days');
    const history3 = [
      { role: 'user', content: 'Show pollution in Vidyanagar for the last 7 days.' },
      { role: 'assistant', content: 'Opening Pollution for Vidyanagar (Last 7 Days).' }
    ];
    const res3 = await postChat('Is it getting worse?', ctx3, history3);
    console.log('Reply:', res3.body.data.reply);
    console.log('Action:', res3.body.data.action);

    const reply3 = res3.body.data.reply.toLowerCase();
    const evaluatedVidyanagar = reply3.includes('vidyanagar');
    const hasTrendMetrics = reply3.includes('84') || reply3.includes('91') || reply3.includes('112') || reply3.includes('increasing');
    const noUnnecessaryNav = res3.body.data.action === null;

    if (evaluatedVidyanagar && hasTrendMetrics && noUnnecessaryNav) {
      console.log('✅ TEST 3 PASSED: Evaluated multi-factor trend for Vidyanagar 7-day pollution without re-navigating.\n');
      passed++;
    } else {
      console.log('❌ TEST 3 FAILED: Follow-up trend resolution failed.\n');
    }
  } catch (err) {
    console.log('❌ TEST 3 ERROR:', err.message, '\n');
  }

  // TEST 4 — No Unnecessary Navigation
  console.log('--- TEST 4: No Unnecessary Navigation ---');
  try {
    const ctx4 = await getContext('Gokul Road', 'electricity', 'Today');
    const res4 = await postChat('Why is electricity high here?', ctx4);
    console.log('Reply:', res4.body.data.reply);
    console.log('Action:', res4.body.data.action);

    const actionNull = res4.body.data.action === null;
    const answeredQuestion = res4.body.data.reply.includes('1,720') || res4.body.data.reply.includes('1720');

    if (actionNull && answeredQuestion) {
      console.log('✅ TEST 4 PASSED: Answered contextual query while keeping action = null (no reload).\n');
      passed++;
    } else {
      console.log('❌ TEST 4 FAILED: Expected action to remain null.\n');
    }
  } catch (err) {
    console.log('❌ TEST 4 ERROR:', err.message, '\n');
  }

  // TEST 5 — Authoritative Context Precedence over Stale History
  console.log('--- TEST 5: Authoritative Context Precedence over Stale History ---');
  try {
    // Previous conversation talked about Gokul Road
    const history5 = [
      { role: 'user', content: 'Show electricity in Gokul Road.' },
      { role: 'assistant', content: 'Opening Electricity for Gokul Road.' }
    ];
    // But user MANUALLY switched dashboard to Vidyanagar traffic
    const ctx5 = await getContext('Vidyanagar', 'traffic', 'Today');

    const res5 = await postChat('What is the traffic situation here?', ctx5, history5);
    console.log('Reply:', res5.body.data.reply);
    console.log('Action:', res5.body.data.action);

    const reply5 = res5.body.data.reply;
    // Must use Vidyanagar (authoritative context), NOT stale Gokul Road
    const usesVidyanagar = reply5.includes('Vidyanagar');
    const doesNotUseGokul = !reply5.includes('Gokul Road');

    if (usesVidyanagar && doesNotUseGokul) {
      console.log('✅ TEST 5 PASSED: Current Context Manager state took precedence over stale history.\n');
      passed++;
    } else {
      console.log('❌ TEST 5 FAILED: Stale history overrode current dashboard context.\n');
    }
  } catch (err) {
    console.log('❌ TEST 5 ERROR:', err.message, '\n');
  }

  // TEST 6 — Invalid Action Rejection
  console.log('--- TEST 6: Invalid Action Rejection ---');
  try {
    const maliciousAction = {
      type: 'dashboard_navigation',
      view: 'sql_inject_admin',
      area: 'Gokul Road',
      timeRange: 'Today'
    };
    const parsed = require('../services/aiService').safeParseAIResponse(JSON.stringify({
      reply: 'Testing injection',
      action: maliciousAction
    }));

    if (parsed.action === null) {
      console.log('✅ TEST 6 PASSED: Invalid action strictly rejected and neutralized.\n');
      passed++;
    } else {
      console.log('❌ TEST 6 FAILED: Action was not rejected.\n');
    }
  } catch (err) {
    console.log('❌ TEST 6 ERROR:', err.message, '\n');
  }

  // TEST 7 — Manual Navigation & Context Refresh
  console.log('--- TEST 7: Manual Navigation & Context Refresh ---');
  try {
    const views = ['overview', 'traffic', 'electricity', 'pollution', 'water', 'alerts'];
    let allOk = true;
    for (const v of views) {
      const c = await getContext('Unkal', v, 'Today');
      if (c.currentView !== v || c.selectedArea !== 'Unkal' || c.selectedTimeRange !== 'Today') {
        allOk = false;
        break;
      }
    }
    if (allOk) {
      console.log('✅ TEST 7 PASSED: Manual navigation and context refresh respond correctly across all 6 views.\n');
      passed++;
    } else {
      console.log('❌ TEST 7 FAILED: Context refresh issue.\n');
    }
  } catch (err) {
    console.log('❌ TEST 7 ERROR:', err.message, '\n');
  }

  // TEST 8 — Step 6A Regression Suite
  console.log('--- TEST 8: Step 6A Regression Suite ---');
  try {
    const ctx8 = await getContext('Gokul Road', 'electricity', 'Today');
    const res8 = await postChat('What is the AQI here?', ctx8);
    const antiHallucinationOk = res8.body.data.reply.toLowerCase().includes('not available') || res8.body.data.reply.toLowerCase().includes('switch to the pollution');
    if (antiHallucinationOk) {
      console.log('✅ TEST 8 PASSED: Step 6A anti-hallucination out-of-context check preserved.\n');
      passed++;
    } else {
      console.log('❌ TEST 8 FAILED: Step 6A regression.\n');
    }
  } catch (err) {
    console.log('❌ TEST 8 ERROR:', err.message, '\n');
  }

  // TEST 9 — Step 6B-1 Regression Suite
  console.log('--- TEST 9: Step 6B-1 Regression Suite ---');
  try {
    const ctx9 = await getContext('Gokul Road', 'electricity', 'Today');
    const res9 = await postChat('Show the last 7 days.', ctx9);
    const act9 = res9.body.data.action;
    if (act9 && act9.view === 'electricity' && act9.area === 'Gokul Road' && act9.timeRange === 'Last 7 Days') {
      console.log('✅ TEST 9 PASSED: Step 6B-1 dimension preservation preserved.\n');
      passed++;
    } else {
      console.log('❌ TEST 9 FAILED: Step 6B-1 regression.\n');
    }
  } catch (err) {
    console.log('❌ TEST 9 ERROR:', err.message, '\n');
  }

  // TEST 10 — Step 6B-2 Regression Suite
  console.log('--- TEST 10: Step 6B-2 Regression Suite ---');
  try {
    const ctx10 = await getContext('Gokul Road', 'pollution', 'Last 7 Days');
    const res10 = await postChat('Is pollution increasing in Gokul Road over the last 7 days?', ctx10);
    const reply10 = res10.body.data.reply.toLowerCase();
    const trendOk = (reply10.includes('110') || reply10.includes('126')) && reply10.includes('increasing');
    if (trendOk) {
      console.log('✅ TEST 10 PASSED: Step 6B-2 multi-factor trend evaluation preserved.\n');
      passed++;
    } else {
      console.log('❌ TEST 10 FAILED: Step 6B-2 regression.\n');
    }
  } catch (err) {
    console.log('❌ TEST 10 ERROR:', err.message, '\n');
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
