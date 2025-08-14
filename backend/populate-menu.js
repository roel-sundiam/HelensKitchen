const dbPromise = require('./db');

// Helen's Kitchen authentic menu data
const menuData = [
  // Charlie Chan Chicken Pasta
  {
    name: "Charlie Chan Chicken Pasta",
    description: "Perfectly cooked pasta with chicken, mushrooms and peanuts, coated in a sticky, sweet and spicy sauce with special ingredients. Must try, you will surely love it!",
    image_url: "images/food/pasta/pasta_1.jpg",
    base_price: 199.00,
    variants: [
      { name: "700ml box", price: 199.00 },
      { name: "1000ml box", price: 289.00 },
      { name: "1400ml box", price: 379.00 }
    ]
  },
  
  // 4 Cheese Burger
  {
    name: "Four Cheese Burger",
    description: "Our signature burger featuring a blend of four premium cheeses, perfectly melted over a juicy patty. A cheese lover's dream!",
    image_url: "images/food/burgers/burger_1.jpg",
    base_price: 159.00,
    variants: [
      { name: "Single Patty", price: 159.00 },
      { name: "Double Patty", price: 199.00 }
    ]
  },
  
  // Spicy Bulgogi in 3 Cheese
  {
    name: "Spicy Bulgogi",
    description: "Korean-inspired bulgogi beef with a spicy kick, topped with our signature three-cheese blend for the ultimate flavor experience.",
    image_url: "images/food/bulgogi/bulgogi_1.jpg", 
    base_price: 159.00,
    variants: [
      { name: "Single Patty", price: 159.00 },
      { name: "Double Patty", price: 199.00 }
    ]
  }
];

async function populateMenu() {
  console.log('🍽️ Populating Helen\'s Kitchen menu...');
  
  try {
    const db = await dbPromise;
    
    // Clear existing menu data
    console.log('Clearing existing menu data...');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM menu_variants', [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM menu_items', [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Insert menu items and variants
    for (const item of menuData) {
      console.log(`Adding ${item.name}...`);
      
      // Insert menu item
      const menuItemId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO menu_items (name, description, image_url, base_price) VALUES (?, ?, ?, ?)',
          [item.name, item.description, item.image_url, item.base_price],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Insert variants
      for (const variant of item.variants) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO menu_variants (menu_item_id, name, price) VALUES (?, ?, ?)',
            [menuItemId, variant.name, variant.price],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      console.log(`✅ Added ${item.name} with ${item.variants.length} variants`);
    }
    
    console.log('🎉 Menu population complete!');
    console.log('📋 Menu items added:');
    menuData.forEach(item => {
      console.log(`   • ${item.name} - ₱${item.base_price} (${item.variants.length} variants)`);
    });
    
    // Verify the data
    console.log('\n📊 Verifying menu data...');
    db.all('SELECT * FROM menu_items', [], (err, items) => {
      if (err) {
        console.error('Error verifying menu items:', err);
      } else {
        console.log(`Found ${items.length} menu items in database`);
        
        db.all('SELECT * FROM menu_variants', [], (err, variants) => {
          if (err) {
            console.error('Error verifying variants:', err);
          } else {
            console.log(`Found ${variants.length} variants in database`);
            process.exit(0);
          }
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error populating menu:', error);
    process.exit(1);
  }
}

// Run the population script
populateMenu();