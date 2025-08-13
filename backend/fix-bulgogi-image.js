const db = require('./db');

console.log('🔧 Fixing Spicy Bulgogi image path...');

// Update the Spicy Bulgogi image path
db.run(
  'UPDATE menu_items SET image_url = ? WHERE name = ?',
  ['images/food/bulgogi/bulgogi_1.jpg', 'Spicy Bulgogi'],
  function(err) {
    if (err) {
      console.error('❌ Error updating Spicy Bulgogi image:', err);
    } else {
      console.log('✅ Successfully updated Spicy Bulgogi image path');
      console.log(`Rows affected: ${this.changes}`);
    }
    
    // Verify the update
    db.get(
      'SELECT name, image_url FROM menu_items WHERE name = ?',
      ['Spicy Bulgogi'],
      (err, row) => {
        if (err) {
          console.error('❌ Error verifying update:', err);
        } else if (row) {
          console.log('📋 Verified:', row.name, '->', row.image_url);
        } else {
          console.log('⚠️ No Spicy Bulgogi item found');
        }
        process.exit(0);
      }
    );
  }
);