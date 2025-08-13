// Debug version to identify the issue
const express = require('express');
const cors = require('cors');

console.log('Starting debug server...');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());

console.log('Middleware configured...');

// Simple test route
app.get('/api/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({ status: 'OK', message: 'Debug server working' });
});

// Test database connection
let db;
try {
  console.log('Attempting to connect to database...');
  db = require('./db.js');
  console.log('Database connection successful');
  
  // Add menu endpoint
  app.get("/api/menu", (req, res) => {
    console.log('Menu endpoint called');
    const menuQuery = `SELECT * FROM menu_items`;
    const variantsQuery = `SELECT * FROM menu_variants`;

    db.all(menuQuery, [], (err, menuItems) => {
      if (err) {
        console.error('Menu query error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Menu items found:', menuItems?.length || 0);

      db.all(variantsQuery, [], (err, variants) => {
        if (err) {
          console.error('Variants query error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('Variants found:', variants?.length || 0);

        const menuWithVariants = menuItems.map((item) => ({
          ...item,
          variants: variants.filter((variant) => variant.menu_item_id === item.id),
        }));

        res.json(menuWithVariants);
      });
    });
  });

  // Add admin verify endpoint
  app.get("/api/admin/verify", (req, res) => {
    console.log('Admin verify endpoint called');
    res.json({ authenticated: false });
  });

} catch (error) {
  console.error('Database connection failed:', error);
  
  // Fallback endpoints with mock data
  app.get("/api/menu", (req, res) => {
    console.log('Menu endpoint called (mock data)');
    res.json([
      {
        id: 1,
        name: "Classic Burger",
        description: "Beef patty with lettuce, tomato, and cheese",
        base_price: 12.99,
        image_url: "/images/burger.jpg",
        variants: [
          { id: 1, name: "Single Patty", price: 12.99 },
          { id: 2, name: "Double Patty", price: 16.99 }
        ]
      }
    ]);
  });

  app.get("/api/admin/verify", (req, res) => {
    console.log('Admin verify endpoint called (mock)');
    res.json({ authenticated: false });
  });
}

console.log('Routes configured...');

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET /api/health');
  console.log('- GET /api/menu');
  console.log('- GET /api/admin/verify');
});