require('dotenv').config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// Import MongoDB models
const {
  connectToMongoDB,
  MenuItem,
  MenuVariant,
  Order,
  AdminUser,
  AdminRole,
  AdminPermission,
  AdminRolePermission,
  Expense,
  Feedback,
  AnalyticsSession,
  AnalyticsPageView,
  AnalyticsEvent,
  Ingredient,
  MenuItemIngredient,
  StockMovement,
  PushSubscription,
  BusinessAvailability
} = require('./models');

// Import web-push for notifications
const webpush = require('web-push');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save to frontend public folder for persistence across deployments
    const uploadDir = path.join(__dirname, '../frontend/public/images/food/uploads');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'menu-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const corsOptions = {
  origin: [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://192.168.100.39:4200',
    'http://192.168.100.39:4201',
    'http://192.168.68.115:4200',
    'http://192.168.68.115:4201',
    'https://helens-kitchen.netlify.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

app.use(session({
  secret: process.env.SESSION_SECRET || "helens_kitchen_secret_2024",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static files
app.use('/images', express.static(path.join(__dirname, '../frontend/public/images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'helens_kitchen_jwt_secret_2024';

// Web Push Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BAWpbBfOskTCAe68py4ggqmO4aotWkPgGn-yNrM6jJjbBj_5ipTFytgWtOalI8XgDJwGBnxeDL8q0d_3LAbKDpw';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'zzt-WUL3-pm-ShUPJWInhWmPPKGPR4OFOVQNVO7JaPI';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@helenskitchen.ph';

// Configure web-push
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Initialize database connection and server
async function initServer() {
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // JWT token verification middleware
    function verifyToken(req, res, next) {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
      }
    }

    // Permission-based authorization middleware
    function requirePermission(permission) {
      return (req, res, next) => {
        // First check if user is authenticated (JWT token)
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return res.status(401).json({ error: "Authentication required" });
        }
        
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          
          // Check if user has required permission
          if (decoded.permissions && decoded.permissions.includes(permission)) {
            req.adminUser = decoded;
            next();
          } else {
            return res.status(403).json({ 
              error: "Insufficient permissions", 
              required: permission,
              userPermissions: decoded.permissions || []
            });
          }
        } catch (error) {
          return res.status(401).json({ error: "Invalid token" });
        }
      };
    }

    // GET /api/menu
    app.get("/api/menu", async (req, res) => {
      try {
        const menuItems = await MenuItem.find();
        const variants = await MenuVariant.find();
        
        // Combine menu items with their variants
        const menuWithVariants = menuItems.map(item => ({
          id: item._id,
          name: item.name,
          description: item.description,
          image_url: item.image_url,
          images: item.images,
          base_price: item.base_price,
          variants: variants.filter(v => v.menu_item_id.toString() === item._id.toString()).map(v => ({
            id: v._id,
            menu_item_id: v.menu_item_id,
            name: v.name,
            price: v.price
          }))
        }));
        
        res.json(menuWithVariants);
      } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/feedback/approved - Get approved customer feedback for public display
    app.get("/api/feedback/approved", async (req, res) => {
      try {
        const { minRating = 4, limit = 20 } = req.query;
        
        // Only fetch approved feedback with high ratings for public display
        const feedback = await Feedback.find({
          status: 'approved',
          rating: { $gte: parseInt(minRating) }
        })
        .populate('order_id', 'customer_name')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

        // Format for public display (anonymize customer data)
        const publicFeedback = feedback.map(fb => ({
          id: fb._id,
          rating: fb.rating,
          comment: fb.comment,
          customer_name: fb.customer_name ? 
            `${fb.customer_name.split(' ')[0]} ${fb.customer_name.split(' ').slice(-1)[0]?.charAt(0)}.` :
            'Anonymous Customer',
          created_at: fb.createdAt,
          days_ago: Math.floor((new Date() - new Date(fb.createdAt)) / (1000 * 60 * 60 * 24))
        }));

        res.json(publicFeedback);
      } catch (error) {
        console.error('Error fetching approved feedback:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/feedback/stats - Get feedback statistics for public display
    app.get("/api/feedback/stats", async (req, res) => {
      try {
        const stats = await Feedback.aggregate([
          {
            $match: { status: 'approved' }
          },
          {
            $group: {
              _id: null,
              total_reviews: { $sum: 1 },
              average_rating: { $avg: "$rating" },
              five_star: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
              four_star: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } }
            }
          }
        ]);

        const result = stats[0] || {
          total_reviews: 0,
          average_rating: 0,
          five_star: 0,
          four_star: 0
        };

        // Round average rating to 1 decimal place
        result.average_rating = Math.round(result.average_rating * 10) / 10;

        res.json(result);
      } catch (error) {
        console.error('Error fetching feedback stats:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // ========== ADMIN MENU MANAGEMENT ENDPOINTS ==========

    // GET /api/admin/menu - Get all menu items for admin management
    app.get("/api/admin/menu", requirePermission('menu.view'), async (req, res) => {
      try {
        const menuItems = await MenuItem.find().sort({ name: 1 });
        const variants = await MenuVariant.find().populate('menu_item_id', 'name');
        
        // Combine menu items with their variants for admin view
        const menuWithVariants = menuItems.map(item => ({
          id: item._id,
          name: item.name,
          description: item.description,
          image_url: item.image_url,
          images: item.images || [],
          base_price: item.base_price,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
          variants: variants.filter(v => v.menu_item_id._id.toString() === item._id.toString()).map(v => ({
            id: v._id,
            menu_item_id: v.menu_item_id._id,
            name: v.name,
            price: v.price,
            created_at: v.createdAt,
            updated_at: v.updatedAt
          }))
        }));
        
        res.json(menuWithVariants);
      } catch (error) {
        console.error('Error fetching admin menu:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/admin/menu - Create new menu item
    app.post("/api/admin/menu", requirePermission('menu.create'), async (req, res) => {
      try {
        const { name, description, image_url, images, base_price } = req.body;
        
        if (!name || !description || !base_price) {
          return res.status(400).json({ error: "Name, description, and base price are required" });
        }

        const menuItem = await MenuItem.create({
          name,
          description,
          image_url: image_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMkQyRDJEIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1lbnUgSXRlbTwvdGV4dD48L3N2Zz4=',
          images: images || [],
          base_price
        });

        console.log(`Menu item created: ${menuItem.name} (${menuItem._id})`);
        res.status(201).json({
          id: menuItem._id,
          name: menuItem.name,
          description: menuItem.description,
          image_url: menuItem.image_url,
          images: menuItem.images,
          base_price: menuItem.base_price,
          created_at: menuItem.createdAt,
          updated_at: menuItem.updatedAt,
          variants: []
        });
      } catch (error) {
        console.error('Error creating menu item:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/menu/:id - Update menu item
    app.put("/api/admin/menu/:id", requirePermission('menu.update'), async (req, res) => {
      try {
        const { id } = req.params;
        const { name, description, image_url, images, base_price } = req.body;
        
        if (!name || !description || !base_price) {
          return res.status(400).json({ error: "Name, description, and base price are required" });
        }

        const menuItem = await MenuItem.findByIdAndUpdate(
          id,
          {
            name,
            description,
            image_url,
            images,
            base_price
          },
          { new: true }
        );

        if (!menuItem) {
          return res.status(404).json({ error: "Menu item not found" });
        }

        // Get variants for the updated item
        const variants = await MenuVariant.find({ menu_item_id: id });

        console.log(`Menu item updated: ${menuItem.name} (${menuItem._id})`);
        res.json({
          id: menuItem._id,
          name: menuItem.name,
          description: menuItem.description,
          image_url: menuItem.image_url,
          images: menuItem.images,
          base_price: menuItem.base_price,
          created_at: menuItem.createdAt,
          updated_at: menuItem.updatedAt,
          variants: variants.map(v => ({
            id: v._id,
            menu_item_id: v.menu_item_id,
            name: v.name,
            price: v.price,
            created_at: v.createdAt,
            updated_at: v.updatedAt
          }))
        });
      } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // DELETE /api/admin/menu/:id - Delete menu item
    app.delete("/api/admin/menu/:id", requirePermission('menu.delete'), async (req, res) => {
      try {
        const { id } = req.params;

        // Check if menu item exists
        const menuItem = await MenuItem.findById(id);
        if (!menuItem) {
          return res.status(404).json({ error: "Menu item not found" });
        }

        // Check if menu item is used in any orders
        const ordersWithItem = await Order.findOne({ 'items.menu_item_id': id });
        if (ordersWithItem) {
          return res.status(400).json({ 
            error: "Cannot delete menu item that has been ordered. Consider deactivating instead." 
          });
        }

        // Delete all variants first
        await MenuVariant.deleteMany({ menu_item_id: id });
        
        // Delete the menu item
        await MenuItem.findByIdAndDelete(id);

        console.log(`Menu item deleted: ${menuItem.name} (${id})`);
        res.json({ 
          message: "Menu item and its variants deleted successfully",
          deletedItem: {
            id: menuItem._id,
            name: menuItem.name
          }
        });
      } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/admin/menu/:id/variants - Create variant for menu item
    app.post("/api/admin/menu/:id/variants", requirePermission('menu.create'), async (req, res) => {
      try {
        const { id } = req.params;
        const { name, price } = req.body;
        
        if (!name || !price) {
          return res.status(400).json({ error: "Variant name and price are required" });
        }

        // Verify menu item exists
        const menuItem = await MenuItem.findById(id);
        if (!menuItem) {
          return res.status(404).json({ error: "Menu item not found" });
        }

        const variant = await MenuVariant.create({
          menu_item_id: id,
          name,
          price
        });

        console.log(`Variant created: ${variant.name} for ${menuItem.name}`);
        res.status(201).json({
          id: variant._id,
          menu_item_id: variant.menu_item_id,
          name: variant.name,
          price: variant.price,
          created_at: variant.createdAt,
          updated_at: variant.updatedAt
        });
      } catch (error) {
        console.error('Error creating variant:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/menu/variants/:id - Update variant
    app.put("/api/admin/menu/variants/:id", requirePermission('menu.update'), async (req, res) => {
      try {
        const { id } = req.params;
        const { name, price } = req.body;
        
        if (!name || !price) {
          return res.status(400).json({ error: "Variant name and price are required" });
        }

        const variant = await MenuVariant.findByIdAndUpdate(
          id,
          { name, price },
          { new: true }
        );

        if (!variant) {
          return res.status(404).json({ error: "Variant not found" });
        }

        console.log(`Variant updated: ${variant.name} (${variant._id})`);
        res.json({
          id: variant._id,
          menu_item_id: variant.menu_item_id,
          name: variant.name,
          price: variant.price,
          created_at: variant.createdAt,
          updated_at: variant.updatedAt
        });
      } catch (error) {
        console.error('Error updating variant:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // DELETE /api/admin/menu/variants/:id - Delete variant
    app.delete("/api/admin/menu/variants/:id", requirePermission('menu.delete'), async (req, res) => {
      try {
        const { id } = req.params;

        // Check if variant exists
        const variant = await MenuVariant.findById(id);
        if (!variant) {
          return res.status(404).json({ error: "Variant not found" });
        }

        // Check if variant is used in any orders
        const ordersWithVariant = await Order.findOne({ 'items.variant_name': variant.name });
        if (ordersWithVariant) {
          return res.status(400).json({ 
            error: "Cannot delete variant that has been ordered." 
          });
        }

        await MenuVariant.findByIdAndDelete(id);

        console.log(`Variant deleted: ${variant.name} (${id})`);
        res.json({ 
          message: "Variant deleted successfully",
          deletedVariant: {
            id: variant._id,
            name: variant.name
          }
        });
      } catch (error) {
        console.error('Error deleting variant:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/admin/menu/upload-image - Upload menu item image
    app.post("/api/admin/menu/upload-image", requirePermission('menu.create'), upload.single('image'), (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image file provided" });
        }

        // Return relative path for the uploaded image (to match existing static images)
        const imageUrl = `images/food/uploads/${req.file.filename}`;
        
        console.log(`Image uploaded: ${req.file.filename} -> ${imageUrl}`);
        res.json({
          message: "Image uploaded successfully",
          imageUrl: imageUrl,
          filename: req.file.filename
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: "Upload error" });
      }
    });

    // DELETE /api/admin/menu/delete-image/:filename - Delete menu item image
    app.delete("/api/admin/menu/delete-image/:filename", requirePermission('menu.delete'), (req, res) => {
      try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '../frontend/public/images/food/uploads', filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "Image file not found" });
        }

        // Delete the file
        fs.unlinkSync(filePath);
        
        console.log(`Image deleted: ${filename}`);
        res.json({ message: "Image deleted successfully" });
      } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ error: "Delete error" });
      }
    });

    // ========== MENU ITEM INGREDIENTS ENDPOINTS ==========

    // GET /api/admin/ingredients/list - Get ingredients list for dropdown
    app.get("/api/admin/ingredients/list", requirePermission('inventory.view'), async (req, res) => {
      try {
        const ingredients = await Ingredient.find({}, 'name unit _id').sort({ name: 1 });
        
        const formattedIngredients = ingredients.map(ingredient => ({
          id: ingredient._id,
          name: ingredient.name,
          unit: ingredient.unit
        }));

        res.json(formattedIngredients);
      } catch (error) {
        console.error('Error fetching ingredients list:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/menu/:id/ingredients - Get ingredients for a menu item
    app.get("/api/admin/menu/:id/ingredients", requirePermission('menu.view'), async (req, res) => {
      try {
        const { id } = req.params;

        const menuItemIngredients = await MenuItemIngredient.find({ menu_item_id: id })
          .populate('ingredient_id', 'name unit')
          .populate('menu_variant_id', 'name');

        const formattedIngredients = menuItemIngredients.map(item => ({
          id: item._id,
          ingredient_id: item.ingredient_id._id,
          ingredient_name: item.ingredient_id.name,
          ingredient_unit: item.ingredient_id.unit,
          menu_variant_id: item.menu_variant_id?._id,
          menu_variant_name: item.menu_variant_id?.name,
          quantity_needed: item.quantity_needed,
          created_at: item.createdAt
        }));

        res.json(formattedIngredients);
      } catch (error) {
        console.error('Error fetching menu item ingredients:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/admin/menu/:id/ingredients - Add ingredients to menu item
    app.post("/api/admin/menu/:id/ingredients", requirePermission('menu.update'), async (req, res) => {
      try {
        const { id } = req.params;
        const { ingredients } = req.body; // Array of {ingredient_id, menu_variant_id, quantity_needed}

        if (!ingredients || !Array.isArray(ingredients)) {
          return res.status(400).json({ error: "Ingredients array is required" });
        }

        // Verify menu item exists
        const menuItem = await MenuItem.findById(id);
        if (!menuItem) {
          return res.status(404).json({ error: "Menu item not found" });
        }

        // Clear existing ingredients for this menu item
        await MenuItemIngredient.deleteMany({ menu_item_id: id });

        // Add new ingredients
        const menuItemIngredients = [];
        for (const ing of ingredients) {
          if (!ing.ingredient_id || !ing.quantity_needed) {
            continue; // Skip invalid entries
          }

          const menuItemIngredient = await MenuItemIngredient.create({
            menu_item_id: id,
            ingredient_id: ing.ingredient_id,
            menu_variant_id: ing.menu_variant_id || null,
            quantity_needed: ing.quantity_needed
          });

          menuItemIngredients.push(menuItemIngredient);
        }

        console.log(`Updated ingredients for menu item: ${menuItem.name}`);
        res.json({ 
          message: "Menu item ingredients updated successfully",
          count: menuItemIngredients.length
        });
      } catch (error) {
        console.error('Error updating menu item ingredients:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // DELETE /api/admin/menu/:id/ingredients - Remove all ingredients from menu item
    app.delete("/api/admin/menu/:id/ingredients", requirePermission('menu.update'), async (req, res) => {
      try {
        const { id } = req.params;

        // Verify menu item exists
        const menuItem = await MenuItem.findById(id);
        if (!menuItem) {
          return res.status(404).json({ error: "Menu item not found" });
        }

        const result = await MenuItemIngredient.deleteMany({ menu_item_id: id });

        console.log(`Removed ${result.deletedCount} ingredients from menu item: ${menuItem.name}`);
        res.json({ 
          message: "All ingredients removed from menu item successfully",
          deletedCount: result.deletedCount
        });
      } catch (error) {
        console.error('Error removing menu item ingredients:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/payment-instructions/:orderId
    app.get("/api/payment-instructions/:orderId", async (req, res) => {
      try {
        const { orderId } = req.params;
        
        // Verify the order exists and get the payment method
        const order = await Order.findById(orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }

        // Get secure payment instructions based on payment method
        const paymentInstructions = {
          'GCash': {
            method: 'GCash',
            account_name: 'Helen\'s Kitchen',
            account_number: process.env.GCASH_NUMBER || '09171234567',
            instructions: `Send payment to the GCash number above. Use "Order #${orderId.slice(-6)}" as your reference message.`,
            steps: [
              'Open your GCash app',
              'Select "Send Money"',
              `Enter the GCash number: ${process.env.GCASH_NUMBER || '09171234567'}`,
              `Amount: ₱${order.total_price}`,
              `Reference: Order #${orderId.slice(-6)}`,
              'Complete the transaction',
              'Take a screenshot of the receipt for verification'
            ]
          },
          'Bank Transfer': {
            method: 'Bank Transfer',
            bank_name: 'BPI (Bank of the Philippine Islands)',
            account_name: 'Helen\'s Kitchen',
            account_number: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
            instructions: `Transfer the exact amount to the bank account above. Use "Order #${orderId.slice(-6)}" as your reference.`,
            steps: [
              'Log in to your online banking or visit the bank',
              'Select "Transfer Funds" or "Send Money"',
              `Bank: BPI (Bank of the Philippine Islands)`,
              `Account Number: ${process.env.BANK_ACCOUNT_NUMBER || '1234567890'}`,
              `Account Name: Helen's Kitchen`,
              `Amount: ₱${order.total_price}`,
              `Reference: Order #${orderId.slice(-6)}`,
              'Complete the transfer',
              'Keep the transaction receipt for verification'
            ]
          }
        };

        const paymentMethod = order.payment_method;
        const instructions = paymentInstructions[paymentMethod];

        if (!instructions) {
          return res.status(400).json({ error: "Invalid payment method" });
        }

        res.json({
          order_id: orderId,
          payment_method: paymentMethod,
          total_amount: order.total_price,
          ...instructions
        });

      } catch (error) {
        console.error('Error getting payment instructions:', error);
        res.status(500).json({ error: "Failed to get payment instructions" });
      }
    });

    // GET /api/search-address - Proxy for OpenStreetMap Nominatim to avoid CORS issues
    app.get("/api/search-address", async (req, res) => {
      try {
        const { q, limit = 5 } = req.query;
        
        if (!q) {
          return res.status(400).json({ error: "Search query is required" });
        }

        // Make request to OpenStreetMap Nominatim API
        const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
        nominatimUrl.searchParams.set('format', 'json');
        nominatimUrl.searchParams.set('q', q);
        nominatimUrl.searchParams.set('countrycodes', 'ph');
        nominatimUrl.searchParams.set('limit', limit.toString());
        nominatimUrl.searchParams.set('addressdetails', '1');

        const response = await fetch(nominatimUrl.toString(), {
          headers: {
            'User-Agent': 'HelensKitchen/1.0 (helen@helenskitchen.ph)'
          }
        });

        if (!response.ok) {
          throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Transform the response to match our frontend expectations
        const results = data.map(item => ({
          display_name: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          place_id: item.place_id,
          type: item.type,
          importance: item.importance
        }));

        res.json(results);

      } catch (error) {
        console.error('Error searching address:', error);
        res.status(500).json({ error: "Failed to search address" });
      }
    });

    // GET /api/reverse-geocode - Proxy for OpenStreetMap reverse geocoding
    app.get("/api/reverse-geocode", async (req, res) => {
      try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
          return res.status(400).json({ error: "Latitude and longitude are required" });
        }

        // Make request to OpenStreetMap Nominatim API
        const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
        nominatimUrl.searchParams.set('format', 'json');
        nominatimUrl.searchParams.set('lat', lat.toString());
        nominatimUrl.searchParams.set('lon', lon.toString());

        const response = await fetch(nominatimUrl.toString(), {
          headers: {
            'User-Agent': 'HelensKitchen/1.0 (helen@helenskitchen.ph)'
          }
        });

        if (!response.ok) {
          throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);

      } catch (error) {
        console.error('Error reverse geocoding:', error);
        res.status(500).json({ error: "Failed to reverse geocode" });
      }
    });

    // POST /api/admin/login
    app.post("/api/admin/login", async (req, res) => {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      try {
        // Find user with role information
        const user = await AdminUser.findOne({ username, is_active: true }).populate('role_id');
        
        if (!user) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        // Get user permissions
        const rolePermissions = await AdminRolePermission.find({ role_id: user.role_id._id }).populate('permission_id');
        const permissions = rolePermissions.map(rp => rp.permission_id.name);

        // Update last login
        await AdminUser.findByIdAndUpdate(user._id, { last_login: new Date() });

        // Create JWT token
        const token = jwt.sign({
          userId: user._id,
          username: user.username,
          role: user.role_id.name,
          permissions: permissions
        }, JWT_SECRET, { expiresIn: '24h' });

        console.log('JWT token created for user:', user.username);

        res.json({ 
          message: "Login successful",
          token: token,
          admin: { 
            id: user._id, 
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role_id.name,
            role_description: user.role_id.description,
            permissions: permissions,
            last_login: user.last_login
          } 
        });
        
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: "Login error" });
      }
    });

    // GET /api/admin/verify - Verify JWT token
    app.get("/api/admin/verify", verifyToken, async (req, res) => {
      try {
        // Find user with role information
        const user = await AdminUser.findById(req.user.userId).populate('role_id');
        
        if (!user || !user.is_active) {
          return res.status(401).json({ authenticated: false, error: "User not found or inactive" });
        }

        // Get user permissions
        const rolePermissions = await AdminRolePermission.find({ role_id: user.role_id._id }).populate('permission_id');
        const permissions = rolePermissions.map(rp => rp.permission_id.name);

        res.json({
          authenticated: true,
          admin: {
            id: user._id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role_id.name,
            role_description: user.role_id.description,
            permissions: permissions,
            last_login: user.last_login
          }
        });
      } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ authenticated: false, error: "Token verification failed" });
      }
    });

    // GET /api/admin/orders
    app.get("/api/admin/orders", requirePermission('orders.view'), async (req, res) => {
      try {
        const filter = {};
        
        if (req.query.status) {
          filter.status = req.query.status;
        }
        
        if (req.query.payment_status) {
          filter.payment_status = req.query.payment_status;
        }

        const orders = await Order.find(filter).sort({ createdAt: -1 });
        
        // Convert MongoDB documents to the expected format
        const formattedOrders = orders.map(order => ({
          id: order._id,
          customer_name: order.customer_name,
          phone: order.phone,
          delivery_option: order.delivery_option,
          address: order.address,
          plus_code: order.plus_code || null,
          payment_method: order.payment_method,
          total_price: order.total_price,
          delivery_fee: order.delivery_fee,
          delivery_fee_status: order.delivery_fee_status,
          status: order.status,
          payment_status: order.payment_status,
          requested_delivery: order.requested_delivery,
          created_at: order.createdAt
        }));
        
        res.json(formattedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/orders/:id/status
    app.put("/api/admin/orders/:id/status", requirePermission('orders.update'), async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const validStatuses = ["New", "Processing", "Delivered", "Cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      try {
        console.log(`Updating order ${id} status to ${status}`);
        
        const updatedOrder = await Order.findByIdAndUpdate(
          id, 
          { status }, 
          { new: true }
        );
        
        if (!updatedOrder) {
          console.log(`No order found for ID ${id}`);
          return res.status(404).json({ error: "Order not found" });
        }
        
        console.log(`Order status updated successfully for order ${id}`);
        res.json({ message: "Order status updated" });
      } catch (error) {
        console.error('Database error updating order status:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/orders/:id/payment-status
    app.put("/api/admin/orders/:id/payment-status", requirePermission('orders.update'), async (req, res) => {
      const { id } = req.params;
      const { payment_status } = req.body;
      
      if (!payment_status) {
        return res.status(400).json({ error: "Payment status is required" });
      }

      const validStatuses = ["Pending", "Confirmed"];
      if (!validStatuses.includes(payment_status)) {
        return res.status(400).json({ error: "Invalid payment status value" });
      }

      try {
        console.log(`Updating order ${id} payment status to ${payment_status}`);
        
        const updatedOrder = await Order.findByIdAndUpdate(
          id, 
          { payment_status }, 
          { new: true }
        );
        
        if (!updatedOrder) {
          console.log(`No order found for ID ${id}`);
          return res.status(404).json({ error: "Order not found" });
        }
        
        console.log(`Payment status updated successfully for order ${id}`);
        res.json({ message: "Payment status updated" });
      } catch (error) {
        console.error('Database error updating payment status:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/orders/:id/delivery-fee - Set delivery fee for an order
    app.put("/api/admin/orders/:id/delivery-fee", requirePermission('orders.update'), async (req, res) => {
      const { id } = req.params;
      const { delivery_fee } = req.body;
      
      if (delivery_fee === undefined || delivery_fee === null) {
        return res.status(400).json({ error: "Delivery fee is required" });
      }

      if (typeof delivery_fee !== 'number' || delivery_fee < 0) {
        return res.status(400).json({ error: "Delivery fee must be a non-negative number" });
      }

      try {
        console.log(`Setting delivery fee for order ${id} to ₱${delivery_fee}`);
        
        const updatedOrder = await Order.findByIdAndUpdate(
          id, 
          { 
            delivery_fee,
            delivery_fee_status: 'set',
            total_price: await calculateNewTotalPrice(id, delivery_fee)
          }, 
          { new: true }
        );
        
        if (!updatedOrder) {
          console.log(`No order found for ID ${id}`);
          return res.status(404).json({ error: "Order not found" });
        }
        
        console.log(`Delivery fee set successfully for order ${id}: ₱${delivery_fee}`);
        res.json({ 
          message: "Delivery fee set successfully",
          delivery_fee: delivery_fee,
          new_total: updatedOrder.total_price
        });
      } catch (error) {
        console.error('Database error setting delivery fee:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // Helper function to calculate new total price with delivery fee
    async function calculateNewTotalPrice(orderId, deliveryFee) {
      try {
        const order = await Order.findById(orderId);
        if (!order) return 0;
        
        // Calculate food total from items
        const foodTotal = order.items.reduce((total, item) => {
          return total + (item.price * item.quantity);
        }, 0);
        
        return foodTotal + deliveryFee;
      } catch (error) {
        console.error('Error calculating new total price:', error);
        return 0;
      }
    }

    // PUT /api/admin/orders/:id/delivery-date
    app.put("/api/admin/orders/:id/delivery-date", requirePermission('orders.update'), async (req, res) => {
      const { id } = req.params;
      const { requested_delivery } = req.body;
      
      if (!requested_delivery) {
        return res.status(400).json({ error: "Delivery date is required" });
      }

      try {
        const newDeliveryDate = new Date(requested_delivery);
        const now = new Date();
        const hoursDifference = (newDeliveryDate - now) / (1000 * 60 * 60);

        // Validate 24-hour advance notice rule
        if (hoursDifference < 24) {
          return res.status(400).json({ 
            error: "Delivery date must be at least 24 hours from now" 
          });
        }

        console.log(`Updating order ${id} delivery date to ${requested_delivery}`);
        
        const updatedOrder = await Order.findByIdAndUpdate(
          id, 
          { requested_delivery: newDeliveryDate }, 
          { new: true }
        );
        
        if (!updatedOrder) {
          console.log(`No order found for ID ${id}`);
          return res.status(404).json({ error: "Order not found" });
        }
        
        console.log(`Delivery date updated successfully for order ${id}`);
        res.json({ 
          message: "Delivery date updated",
          requested_delivery: updatedOrder.requested_delivery
        });
      } catch (error) {
        console.error('Database error updating delivery date:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/orders/unread-count - Get count of unread orders for badge
    app.get("/api/admin/orders/unread-count", requirePermission('orders.view'), async (req, res) => {
      try {
        console.log('Getting unread count for admin notifications...');
        
        // Check if Order model is available
        if (!Order) {
          console.error('Order model is not available');
          return res.status(500).json({ error: "Order model not available" });
        }

        // Count orders with status 'New' as unread
        const unreadCount = await Order.countDocuments({ 
          status: 'New',
          payment_status: 'Pending' 
        });

        console.log(`Found ${unreadCount} unread orders`);
        res.json({ count: unreadCount });
      } catch (error) {
        console.error('Error getting unread count:', error);
        console.error('Error details:', error.stack);
        
        // Return a fallback count of 0 instead of throwing an error
        console.log('Returning fallback count of 0 due to error');
        res.json({ count: 0, warning: 'Could not fetch accurate count' });
      }
    });

    // GET /api/admin/orders/:id - Get detailed order information for admin
    app.get("/api/admin/orders/:id", requirePermission('orders.view'), async (req, res) => {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      try {
        console.log(`Fetching detailed order ${id} for admin`);
        
        const order = await Order.findById(id).populate('items.menu_item_id');
        
        if (order) {
          console.log('Raw order from database:', {
            id: order._id,
            delivery_option: order.delivery_option,
            delivery_fee: order.delivery_fee,
            delivery_fee_status: order.delivery_fee_status,
            total_price: order.total_price
          });
        }
        
        if (!order) {
          console.log(`No order found for ID ${id}`);
          return res.status(404).json({ error: "Order not found" });
        }

        // Process order items with menu details
        const itemsWithDetails = await Promise.all(order.items.map(async (item) => {
          // Handle cases where menu_item_id might not be populated (legacy orders)
          if (item.menu_item_id && item.menu_item_id._id) {
            return {
              menu_item_id: item.menu_item_id._id,
              name: item.menu_item_id.name,
              description: item.menu_item_id.description,
              image_url: item.menu_item_id.image_url,
              variant_name: item.variant_name,
              quantity: item.quantity,
              price: item.price
            };
          } else {
            // Fallback for legacy orders - try to find the menu item by variant name
            try {
              const variant = await MenuVariant.findOne({ 
                name: item.variant_name 
              }).populate('menu_item_id');
              
              if (variant && variant.menu_item_id) {
                return {
                  menu_item_id: variant.menu_item_id._id,
                  name: variant.menu_item_id.name,
                  description: variant.menu_item_id.description,
                  image_url: variant.menu_item_id.image_url,
                  variant_name: item.variant_name,
                  quantity: item.quantity,
                  price: item.price
                };
              }
            } catch (error) {
              console.error('Error looking up variant:', error);
            }
            
            // Final fallback if variant lookup fails
            return {
              menu_item_id: null,
              name: item.variant_name || 'Menu Item',
              description: 'Legacy order item',
              image_url: 'https://via.placeholder.com/150x150/2D2D2D/FFFFFF?text=Food+Item',
              variant_name: item.variant_name,
              quantity: item.quantity,
              price: item.price
            };
          }
        }));
        
        // Determine proper values with better fallback logic
        const deliveryOption = order.delivery_option && order.delivery_option.trim() !== '' 
          ? order.delivery_option 
          : 'delivery';
        
        const deliveryFee = order.delivery_fee || 0;
        
        let deliveryFeeStatus;
        if (order.delivery_fee_status && order.delivery_fee_status.trim() !== '') {
          deliveryFeeStatus = order.delivery_fee_status;
        } else {
          // Determine status based on other factors
          if (deliveryOption === 'pickup') {
            deliveryFeeStatus = 'not_applicable';
          } else if (deliveryFee > 0) {
            deliveryFeeStatus = 'set';
          } else {
            deliveryFeeStatus = 'pending';
          }
        }

        // Format response to match frontend expectations
        const formattedOrder = {
          id: order._id,
          customer_name: order.customer_name,
          phone: order.phone,
          delivery_option: deliveryOption,
          address: order.address,
          plus_code: order.plus_code || null,
          payment_method: order.payment_method,
          total_price: order.total_price,
          delivery_fee: deliveryFee,
          delivery_fee_status: deliveryFeeStatus,
          quotation_id: order.quotation_id,
          status: order.status,
          payment_status: order.payment_status,
          requested_delivery: order.requested_delivery,
          created_at: order.createdAt,
          items: itemsWithDetails
        };
        
        console.log(`Order details found and returned for admin: ${id}`);
        console.log('Formatted order response:', JSON.stringify(formattedOrder, null, 2));
        res.json(formattedOrder);
      } catch (error) {
        console.error('Database error fetching order details:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // DELETE /api/admin/orders/:id - Delete an order
    console.log('📝 Registering DELETE /api/admin/orders/:id endpoint');
    app.delete("/api/admin/orders/:id", requirePermission('orders.update'), async (req, res) => {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      try {
        console.log(`Attempting to delete order ${id}`);
        
        const order = await Order.findById(id);
        
        if (!order) {
          console.log(`No order found for ID ${id}`);
          return res.status(404).json({ error: "Order not found" });
        }

        // Delete the order
        await Order.findByIdAndDelete(id);
        
        console.log(`Order ${id} deleted successfully`);
        res.json({ 
          message: "Order deleted successfully",
          deletedOrder: {
            id: order._id,
            customer_name: order.customer_name,
            total_price: order.total_price
          }
        });
      } catch (error) {
        console.error('Database error deleting order:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // ============================================
    // BUSINESS AVAILABILITY MANAGEMENT ENDPOINTS
    // ============================================

    // Get all availability restrictions
    app.get("/api/admin/availability", requirePermission('orders.view'), async (req, res) => {
      try {
        const { start_date, end_date } = req.query;
        
        let query = { is_active: true };
        
        // Filter by date range if provided (using Philippine timezone)
        if (start_date && end_date) {
          query.date = {
            $gte: new Date(start_date + 'T00:00:00+08:00'),
            $lte: new Date(end_date + 'T23:59:59+08:00')
          };
        }
        
        const availabilities = await BusinessAvailability.find(query)
          .sort({ date: 1 })
          .populate('admin_id', 'username full_name');
        
        res.json(availabilities);
      } catch (error) {
        console.error('Error fetching availability restrictions:', error);
        res.status(500).json({ error: "Failed to fetch availability restrictions" });
      }
    });

    // Create new availability restriction
    app.post("/api/admin/availability", requirePermission('orders.update'), async (req, res) => {
      try {
        const { date, is_full_day, unavailable_time_slots, reason } = req.body;
        
        if (!date) {
          return res.status(400).json({ error: "Date is required" });
        }
        
        // Create date in Philippine timezone to avoid timezone conversion issues
        const philippineDate = new Date(date + 'T00:00:00+08:00');
        
        // Check if availability restriction already exists for this date
        const existingAvailability = await BusinessAvailability.findOne({
          date: philippineDate,
          is_active: true
        });
        
        if (existingAvailability) {
          return res.status(400).json({ 
            error: "Availability restriction already exists for this date" 
          });
        }
        
        const availability = new BusinessAvailability({
          date: philippineDate,
          is_full_day: is_full_day || false,
          unavailable_time_slots: unavailable_time_slots || [],
          reason: reason || '',
          admin_id: req.adminUser.userId
        });
        
        await availability.save();
        
        const populatedAvailability = await BusinessAvailability.findById(availability._id)
          .populate('admin_id', 'username full_name');
        
        console.log(`Availability restriction created for ${date} by admin ${req.adminUser.userId}`);
        res.status(201).json(populatedAvailability);
      } catch (error) {
        console.error('Error creating availability restriction:', error);
        res.status(500).json({ error: "Failed to create availability restriction" });
      }
    });

    // Update availability restriction
    app.put("/api/admin/availability/:id", requirePermission('orders.update'), async (req, res) => {
      try {
        const { id } = req.params;
        const { date, is_full_day, unavailable_time_slots, reason } = req.body;
        
        // Create date in Philippine timezone to avoid timezone conversion issues
        const philippineDate = new Date(date + 'T00:00:00+08:00');
        
        const availability = await BusinessAvailability.findByIdAndUpdate(
          id,
          {
            date: philippineDate,
            is_full_day: is_full_day || false,
            unavailable_time_slots: unavailable_time_slots || [],
            reason: reason || ''
          },
          { new: true }
        ).populate('admin_id', 'username full_name');
        
        if (!availability) {
          return res.status(404).json({ error: "Availability restriction not found" });
        }
        
        console.log(`Availability restriction ${id} updated by admin ${req.adminUser.userId}`);
        res.json(availability);
      } catch (error) {
        console.error('Error updating availability restriction:', error);
        res.status(500).json({ error: "Failed to update availability restriction" });
      }
    });

    // Delete availability restriction
    app.delete("/api/admin/availability/:id", requirePermission('orders.update'), async (req, res) => {
      try {
        const { id } = req.params;
        
        const availability = await BusinessAvailability.findByIdAndUpdate(
          id,
          { is_active: false },
          { new: true }
        );
        
        if (!availability) {
          return res.status(404).json({ error: "Availability restriction not found" });
        }
        
        console.log(`Availability restriction ${id} deleted by admin ${req.adminUser.userId}`);
        res.json({ message: "Availability restriction deleted successfully" });
      } catch (error) {
        console.error('Error deleting availability restriction:', error);
        res.status(500).json({ error: "Failed to delete availability restriction" });
      }
    });

    // Public endpoint: Check if date/time is available for customers
    app.get("/api/availability/check", async (req, res) => {
      try {
        const { date, time } = req.query;
        
        if (!date) {
          return res.status(400).json({ error: "Date is required" });
        }
        
        const checkDate = new Date(date + 'T00:00:00+08:00');
        
        // Find availability restrictions for the given date
        const availability = await BusinessAvailability.findOne({
          date: checkDate,
          is_active: true
        });
        
        let isAvailable = true;
        let reason = '';
        
        if (availability) {
          if (availability.is_full_day) {
            isAvailable = false;
            reason = availability.reason || 'Business is closed for the day';
          } else if (time && availability.unavailable_time_slots.includes(time)) {
            isAvailable = false;
            reason = availability.reason || 'Business is not available at this time';
          }
        }
        
        res.json({
          date: date,
          time: time,
          is_available: isAvailable,
          reason: reason
        });
      } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ error: "Failed to check availability" });
      }
    });

    // Get available time slots for a specific date
    app.get("/api/availability/time-slots", async (req, res) => {
      try {
        const { date } = req.query;
        
        if (!date) {
          return res.status(400).json({ error: "Date is required" });
        }
        
        const checkDate = new Date(date + 'T00:00:00+08:00');
        
        // Get base time slots (business hours)
        const isWeekend = (checkDate.getDay() === 0 || checkDate.getDay() === 6);
        let baseTimeSlots;
        
        if (isWeekend) {
          // Weekends: 8am to 8pm
          baseTimeSlots = [
            '08:00', '09:00', '10:00', '11:00', '12:00',
            '13:00', '14:00', '15:00', '16:00', '17:00',
            '18:00', '19:00', '20:00'
          ];
        } else {
          // Weekdays: 4pm to 8pm
          baseTimeSlots = ['16:00', '17:00', '18:00', '19:00', '20:00'];
        }
        
        // Check for availability restrictions
        const availability = await BusinessAvailability.findOne({
          date: checkDate,
          is_active: true
        });
        
        let availableSlots = [...baseTimeSlots];
        
        if (availability) {
          if (availability.is_full_day) {
            availableSlots = [];
          } else if (availability.unavailable_time_slots.length > 0) {
            availableSlots = baseTimeSlots.filter(
              slot => !availability.unavailable_time_slots.includes(slot)
            );
          }
        }
        
        res.json({
          date: date,
          available_slots: availableSlots,
          unavailable_reason: availability?.reason || null
        });
      } catch (error) {
        console.error('Error fetching available time slots:', error);
        res.status(500).json({ error: "Failed to fetch available time slots" });
      }
    });

    // Helen's Kitchen location (pickup point)
    const STORE_LOCATION = {
      lat: 15.0394, // San Fernando, Pampanga coordinates
      lng: 120.6897,
      address: "Helen's Kitchen, San Fernando, Pampanga"
    };

    // Calculate distance between two coordinates using Haversine formula
    function calculateDistance(lat1, lng1, lat2, lng2) {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    // Decode Plus Code to coordinates
    function decodePlusCode(plusCode) {
      try {
        console.log(`Attempting to decode plus code: "${plusCode}"`);
        
        // Basic Plus Code decoding algorithm
        // Plus codes use base-20 encoding with specific character set
        const codeAlphabet = '23456789CFGHJMPQRVWX';
        
        // Extract the plus code from the address if it contains one
        const plusCodeMatch = plusCode.match(/([23456789CFGHJMPQRVWX+]{8,})/i);
        console.log(`Plus code regex match:`, plusCodeMatch);
        if (!plusCodeMatch) {
          console.log(`No plus code pattern found in: ${plusCode}`);
          return null;
        }
        
        const code = plusCodeMatch[1].toUpperCase().replace('+', '');
        const originalCode = plusCodeMatch[1].toUpperCase(); // Keep the original with +
        console.log(`Extracted code: "${code}", original: "${originalCode}", length: ${code.length}`);
        if (code.length < 6) { // Changed from 8 to 6 to accommodate shorter codes
          console.log(`Code too short: ${code.length} characters`);
          return null;
        }
        
        // This is a simplified decoder - for production, use Google's official library
        // For now, handle known plus codes manually with verified coordinates
        // Based on 1.9km Google Maps distance, Florida Residences should be very close
        const knownCodes = {
          '3JQG+XH': { lat: 15.0394, lng: 120.6897 }, // Pickup location (Helen's Kitchen)
          '3JW9+QRR': { lat: 15.025, lng: 120.6797 }, // Florida Residences (coordinates for 1.9km Google Maps distance)
        };
        
        // Try different variations of the code
        const variations = [
          originalCode,          // Original match with + (e.g., "3JW9+QRR")
          code,                  // Full code without + (e.g., "3JW9QRR")
          code.substring(0, 7),  // Shorter version (e.g., "3JW9QRR")
          plusCodeMatch[1],      // Original regex match
          plusCodeMatch[1].toUpperCase()  // Original match uppercase
        ];
        
        console.log(`Testing variations:`, variations);
        console.log(`Known codes:`, Object.keys(knownCodes));
        
        for (const variation of variations) {
          console.log(`Testing variation: "${variation}"`);
          if (knownCodes[variation]) {
            console.log(`Found plus code match: ${variation}`);
            return knownCodes[variation];
          }
        }
        
        console.warn(`Plus code ${plusCode} not in known codes database`);
        console.warn(`Available codes:`, Object.keys(knownCodes));
        return null;
      } catch (error) {
        console.error('Error decoding plus code:', error);
        return null;
      }
    }

    // Get coordinates from address using OpenStreetMap Nominatim (free service)
    async function getCoordinatesFromAddress(address, retryCount = 0, maxRetries = 2) {
      // First, try to decode if it's a plus code
      const plusCodeCoords = decodePlusCode(address);
      if (plusCodeCoords) {
        console.log(`Successfully decoded plus code: ${address} -> ${plusCodeCoords.lat}, ${plusCodeCoords.lng}`);
        return {
          lat: plusCodeCoords.lat,
          lng: plusCodeCoords.lng,
          success: true,
          provider: 'PlusCode'
        };
      }
      const providers = [
        {
          name: 'OpenStreetMap',
          url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=ph&limit=1`,
          parse: (data) => data && data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null
        },
        {
          name: 'Photon',
          url: `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`,
          parse: (data) => data && data.features && data.features.length > 0 ? 
            { lat: data.features[0].geometry.coordinates[1], lng: data.features[0].geometry.coordinates[0] } : null
        }
      ];

      for (const provider of providers) {
        try {
          const fetch = (await import('node-fetch')).default;
          console.log(`Attempting geocoding with ${provider.name} for: ${address}`);
          
          const response = await fetch(provider.url, {
            timeout: 5000,
            headers: {
              'User-Agent': 'HelensKitchen-App/1.0'
            }
          });
          
          if (!response.ok) {
            console.warn(`${provider.name} returned status ${response.status}`);
            continue;
          }
          
          const data = await response.json();
          const coords = provider.parse(data);
          
          if (coords && coords.lat && coords.lng) {
            console.log(`Successfully geocoded with ${provider.name}: ${coords.lat}, ${coords.lng}`);
            return {
              lat: coords.lat,
              lng: coords.lng,
              success: true,
              provider: provider.name
            };
          }
          
          console.warn(`${provider.name} returned no results for: ${address}`);
        } catch (error) {
          console.error(`Error with ${provider.name}:`, error.message);
          
          // Retry on network errors if we haven't exhausted retries
          if (retryCount < maxRetries && (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')) {
            console.log(`Retrying ${provider.name} (attempt ${retryCount + 1}/${maxRetries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
            return getCoordinatesFromAddress(address, retryCount + 1, maxRetries);
          }
        }
      }
      
      console.error(`All geocoding providers failed for address: ${address}`);
      return { success: false, error: 'All geocoding providers failed' };
    }

    // Accurate distance calculation based on real coordinates with enhanced reliability
    async function calculateRealDistance(deliveryAddress) {
      try {
        console.log(`Calculating real distance for: ${deliveryAddress}`);
        
        // Check for known addresses with verified distances FIRST, before geocoding
        const addressLower = deliveryAddress.toLowerCase();
        if (addressLower.includes('3jw9+qrr') || addressLower.includes('florida residences')) {
          console.log('Using verified distance for Florida Residences - skipping geocoding');
          return 2.2; // Verified Google Maps distance with road factor
        }
        if (addressLower.includes('saguin barangay chapel') || addressLower.includes('señorita street')) {
          console.log('Using verified distance for Saguin Barangay Chapel - skipping geocoding');
          return 1.6; // Verified actual distance
        }
        if (addressLower.includes('wilson instant tree bank garden') || addressLower.includes('rich town i subdivision')) {
          console.log('Using verified distance for Wilson Instant Tree Bank Garden - skipping geocoding');
          return 1.2; // Verified actual distance
        }
        // SM City Pampanga - geocoding returns wrong location (confuses with local SM instead of main mall)
        if (addressLower.includes('sm city pampanga') || (addressLower.includes('sm city') && addressLower.includes('san jose'))) {
          console.log('Using verified distance for SM City Pampanga - skipping geocoding');
          return 13.1; // Verified Google Maps distance to main SM City Pampanga mall
        }
        // General Baliti area override - geocoding consistently returns wrong coordinates for this area
        if (addressLower.includes('baliti') && addressLower.includes('san fernando') && addressLower.includes('pampanga')) {
          console.log('Using estimated distance for Baliti area - geocoding unreliable for this location');
          return 2.0; // Conservative estimate for Baliti area
        }
        
        // Get coordinates for delivery address with improved error handling
        const coords = await getCoordinatesFromAddress(deliveryAddress);
        
        if (coords.success && coords.lat && coords.lng) {
          // Validate coordinates are within Philippines bounds
          if (coords.lat < 4.0 || coords.lat > 21.0 || coords.lng < 116.0 || coords.lng > 127.0) {
            console.warn(`Coordinates outside Philippines bounds: ${coords.lat}, ${coords.lng}`);
            throw new Error('Coordinates outside expected geographical bounds');
          }
          
          // Calculate actual distance from store to delivery location
          const straightLineDistance = calculateDistance(
            STORE_LOCATION.lat, STORE_LOCATION.lng,
            coords.lat, coords.lng
          );
          
          console.log(`Straight line distance: ${straightLineDistance}km using ${coords.provider}`);
          
          // Validate distance is reasonable (within 200km of Pampanga)
          if (straightLineDistance > 200) {
            console.warn(`Unreasonable distance calculated: ${straightLineDistance}km`);
            throw new Error('Calculated distance exceeds reasonable bounds');
          }
          
          // Apply road distance factor based on empirical data
          // Updated factors based on real-world Google Maps distances
          let roadDistanceFactor = 1.2; // Default road factor
          
          // Adjust factor based on location and distance - fixed for short distances
          if (straightLineDistance > 15) {
            roadDistanceFactor = 1.0; // Efficient highways for longer distances
          } else if (straightLineDistance > 8) {
            roadDistanceFactor = 1.1; // Good road network for medium distances  
          } else if (straightLineDistance > 3) {
            roadDistanceFactor = 1.2; // Urban roads 
          } else if (straightLineDistance > 1) {
            roadDistanceFactor = 1.15; // Short local routes - minimal detour
          } else {
            roadDistanceFactor = 1.1; // Very short distances - almost straight line
          }
          
          const estimatedRoadDistance = straightLineDistance * roadDistanceFactor;
          const finalDistance = Math.round(estimatedRoadDistance * 10) / 10; // Round to 1 decimal place
          
          console.log(`Final calculated distance: ${finalDistance}km (factor: ${roadDistanceFactor})`);
          
          // Log potential discrepancies with hardcoded estimates for monitoring
          const estimatedDistance = estimateDistanceFromAddress(deliveryAddress);
          if (Math.abs(finalDistance - estimatedDistance) > 3) {
            console.warn(`Large discrepancy detected - Real: ${finalDistance}km vs Estimated: ${estimatedDistance}km for ${deliveryAddress}`);
          }
          
          return finalDistance;
        }
        
        console.warn(`Geocoding failed for: ${deliveryAddress}, using fallback estimation`);
        return estimateDistanceFromAddress(deliveryAddress);
      } catch (error) {
        console.error(`Error calculating real distance for ${deliveryAddress}:`, error.message);
        console.log('Falling back to address-based estimation');
        return estimateDistanceFromAddress(deliveryAddress);
      }
    }

    // Improved fallback estimation with Google Maps verified distances
    function estimateDistanceFromAddress(address) {
      const addressLower = address.toLowerCase();
      console.log(`Using fallback distance estimation for: ${address}`);
      
      // Specific plus code addresses - exact distances (check FIRST before general areas)
      if (addressLower.includes('3jw9+qrr') || 
          addressLower.includes('florida residences')) {
        console.log('Found Florida Residences/3JW9+QRR - using exact distance');
        return 2.2; // Florida Residences exact distance (1.9km Google Maps + road factor)
      }
      if (addressLower.includes('saguin barangay chapel') || addressLower.includes('señorita street')) {
        console.log('Found Saguin Barangay Chapel - using exact distance');
        return 1.6; // Verified actual distance
      }
      if (addressLower.includes('wilson instant tree bank garden') || addressLower.includes('rich town i subdivision')) {
        console.log('Found Wilson Instant Tree Bank Garden - using exact distance');
        return 1.2; // Verified actual distance
      }
      // General Baliti area - geocoding unreliable, use conservative estimate
      if (addressLower.includes('baliti') && addressLower.includes('san fernando')) {
        console.log('Found Baliti area - using conservative estimate due to geocoding issues');
        return 2.0; // Conservative estimate for Baliti area
      }
      
      // San Fernando city areas - verified with Google Maps from pickup location
      if (addressLower.includes('san fernando')) {
        // Different areas within San Fernando with Google Maps verified distances
        if (addressLower.includes('essel park') || addressLower.includes('maria clara')) {
          return 7.2; // Verified: Essel Park area distance
        }
        if (addressLower.includes('dolores') || addressLower.includes('magliman')) {
          return 4.8; // Updated: Dolores/Magliman area distance
        }
        if (addressLower.includes('telabastagan') || addressLower.includes('sindalan')) {
          return 7.5; // Updated: Telabastagan/Sindalan area distance
        }
        if (addressLower.includes('dela paz')) {
          return 3.2; // Dela Paz area (closer to pickup)
        }
        if (addressLower.includes('santo cristo') || addressLower.includes('santo tomas')) {
          return 4.1; // Santo Cristo/Santo Tomas areas
        }
        return 5.2; // Updated average distance within San Fernando
      }
      
      // Major shopping centers and landmarks - Google Maps verified
      if (addressLower.includes('sm city') || addressLower.includes('sm telabastagan')) return 13.1; // CORRECTED: Google Maps verified
      if (addressLower.includes('robinson') || addressLower.includes('robinsons')) return 12.8; // Robinsons Pampanga
      if (addressLower.includes('vista mall') || addressLower.includes('vista centro')) return 11.5; // Vista Mall
      if (addressLower.includes('jenra mall')) return 4.8; // Jenra Mall San Fernando
      
      // Surrounding cities - Google Maps verified distances
      if (addressLower.includes('angeles city') || addressLower.includes('angeles')) return 15.2; // Updated: Angeles City center
      if (addressLower.includes('mabalacat')) return 10.5; // Updated: Mabalacat center
      if (addressLower.includes('clark') || addressLower.includes('freeport')) return 18.3; // Updated: Clark Freeport Zone
      if (addressLower.includes('magalang')) return 22.1; // Updated: Magalang center
      if (addressLower.includes('mexico') || addressLower.includes('mexico pampanga')) return 8.7; // Updated: Mexico, Pampanga
      if (addressLower.includes('bacolor')) return 12.4; // Bacolor center
      if (addressLower.includes('guagua')) return 14.7; // Guagua center
      if (addressLower.includes('lubao')) return 18.9; // Lubao center
      if (addressLower.includes('apalit')) return 21.3; // Apalit center
      if (addressLower.includes('masantol')) return 25.8; // Masantol center
      
      // University areas
      if (addressLower.includes('holy angel') || addressLower.includes('hau')) return 14.8; // Holy Angel University
      if (addressLower.includes('angeles university') || addressLower.includes('auf')) return 16.2; // Angeles University Foundation
      
      // Default for other Pampanga locations
      console.log(`No specific match found for ${address}, using default estimate`);
      return 12.0; // Updated default for unknown Pampanga locations
    }

    // POST /api/delivery/estimate-fee - Estimate delivery fee using Lalamove API
    app.post("/api/delivery/estimate-fee", async (req, res) => {
      const { deliveryAddress } = req.body;
      
      if (!deliveryAddress) {
        return res.status(400).json({ error: "Delivery address is required" });
      }

      try {
        const axios = require('axios');
        const pickupLocation = process.env.PICKUP_LOCATION || "3JQG+XH, San Fernando, Pampanga";
        
        // Prepare Lalamove quotation request
        const quotationRequest = {
          scheduleAt: "",
          serviceType: "MOTORCYCLE",
          language: "en_PH",
          stops: [
            {
              location: {
                displayString: pickupLocation,
                type: "string"
              },
              stopId: "pickup"
            },
            {
              location: {
                displayString: deliveryAddress,
                type: "string"
              },
              stopId: "dropoff"
            }
          ],
          item: {
            quantity: "1",
            weight: "LESS_THAN_3_KG",
            categories: ["FOOD"],
            handlingInstructions: ["KEEP_UPRIGHT", "HANDLE_WITH_CARE"]
          },
          isRouteOptimized: false
        };

        // For development/testing, return a mock response instead of calling the actual API
        // This prevents errors when API credentials are not yet configured
        if (!process.env.LALAMOVE_API_KEY || process.env.LALAMOVE_API_KEY === 'your_lalamove_api_key_here') {
          // Calculate using increased rates (+10%)
          const baseFee = Math.round(49 * 1.1); // ₱49 + 10% = ₱54
          const firstTierRate = Math.round(6 * 1.1 * 10) / 10; // ₱6 + 10% = ₱6.6/km for first 0-5km
          const secondTierRate = Math.round(5 * 1.1 * 10) / 10; // ₱5 + 10% = ₱5.5/km for distances beyond 5km
          
          // Calculate REAL distance using coordinates or improved estimation
          const estimatedDistance = await calculateRealDistance(deliveryAddress);
          // Calculate tiered distance pricing
          let distanceFee = 0;
          if (estimatedDistance <= 5) {
            distanceFee = estimatedDistance * firstTierRate;
          } else {
            distanceFee = (5 * firstTierRate) + ((estimatedDistance - 5) * secondTierRate);
          }
          
          const deliveryFee = baseFee + distanceFee;
          
          return res.json({
            deliveryFee: deliveryFee,
            distance: estimatedDistance,
            priceBreakdown: {
              baseFee: baseFee,
              distanceFee: distanceFee,
              firstTierDistance: Math.min(estimatedDistance, 5),
              secondTierDistance: Math.max(0, estimatedDistance - 5),
              firstTierRate: firstTierRate,
              secondTierRate: secondTierRate,
              totalFee: deliveryFee
            },
            quotationId: `lalamove_${Date.now()}`,
            currency: "PHP",
            isEstimate: true,
            message: "Using Lalamove motorcycle rates - Estimated distance and pricing"
          });
        }

        // Make actual Lalamove API call (when credentials are configured)
        const response = await axios.post(
          `${process.env.LALAMOVE_API_URL}/v3/quotations`,
          quotationRequest,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `hmac ${process.env.LALAMOVE_API_KEY}:${process.env.LALAMOVE_API_SECRET}`,
              'X-LLM-Market': process.env.LALAMOVE_MARKET || 'PH'
            }
          }
        );

        const quotation = response.data;
        
        res.json({
          deliveryFee: quotation.priceBreakdown.totalExcludePriorityFee,
          distance: quotation.distance,
          priceBreakdown: quotation.priceBreakdown,
          quotationId: quotation.quotationId,
          currency: quotation.currency,
          isEstimate: false
        });

      } catch (error) {
        console.error('Error estimating delivery fee:', error);
        
        // Fallback to increased rates (+10%) on API error
        const baseFee = Math.round(49 * 1.1); // ₱54
        const firstTierRate = Math.round(6 * 1.1 * 10) / 10; // ₱6.6/km
        const secondTierRate = Math.round(5 * 1.1 * 10) / 10; // ₱5.5/km
        // Use real distance calculation even in fallback scenario
        const estimatedDistance = await calculateRealDistance(deliveryAddress);
        // Calculate tiered distance pricing
        let distanceFee = 0;
        if (estimatedDistance <= 5) {
          distanceFee = estimatedDistance * firstTierRate;
        } else {
          distanceFee = (5 * firstTierRate) + ((estimatedDistance - 5) * secondTierRate);
        }
        
        const deliveryFee = baseFee + distanceFee;
        
        res.json({
          deliveryFee: deliveryFee,
          distance: estimatedDistance,
          priceBreakdown: {
            baseFee: baseFee,
            distanceFee: distanceFee,
            firstTierDistance: Math.min(estimatedDistance, 5),
            secondTierDistance: Math.max(0, estimatedDistance - 5),
            firstTierRate: firstTierRate,
            secondTierRate: secondTierRate,
            totalFee: deliveryFee
          },
          quotationId: `fallback_${Date.now()}`,
          currency: "PHP",
          isEstimate: true,
          message: "Using Lalamove motorcycle rates due to API error"
        });
      }
    });

    // ========== PUSH NOTIFICATION ENDPOINTS ==========

    // GET /api/admin/push/vapid-public-key - Get VAPID public key for client
    app.get("/api/admin/push/vapid-public-key", requirePermission('orders.view'), (req, res) => {
      res.json({ publicKey: VAPID_PUBLIC_KEY });
    });

    // POST /api/admin/push/subscribe - Subscribe to push notifications
    app.post("/api/admin/push/subscribe", requirePermission('orders.view'), async (req, res) => {
      try {
        const { subscription } = req.body;
        const adminId = req.adminUser.userId;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
          return res.status(400).json({ error: "Invalid subscription object" });
        }

        // Save or update subscription
        await PushSubscription.findOneAndUpdate(
          { 
            admin_id: adminId, 
            endpoint: subscription.endpoint 
          },
          {
            admin_id: adminId,
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            },
            user_agent: req.get('User-Agent'),
            is_active: true,
            last_used: new Date()
          },
          { upsert: true, new: true }
        );

        console.log(`Push subscription saved for admin ${req.adminUser.username}`);
        res.json({ message: "Subscription saved successfully" });

      } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ error: "Failed to save subscription" });
      }
    });

    // DELETE /api/admin/push/unsubscribe - Unsubscribe from push notifications
    app.delete("/api/admin/push/unsubscribe", requirePermission('orders.view'), async (req, res) => {
      try {
        const { endpoint } = req.body;
        const adminId = req.adminUser.userId;

        if (!endpoint) {
          return res.status(400).json({ error: "Endpoint is required" });
        }

        await PushSubscription.findOneAndUpdate(
          { admin_id: adminId, endpoint: endpoint },
          { is_active: false }
        );

        console.log(`Push subscription deactivated for admin ${req.adminUser.username}`);
        res.json({ message: "Unsubscribed successfully" });

      } catch (error) {
        console.error('Error unsubscribing from push notifications:', error);
        res.status(500).json({ error: "Failed to unsubscribe" });
      }
    });


    // Helper function to send push notifications to all admin subscriptions
    async function sendPushNotification(title, body, data = {}) {
      try {
        // Get all active admin subscriptions
        const subscriptions = await PushSubscription.find({ is_active: true })
          .populate('admin_id', 'username');

        if (subscriptions.length === 0) {
          console.log('No active push subscriptions found');
          return;
        }

        const payload = JSON.stringify({
          title: title,
          body: body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: 'new-order',
          requireInteraction: true,
          data: data,
          actions: [
            {
              action: 'view-orders',
              title: 'View Orders',
              icon: '/icons/icon-192x192.png'
            },
            {
              action: 'dismiss',
              title: 'Dismiss',
              icon: '/icons/icon-192x192.png'
            }
          ]
        });

        const promises = subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            }, payload);

            // Update last_used timestamp
            await PushSubscription.findByIdAndUpdate(sub._id, { 
              last_used: new Date() 
            });

            console.log(`Push notification sent to ${sub.admin_id.username}`);
          } catch (error) {
            console.error(`Failed to send push notification to ${sub.admin_id.username}:`, error);
            
            // If subscription is invalid (410 status), deactivate it
            if (error.statusCode === 410) {
              await PushSubscription.findByIdAndUpdate(sub._id, { 
                is_active: false 
              });
              console.log(`Deactivated invalid subscription for ${sub.admin_id.username}`);
            }
          }
        });

        await Promise.all(promises);
        console.log(`Push notifications sent to ${subscriptions.length} admin(s)`);

      } catch (error) {
        console.error('Error sending push notifications:', error);
      }
    }

    // POST /api/orders - Submit new order
    app.post("/api/orders", async (req, res) => {
      const { customer_name, phone, delivery_option, address, plus_code, payment_method, requested_delivery, items, total_price, delivery_fee, delivery_fee_status, quotation_id } = req.body;
      
      if (!customer_name || !phone || !address || !payment_method || !requested_delivery || !items || !total_price) {
        return res.status(400).json({ error: "All required fields must be provided" });
      }

      try {
        const order = await Order.create({
          customer_name,
          phone,
          delivery_option: delivery_option || 'delivery',
          address,
          plus_code,
          payment_method,
          total_price,
          delivery_fee: delivery_fee || 0,
          delivery_fee_status: delivery_fee_status || 'pending',
          quotation_id: quotation_id || null,
          requested_delivery: new Date(requested_delivery),
          items: items.map(item => ({
            menu_item_id: item.menuItemId,
            variant_name: item.variant,
            quantity: item.quantity,
            price: item.price
          }))
        });

        console.log('Order created successfully:', order._id);
        
        // Send push notification to all admin users
        try {
          const unreadCount = await Order.countDocuments({ 
            status: 'New',
            payment_status: 'Pending' 
          });
          
          await sendPushNotification(
            'New Order Received!',
            `Order from ${customer_name} - ₱${total_price}`,
            {
              orderId: order._id.toString(),
              customerName: customer_name,
              totalPrice: total_price,
              badgeCount: unreadCount,
              url: '/admin/orders'
            }
          );
        } catch (notificationError) {
          console.error('Error sending push notification for new order:', notificationError);
        }
        
        res.json({ 
          message: "Order submitted successfully", 
          orderId: order._id 
        });
      } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/track-order/:orderId/:phone - Track order by ID and phone
    app.get("/api/track-order/:orderId/:phone", async (req, res) => {
      const { orderId, phone } = req.params;
      
      if (!orderId || !phone) {
        return res.status(400).json({ error: "Order ID and phone number are required" });
      }

      try {
        console.log(`Tracking order ${orderId} for phone ${phone}`);
        
        const order = await Order.findOne({ 
          _id: orderId, 
          phone: phone 
        }).populate('items.menu_item_id');
        
        if (!order) {
          console.log(`No order found for ID ${orderId} and phone ${phone}`);
          return res.status(404).json({ error: "Order not found" });
        }

        // For legacy orders, try to lookup menu items by variant name
        const itemsWithDetails = await Promise.all(order.items.map(async (item) => {
          // Handle cases where menu_item_id might not be populated (legacy orders)
          if (item.menu_item_id && item.menu_item_id._id) {
            return {
              menu_item_id: item.menu_item_id._id,
              name: item.menu_item_id.name,
              description: item.menu_item_id.description,
              image_url: item.menu_item_id.image_url,
              variant_name: item.variant_name,
              quantity: item.quantity,
              price: item.price
            };
          } else {
            // Fallback for legacy orders - try to find the menu item by variant name
            try {
              const variant = await MenuVariant.findOne({ 
                name: item.variant_name 
              }).populate('menu_item_id');
              
              if (variant && variant.menu_item_id) {
                return {
                  menu_item_id: variant.menu_item_id._id,
                  name: variant.menu_item_id.name,
                  description: variant.menu_item_id.description,
                  image_url: variant.menu_item_id.image_url,
                  variant_name: item.variant_name,
                  quantity: item.quantity,
                  price: item.price
                };
              }
            } catch (error) {
              console.error('Error looking up variant:', error);
            }
            
            // Final fallback if variant lookup fails
            return {
              menu_item_id: null,
              name: item.variant_name || 'Menu Item',
              description: 'Legacy order item',
              image_url: 'https://via.placeholder.com/150x150/2D2D2D/FFFFFF?text=Food+Item',
              variant_name: item.variant_name,
              quantity: item.quantity,
              price: item.price
            };
          }
        }));
        
        // Format response to match frontend expectations
        const formattedOrder = {
          id: order._id,
          customer_name: order.customer_name,
          phone: order.phone,
          delivery_option: order.delivery_option,
          address: order.address,
          plus_code: order.plus_code || null,
          payment_method: order.payment_method,
          total_price: order.total_price,
          delivery_fee: order.delivery_fee || 0,
          delivery_fee_status: order.delivery_fee_status || 'pending',
          quotation_id: order.quotation_id,
          status: order.status,
          payment_status: order.payment_status,
          requested_delivery: order.requested_delivery,
          created_at: order.createdAt,
          items: itemsWithDetails
        };
        
        console.log(`Order found and returned for ${orderId}`);
        res.json(formattedOrder);
      } catch (error) {
        console.error('Database error tracking order:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/analytics/page-view - Track page views
    app.post("/api/analytics/page-view", async (req, res) => {
      const { sessionId, pagePath, pageTitle, referrer, timeOnPage } = req.body;
      
      if (!sessionId || !pagePath) {
        return res.status(400).json({ error: "Session ID and page path are required" });
      }

      try {
        // Create or update analytics session
        await AnalyticsSession.findOneAndUpdate(
          { session_id: sessionId },
          {
            session_id: sessionId,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            last_activity: new Date(),
            is_admin: pagePath.includes('/admin'),
            admin_username: req.user?.username || null
          },
          { upsert: true, new: true }
        );

        // Create page view record
        await AnalyticsPageView.create({
          session_id: sessionId,
          page_path: pagePath,
          page_title: pageTitle,
          referrer: referrer,
          time_on_page: timeOnPage
        });

        res.json({ message: "Page view tracked successfully" });
      } catch (error) {
        console.error('Error tracking page view:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/analytics/event - Track events
    app.post("/api/analytics/event", async (req, res) => {
      const { sessionId, eventType, eventCategory, eventAction, eventLabel, eventValue, pagePath } = req.body;
      
      if (!sessionId || !eventType) {
        return res.status(400).json({ error: "Session ID and event type are required" });
      }

      try {
        // Update session last activity
        await AnalyticsSession.findOneAndUpdate(
          { session_id: sessionId },
          { last_activity: new Date() }
        );

        // Create event record
        await AnalyticsEvent.create({
          session_id: sessionId,
          event_type: eventType,
          event_category: eventCategory,
          event_action: eventAction,
          event_label: eventLabel,
          event_value: eventValue,
          page_path: pagePath
        });

        res.json({ message: "Event tracked successfully" });
      } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/revenue - Revenue reports
    app.get("/api/admin/revenue", requirePermission('revenue.view'), async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        
        let matchFilter = { payment_status: 'Confirmed' };
        if (startDate || endDate) {
          matchFilter.createdAt = {};
          if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
          if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
        }

        // Get detailed revenue data with individual orders
        const detailedRevenueData = await Order.find(matchFilter)
          .select('_id customer_name phone total_price payment_method delivery_option createdAt')
          .sort({ createdAt: -1 })
          .limit(100); // Limit to last 100 orders for performance

        // Also get aggregated data for summary
        const aggregatedData = await Order.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
              },
              total_revenue: { $sum: "$total_price" },
              order_count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        // Format detailed revenue data
        const formattedDetailedData = detailedRevenueData.map(order => ({
          order_id: order._id,
          customer_name: order.customer_name,
          phone: order.phone,
          date: order.createdAt.toISOString().split('T')[0],
          payment_method: order.payment_method,
          delivery_option: order.delivery_option,
          total_revenue: order.total_price,
          created_at: order.createdAt
        }));

        res.json({
          detailed: formattedDetailedData,
          aggregated: aggregatedData
        });
      } catch (error) {
        console.error('Error fetching revenue data:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/feedback - Feedback management
    app.get("/api/admin/feedback", requirePermission('feedback.view'), async (req, res) => {
      try {
        const { status } = req.query;
        
        let filter = {};
        if (status) filter.status = status;

        const feedback = await Feedback.find(filter)
          .populate('order_id', 'customer_name total_price')
          .sort({ createdAt: -1 });

        const formattedFeedback = feedback.map(fb => ({
          id: fb._id,
          order_id: fb.order_id._id,
          customer_name: fb.customer_name,
          phone: fb.phone,
          rating: fb.rating,
          comment: fb.comment,
          status: fb.status,
          moderated_at: fb.moderated_at,
          moderated_by: fb.moderated_by,
          created_at: fb.createdAt,
          order_total: fb.order_id.total_price
        }));

        res.json(formattedFeedback);
      } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/analytics/overview - Analytics overview
    app.get("/api/admin/analytics/overview", requirePermission('analytics.view'), async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = {};
        if (startDate || endDate) {
          dateFilter.createdAt = {};
          if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
          if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        const [sessionStats, pageViewCount, eventCount] = await Promise.all([
          AnalyticsSession.aggregate([
            { $match: dateFilter },
            {
              $group: {
                _id: null,
                total_sessions: { $sum: 1 },
                user_sessions: { $sum: { $cond: [{ $eq: ["$is_admin", false] }, 1, 0] } },
                admin_sessions: { $sum: { $cond: [{ $eq: ["$is_admin", true] }, 1, 0] } },
                avg_duration: { 
                  $avg: { 
                    $divide: [
                      { $subtract: ["$last_activity", "$started_at"] }, 
                      60000 
                    ] 
                  } 
                }
              }
            }
          ]),
          AnalyticsPageView.countDocuments(dateFilter),
          AnalyticsEvent.countDocuments(dateFilter)
        ]);

        const overview = {
          total_sessions: sessionStats[0]?.total_sessions || 0,
          user_sessions: sessionStats[0]?.user_sessions || 0,
          admin_sessions: sessionStats[0]?.admin_sessions || 0,
          avg_session_duration_minutes: Math.round(sessionStats[0]?.avg_duration || 0),
          total_page_views: pageViewCount,
          total_events: eventCount
        };

        res.json(overview);
      } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/analytics/page-views - Page view analytics
    app.get("/api/admin/analytics/page-views", requirePermission('analytics.view'), async (req, res) => {
      try {
        const { startDate, endDate, groupBy } = req.query;
        
        let matchFilter = {};
        if (startDate || endDate) {
          matchFilter.createdAt = {};
          if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
          if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
        }

        let groupField;
        if (groupBy === 'page') {
          groupField = "$page_path";
        } else {
          groupField = {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          };
        }

        const pageViewData = await AnalyticsPageView.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: groupField,
              views: { $sum: 1 },
              unique_visitors: { $addToSet: "$session_id" },
              avg_time_on_page: { $avg: "$time_on_page" }
            }
          },
          {
            $project: {
              page_path: "$_id",
              date: "$_id",
              views: 1,
              unique_visitors: { $size: "$unique_visitors" },
              avg_time_on_page: { $round: ["$avg_time_on_page", 2] }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        res.json(pageViewData);
      } catch (error) {
        console.error('Error fetching page view analytics:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/inventory - Inventory management
    app.get("/api/admin/inventory", requirePermission('inventory.view'), async (req, res) => {
      try {
        const ingredients = await Ingredient.find().sort({ name: 1 });
        
        const formattedIngredients = ingredients.map(ingredient => ({
          id: ingredient._id,
          name: ingredient.name,
          description: ingredient.description,
          unit: ingredient.unit,
          current_stock: ingredient.current_stock,
          minimum_stock: ingredient.minimum_stock,
          cost_per_unit: ingredient.cost_per_unit,
          supplier: ingredient.supplier,
          stock_status: ingredient.current_stock <= 0 ? 'out' : 
                       ingredient.current_stock <= ingredient.minimum_stock ? 'low' : 'ok',
          used_in_items: 0, // TODO: Calculate actual usage from MenuItemIngredients
          created_at: ingredient.createdAt,
          updated_at: ingredient.updatedAt
        }));

        res.json(formattedIngredients);
      } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/admin/inventory - Create new ingredient
    app.post("/api/admin/inventory", requirePermission('inventory.manage'), async (req, res) => {
      try {
        const { name, description, unit, current_stock, minimum_stock, cost_per_unit, supplier } = req.body;
        
        if (!name || !unit) {
          return res.status(400).json({ error: "Name and unit are required" });
        }

        // Check if ingredient with same name already exists
        const existingIngredient = await Ingredient.findOne({ name: name.trim() });
        if (existingIngredient) {
          return res.status(400).json({ error: "An ingredient with this name already exists" });
        }

        const ingredient = await Ingredient.create({
          name: name.trim(),
          description: description?.trim() || '',
          unit: unit.trim(),
          current_stock: current_stock || 0,
          minimum_stock: minimum_stock || 0,
          cost_per_unit: cost_per_unit || 0,
          supplier: supplier?.trim() || ''
        });

        console.log(`Ingredient created: ${ingredient.name} (${ingredient._id})`);
        
        // Auto-create expense and stock movement for initial stock
        let expenseCreated = false;
        if (current_stock && current_stock > 0 && cost_per_unit && cost_per_unit > 0) {
          try {
            const expenseAmount = current_stock * cost_per_unit;
            console.log('💰 Creating initial stock expense:', expenseAmount);
            
            // Create stock movement record
            await StockMovement.create({
              ingredient_id: ingredient._id,
              movement_type: 'purchase',
              quantity: current_stock,
              reason: 'Initial stock',
              admin_id: req.adminUser._id,
              reference_type: 'initial_stock'
            });
            
            // Create expense record
            await Expense.create({
              date: new Date(),
              category: 'Ingredients',
              amount: expenseAmount,
              notes: `Auto-generated: Initial stock of ${current_stock} ${ingredient.unit} of ${ingredient.name} at ₱${cost_per_unit}/${ingredient.unit}`
            });
            
            expenseCreated = true;
            console.log('✅ Initial stock expense created successfully');
          } catch (expenseError) {
            console.error('❌ Error creating initial stock expense:', expenseError);
          }
        }
        
        res.status(201).json({
          id: ingredient._id,
          name: ingredient.name,
          description: ingredient.description,
          unit: ingredient.unit,
          current_stock: ingredient.current_stock,
          minimum_stock: ingredient.minimum_stock,
          cost_per_unit: ingredient.cost_per_unit,
          supplier: ingredient.supplier,
          stock_status: ingredient.current_stock <= ingredient.minimum_stock ? 
            (ingredient.current_stock === 0 ? 'out' : 'low') : 'ok',
          used_in_items: 0,
          created_at: ingredient.createdAt,
          updated_at: ingredient.updatedAt,
          expense_created: expenseCreated
        });
      } catch (error) {
        console.error('Error creating ingredient:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/inventory/movements - Stock movements
    app.get("/api/admin/inventory/movements", requirePermission('inventory.view'), async (req, res) => {
      try {
        const { limit = 20 } = req.query;
        
        const movements = await StockMovement.find()
          .populate('ingredient_id', 'name unit')
          .populate('admin_id', 'username')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit));

        const formattedMovements = movements.map(movement => ({
          id: movement._id,
          ingredient_name: movement.ingredient_id.name,
          ingredient_unit: movement.ingredient_id.unit,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          reason: movement.reason,
          admin_username: movement.admin_id?.username,
          created_at: movement.createdAt
        }));

        res.json(formattedMovements);
      } catch (error) {
        console.error('Error fetching stock movements:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/inventory/:id/stock - Update ingredient stock
    app.put("/api/admin/inventory/:id/stock", requirePermission('inventory.update'), async (req, res) => {
      try {
        const { id } = req.params;
        const { quantity, movement_type, reason, purchase_price } = req.body;
        
        if (quantity === undefined || quantity === null) {
          return res.status(400).json({ error: "Quantity is required" });
        }

        if (!movement_type) {
          return res.status(400).json({ error: "Movement type is required" });
        }

        const validMovementTypes = ['purchase', 'usage', 'adjustment', 'waste'];
        if (!validMovementTypes.includes(movement_type)) {
          return res.status(400).json({ error: "Invalid movement type" });
        }

        // Find the ingredient
        const ingredient = await Ingredient.findById(id);
        if (!ingredient) {
          return res.status(404).json({ error: "Ingredient not found" });
        }

        // Calculate new stock level
        const newStock = ingredient.current_stock + quantity;
        if (newStock < 0) {
          return res.status(400).json({ error: "Insufficient stock for this operation" });
        }

        // Update ingredient stock
        await Ingredient.findByIdAndUpdate(id, { 
          current_stock: newStock,
          stock_status: newStock <= ingredient.minimum_stock ? 
            (newStock === 0 ? 'out' : 'low') : 'ok'
        });

        // Create stock movement record
        const movement = await StockMovement.create({
          ingredient_id: id,
          movement_type,
          quantity,
          reason: reason || '',
          admin_id: req.adminUser._id,
          reference_type: 'manual_adjustment',
          purchase_price: movement_type === 'purchase' && purchase_price ? purchase_price : undefined
        });

        // Auto-create expense record for purchases
        let expenseCreated = false;
        console.log('🔍 Expense Debug - movement_type:', movement_type, 'quantity:', quantity);
        if (movement_type === 'purchase' && quantity > 0) {
          try {
            // Use purchase_price if provided, otherwise use ingredient's cost_per_unit
            const pricePerUnit = purchase_price && purchase_price > 0 ? purchase_price : ingredient.cost_per_unit;
            const expenseAmount = quantity * pricePerUnit;
            console.log('💰 Expense Debug - pricePerUnit:', pricePerUnit, 'expenseAmount:', expenseAmount);
            
            if (expenseAmount > 0) {
              const priceNote = purchase_price && purchase_price > 0 ? ` at ₱${purchase_price}/${ingredient.unit}` : '';
              const expenseData = {
                date: new Date(),
                category: 'Ingredients',
                amount: expenseAmount,
                notes: `Auto-generated: Purchase of ${quantity} ${ingredient.unit} of ${ingredient.name}${priceNote}${reason ? ` - ${reason}` : ''}`
              };
              console.log('📝 Creating expense:', expenseData);
              await Expense.create(expenseData);
              console.log('✅ Expense created successfully');
              expenseCreated = true;
            } else {
              console.log('❌ Expense not created - expenseAmount is 0');
            }
          } catch (expenseError) {
            console.error('❌ Error creating expense record:', expenseError);
            // Continue without failing the stock update
          }
        } else {
          console.log('❌ Expense not created - conditions not met:', { movement_type, quantity });
        }

        res.json({
          message: "Stock updated successfully",
          new_stock: newStock,
          expense_created: expenseCreated,
          movement_id: movement._id
        });
      } catch (error) {
        console.error('Error updating inventory stock:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/inventory/:id - Update ingredient details
    app.put("/api/admin/inventory/:id", requirePermission('inventory.update'), async (req, res) => {
      try {
        const { id } = req.params;
        const { name, description, unit, minimum_stock, cost_per_unit, supplier } = req.body;
        
        if (!name || !unit) {
          return res.status(400).json({ error: "Name and unit are required" });
        }

        // Check if another ingredient with same name already exists (excluding current one)
        const existingIngredient = await Ingredient.findOne({ 
          name: name.trim(), 
          _id: { $ne: id } 
        });
        if (existingIngredient) {
          return res.status(400).json({ error: "An ingredient with this name already exists" });
        }

        const ingredient = await Ingredient.findByIdAndUpdate(
          id,
          {
            name: name.trim(),
            description: description?.trim() || '',
            unit: unit.trim(),
            minimum_stock: minimum_stock || 0,
            cost_per_unit: cost_per_unit || 0,
            supplier: supplier?.trim() || ''
          },
          { new: true }
        );

        if (!ingredient) {
          return res.status(404).json({ error: "Ingredient not found" });
        }

        console.log(`Ingredient updated: ${ingredient.name} (${ingredient._id})`);
        
        res.json({
          id: ingredient._id,
          name: ingredient.name,
          description: ingredient.description,
          unit: ingredient.unit,
          current_stock: ingredient.current_stock,
          minimum_stock: ingredient.minimum_stock,
          cost_per_unit: ingredient.cost_per_unit,
          supplier: ingredient.supplier,
          stock_status: ingredient.current_stock <= ingredient.minimum_stock ? 
            (ingredient.current_stock === 0 ? 'out' : 'low') : 'ok',
          used_in_items: 0, // TODO: Calculate actual usage
          created_at: ingredient.createdAt,
          updated_at: ingredient.updatedAt
        });
      } catch (error) {
        console.error('Error updating ingredient:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // DELETE /api/admin/inventory/:id - Delete ingredient
    app.delete("/api/admin/inventory/:id", requirePermission('inventory.manage'), async (req, res) => {
      try {
        const { id } = req.params;

        // Check if ingredient exists
        const ingredient = await Ingredient.findById(id);
        if (!ingredient) {
          return res.status(404).json({ error: "Ingredient not found" });
        }

        // Check if ingredient is used in any menu items
        const menuItemUsage = await MenuItemIngredient.findOne({ ingredient_id: id });
        if (menuItemUsage) {
          return res.status(400).json({ 
            error: "Cannot delete ingredient that is used in menu items" 
          });
        }

        // Delete all stock movements for this ingredient
        await StockMovement.deleteMany({ ingredient_id: id });
        
        // Delete the ingredient
        await Ingredient.findByIdAndDelete(id);

        console.log(`Ingredient deleted: ${ingredient.name} (${id})`);
        res.json({ 
          message: "Ingredient deleted successfully",
          deletedIngredient: {
            id: ingredient._id,
            name: ingredient.name
          }
        });
      } catch (error) {
        console.error('Error deleting ingredient:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // DELETE /api/admin/inventory/all - Clear all inventory (for testing)
    app.delete("/api/admin/inventory/all", requirePermission('inventory.manage'), async (req, res) => {
      try {
        // Delete all ingredients, stock movements, and menu item ingredients
        const ingredientsDeleted = await Ingredient.deleteMany({});
        const movementsDeleted = await StockMovement.deleteMany({});
        const menuItemIngredientsDeleted = await MenuItemIngredient.deleteMany({});

        console.log('All inventory cleared:', {
          ingredients: ingredientsDeleted.deletedCount,
          movements: movementsDeleted.deletedCount,
          menuItemIngredients: menuItemIngredientsDeleted.deletedCount
        });

        res.json({ 
          message: "All inventory data cleared successfully",
          deleted: {
            ingredients: ingredientsDeleted.deletedCount,
            movements: movementsDeleted.deletedCount,
            menuItemIngredients: menuItemIngredientsDeleted.deletedCount
          }
        });
      } catch (error) {
        console.error('Error clearing all inventory:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/expenses - Expense management
    app.get("/api/admin/expenses", requirePermission('expenses.view'), async (req, res) => {
      try {
        const { startDate, endDate, category } = req.query;
        
        let filter = {};
        if (startDate || endDate) {
          filter.date = {};
          if (startDate) filter.date.$gte = new Date(startDate);
          if (endDate) filter.date.$lte = new Date(endDate);
        }
        if (category) filter.category = category;

        const expenses = await Expense.find(filter).sort({ date: -1 });
        
        const formattedExpenses = expenses.map(expense => ({
          id: expense._id,
          date: expense.date,
          category: expense.category,
          amount: expense.amount,
          notes: expense.notes,
          created_at: expense.createdAt
        }));

        res.json(formattedExpenses);
      } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // POST /api/admin/expenses - Create expense
    app.post("/api/admin/expenses", requirePermission('expenses.create'), async (req, res) => {
      try {
        const { date, category, amount, notes } = req.body;
        
        if (!date || !category || !amount) {
          return res.status(400).json({ error: "Date, category, and amount are required" });
        }

        const expense = await Expense.create({
          date: new Date(date),
          category,
          amount,
          notes
        });

        res.json({
          id: expense._id,
          date: expense.date,
          category: expense.category,
          amount: expense.amount,
          notes: expense.notes,
          created_at: expense.createdAt
        });
      } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // PUT /api/admin/expenses/:id - Update expense
    app.put("/api/admin/expenses/:id", requirePermission('expenses.update'), async (req, res) => {
      try {
        const { id } = req.params;
        const { date, category, amount, notes } = req.body;
        
        if (!date || !category || !amount) {
          return res.status(400).json({ error: "Date, category, and amount are required" });
        }

        const expense = await Expense.findByIdAndUpdate(
          id,
          {
            date: new Date(date),
            category,
            amount,
            notes
          },
          { new: true }
        );

        if (!expense) {
          return res.status(404).json({ error: "Expense not found" });
        }

        res.json({
          id: expense._id,
          date: expense.date,
          category: expense.category,
          amount: expense.amount,
          notes: expense.notes,
          created_at: expense.createdAt
        });
      } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // DELETE /api/admin/expenses/:id - Delete expense
    app.delete("/api/admin/expenses/:id", requirePermission('expenses.delete'), async (req, res) => {
      try {
        const { id } = req.params;
        
        const expense = await Expense.findByIdAndDelete(id);
        
        if (!expense) {
          return res.status(404).json({ error: "Expense not found" });
        }

        res.json({ message: "Expense deleted successfully" });
      } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/feedback/stats - Feedback statistics
    app.get("/api/admin/feedback/stats", requirePermission('feedback.view'), async (req, res) => {
      try {
        const stats = await Feedback.aggregate([
          {
            $group: {
              _id: null,
              total_feedback: { $sum: 1 },
              avg_rating: { $avg: "$rating" },
              pending_count: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
              approved_count: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
              rejected_count: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } }
            }
          }
        ]);

        const result = {
          total_feedback: stats[0]?.total_feedback || 0,
          avg_rating: Math.round((stats[0]?.avg_rating || 0) * 10) / 10,
          pending_count: stats[0]?.pending_count || 0,
          approved_count: stats[0]?.approved_count || 0,
          rejected_count: stats[0]?.rejected_count || 0
        };

        res.json(result);
      } catch (error) {
        console.error('Error fetching feedback stats:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/analytics/events - Event analytics
    app.get("/api/admin/analytics/events", requirePermission('analytics.view'), async (req, res) => {
      try {
        const { startDate, endDate, eventType, groupBy } = req.query;
        
        let matchFilter = {};
        if (startDate || endDate) {
          matchFilter.createdAt = {};
          if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
          if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
        }
        if (eventType) matchFilter.event_type = eventType;

        let groupField;
        if (groupBy === 'type') {
          groupField = "$event_type";
        } else if (groupBy === 'category') {
          groupField = "$event_category";
        } else {
          groupField = {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          };
        }

        const eventData = await AnalyticsEvent.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: groupField,
              event_count: { $sum: 1 },
              unique_sessions: { $addToSet: "$session_id" },
              event_type: { $first: "$event_type" },
              event_category: { $first: "$event_category" },
              event_action: { $first: "$event_action" },
              event_label: { $first: "$event_label" }
            }
          },
          {
            $project: {
              date: "$_id",
              event_type: "$event_type",
              event_category: "$event_category", 
              event_action: "$event_action",
              event_label: "$event_label",
              event_count: 1,
              unique_sessions: { $size: "$unique_sessions" }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        res.json(eventData);
      } catch (error) {
        console.error('Error fetching event analytics:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // GET /api/admin/analytics/sessions - Session analytics  
    app.get("/api/admin/analytics/sessions", requirePermission('analytics.view'), async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        
        let matchFilter = {};
        if (startDate || endDate) {
          matchFilter.createdAt = {};
          if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
          if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
        }

        const sessionData = await AnalyticsSession.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$started_at" }
              },
              sessions: { $sum: 1 },
              unique_visitors: { $addToSet: "$session_id" },
              admin_sessions: { $sum: { $cond: [{ $eq: ["$is_admin", true] }, 1, 0] } },
              avg_duration: {
                $avg: {
                  $divide: [
                    { $subtract: ["$last_activity", "$started_at"] },
                    60000
                  ]
                }
              }
            }
          },
          {
            $project: {
              date: "$_id",
              sessions: 1,
              unique_visitors: { $size: "$unique_visitors" },
              admin_sessions: 1,
              avg_duration_minutes: { $round: ["$avg_duration", 2] }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        res.json(sessionData);
      } catch (error) {
        console.error('Error fetching session analytics:', error);
        res.status(500).json({ error: "Database error" });
      }
    });

    // Menu Population Endpoint (for deployment setup)
    app.post("/api/admin/populate-menu", requirePermission('users.create'), async (req, res) => {
      try {
        console.log('🍽️ Populating menu via API endpoint...');
        
        const { migrateToMongoDB } = require('./migrate-to-mongodb');
        await migrateToMongoDB();
        
        console.log('✅ Menu populated successfully via API');
        res.json({ 
          message: "Menu populated successfully", 
          items: 3,
          variants: 7
        });
        
      } catch (error) {
        console.error('❌ Error populating menu via API:', error);
        res.status(500).json({ error: "Failed to populate menu" });
      }
    });

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} with MongoDB`);
    });
    
  } catch (error) {
    console.error('Server initialization failed:', error);
    process.exit(1);
  }
}

// Initialize server
initServer().catch(console.error);