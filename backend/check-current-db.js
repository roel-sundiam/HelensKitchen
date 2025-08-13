const db = require('./db');

console.log('🔍 Checking current database menu items...');

db.all('SELECT id, name, image_url FROM menu_items', [], (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    return;
  }
  
  console.log('📋 Current menu items in database:');
  rows.forEach(row => {
    console.log(`  ${row.id}. ${row.name} -> ${row.image_url}`);
  });
  
  process.exit(0);
});