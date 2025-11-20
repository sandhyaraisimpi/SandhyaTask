/**
 * Task Management Feature - Test Suite
 * 
 * Tests the past-date protection and auto-scheduling functionality
 * 
 * Run: node backend/test-task-management.js
 */

const API_URL = 'http://localhost:5000';
let TOKEN = null;
let USER_ID = null;

// ============================================================================
// SETUP
// ============================================================================

async function setup() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  Task Management Feature - Test Suite     ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    // Create test user
    const res = await fetch(`${API_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User' })
    });

    const data = await res.json();
    TOKEN = data.data.token;
    USER_ID = data.data.user.user_id;

    console.log('✓ Test user created');
    console.log(`✓ Token: ${TOKEN.substring(0, 20)}...`);
    console.log(`✓ User ID: ${USER_ID}\n`);

    return true;
  } catch (error) {
    console.error('✗ Setup failed:', error);
    return false;
  }
}

// ============================================================================
// TEST 1: Past Uncompleted Task Cannot Be Deleted
// ============================================================================

async function test1_PastTaskAutoReschedule() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│ TEST 1: Past Task Auto-Reschedule          │');
  console.log('└────────────────────────────────────────────┘\n');

  try {
    // Create past task
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];

    const createRes = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        title: 'Past Task Test',
        description: 'Test past task',
        due_date: pastDate,
        priority: 'medium'
      })
    });

    const createData = await createRes.json();
    const taskId = createData.data.task_id;
    console.log(`✓ Created past task (ID: ${taskId}) on ${pastDate}`);

    // Try to delete it
    const deleteRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ forceDelete: false })
    });

    const deleteData = await deleteRes.json();
    console.log(`Action: ${deleteData.action}`);
    console.log(`Message: ${deleteData.message}`);

    if (deleteData.action === 'rescheduled') {
      console.log(`✓ New date: ${deleteData.data.task.due_date}`);
      console.log('✓ TEST 1 PASSED\n');
      return true;
    } else {
      console.log('✗ Task was deleted instead of rescheduled');
      console.log('✗ TEST 1 FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('✗ TEST 1 FAILED:', error);
    return false;
  }
}

// ============================================================================
// TEST 2: Completed Tasks Can Be Deleted
// ============================================================================

async function test2_CompletedTaskDelete() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│ TEST 2: Completed Tasks Can Be Deleted     │');
  console.log('└────────────────────────────────────────────┘\n');

  try {
    // Create past task
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];

    const createRes = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        title: 'Completed Past Task',
        due_date: pastDate,
        priority: 'low'
      })
    });

    const createData = await createRes.json();
    const taskId = createData.data.task_id;
    console.log(`✓ Created past task (ID: ${taskId})`);

    // Mark as completed
    await fetch(`${API_URL}/api/tasks/${taskId}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    console.log('✓ Marked as completed');

    // Delete it
    const deleteRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ forceDelete: false })
    });

    const deleteData = await deleteRes.json();

    if (deleteData.action === 'deleted') {
      console.log('✓ Completed task was deleted');
      console.log('✓ TEST 2 PASSED\n');
      return true;
    } else {
      console.log('✗ Completed task was rescheduled');
      console.log('✗ TEST 2 FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('✗ TEST 2 FAILED:', error);
    return false;
  }
}

// ============================================================================
// TEST 3: Future Tasks Can Be Deleted
// ============================================================================

async function test3_FutureTaskDelete() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│ TEST 3: Future Tasks Can Be Deleted        │');
  console.log('└────────────────────────────────────────────┘\n');

  try {
    // Create future task
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = tomorrow.toISOString().split('T')[0];

    const createRes = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        title: 'Future Task',
        due_date: futureDate,
        priority: 'high'
      })
    });

    const createData = await createRes.json();
    const taskId = createData.data.task_id;
    console.log(`✓ Created future task (ID: ${taskId}) on ${futureDate}`);

    // Delete it
    const deleteRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ forceDelete: false })
    });

    const deleteData = await deleteRes.json();

    if (deleteData.action === 'deleted') {
      console.log('✓ Future task was deleted');
      console.log('✓ TEST 3 PASSED\n');
      return true;
    } else {
      console.log('✗ Future task was rescheduled');
      console.log('✗ TEST 3 FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('✗ TEST 3 FAILED:', error);
    return false;
  }
}

