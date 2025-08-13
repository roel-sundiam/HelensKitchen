// Check database tables
const db = require('./db.js');

console.log('Checking database tables...');

// Check if tables exist
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Error checking tables:', err);
    return;
  }
  
  console.log('Tables found:', tables.map(t => t.name));
  
  // Check menu_items
  db.all("SELECT COUNT(*) as count FROM menu_items", [], (err, result) => {
    if (err) {
      console.error('Error checking menu_items:', err);
    } else {
      console.log('Menu items count:', result[0].count);
    }
    
    // Check orders table structure
    db.all("PRAGMA table_info(orders)", [], (err, columns) => {
      if (err) {
        console.error('Error checking orders table:', err);
      } else {
        console.log('Orders table columns:', columns.map(c => c.name));
      }
      
      // Close the database
      db.close();
    });
  });
});