/**
 * Step 6A Automated Test Suite
 * 
 * Tests the 5 mandated scenarios for Step 6A:
 * 1. Electricity Gokul Road Today
 * 2. Pollution Gokul Road Today
 * 3. Water Keshwapur Today
 * 4. Anti-hallucination out-of-context query
 * 5. Error handling (empty message & validation)
 */

const http = require('http');

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
    http.get(`http://localhost:5000/api/city/context?zone=${encodeURIComponent(zone)}&view=${encodeURIComponent(view)}&time=${encodeURIComponent(time)}`, (res) => {
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
  console.log('====================================================');
  console.log('SMART CITY DASHBOARD - STEP 6A VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 5;

  // TEST 1: Electricity Gokul Road Today
  console.log('--- TEST 1: Electricity Gokul Road Today ---');
  try {
    const ctx1 = await getContext('Gokul Road', 'electricity', 'Today');
    console.log('Retrieved Context KPIs:', ctx1.kpis);
    console.log('Retrieved Context Baseline:', ctx1.baseline);
    console.log('Retrieved Alerts count:', ctx1.alerts ? ctx1.alerts.length : 0);

    const res1 = await postChat('Why is electricity high here?', ctx1);
    console.log('HTTP Status:', res1.status);
    console.log('AI Reply:', res1.body.data.reply);

    const reply1 = res1.body.data.reply;
    const mentionsGokul = reply1.includes('Gokul Road');
    const mentionsConsumption = reply1.includes('1,720') || reply1.includes('1720');
    const mentionsBaseline = reply1.includes('1,340') || reply1.includes('1340');
    const mentionsSpike = reply1.toLowerCase().includes('spike') || reply1.includes('+28%') || reply1.toLowerCase().includes('higher');

    if (res1.status === 200 && mentionsGokul && mentionsConsumption && mentionsBaseline && mentionsSpike) {
      console.log('✅ TEST 1 PASSED: Grounded in Gokul Road electricity data (1,720 MWh vs 1,340 MWh baseline).\n');
      passed++;
    } else {
      console.log('❌ TEST 1 FAILED: Expected Gokul Road electricity grounding.\n');
    }
  } catch (err) {
    console.log('❌ TEST 1 ERROR:', err.message, '\n');
  }

  // TEST 2: Pollution Gokul Road Today
  console.log('--- TEST 2: Pollution Gokul Road Today ---');
  try {
    const ctx2 = await getContext('Gokul Road', 'pollution', 'Today');
    console.log('Retrieved Context KPIs:', ctx2.kpis);
    console.log('Retrieved Context Baseline:', ctx2.baseline);

    const res2 = await postChat('What is the AQI here?', ctx2);
    console.log('HTTP Status:', res2.status);
    console.log('AI Reply:', res2.body.data.reply);

    const reply2 = res2.body.data.reply;
    const mentionsGokul2 = reply2.includes('Gokul Road');
    const mentionsAqi = reply2.includes('152');
    const mentionsStatus = reply2.toLowerCase().includes('unhealthy');

    if (res2.status === 200 && mentionsGokul2 && mentionsAqi && mentionsStatus) {
      console.log('✅ TEST 2 PASSED: Grounded in Gokul Road AQI 152 (Unhealthy category).\n');
      passed++;
    } else {
      console.log('❌ TEST 2 FAILED: Expected Gokul Road AQI 152 grounding.\n');
    }
  } catch (err) {
    console.log('❌ TEST 2 ERROR:', err.message, '\n');
  }

  // TEST 3: Water Keshwapur Today
  console.log('--- TEST 3: Water Keshwapur Today ---');
  try {
    const ctx3 = await getContext('Keshwapur', 'water', 'Today');
    console.log('Retrieved Context KPIs:', ctx3.kpis);
    console.log('Retrieved Context Baseline:', ctx3.baseline);

    const res3 = await postChat('Is there any water issue here?', ctx3);
    console.log('HTTP Status:', res3.status);
    console.log('AI Reply:', res3.body.data.reply);

    const reply3 = res3.body.data.reply;
    const mentionsKeshwapur = reply3.includes('Keshwapur');
    const mentionsPressure = reply3.includes('41');
    const mentionsBasePressure = reply3.includes('52');
    const mentionsDrop = reply3.toLowerCase().includes('drop') || reply3.includes('-21%') || reply3.toLowerCase().includes('pressure');

    if (res3.status === 200 && mentionsKeshwapur && mentionsPressure && mentionsBasePressure && mentionsDrop) {
      console.log('✅ TEST 3 PASSED: Grounded in Keshwapur water pressure drop (41 PSI vs 52 PSI baseline).\n');
      passed++;
    } else {
      console.log('❌ TEST 3 FAILED: Expected Keshwapur water pressure grounding.\n');
    }
  } catch (err) {
    console.log('❌ TEST 3 ERROR:', err.message, '\n');
  }

  // TEST 4: Anti-Hallucination Out-of-Context Check
  console.log('--- TEST 4: Anti-Hallucination Out-of-Context Check ---');
  try {
    // Current context is Electricity view on Gokul Road
    const ctx4 = await getContext('Gokul Road', 'electricity', 'Today');
    // User asks for AQI while on Electricity view
    const res4 = await postChat('What is the AQI here?', ctx4);
    console.log('HTTP Status:', res4.status);
    console.log('AI Reply:', res4.body.data.reply);

    const reply4 = res4.body.data.reply;
    // Must clearly state that AQI/air quality is NOT available in this context, and NOT invent an AQI value
    const statesNotAvailable = reply4.toLowerCase().includes('not available') || reply4.toLowerCase().includes('switch to the pollution');
    const doesNotInventAqi = !reply4.includes('AQI is 152') && !reply4.includes('AQI: 152');

    if (res4.status === 200 && statesNotAvailable && doesNotInventAqi) {
      console.log('✅ TEST 4 PASSED: Refused to hallucinate AQI when dashboard context is Electricity.\n');
      passed++;
    } else {
      console.log('❌ TEST 4 FAILED: Did not refuse to hallucinate or invent out-of-context AQI.\n');
    }
  } catch (err) {
    console.log('❌ TEST 4 ERROR:', err.message, '\n');
  }

  // TEST 5: Error Handling Check
  console.log('--- TEST 5: Error Handling Check ---');
  try {
    // Sending empty message
    const res5 = await postChat('   ', {});
    console.log('HTTP Status:', res5.status);
    console.log('Error Body:', res5.body);

    if (res5.status === 400 && res5.body.success === false && res5.body.error) {
      console.log('✅ TEST 5 PASSED: Returned 400 Bad Request for empty message with clear error message.\n');
      passed++;
    } else {
      console.log('❌ TEST 5 FAILED: Expected 400 with error property.\n');
    }
  } catch (err) {
    console.log('❌ TEST 5 ERROR:', err.message, '\n');
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
