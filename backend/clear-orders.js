const initSqlJs = require('sql.js');
const fs = require('fs');

async function clearOrders() {
  try {
    const SQL = await initSqlJs();
    
    // Load existing database
    let filebuffer;
    try {
      filebuffer = fs.readFileSync('./helens_kitchen.db');
    } catch (err) {
      console.log('Database file not found');
      return;
    }
    
    const db = new SQL.Database(filebuffer);
    
    // Delete all orders
    const result = db.exec("DELETE FROM orders");
    console.log('All orders deleted successfully');
    
    // Save the database
    const data = db.export();
    fs.writeFileSync('./helens_kitchen.db', data);
    
    console.log('Database updated and saved');
    db.close();
    
  } catch (error) {
    console.error('Error clearing orders:', error);
  }
}

clearOrders();