// ============================================================================
// TEST 4: Revision Tasks Auto-Schedule
// ============================================================================

async function test4_RevisionAutoSchedule() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│ TEST 4: Revision Tasks Auto-Schedule       │');
  console.log('└────────────────────────────────────────────┘\n');

  try {
    // Create past revision task
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];

    const createRes = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        title: 'Revision Task',
        description: 'Spaced repetition',
        due_date: pastDate,
        priority: 'high',
        is_revision_task: true,
        spaced_pattern: '1d, 3d, 7d'
      })
    });

    const createData = await createRes.json();
    const taskId = createData.data.task_id;
    console.log(`✓ Created revision task (ID: ${taskId})`);
    console.log(`✓ Spaced pattern: 1d, 3d, 7d`);

    // Delete it (should reschedule + auto-schedule revisions)
    const deleteRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ forceDelete: false })
    });

    const deleteData = await deleteRes.json();
    console.log(`Action: ${deleteData.action}`);

    if (deleteData.action === 'rescheduled') {
      const revisions = deleteData.data.revisions || [];
      console.log(`✓ Task rescheduled to: ${deleteData.data.task.due_date}`);
      console.log(`✓ Created ${revisions.length} revisions`);

      if (revisions.length === 3) {
        revisions.forEach(r => {
          console.log(`  - Rev ${r.revision_number}: ${r.revision_date}`);
        });
        console.log('✓ TEST 4 PASSED\n');
        return true;
      } else {
        console.log(`✗ Expected 3 revisions, got ${revisions.length}`);
        console.log('✗ TEST 4 FAILED\n');
        return false;
      }
    } else {
      console.log('✗ Task was deleted instead of rescheduled');
      console.log('✗ TEST 4 FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('✗ TEST 4 FAILED:', error);
    return false;
  }
}

// ============================================================================
// TEST 5: Recursive Tasks Auto-Schedule
// ============================================================================

async function test5_RecursiveAutoSchedule() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│ TEST 5: Recursive Tasks Auto-Schedule      │');
  console.log('└────────────────────────────────────────────┘\n');

  try {
    // Create past recursive task
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const endDate = nextYear.toISOString().split('T')[0];

    const createRes = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        title: 'Daily Recurring Task',
        description: 'Daily task',
        due_date: pastDate,
        priority: 'medium',
        is_recursive: true,
        recursive_pattern: 'daily',
        recursive_interval: 1,
        recursive_end_date: endDate
      })
    });

    const createData = await createRes.json();
    const taskId = createData.data.task_id;
    console.log(`✓ Created recursive task (ID: ${taskId})`);
    console.log(`✓ Pattern: daily`);

    // Delete it (should reschedule + auto-schedule instances)
    const deleteRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ forceDelete: false })
    });

    const deleteData = await deleteRes.json();
    console.log(`Action: ${deleteData.action}`);

    if (deleteData.action === 'rescheduled') {
      const instances = deleteData.data.recursiveInstances || [];
      console.log(`✓ Task rescheduled to: ${deleteData.data.task.due_date}`);
      console.log(`✓ Created ${instances.length} recursive instances`);

      if (instances.length > 0) {
        console.log('✓ First 3 instances:');
        instances.slice(0, 3).forEach(inst => {
          console.log(`  - ${inst.due_date}`);
        });
        console.log('✓ TEST 5 PASSED\n');
        return true;
      } else {
        console.log('✗ No recursive instances created');
        console.log('✗ TEST 5 FAILED\n');
        return false;
      }
    } else {
      console.log('✗ Task was deleted instead of rescheduled');
      console.log('✗ TEST 5 FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('✗ TEST 5 FAILED:', error);
    return false;
  }
}

