const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/sumitask.db');

db.all('SELECT sql FROM sqlite_master WHERE name = "tasks"', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tasks table schema:');
    console.log(rows[0].sql);
  }
  db.close();
});
