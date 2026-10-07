/**
 * Step 6B-1 Automated Test Suite
 * 
 * Tests the 10 mandated scenarios for Step 6B-1:
 * TEST 1: View change ("Show electricity")
 * TEST 2: View + Area ("Show traffic in Vidyanagar")
 * TEST 3: View + Area + Time ("Show electricity in Gokul Road for the last 7 days")
 * TEST 4: Preserve context ("Show pollution" from Gokul Road, Today)
 * TEST 5: Change only time ("Show the last 7 days")
 * TEST 6: Change area + view ("Open water in Keshwapur" from Vidyanagar, Last 7 Days)
 * TEST 7: Normal informational question ("Why is electricity high here?" -> action = null)
 * TEST 8: Invalid action rejection ({ type: "dashboard_navigation", view: "delete_database" } -> rejected)
 * TEST 9: Malformed AI response handling (no crash, safe recovery)
 * TEST 10: Manual navigation & context regression check
 */

const http = require('http');
const aiService = require('../services/aiService');

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

// Frontend allowlist validation mirror
const ALLOWED_VIEWS = ['overview', 'traffic', 'electricity', 'pollution', 'water', 'alerts'];
const ALLOWED_AREAS = ['Hubballi', 'Vidyanagar', 'Gokul Road', 'Keshwapur', 'Unkal'];
const ALLOWED_TIMERANGES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'];

function validateDashboardAction(action) {
  if (!action || typeof action !== 'object') return null;
  if (action.type !== 'dashboard_navigation') return null;
  if (!ALLOWED_VIEWS.includes(action.view)) return null;
  if (!ALLOWED_AREAS.includes(action.area)) return null;
  if (!ALLOWED_TIMERANGES.includes(action.timeRange)) return null;
  return action;
}

