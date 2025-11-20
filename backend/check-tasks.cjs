const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/sumitask.db');

db.all('SELECT task_id, title, parent_task_id, revision_interval, is_revision_task FROM tasks ORDER BY task_id DESC LIMIT 35', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Total tasks in database:', rows.length);
    console.log('\nRecent tasks:');
    console.table(rows);
    
    // Count by type
    const parents = rows.filter(r => !r.parent_task_id);
    const children = rows.filter(r => r.parent_task_id);
    console.log('\nBreakdown:');
    console.log('Parent tasks:', parents.length);
    console.log('Child revision tasks:', children.length);
    console.log('Total:', rows.length);
  }
  db.close();
});
