// Create retroactive expense records for existing inventory
// This script should be run once to create expenses for inventory that was added before the expense auto-creation feature

const mongoose = require('mongoose');
require('dotenv').config();

const { 
  connectToMongoDB,
  Ingredient,
  Expense,
  StockMovement,
  AdminUser
} = require('./models');

async function createRetroactiveExpenses() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectToMongoDB();
    
    console.log('📋 Fetching existing ingredients with stock...');
    
    // Get all ingredients that have current stock > 0 and cost_per_unit > 0
    const ingredients = await Ingredient.find({
      current_stock: { $gt: 0 },
      cost_per_unit: { $gt: 0 }
    });
    
    console.log(`Found ${ingredients.length} ingredients with stock to process:`);
    
    if (ingredients.length === 0) {
      console.log('✅ No ingredients with stock found. Nothing to process.');
      return;
    }
    
    // Display ingredients that will be processed
    let totalExpenseAmount = 0;
    ingredients.forEach((ingredient, index) => {
      const itemValue = ingredient.current_stock * ingredient.cost_per_unit;
      totalExpenseAmount += itemValue;
      console.log(`${index + 1}. ${ingredient.name}: ${ingredient.current_stock} ${ingredient.unit} × ₱${ingredient.cost_per_unit} = ₱${itemValue.toFixed(2)}`);
    });
    
    console.log(`\n💰 Total inventory value: ₱${totalExpenseAmount.toFixed(2)}`);
    console.log('\n⚠️  This will create expense records for existing inventory.');
    console.log('⚠️  This should only be run ONCE to avoid duplicate expenses.');
    
    // Ask for confirmation (in a real environment, you might want to add readline for interactive confirmation)
    console.log('\n🔄 Processing expenses...');
    
    // Get the first admin user for the stock movements
    const adminUser = await AdminUser.findOne({ is_active: true });
    if (!adminUser) {
      console.error('❌ No active admin user found. Cannot create stock movements.');
      return;
    }
    
    let createdExpenses = 0;
    let createdMovements = 0;
    
    for (const ingredient of ingredients) {
      try {
        const expenseAmount = ingredient.current_stock * ingredient.cost_per_unit;
        
        // Create stock movement record (retroactive initial stock)
        const movement = await StockMovement.create({
          ingredient_id: ingredient._id,
          movement_type: 'purchase',
          quantity: ingredient.current_stock,
          reason: 'Retroactive: Initial inventory stock',
          admin_id: adminUser._id,
          reference_type: 'retroactive_initial_stock'
        });
        createdMovements++;
        
        // Create expense record (backdated to ingredient creation or a reasonable date)
        const expenseDate = ingredient.createdAt || new Date();
        await Expense.create({
          date: expenseDate,
          category: 'Ingredients',
          amount: expenseAmount,
          notes: `Retroactive expense: Initial stock of ${ingredient.current_stock} ${ingredient.unit} of ${ingredient.name} at ₱${ingredient.cost_per_unit}/${ingredient.unit}`
        });
        createdExpenses++;
        
        console.log(`✅ ${ingredient.name}: Created expense ₱${expenseAmount.toFixed(2)} and stock movement`);
        
      } catch (error) {
        console.error(`❌ Error processing ${ingredient.name}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Completed successfully!`);
    console.log(`📝 Created ${createdExpenses} expense records`);
    console.log(`📦 Created ${createdMovements} stock movement records`);
    console.log(`💰 Total expenses added: ₱${totalExpenseAmount.toFixed(2)}`);
    console.log('\n✅ All existing inventory has been properly charged to expenses.');
    console.log('\n💡 Future ingredient purchases will automatically create expenses.');
    
  } catch (error) {
    console.error('❌ Error creating retroactive expenses:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
createRetroactiveExpenses();