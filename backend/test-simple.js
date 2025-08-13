// Test order creation directly
const db = require('./db.js');

console.log('Testing order creation...');

const orderData = {
  customer_name: 'Test User',
  phone: '1234567890', 
  address: '123 Test Street',
  plus_code: null,
  payment_method: 'GCash',
  total_price: 12.99,
  requested_delivery: '2025-08-13 12:00:00'
};

const orderSql = `INSERT INTO orders (customer_name, phone, address, plus_code, payment_method, total_price, status, payment_status, requested_delivery) 
                  VALUES (?, ?, ?, ?, ?, ?, 'New', 'Pending', ?)`;

db.run(orderSql, [
  orderData.customer_name, 
  orderData.phone, 
  orderData.address, 
  orderData.plus_code, 
  orderData.payment_method, 
  orderData.total_price, 
  orderData.requested_delivery
], function(err) {
  if (err) {
    console.error('Error creating order:', err);
  } else {
    console.log('Order created successfully!');
    console.log('Order ID:', this.lastID);
    
    // Query the order back
    db.get("SELECT * FROM orders WHERE id = ?", [this.lastID], (err, row) => {
      if (err) {
        console.error('Error querying order:', err);
      } else {
        console.log('Order data:', row);
      }
      db.close();
    });
  }
});