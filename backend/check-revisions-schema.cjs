const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/sumitask.db');

db.all('SELECT sql FROM sqlite_master WHERE name = "revisions"', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else if (rows && rows.length > 0) {
    console.log('Revisions table schema:');
    console.log(rows[0].sql);
  } else {
    console.log('No revisions table found');
  }
  db.close();
});