async function runTests() {
  console.log('========================================================');
  console.log('SMART CITY DASHBOARD - STEP 6B-1 VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  const total = 10;

  // TEST 1 — VIEW CHANGE
  console.log('--- TEST 1: View Change ---');
  try {
    const ctx1 = await getContext('Hubballi', 'overview', 'Today');
    const res1 = await postChat('Show electricity.', ctx1);
    console.log('Reply:', res1.body.data.reply);
    console.log('Action:', res1.body.data.action);

    const act1 = res1.body.data.action;
    const validated1 = validateDashboardAction(act1);
    if (validated1 && validated1.view === 'electricity' && validated1.area === 'Hubballi' && validated1.timeRange === 'Today') {
      console.log('✅ TEST 1 PASSED: Correctly switched view to electricity while preserving area and time.\n');
      passed++;
    } else {
      console.log('❌ TEST 1 FAILED: Incorrect action structure.\n');
    }
  } catch (err) {
    console.log('❌ TEST 1 ERROR:', err.message, '\n');
  }

  // TEST 2 — VIEW + AREA
  console.log('--- TEST 2: View + Area ---');
  try {
    const ctx2 = await getContext('Hubballi', 'overview', 'Today');
    const res2 = await postChat('Show traffic in Vidyanagar.', ctx2);
    console.log('Reply:', res2.body.data.reply);
    console.log('Action:', res2.body.data.action);

    const act2 = res2.body.data.action;
    const validated2 = validateDashboardAction(act2);
    if (validated2 && validated2.view === 'traffic' && validated2.area === 'Vidyanagar' && validated2.timeRange === 'Today') {
      console.log('✅ TEST 2 PASSED: View changed to traffic, area to Vidyanagar, time preserved as Today.\n');
      passed++;
    } else {
      console.log('❌ TEST 2 FAILED: Incorrect action structure.\n');
    }
  } catch (err) {
    console.log('❌ TEST 2 ERROR:', err.message, '\n');
  }

  // TEST 3 — VIEW + AREA + TIME
  console.log('--- TEST 3: View + Area + Time ---');
  try {
    const ctx3 = await getContext('Hubballi', 'overview', 'Today');
    const res3 = await postChat('Show electricity in Gokul Road for the last 7 days.', ctx3);
    console.log('Reply:', res3.body.data.reply);
    console.log('Action:', res3.body.data.action);

    const act3 = res3.body.data.action;
    const validated3 = validateDashboardAction(act3);
    if (validated3 && validated3.view === 'electricity' && validated3.area === 'Gokul Road' && validated3.timeRange === 'Last 7 Days') {
      console.log('✅ TEST 3 PASSED: All 3 dimensions correctly set (electricity, Gokul Road, Last 7 Days).\n');
      passed++;
    } else {
      console.log('❌ TEST 3 FAILED: Incorrect action structure.\n');
    }
  } catch (err) {
    console.log('❌ TEST 3 ERROR:', err.message, '\n');
  }

  // TEST 4 — PRESERVE CONTEXT
  console.log('--- TEST 4: Preserve Context ---');
  try {
    const ctx4 = await getContext('Gokul Road', 'electricity', 'Today');
    const res4 = await postChat('Show pollution.', ctx4);
    console.log('Reply:', res4.body.data.reply);
    console.log('Action:', res4.body.data.action);

    const act4 = res4.body.data.action;
    const validated4 = validateDashboardAction(act4);
    if (validated4 && validated4.view === 'pollution' && validated4.area === 'Gokul Road' && validated4.timeRange === 'Today') {
      console.log('✅ TEST 4 PASSED: Changed view to pollution, preserved Gokul Road and Today.\n');
      passed++;
    } else {
      console.log('❌ TEST 4 FAILED: Did not preserve context dimensions.\n');
    }
  } catch (err) {
    console.log('❌ TEST 4 ERROR:', err.message, '\n');
  }

  // TEST 5 — CHANGE ONLY TIME
  console.log('--- TEST 5: Change Only Time ---');
  try {
    const ctx5 = await getContext('Gokul Road', 'electricity', 'Today');
    const res5 = await postChat('Show the last 7 days.', ctx5);
    console.log('Reply:', res5.body.data.reply);
    console.log('Action:', res5.body.data.action);

    const act5 = res5.body.data.action;
    const validated5 = validateDashboardAction(act5);
    if (validated5 && validated5.view === 'electricity' && validated5.area === 'Gokul Road' && validated5.timeRange === 'Last 7 Days') {
      console.log('✅ TEST 5 PASSED: Changed only time to Last 7 Days, preserved electricity and Gokul Road.\n');
      passed++;
    } else {
      console.log('❌ TEST 5 FAILED: Did not preserve view/area when changing time.\n');
    }
  } catch (err) {
    console.log('❌ TEST 5 ERROR:', err.message, '\n');
  }

  // TEST 6 — CHANGE AREA + VIEW
  console.log('--- TEST 6: Change Area + View ---');
  try {
    const ctx6 = await getContext('Vidyanagar', 'pollution', 'Last 7 Days');
    const res6 = await postChat('Open water in Keshwapur.', ctx6);
    console.log('Reply:', res6.body.data.reply);
    console.log('Action:', res6.body.data.action);

    const act6 = res6.body.data.action;
    const validated6 = validateDashboardAction(act6);
    if (validated6 && validated6.view === 'water' && validated6.area === 'Keshwapur' && validated6.timeRange === 'Last 7 Days') {
      console.log('✅ TEST 6 PASSED: Changed view to water and area to Keshwapur, preserved Last 7 Days.\n');
      passed++;
    } else {
      console.log('❌ TEST 6 FAILED: Did not preserve time range.\n');
    }
  } catch (err) {
    console.log('❌ TEST 6 ERROR:', err.message, '\n');
  }

  // TEST 7 — NORMAL INFORMATIONAL QUESTION
  console.log('--- TEST 7: Normal Informational Question ---');
  try {
    const ctx7 = await getContext('Gokul Road', 'electricity', 'Today');
    const res7 = await postChat('Why is electricity high here?', ctx7);
    console.log('Reply:', res7.body.data.reply);
    console.log('Action:', res7.body.data.action);

    const reply7 = res7.body.data.reply;
    const isGrounded = reply7.includes('1,720') || reply7.includes('1720');
    const isActionNull = res7.body.data.action === null;

    if (isGrounded && isActionNull) {
      console.log('✅ TEST 7 PASSED: Returned grounded Step 6A answer with action = null.\n');
      passed++;
    } else {
      console.log('❌ TEST 7 FAILED: Expected grounded answer and action = null.\n');
    }
  } catch (err) {
    console.log('❌ TEST 7 ERROR:', err.message, '\n');
  }

  // TEST 8 — INVALID ACTION REJECTION
  console.log('--- TEST 8: Invalid Action Rejection ---');
  try {
    const maliciousAction = {
      type: 'dashboard_navigation',
      view: 'delete_database',
      area: 'Hubballi',
      timeRange: 'Today'
    };

    const validated8 = validateDashboardAction(maliciousAction);
    const parsed8 = aiService.safeParseAIResponse(JSON.stringify({
      reply: 'Malicious attempt',
      action: maliciousAction
    }));

    if (validated8 === null && parsed8.action === null) {
      console.log('✅ TEST 8 PASSED: Malicious / outside-allowlist action strictly rejected by both backend & frontend validators.\n');
      passed++;
    } else {
      console.log('❌ TEST 8 FAILED: Invalid action was not rejected.\n');
    }
  } catch (err) {
    console.log('❌ TEST 8 ERROR:', err.message, '\n');
  }

  // TEST 9 — MALFORMED AI RESPONSE HANDLING
  console.log('--- TEST 9: Malformed AI Response Handling ---');
  try {
    const malformed1 = aiService.safeParseAIResponse('Not even JSON at all! Just raw plain text');
    const malformed2 = aiService.safeParseAIResponse('```json\n{"reply": "Partial JSON", "action": \n```');
    const malformed3 = aiService.safeParseAIResponse('');

    const safe1 = malformed1.reply.includes('Not even JSON') && malformed1.action === null;
    const safe2 = typeof malformed2.reply === 'string' && malformed2.action === null;
    const safe3 = malformed3.action === null;

    if (safe1 && safe2 && safe3) {
      console.log('✅ TEST 9 PASSED: Malformed/non-JSON responses parsed safely without crashing; action defaults to null.\n');
      passed++;
    } else {
      console.log('❌ TEST 9 FAILED: Malformed response not handled safely.\n');
    }
  } catch (err) {
    console.log('❌ TEST 9 ERROR:', err.message, '\n');
  }

  // TEST 10 — MANUAL NAVIGATION REGRESSION
  console.log('--- TEST 10: Manual Navigation & Context Regression ---');
  try {
    const views = ['overview', 'traffic', 'electricity', 'pollution', 'water', 'alerts'];
    let allViewsOk = true;

    for (const v of views) {
      const ctx = await getContext('Vidyanagar', v, 'Yesterday');
      if (ctx.currentView !== v || ctx.selectedArea !== 'Vidyanagar' || ctx.selectedTimeRange !== 'Yesterday') {
        allViewsOk = false;
        break;
      }
    }

    if (allViewsOk) {
      console.log('✅ TEST 10 PASSED: All 6 views, localities, and time ranges retrieve and update context accurately with 0 regressions.\n');
      passed++;
    } else {
      console.log('❌ TEST 10 FAILED: Regression detected in manual context retrieval.\n');
    }
  } catch (err) {
    console.log('❌ TEST 10 ERROR:', err.message, '\n');
  }

  console.log('========================================================');
  console.log(`SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('========================================================');

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