// ============================================================================
// TEST 6: Force Delete Override
// ============================================================================

async function test6_ForceDelete() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│ TEST 6: Force Delete Override              │');
  console.log('└────────────────────────────────────────────┘\n');

  try {
    // Create past task
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];

    const createRes = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        title: 'Force Delete Test',
        due_date: pastDate,
        priority: 'low'
      })
    });

    const createData = await createRes.json();
    const taskId = createData.data.task_id;
    console.log(`✓ Created past task (ID: ${taskId})`);

    // Force delete
    const deleteRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ forceDelete: true })
    });

    const deleteData = await deleteRes.json();

    if (deleteData.action === 'deleted') {
      console.log('✓ Task force deleted successfully');
      console.log('✓ TEST 6 PASSED\n');
      return true;
    } else {
      console.log('✗ Force delete did not work');
      console.log('✗ TEST 6 FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('✗ TEST 6 FAILED:', error);
    return false;
  }
}

// ============================================================================
// TEST 7: Manage Endpoint - Explicit Reschedule
// ============================================================================

async function test7_ManageEndpoint() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│ TEST 7: Manage Endpoint - Reschedule       │');
  console.log('└────────────────────────────────────────────┘\n');

  try {
    // Create task
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const futureDate = nextWeek.toISOString().split('T')[0];

    const createRes = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        title: 'Task to Reschedule',
        due_date: futureDate,
        priority: 'medium'
      })
    });

    const createData = await createRes.json();
    const taskId = createData.data.task_id;
    console.log(`✓ Created task (ID: ${taskId}) on ${futureDate}`);

    // Use manage endpoint to reschedule
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const newDate = nextMonth.toISOString().split('T')[0];

    const manageRes = await fetch(`${API_URL}/api/tasks/${taskId}/manage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        action: 'reschedule',
        newDate: newDate
      })
    });

    const manageData = await manageRes.json();
    console.log(`Action: ${manageData.action}`);
    console.log(`New date: ${manageData.data.task.due_date}`);

    if (manageData.action === 'rescheduled' && manageData.data.task.due_date === newDate) {
      console.log('✓ Task rescheduled to specified date');
      console.log('✓ TEST 7 PASSED\n');
      return true;
    } else {
      console.log('✗ Task was not rescheduled correctly');
      console.log('✗ TEST 7 FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('✗ TEST 7 FAILED:', error);
    return false;
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  const setupOk = await setup();
  if (!setupOk) {
    console.log('Setup failed. Make sure backend is running on localhost:5000');
    return;
  }

  const results = [];

  results.push({ name: 'Past Task Auto-Reschedule', pass: await test1_PastTaskAutoReschedule() });
  results.push({ name: 'Completed Tasks Can Delete', pass: await test2_CompletedTaskDelete() });
  results.push({ name: 'Future Tasks Can Delete', pass: await test3_FutureTaskDelete() });
  results.push({ name: 'Revision Auto-Schedule', pass: await test4_RevisionAutoSchedule() });
  results.push({ name: 'Recursive Auto-Schedule', pass: await test5_RecursiveAutoSchedule() });
  results.push({ name: 'Force Delete Override', pass: await test6_ForceDelete() });
  results.push({ name: 'Manage Endpoint', pass: await test7_ManageEndpoint() });

  // Summary
  console.log('╔════════════════════════════════════════════╗');
  console.log('║              TEST SUMMARY                  ║');
  console.log('╚════════════════════════════════════════════╝\n');

  let passed = 0;
  results.forEach(r => {
    const status = r.pass ? '✓' : '✗';
    console.log(`${status} ${r.name}`);
    if (r.pass) passed++;
  });

  console.log(`\n${passed}/${results.length} tests passed\n`);

  if (passed === results.length) {
    console.log('🎉 All tests passed! Feature working correctly.\n');
  } else {
    console.log(`⚠️  ${results.length - passed} test(s) failed.\n`);
  }
}

// Run tests
if (typeof module !== 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests };
