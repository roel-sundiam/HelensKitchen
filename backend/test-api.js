// Test the actual API endpoint
const http = require('http');

const orderData = JSON.stringify({
  customer_name: "Test User",
  phone: "1234567890", 
  address: "123 Test Street",
  payment_method: "GCash",
  requested_delivery: "2025-08-14T12:00:00",
  items: [
    {
      menu_item_id: 1,
      variant: "Single", 
      quantity: 1,
      price: 12.99
    }
  ],
  total_price: 12.99
});

const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/api/orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(orderData)
  }
};

console.log('Testing order API endpoint...');

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('Parsed response:', parsed);
      if (parsed.orderId) {
        console.log('✅ Order ID received:', parsed.orderId);
      } else {
        console.log('❌ No orderId in response');
      }
    } catch (e) {
      console.log('❌ Could not parse JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e);
});

req.write(orderData);
req.end();