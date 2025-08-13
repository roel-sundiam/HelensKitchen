const dbPromise = require('./db');

async function clearInventoryData() {
  try {
    const db = await dbPromise;
    
    console.log('🗑️  Clearing inventory data...');
    
    // Clear stock movements first (foreign key dependency)
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM stock_movements", [], (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Cleared stock movements');
          resolve();
        }
      });
    });
    
    // Clear menu item ingredients (foreign key dependency)
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM menu_item_ingredients", [], (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Cleared menu item ingredients relationships');
          resolve();
        }
      });
    });
    
    // Clear ingredients
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM ingredients", [], (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Cleared ingredients');
          resolve();
        }
      });
    });
    
    // Get counts to verify
    const ingredientCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM ingredients", [], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    const movementCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM stock_movements", [], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    console.log(`\n📊 Final counts:`);
    console.log(`   Ingredients: ${ingredientCount}`);
    console.log(`   Stock movements: ${movementCount}`);
    console.log('\n🎉 Inventory data cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing inventory:', error);
    process.exit(1);
  }
}

clearInventoryData();