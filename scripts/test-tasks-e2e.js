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

async function runTaskTests() {
  console.log('=== STARTING WAITLIST COMMUNITY TASK SYSTEM VERIFICATION ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failures++;
    }
  }

  // 1. Check Public Tasks API
  console.log('1. Testing Public Tasks API (/api/tasks)...');
  const tasksRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'GET',
  });
  assert(tasksRes.status === 200, 'Tasks endpoint returns 200');
  assert(Array.isArray(tasksRes.data.tasks), 'Returns array of tasks');
  assert(tasksRes.data.tasks.length >= 4, `At least 4 seeded tasks returned (got ${tasksRes.data.tasks.length})`);

  const taskTitles = tasksRes.data.tasks.map((t) => t.title);
  assert(taskTitles.some((t) => t.includes('Follow')), 'Contains Follow task');
  assert(taskTitles.some((t) => t.includes('Like')), 'Contains Like task');
  assert(taskTitles.some((t) => t.includes('Repost')), 'Contains Repost task');
  assert(taskTitles.some((t) => t.includes('Comment')), 'Contains Comment task');

  // 2. Test Waitlist Submission Rejection when Required Tasks are Incomplete
  console.log('\n2. Testing Waitlist Submission Rejection when Incomplete (/api/waitlist)...');
  const crypto = require('crypto');
  const testWallet = '0x' + crypto.randomBytes(20).toString('hex');
  console.log(`  Using test wallet: ${testWallet}`);

  // Generate anti-bot challenge token
  const chalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/waitlist',
    method: 'GET',
  });
  const decoded = JSON.parse(Buffer.from(chalRes.data.payload, 'base64').toString());
  const token = 'arc_challenge:' + Buffer.from(JSON.stringify({ ...decoded, userAnswer: (decoded.num1 + decoded.num2).toString() })).toString('base64');

  const prematureSubmit = await request(
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
    }
  );
  assert(prematureSubmit.status === 400, 'Submission rejected with 400 when required tasks incomplete');
  assert(
    prematureSubmit.data.error.includes('complete all required community tasks'),
    `Error message mentions required tasks: "${prematureSubmit.data.error}"`
  );

  // 3. Testing Task Verification API (/api/tasks/verify) & Proof Validation
  console.log('\n3. Testing Task Verification (/api/tasks/verify)...');
  const allTasks = tasksRes.data.tasks;
  const firstTask = allTasks[0];

  // 3a. Rejection when proof is omitted
  console.log('  Testing verification rejection without proof...');
  const noProofRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/tasks/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      address: testWallet,
      taskId: firstTask.id,
    }
  );
  assert(noProofRes.status === 400, 'Verification rejected with 400 when proof is missing');
  assert(noProofRes.data.error.includes('Proof required'), 'Error requires proof/X handle');

  // 3b. Anti-rush cooldown rejection (action opened < 3s ago)
  console.log('  Testing anti-rush cooldown rejection...');
  const rushRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/tasks/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      address: testWallet,
      taskId: firstTask.id,
      proof: '@valid_tester',
      actionOpenedAt: Date.now() - 500, // only 0.5s elapsed
    }
  );
  assert(rushRes.status === 400, 'Verification rejected with 400 when action rushed < 3s');
  assert(rushRes.data.error.includes('wait'), 'Error message informs user to perform action on X');

  // 3c. Successful verification with valid handle & proof
  const testHandle = `@arcuser_${testWallet.slice(2, 8)}`;
  console.log(`  Verifying all tasks with valid proof: ${testHandle}...`);
  for (const t of allTasks) {
    const verifyRes = await request(
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
        actionOpenedAt: Date.now() - 4000, // 4s elapsed
      }
    );
    assert(verifyRes.status === 200, `Task #${t.id} (${t.title}) verified with 200`);
    assert(verifyRes.data.success === true, `Task #${t.id} success is true`);
    assert(verifyRes.data.proof === testHandle, `Proof stored as ${testHandle}`);
  }

  // 3d. Anti-Sybil protection: another wallet attempting to reuse the same X handle
  console.log('  Testing anti-sybil duplicate account rejection...');
  const sybilWallet = '0x' + crypto.randomBytes(20).toString('hex');
  const sybilRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/tasks/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      address: sybilWallet,
      taskId: firstTask.id,
      proof: testHandle, // reusing testHandle
    }
  );
  assert(sybilRes.status === 400, 'Sybil reuse rejected with 400');
  assert(sybilRes.data.error.includes('already been verified for another wallet'), 'Sybil error message displayed');

  // Verify that GET /api/tasks?address=... now shows all completed with proof
  const userTasksRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/tasks?address=${testWallet}`,
    method: 'GET',
  });
  const completedCount = userTasksRes.data.tasks.filter((t) => t.completed).length;
  assert(completedCount === allTasks.length, `All ${allTasks.length} tasks reflect completed: true for wallet`);
  assert(userTasksRes.data.tasks[0].proof_value === testHandle, 'Proof value returned in tasks API');

  // 4. Test Waitlist Submission Acceptance after Required Tasks Completed
  console.log('\n4. Testing Waitlist Submission after Tasks Completed (/api/waitlist)...');
  // Generate fresh anti-bot token
  const chalRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/waitlist',
    method: 'GET',
  });
  const decoded2 = JSON.parse(Buffer.from(chalRes2.data.payload, 'base64').toString());
  const token2 = 'arc_challenge:' + Buffer.from(JSON.stringify({ ...decoded2, userAnswer: (decoded2.num1 + decoded2.num2).toString() })).toString('base64');

  const validSubmit = await request(
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
      xHandle: testHandle,
    }
  );
  assert(validSubmit.status === 200, 'Waitlist submission accepted with 200');
  assert(validSubmit.data.success === true, 'Submission succeeded and saved to waitlist_users');
  assert(validSubmit.data.entry.x_handle === testHandle, 'Entry stored with X handle');

  // 5. Admin Task Management Testing (/api/admin/tasks)
  console.log('\n5. Testing Admin Task Management (/api/admin/tasks)...');
  // Login
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { password: 'arcstonks@9888' }
  );
  assert(loginRes.status === 200, 'Admin login succeeded');
  const authCookie = loginRes.headers['set-cookie'][0].split(';')[0];

  // Admin list tasks
  const adminTasksRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/tasks',
    method: 'GET',
    headers: { Cookie: authCookie },
  });
  assert(adminTasksRes.status === 200, 'Admin get tasks returns 200');
  assert(adminTasksRes.data.tasks[0].completionCount >= 1, 'Completion count tracked for task');

  // Admin Create New Task
  const createTaskRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/tasks',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    {
      title: 'Join ArcStonks Telegram Channel',
      type: 'Join',
      url: 'https://t.me/arcstonks',
      required: false,
      enabled: true,
      display_order: 5,
    }
  );
  assert(createTaskRes.status === 200, 'Admin can create new task');
  const createdTaskId = createTaskRes.data.task.id;

  // Verify it appears in public list
  const publicListWithNew = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'GET',
  });
  assert(
    publicListWithNew.data.tasks.some((t) => t.id === createdTaskId),
    'Newly created task appears in public /api/tasks'
  );

  // Admin Disable Task
  const disableTaskRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/tasks/${createdTaskId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    },
    { enabled: false }
  );
  assert(disableTaskRes.status === 200, 'Admin can disable task');

  // Verify disabled task disappears from public list
  const publicListAfterDisable = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'GET',
  });
  assert(
    !publicListAfterDisable.data.tasks.some((t) => t.id === createdTaskId),
    'Disabled task disappears from public /api/tasks'
  );

  // Admin Delete Task
  const deleteTaskRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/tasks/${createdTaskId}`,
    method: 'DELETE',
    headers: { Cookie: authCookie },
  });
  assert(deleteTaskRes.status === 200, 'Admin can delete task');

  // 6. Verify Existing Features Unbroken
  console.log('\n6. Checking Existing Features (Wallet Checker & Settings)...');
  const checkRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/check-wallet?address=0x71C63397e3E79401736b43Fa9FE4B952E8C0409A',
    method: 'GET',
  });
  assert(checkRes.status === 200 && checkRes.data.eligible === true, 'Wallet Checker remains 100% functional');

  console.log('\n=============================================');
  if (failures === 0) {
    console.log('🎉 ALL TASK SYSTEM TESTS PASSED! 100% FUNCTIONAL.');
  } else {
    console.error(`💥 COMPLETED WITH ${failures} FAILURES.`);
  }
}

runTaskTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
