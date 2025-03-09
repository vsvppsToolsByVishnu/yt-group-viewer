// Utility script to view the contents of the SQLite database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Define the database path
const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'data.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found at: ${dbPath}`);
  process.exit(1);
}

console.log(`Opening database at: ${dbPath}`);

// Open the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
  
  // Get a list of all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('Error getting tables:', err.message);
      closeAndExit(1);
    }
    
    // Process each table
    let tablesProcessed = 0;
    tables.forEach(({ name }) => {
      viewTable(name, () => {
        tablesProcessed++;
        if (tablesProcessed === tables.length) {
          closeAndExit(0);
        }
      });
    });
  });
});

// Function to view table contents
function viewTable(tableName, callback) {
  console.log(`\n========== Table: ${tableName} ==========`);
  
  // First get the column names
  db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
    if (err) {
      console.error(`Error getting columns for table ${tableName}:`, err.message);
      return callback();
    }
    
    const columnNames = columns.map(col => col.name);
    console.log('Columns:', columnNames);
    
    // Now get the data
    db.all(`SELECT * FROM ${tableName} LIMIT 100`, [], (err, rows) => {
      if (err) {
        console.error(`Error getting data from table ${tableName}:`, err.message);
        return callback();
      }
      
      console.log(`Found ${rows.length} rows:`);
      if (rows.length > 0) {
        // For the 'cache' table, truncate long data values
        if (tableName === 'cache' && rows[0].data && rows[0].data.length > 100) {
          rows.forEach(row => {
            row.data = row.data.substring(0, 100) + '... (truncated)';
          });
        }
        
        // Pretty print the rows
        rows.forEach((row, index) => {
          console.log(`\nRow ${index + 1}:`);
          for (const [key, value] of Object.entries(row)) {
            console.log(`  ${key}: ${value}`);
          }
        });
      } else {
        console.log('  No data in this table');
      }
      
      callback();
    });
  });
}

function closeAndExit(code = 0) {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
      process.exit(1);
    }
    console.log('\nDatabase connection closed.');
    process.exit(code);
  });
} 