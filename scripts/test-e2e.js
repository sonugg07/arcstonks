const http = require('http');

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING ARCSTONKS END-TO-END VERIFICATION ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failures++;
    }
  }

  // 1. Check Public Settings
  console.log('1. Testing Public Settings API (/api/settings)...');
  const settingsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/settings',
    method: 'GET',
  });
  assert(settingsRes.status === 200, 'Settings returns 200');
  assert(typeof settingsRes.data.waitlist_enabled === 'boolean', 'waitlist_enabled is boolean');
  assert(typeof settingsRes.data.checker_enabled === 'boolean', 'checker_enabled is boolean');

  // 2. Check Public Wallet Checker
  console.log('\n2. Testing Public Wallet Checker API (/api/check-wallet)...');
  // Seeded eligible wallet
  const eligibleAddr = '0x71C63397e3E79401736b43Fa9FE4B952E8C0409A';
  const checkEligible = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/check-wallet?address=${eligibleAddr}`,
    method: 'GET',
  });
  assert(checkEligible.status === 200, 'Check eligible wallet returns 200');
  assert(checkEligible.data.eligible === true, 'Wallet is correctly marked eligible');
  assert(checkEligible.data.allocation >= 1, `Wallet allocation is ${checkEligible.data.allocation}`);

  // Non-eligible wallet
  const nonEligibleAddr = '0x0000000000000000000000000000000000000001';
  const checkNonEligible = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/check-wallet?address=${nonEligibleAddr}`,
    method: 'GET',
  });
  assert(checkNonEligible.status === 200, 'Check non-eligible wallet returns 200');
  assert(checkNonEligible.data.eligible === false, 'Wallet is correctly marked NOT eligible');

  // Invalid address format
  const checkInvalid = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/check-wallet?address=0xinvalidaddress',
    method: 'GET',
  });
  assert(checkInvalid.status === 400, 'Invalid address format returns 400 Bad Request');

  // 3. Testing Anti-Bot Challenge & Public Waitlist Submission
  console.log('\n3. Testing Anti-Bot & Waitlist Submission (/api/waitlist)...');
  const challengeRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/waitlist',
    method: 'GET',
  });
  assert(challengeRes.status === 200, 'Challenge endpoint returns 200');
  assert(typeof challengeRes.data.payload === 'string', 'Challenge payload returned');

  // Solve the cryptographic challenge
  const payloadDecoded = JSON.parse(Buffer.from(challengeRes.data.payload, 'base64').toString());
  const answer = payloadDecoded.num1 + payloadDecoded.num2;
  const token = 'arc_challenge:' + Buffer.from(JSON.stringify({ ...payloadDecoded, userAnswer: answer.toString() })).toString('base64');

  // Generate dynamic test wallet
  const crypto = require('crypto');
  const testWallet = '0x' + crypto.randomBytes(20).toString('hex');

  // Complete required tasks for testWallet first with valid X handle proof
  const publicTasksRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'GET',
  });
  const testHandle = `@arcuser_${testWallet.slice(2, 8)}`;
  for (const t of publicTasksRes.data.tasks) {
    await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/tasks/verify',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        address: testWallet,
        taskId: t.id,
        proof: testHandle,
        actionOpenedAt: Date.now() - 4000,
      }
    );
  }

  // Submit wallet with valid challenge token and xHandle
  const submitWaitlist = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/waitlist',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      address: testWallet,
      captchaToken: token,
      xHandle: testHandle,
    }
  );
  assert(submitWaitlist.status === 200, 'Waitlist submission accepted with 200');
  assert(submitWaitlist.data.success === true, 'Waitlist response indicates success');

  // Duplicate submission test
  // Generate a second valid challenge token for re-submission
  const challengeRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/waitlist',
    method: 'GET',
  });
  const payloadDecoded2 = JSON.parse(Buffer.from(challengeRes2.data.payload, 'base64').toString());
  const token2 = 'arc_challenge:' + Buffer.from(JSON.stringify({ ...payloadDecoded2, userAnswer: (payloadDecoded2.num1 + payloadDecoded2.num2).toString() })).toString('base64');

  const duplicateSubmit = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/waitlist',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      address: testWallet,
      captchaToken: token2,
    }
  );
  assert(duplicateSubmit.status === 200, 'Duplicate submission returns 200 gracefully');
  assert(duplicateSubmit.data.alreadyExists === true, 'Duplicate submission recognized without duplicate insertion');

  // Bot submission rejection test (invalid token)
  const botSubmit = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/waitlist',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      address: '0x8888888888888888888888888888888888888888',
      captchaToken: 'fake_bot_token_123',
    }
  );
  assert(botSubmit.status === 403, 'Bot submission rejected with 403 Forbidden');

  // 4. Testing Admin Authentication & Security
  console.log('\n4. Testing Admin Security & Login (/api/admin/...)...');
  // Unauthorized stats access
  const unauthStats = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/stats',
    method: 'GET',
  });
  assert(unauthStats.status === 401, 'Unauthenticated admin endpoint returns 401');

  // Failed login
  const badLogin = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { password: 'wrongpassword' }
  );
  assert(badLogin.status === 401, 'Wrong admin password returns 401');

  // Successful login
  const goodLogin = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { password: 'arcstonks@9888' }
  );
  assert(goodLogin.status === 200, 'Correct admin login returns 200');

  const cookies = goodLogin.headers['set-cookie'];
  assert(Boolean(cookies && cookies.length > 0), 'Auth cookie received');
  const authCookie = cookies[0].split(';')[0];

  // Authorized stats
  const authStats = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/stats',
    method: 'GET',
    headers: { Cookie: authCookie },
  });
  assert(authStats.status === 200, 'Authenticated stats returns 200');
  assert(authStats.data.totalWaitlist >= 1, `Waitlist count is ${authStats.data.totalWaitlist}`);
  assert(authStats.data.totalEligible >= 5, `Eligible count is ${authStats.data.totalEligible}`);

  // 5. Testing Waitlist CSV Export
  console.log('\n5. Testing Waitlist CSV Export (/api/admin/waitlist/export)...');
  const exportRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/waitlist/export',
    method: 'GET',
    headers: { Cookie: authCookie },
  });
  assert(exportRes.status === 200, 'Export CSV returns 200');
  assert(exportRes.headers['content-type'].includes('text/csv'), 'Content-Type is text/csv');
  assert(typeof exportRes.data === 'string' && exportRes.data.startsWith('wallet_address'), 'CSV begins with wallet_address header');
  assert(exportRes.data.includes(testWallet), 'Exported CSV contains the submitted waitlist wallet');

  // 6. Testing Manual Eligible Wallet Management & Immediate Checker Sync
  console.log('\n6. Testing Manual Add Eligible Wallet & Immediate Checker Sync...');
  const newEligibleAddr = '0x' + crypto.randomBytes(20).toString('hex');
  const addWalletRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/eligible',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    {
      address: newEligibleAddr,
      allocation: 3,
    }
  );
  assert(addWalletRes.status === 200, 'Admin can add eligible wallet');

  // Check immediately in public checker
  const checkNewWallet = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/check-wallet?address=${newEligibleAddr}`,
    method: 'GET',
  });
  assert(checkNewWallet.status === 200, 'Newly added wallet returns 200 from public checker');
  assert(checkNewWallet.data.eligible === true, 'Newly added wallet is immediately eligible in public checker');
  assert(checkNewWallet.data.allocation === 3, 'Newly added wallet has allocation 3');

  // 7. Testing CSV Bulk Import
  console.log('\n7. Testing CSV Bulk Import with Validation Report (/api/admin/eligible/import)...');
  const importWallet1 = '0x' + crypto.randomBytes(20).toString('hex');
  const importWallet2 = '0x' + crypto.randomBytes(20).toString('hex');
  const sampleCsv = `wallet_address,allocation
${importWallet1},2
${importWallet2},1
${importWallet1},2
0xinvalid_wallet_here,1
${newEligibleAddr},3`;

  const importRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/eligible/import',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    {
      csvText: sampleCsv,
      defaultAllocation: 1,
    }
  );
  assert(importRes.status === 200, 'Import endpoint returns 200');
  assert(importRes.data.result.successfulCount === 2, `Imported 2 valid wallets (got ${importRes.data.result.successfulCount})`);
  assert(importRes.data.result.duplicateCount === 2, `Detected 2 duplicates (got ${importRes.data.result.duplicateCount})`);
  assert(importRes.data.result.invalidCount === 1, `Detected 1 invalid address (got ${importRes.data.result.invalidCount})`);

  // 8. Testing Admin Persistent Toggles: Waitlist ON/OFF and Checker ON/OFF
  console.log('\n8. Testing Admin Settings Toggles (/api/admin/settings)...');
  // Turn waitlist OFF
  const toggleWaitlistOff = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/settings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    { waitlist_enabled: false }
  );
  assert(toggleWaitlistOff.status === 200, 'Turn waitlist OFF returns 200');

  // Public submission when waitlist is OFF
  const trySubmitWhenOff = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/waitlist',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { address: '0x4444444444444444444444444444444444444444', captchaToken: 'any' }
  );
  assert(trySubmitWhenOff.status === 403, 'Waitlist submission rejected when OFF with 403');

  // Turn waitlist back ON
  await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/settings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    { waitlist_enabled: true }
  );

  // Turn checker OFF
  const toggleCheckerOff = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/settings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    { checker_enabled: false }
  );
  assert(toggleCheckerOff.status === 200, 'Turn checker OFF returns 200');

  // Public check when checker is OFF
  const tryCheckWhenOff = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/check-wallet?address=${eligibleAddr}`,
    method: 'GET',
  });
  assert(tryCheckWhenOff.status === 503, 'Wallet checker returns 503 Unavailable when OFF');

  // Turn checker back ON
  const toggleCheckerOn = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/settings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    { checker_enabled: true }
  );
  assert(toggleCheckerOn.status === 200, 'Turn checker back ON returns 200');

  console.log('\n=============================================');
  if (failures === 0) {
    console.log('🎉 ALL TESTS PASSED! FULL FUNCTIONALITY VERIFIED.');
  } else {
    console.error(`💥 COMPLETED WITH ${failures} FAILURES.`);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
