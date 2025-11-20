/**
 * Diagnostic Test - Check Past Date Protection
 * 
 * This file diagnoses why yesterday's tasks are being deleted
 * Run: node backend/diagnostic-past-date.js
 */

import moment from 'moment';
import { TaskManagementService } from './services/taskManagementService.js';

console.log('\n╔════════════════════════════════════════════╗');
console.log('║  Past-Date Protection Diagnostic Test     ║');
console.log('╚════════════════════════════════════════════╝\n');

// Test 1: Yesterday's uncompleted task
console.log('─ TEST 1: Yesterday uncompleted task');
const yesterdayUncompleted = {
  task_id: 1,
  title: 'Yesterday Task',
  due_date: moment().subtract(1, 'day').format('YYYY-MM-DD'),
  status: 'pending'
};
console.log(`Task: ${JSON.stringify(yesterdayUncompleted, null, 2)}`);
const result1 = TaskManagementService.canDeleteTask(yesterdayUncompleted);
console.log(`Result: ${JSON.stringify(result1, null, 2)}`);
console.log(`Expected: canDelete=false, shouldReschedule=true`);
console.log(`Status: ${!result1.canDelete && result1.shouldReschedule ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Yesterday's completed task
console.log('─ TEST 2: Yesterday completed task');
const yesterdayCompleted = {
  task_id: 2,
  title: 'Yesterday Completed',
  due_date: moment().subtract(1, 'day').format('YYYY-MM-DD'),
  status: 'completed'
};
console.log(`Task: ${JSON.stringify(yesterdayCompleted, null, 2)}`);
const result2 = TaskManagementService.canDeleteTask(yesterdayCompleted);
console.log(`Result: ${JSON.stringify(result2, null, 2)}`);
console.log(`Expected: canDelete=true, shouldReschedule=false`);
console.log(`Status: ${result2.canDelete && !result2.shouldReschedule ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Today's task
console.log('─ TEST 3: Today uncompleted task');
const todayUncompleted = {
  task_id: 3,
  title: 'Today Task',
  due_date: moment().format('YYYY-MM-DD'),
  status: 'pending'
};
console.log(`Task: ${JSON.stringify(todayUncompleted, null, 2)}`);
const result3 = TaskManagementService.canDeleteTask(todayUncompleted);
console.log(`Result: ${JSON.stringify(result3, null, 2)}`);
console.log(`Expected: canDelete=true, shouldReschedule=false (today is not past)`);
console.log(`Status: ${result3.canDelete && !result3.shouldReschedule ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Tomorrow's task
console.log('─ TEST 4: Tomorrow uncompleted task');
const tomorrowUncompleted = {
  task_id: 4,
  title: 'Tomorrow Task',
  due_date: moment().add(1, 'day').format('YYYY-MM-DD'),
  status: 'pending'
};
console.log(`Task: ${JSON.stringify(tomorrowUncompleted, null, 2)}`);
const result4 = TaskManagementService.canDeleteTask(tomorrowUncompleted);
console.log(`Result: ${JSON.stringify(result4, null, 2)}`);
console.log(`Expected: canDelete=true, shouldReschedule=false`);
console.log(`Status: ${result4.canDelete && !result4.shouldReschedule ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
console.log('═════════════════════════════════════════════');
const allPass = [result1, result2, result3, result4].every((r, i) => {
  if (i === 0) return !r.canDelete && r.shouldReschedule;
  if (i === 1) return r.canDelete && !r.shouldReschedule;
  if (i === 2) return r.canDelete && !r.shouldReschedule;
  if (i === 3) return r.canDelete && !r.shouldReschedule;
});

console.log(`\n📊 Summary: ${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('\nIf tests pass but tasks are still being deleted:');
console.log('1. Check that the DELETE endpoint is being called');
console.log('2. Check that canDeleteTask() is being invoked');
console.log('3. Check the console logs in the DELETE endpoint');
console.log('4. Verify the task due_date field is in correct format\n');
