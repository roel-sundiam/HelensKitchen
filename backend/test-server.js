// Simple test server to verify the feedback endpoints
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());

// Mock authentication middleware
const requireAuth = (req, res, next) => {
  // Mock admin session
  req.session = { adminUsername: 'admin' };
  next();
};

// Function to automatically detect images in a folder
function getImagesFromFolder(folderName) {
  const imagePath = path.join(__dirname, '../frontend/public/images/food/', folderName);
  
  try {
    if (!fs.existsSync(imagePath)) {
      console.log(`📂 Folder not found: ${folderName}`);
      return [];
    }
    
    const files = fs.readdirSync(imagePath);
    const imageFiles = files
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .sort() // Sort alphabetically
      .map(file => `images/food/${folderName}/${file}`);
    
    console.log(`📸 Found ${imageFiles.length} images in ${folderName}:`, imageFiles);
    return imageFiles;
  } catch (error) {
    console.error(`❌ Error reading folder ${folderName}:`, error.message);
    return [];
  }
}

// Function to generate menu items with automatic image detection
function generateMenuItems() {
  const menuTemplates = [
    {
      id: 1,
      name: "Charlie Chan Chicken Pasta",
      description: "Perfectly cooked pasta with chicken, mushrooms and peanuts, coated in a sticky, sweet and spicy sauce with special ingredients. Must try, you will surely love it!",
      folder: "pasta",
      base_price: 199.00,
      variants: [
        { id: 1, menu_item_id: 1, name: "700ml box", price: 199.00 },
        { id: 2, menu_item_id: 1, name: "1000ml box", price: 289.00 },
        { id: 3, menu_item_id: 1, name: "1400ml box", price: 379.00 }
      ]
    },
    {
      id: 2,
      name: "Four Cheese Burger",
      description: "Our signature burger featuring a blend of four premium cheeses, perfectly melted over a juicy patty. A cheese lover's dream!",
      folder: "burgers",
      base_price: 159.00,
      variants: [
        { id: 4, menu_item_id: 2, name: "Single Patty", price: 159.00 },
        { id: 5, menu_item_id: 2, name: "Double Patty", price: 199.00 }
      ]
    },
    {
      id: 3,
      name: "Spicy Bulgogi",
      description: "Korean-inspired bulgogi beef with a spicy kick, topped with our signature three-cheese blend for the ultimate flavor experience.",
      folder: "bulgogi",
      base_price: 159.00,
      variants: [
        { id: 6, menu_item_id: 3, name: "Single Patty", price: 159.00 },
        { id: 7, menu_item_id: 3, name: "Double Patty", price: 199.00 }
      ]
    }
  ];

  return menuTemplates.map(template => {
    const images = getImagesFromFolder(template.folder);
    return {
      ...template,
      image_url: images[0] || `images/food/${template.folder}/placeholder.jpg`, // Primary image
      images: images.length > 0 ? images : [`images/food/${template.folder}/placeholder.jpg`]
    };
  });
}

// Generate menu items with automatic image detection
let mockMenuItems = generateMenuItems();

// Mock data
const mockFeedback = [
  {
    id: 1,
    order_id: 1,
    customer_name: 'John Doe',
    phone: '1234567890',
    rating: 5,
    comment: 'Excellent food and service!',
    status: 'approved',
    created_at: '2025-01-12 10:00:00',
    moderated_at: '2025-01-12 11:00:00',
    moderated_by: 'admin',
    order_customer_name: 'John Doe',
    total_price: 25.50
  },
  {
    id: 2,
    order_id: 2,
    customer_name: 'Jane Smith',
    phone: '0987654321',
    rating: 4,
    comment: 'Good food, delivery was a bit late.',
    status: 'pending',
    created_at: '2025-01-12 12:00:00',
    moderated_at: null,
    moderated_by: null,
    order_customer_name: 'Jane Smith',
    total_price: 18.75
  }
];

const mockStats = {
  total_feedback: 2,
  pending_count: 1,
  approved_count: 1,
  rejected_count: 0,
  average_rating: 4.5,
  five_star: 1,
  four_star: 1,
  three_star: 0,
  two_star: 0,
  one_star: 0
};

// GET /api/menu - Helen's Kitchen menu endpoint with dynamic image detection
app.get("/api/menu", (req, res) => {
  console.log('📋 Menu requested - scanning for new images...');
  
  // Regenerate menu items with fresh image detection
  mockMenuItems = generateMenuItems();
  
  res.json(mockMenuItems);
});

// GET /api/admin/feedback - Get all feedback with filtering
app.get("/api/admin/feedback", requireAuth, (req, res) => {
  let filteredFeedback = [...mockFeedback];
  
  if (req.query.status) {
    filteredFeedback = filteredFeedback.filter(f => f.status === req.query.status);
  }
  
  if (req.query.rating) {
    filteredFeedback = filteredFeedback.filter(f => f.rating == req.query.rating);
  }
  
  res.json(filteredFeedback);
});

// GET /api/admin/feedback/stats - Get feedback statistics
app.get("/api/admin/feedback/stats", requireAuth, (req, res) => {
  res.json(mockStats);
});

// PUT /api/admin/feedback/:id/status - Update feedback status
app.put("/api/admin/feedback/:id/status", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  
  const feedback = mockFeedback.find(f => f.id === id);
  if (!feedback) {
    return res.status(404).json({ error: "Feedback not found" });
  }
  
  // Update mock data
  feedback.status = status;
  feedback.moderated_at = new Date().toISOString();
  feedback.moderated_by = 'admin';
  
  res.json({ message: "Feedback status updated" });
});

// DELETE /api/admin/feedback/:id - Delete feedback
app.delete("/api/admin/feedback/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const index = mockFeedback.findIndex(f => f.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: "Feedback not found" });
  }
  
  mockFeedback.splice(index, 1);
  res.json({ message: "Feedback deleted" });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Test server running' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🍽️  Helen's Kitchen Test Server running on port ${PORT}`);
  console.log('🎉 Available endpoints:');
  console.log('   📋 GET /api/menu                    - Helen\'s Kitchen Menu');
  console.log('   💬 GET /api/admin/feedback          - Get feedback');
  console.log('   📊 GET /api/admin/feedback/stats    - Feedback statistics');
  console.log('   ✏️  PUT /api/admin/feedback/:id/status - Update feedback status');
  console.log('   🗑️  DELETE /api/admin/feedback/:id     - Delete feedback');
  console.log('   ❤️  GET /health                      - Health check');
  console.log('');
  console.log('🍔 Menu Items Available:');
  mockMenuItems.forEach(item => {
    console.log(`   • ${item.name} - ₱${item.base_price} (${item.variants.length} variants)`);
  });
});