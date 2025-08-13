require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

// Initialize database asynchronously
let db;
const dbPromise = require("./db");

async function initServer() {
  db = await dbPromise;

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://your-netlify-domain.netlify.app'
    : "http://localhost:4200",
  credentials: true
}));
app.use(express.json());

// Serve static files from frontend/public for images
app.use('/images', express.static(path.join(__dirname, '../frontend/public/images')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'helens-kitchen-secret-key',
  resave: true,  // Changed to true to force session save
  saveUninitialized: true,  // Changed to true
  name: 'helens_session',
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});


// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  } else {
    return res.status(401).json({ error: "Authentication required" });
  }
}

// Permission-based authorization middleware
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session || !req.session.adminId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get user with role and permissions
    const sql = `
      SELECT u.*, r.name as role_name, p.name as permission_name
      FROM admin_users u
      LEFT JOIN admin_roles r ON u.role_id = r.id
      LEFT JOIN admin_role_permissions rp ON r.id = rp.role_id
      LEFT JOIN admin_permissions p ON rp.permission_id = p.id
      WHERE u.id = ? AND u.is_active = 1
    `;
    
    db.all(sql, [req.session.adminId], (err, rows) => {
      if (err) {
        console.error('Permission check error:', err);
        return res.status(500).json({ error: "Server error" });
      }
      
      if (rows.length === 0) {
        return res.status(403).json({ error: "User not found or inactive" });
      }
      
      // Extract permissions from rows
      const userPermissions = rows
        .map(row => row.permission_name)
        .filter(perm => perm !== null);
      
      // Check if user has required permission
      if (userPermissions.includes(permission)) {
        // Add user info to request for later use
        req.adminUser = {
          id: rows[0].id,
          username: rows[0].username,
          role_name: rows[0].role_name,
          permissions: userPermissions
        };
        next();
      } else {
        return res.status(403).json({ 
          error: "Insufficient permissions", 
          required: permission,
          userPermissions: userPermissions 
        });
      }
    });
  };
}

// Helper function to check if user has permission (for internal use)
function hasPermission(adminId, permission, callback) {
  const sql = `
    SELECT COUNT(*) as count
    FROM admin_users u
    JOIN admin_roles r ON u.role_id = r.id
    JOIN admin_role_permissions rp ON r.id = rp.role_id
    JOIN admin_permissions p ON rp.permission_id = p.id
    WHERE u.id = ? AND p.name = ? AND u.is_active = 1
  `;
  
  db.get(sql, [adminId, permission], (err, result) => {
    if (err) {
      callback(err, false);
    } else {
      callback(null, result.count > 0);
    }
  });
}

// Admin authentication endpoints
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const sql = `
    SELECT u.*, r.name as role_name, r.description as role_description
    FROM admin_users u
    LEFT JOIN admin_roles r ON u.role_id = r.id
    WHERE u.username = ? AND u.is_active = 1
  `;
  
  db.get(sql, [username], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Authentication error" });
      }
      
      if (match) {
        // Update last login
        db.run("UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
        
        // Get user permissions
        const permSql = `
          SELECT p.name as permission_name
          FROM admin_permissions p
          JOIN admin_role_permissions rp ON p.id = rp.permission_id
          WHERE rp.role_id = ?
        `;
        
        db.all(permSql, [user.role_id], (err, permissions) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error loading permissions" });
          }
          
          req.session.adminId = user.id;
          req.session.adminUsername = user.username;
          req.session.adminRole = user.role_name;
          
          console.log('Session set:', req.session);
          console.log('Session ID:', req.sessionID);
          
          // Explicitly save session
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
            }
            
            console.log('Response headers before send:', res.getHeaders());
            
            // Manual cookie setting as backup
            const isProduction = process.env.NODE_ENV === 'production';
            const cookieOptions = `helens_session=${req.sessionID}; Path=/; HttpOnly; ${isProduction ? 'Secure; SameSite=None' : 'SameSite=Lax'}; Max-Age=86400`;
            
            // For cross-origin, try setting cookie with specific domain
            if (isProduction) {
              res.setHeader('Set-Cookie', [
                cookieOptions,
                `helens_session_backup=${req.sessionID}; Path=/; Max-Age=86400; SameSite=Lax`
              ]);
            } else {
              res.setHeader('Set-Cookie', cookieOptions);
            }
            
            console.log('Manual cookie set:', cookieOptions);
            
            res.json({ 
              message: "Login successful", 
              admin: { 
                id: user.id, 
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role_name,
                role_description: user.role_description,
                permissions: permissions.map(p => p.permission_name),
                last_login: user.last_login
              } 
            });
            
            console.log('Response headers after send:', res.getHeaders());
          });
        });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    });
  });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Logout error" });
    }
    res.json({ message: "Logout successful" });
  });
});

app.get("/api/admin/verify", (req, res) => {
  if (req.session && req.session.adminId) {
    // Get current user info with role and permissions
    const sql = `
      SELECT u.*, r.name as role_name, r.description as role_description
      FROM admin_users u
      LEFT JOIN admin_roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `;
    
    db.get(sql, [req.session.adminId], (err, user) => {
      if (err || !user) {
        return res.json({ authenticated: false });
      }
      
      // Get user permissions
      const permSql = `
        SELECT p.name as permission_name
        FROM admin_permissions p
        JOIN admin_role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
      `;
      
      db.all(permSql, [user.role_id], (err, permissions) => {
        if (err) {
          console.error(err);
          return res.json({ authenticated: false });
        }
        
        res.json({ 
          authenticated: true, 
          admin: { 
            id: user.id, 
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role_name,
            role_description: user.role_description,
            permissions: permissions.map(p => p.permission_name),
            last_login: user.last_login
          } 
        });
      });
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Helper function to get images from folder (copied from test-server.js)
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

// Helper function to get images for a menu item
function getImagesForItem(imageUrl) {
  // Parse the folder from image_url (e.g., "images/food/pasta/pasta_1.jpg" -> "pasta")
  const urlParts = imageUrl.split('/');
  if (urlParts.length >= 4 && urlParts[0] === 'images' && urlParts[1] === 'food') {
    const folderName = urlParts[2]; // Get the folder name, not the filename
    console.log(`🔍 Parsed folder "${folderName}" from imageUrl: ${imageUrl}`);
    const images = getImagesFromFolder(folderName);
    return images.length > 0 ? images : [imageUrl];
  }
  
  // If can't parse folder, return the original image_url
  console.log(`⚠️ Could not parse folder from imageUrl: ${imageUrl}`);
  return [imageUrl];
}

// GET /api/menu
app.get("/api/menu", (req, res) => {
  const menuQuery = `SELECT * FROM menu_items`;
  const variantsQuery = `SELECT * FROM menu_variants`;

  db.all(menuQuery, [], (err, menuItems) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    db.all(variantsQuery, [], (err, variants) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const menuWithVariants = menuItems.map((item) => ({
        ...item,
        variants: variants.filter((v) => v.menu_item_id === item.id),
        images: getImagesForItem(item.image_url), // Add images array for carousel
      }));

      res.json(menuWithVariants);
    });
  });
});

// GET /api/admin/orders?status=...&payment_status=...
app.get("/api/admin/orders", requirePermission('orders.view'), (req, res) => {
  let sql = "SELECT * FROM orders";
  const conditions = [];
  const params = [];

  if (req.query.status) {
    conditions.push("status = ?");
    params.push(req.query.status);
  }
  if (req.query.payment_status) {
    conditions.push("payment_status = ?");
    params.push(req.query.payment_status);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY created_at DESC";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// PUT /api/admin/orders/:id/status
app.put("/api/admin/orders/:id/status", requirePermission('orders.update'), (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status is required" });

  const validStatuses = ["New", "Processing", "Delivered", "Cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const sql = "UPDATE orders SET status = ? WHERE id = ?";
  db.run(sql, [status, id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ message: "Order status updated" });
  });
});

// PUT /api/admin/orders/:id/payment-status
app.put("/api/admin/orders/:id/payment-status", requirePermission('orders.update'), (req, res) => {
  const id = req.params.id;
  const { payment_status } = req.body;
  if (!payment_status)
    return res.status(400).json({ error: "Payment status is required" });

  const validStatuses = ["Pending", "Confirmed"];
  if (!validStatuses.includes(payment_status)) {
    return res.status(400).json({ error: "Invalid payment status value" });
  }

  const sql = "UPDATE orders SET payment_status = ? WHERE id = ?";
  db.run(sql, [payment_status, id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ message: "Payment status updated" });
  });
});

// POST /api/orders - Submit new order
app.post("/api/orders", (req, res) => {
  const { customer_name, phone, address, plus_code, payment_method, requested_delivery, items, total_price } = req.body;
  
  if (!customer_name || !phone || !address || !payment_method || !requested_delivery || !items || !total_price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order must contain at least one item" });
  }

  // Validate delivery date is at least 24 hours from now
  const deliveryDate = new Date(requested_delivery);
  const minDate = new Date();
  minDate.setHours(minDate.getHours() + 24);
  
  if (deliveryDate < minDate) {
    return res.status(400).json({ error: "Delivery must be at least 24 hours from now" });
  }

  // First, check stock availability for all items
  const stockCheckPromises = items.map(item => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          mii.ingredient_id,
          mii.quantity_needed,
          i.current_stock,
          i.name as ingredient_name
        FROM menu_item_ingredients mii
        JOIN ingredients i ON mii.ingredient_id = i.id
        WHERE mii.menu_item_id = ? AND (mii.menu_variant_id IS NULL OR mii.menu_variant_id = ?)
      `;
      
      db.all(sql, [item.menu_item_id, item.variant_id], (err, ingredients) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Check if we have enough stock for this item quantity
        for (let ingredient of ingredients) {
          const neededQuantity = ingredient.quantity_needed * item.quantity;
          if (ingredient.current_stock < neededQuantity) {
            reject(new Error(`Insufficient stock for ${ingredient.ingredient_name}. Needed: ${neededQuantity}, Available: ${ingredient.current_stock}`));
            return;
          }
        }
        
        resolve({ item, ingredients });
      });
    });
  });

  Promise.all(stockCheckPromises).then(stockData => {
    // All items have sufficient stock, proceed with order creation
    const orderSql = `INSERT INTO orders (customer_name, phone, address, plus_code, payment_method, total_price, status, payment_status, requested_delivery) 
                      VALUES (?, ?, ?, ?, ?, ?, 'New', 'Pending', ?)`;
    
    db.run(orderSql, [customer_name, phone, address, plus_code || null, payment_method, total_price, requested_delivery], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      const orderId = this.lastID;
      
      // Update stock levels for all ingredients used
      const stockUpdatePromises = [];
      
      stockData.forEach(({ item, ingredients }) => {
        ingredients.forEach(ingredient => {
          const quantityUsed = ingredient.quantity_needed * item.quantity;
          const newStock = ingredient.current_stock - quantityUsed;
          
          // Update ingredient stock
          stockUpdatePromises.push(new Promise((resolve, reject) => {
            db.run(
              "UPDATE ingredients SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [newStock, ingredient.ingredient_id],
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                
                // Log stock movement
                db.run(`
                  INSERT INTO stock_movements (ingredient_id, movement_type, quantity, reason, reference_id, reference_type)
                  VALUES (?, 'usage', ?, 'Order placed', ?, 'order')
                `, [ingredient.ingredient_id, -quantityUsed, orderId], (err) => {
                  if (err) {
                    console.error('Error logging stock movement:', err);
                    // Don't fail the order for logging errors
                  }
                  resolve();
                });
              }
            );
          }));
        });
      });
      
      // Execute all stock updates
      Promise.all(stockUpdatePromises).then(() => {
        res.json({ 
          message: "Order submitted successfully and inventory updated", 
          orderId: orderId,
          status: "New",
          payment_status: "Pending"
        });
      }).catch(err => {
        console.error('Error updating stock:', err);
        // Order was created, but stock update failed
        // In production, you might want to implement rollback logic
        res.json({ 
          message: "Order submitted successfully, but inventory update encountered issues", 
          orderId: orderId,
          status: "New",
          payment_status: "Pending",
          warning: "Stock levels may not be accurate"
        });
      });
    });
  }).catch(err => {
    console.error('Stock check failed:', err);
    return res.status(400).json({ error: err.message || "Insufficient stock for order" });
  });
});

// Revenue report: aggregate total sales by date and payment method
app.get("/api/admin/revenue", requirePermission('revenue.view'), (req, res) => {
  const sql = `
    SELECT
      DATE(requested_delivery) as date,
      payment_method,
      SUM(total_price) as total_revenue
    FROM orders
    WHERE payment_status = 'Confirmed'
    GROUP BY date, payment_method
    ORDER BY date DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// Expenses CRUD endpoints

// Get all expenses with optional date filter
app.get("/api/admin/expenses", requirePermission('expenses.view'), (req, res) => {
  let sql = "SELECT * FROM expenses";
  const params = [];

  if (req.query.startDate && req.query.endDate) {
    sql += " WHERE date BETWEEN ? AND ?";
    params.push(req.query.startDate, req.query.endDate);
  }

  sql += " ORDER BY date DESC";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// Add new expense
app.post("/api/admin/expenses", requirePermission('expenses.create'), (req, res) => {
  const { date, category, amount, notes } = req.body;
  if (!date || !category || !amount) {
    return res
      .status(400)
      .json({ error: "Date, category, and amount are required" });
  }

  const sql = `INSERT INTO expenses (date, category, amount, notes) VALUES (?, ?, ?, ?)`;
  db.run(sql, [date, category, amount, notes || null], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ id: this.lastID });
  });
});

// Update expense
app.put("/api/admin/expenses/:id", requirePermission('expenses.update'), (req, res) => {
  const { date, category, amount, notes } = req.body;
  const id = req.params.id;
  if (!date || !category || !amount) {
    return res
      .status(400)
      .json({ error: "Date, category, and amount are required" });
  }

  const sql = `UPDATE expenses SET date = ?, category = ?, amount = ?, notes = ? WHERE id = ?`;
  db.run(sql, [date, category, amount, notes || null, id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json({ message: "Expense updated" });
  });
});

// Delete expense
app.delete("/api/admin/expenses/:id", requirePermission('expenses.delete'), (req, res) => {
  const id = req.params.id;
  const sql = `DELETE FROM expenses WHERE id = ?`;
  db.run(sql, [id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json({ message: "Expense deleted" });
  });
});

// GET /api/track-order/:orderId/:phone - Customer order tracking
app.get("/api/track-order/:orderId/:phone", (req, res) => {
  const { orderId, phone } = req.params;
  
  if (!orderId || !phone) {
    return res.status(400).json({ error: "Order ID and phone number are required" });
  }

  // Validate order ID is numeric
  if (!/^\d+$/.test(orderId)) {
    return res.status(400).json({ error: "Invalid order ID format" });
  }

  // Validate phone number format (10-15 digits)
  if (!/^[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  const sql = "SELECT * FROM orders WHERE id = ? AND phone = ?";
  db.get(sql, [orderId, phone], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!row) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.json(row);
  });
});

// Feedback API endpoints

// POST /api/feedback - Submit customer feedback
app.post("/api/feedback", (req, res) => {
  const { order_id, customer_name, phone, rating, comment } = req.body;
  
  if (!order_id || !customer_name || !phone || !rating) {
    return res.status(400).json({ error: "Order ID, customer name, phone, and rating are required" });
  }

  // Validate rating is between 1-5
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  // First verify the order exists and belongs to the customer
  const orderSql = "SELECT * FROM orders WHERE id = ? AND customer_name = ? AND phone = ?";
  db.get(orderSql, [order_id, customer_name, phone], (err, order) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!order) {
      return res.status(404).json({ error: "Order not found or customer details don't match" });
    }

    // Check if feedback already exists for this order
    const checkFeedbackSql = "SELECT id FROM feedback WHERE order_id = ?";
    db.get(checkFeedbackSql, [order_id], (err, existingFeedback) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (existingFeedback) {
        return res.status(400).json({ error: "Feedback already submitted for this order" });
      }

      // Insert the feedback
      const insertSql = `INSERT INTO feedback (order_id, customer_name, phone, rating, comment) 
                         VALUES (?, ?, ?, ?, ?)`;
      
      db.run(insertSql, [order_id, customer_name, phone, rating, comment || null], function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Database error" });
        }
        
        res.json({ 
          message: "Feedback submitted successfully", 
          feedbackId: this.lastID,
          status: "pending"
        });
      });
    });
  });
});

// GET /api/feedback/check/:orderId/:phone - Check if feedback exists for order
app.get("/api/feedback/check/:orderId/:phone", (req, res) => {
  const { orderId, phone } = req.params;
  
  if (!orderId || !phone) {
    return res.status(400).json({ error: "Order ID and phone number are required" });
  }

  const sql = `SELECT f.id, f.rating, f.comment, f.status, f.created_at 
               FROM feedback f 
               INNER JOIN orders o ON f.order_id = o.id 
               WHERE f.order_id = ? AND f.phone = ?`;
               
  db.get(sql, [orderId, phone], (err, feedback) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    res.json({ 
      hasFeedback: !!feedback,
      feedback: feedback || null
    });
  });
});

// Admin Feedback Management APIs (protected)

// GET /api/admin/feedback - Get all feedback with filtering
app.get("/api/admin/feedback", requirePermission('feedback.view'), (req, res) => {
  let sql = `SELECT f.*, o.customer_name as order_customer_name, o.total_price 
             FROM feedback f 
             INNER JOIN orders o ON f.order_id = o.id`;
  const conditions = [];
  const params = [];

  if (req.query.status) {
    conditions.push("f.status = ?");
    params.push(req.query.status);
  }

  if (req.query.rating) {
    conditions.push("f.rating = ?");
    params.push(req.query.rating);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  
  sql += " ORDER BY f.created_at DESC";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// PUT /api/admin/feedback/:id/status - Update feedback status (approve/reject)
app.put("/api/admin/feedback/:id/status", requirePermission('feedback.moderate'), (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const adminUsername = req.session.adminUsername;
  
  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const validStatuses = ["pending", "approved", "rejected"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const sql = `UPDATE feedback 
               SET status = ?, moderated_at = CURRENT_TIMESTAMP, moderated_by = ? 
               WHERE id = ?`;
               
  db.run(sql, [status, adminUsername, id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json({ message: "Feedback status updated" });
  });
});

// DELETE /api/admin/feedback/:id - Delete feedback
app.delete("/api/admin/feedback/:id", requirePermission('feedback.delete'), (req, res) => {
  const id = req.params.id;
  
  const sql = "DELETE FROM feedback WHERE id = ?";
  db.run(sql, [id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json({ message: "Feedback deleted" });
  });
});

// GET /api/admin/feedback/stats - Get feedback statistics
app.get("/api/admin/feedback/stats", requirePermission('feedback.view'), (req, res) => {
  const statsSql = `
    SELECT 
      COUNT(*) as total_feedback,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
      AVG(CAST(rating as FLOAT)) as average_rating,
      COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
      COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
      COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
      COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
      COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
    FROM feedback
  `;
  
  db.get(statsSql, [], (err, stats) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(stats);
  });
});

// Analytics Tracking System

// Utility function to generate session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Analytics middleware to track page views
function trackPageView(req, res, next) {
  // Only track API calls that represent page navigation
  if (req.path.startsWith('/api/') && !req.path.includes('/analytics')) {
    const sessionId = req.headers['x-session-id'] || generateSessionId();
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const isAdmin = req.session && req.session.adminId ? true : false;
    const adminUsername = req.session && req.session.adminUsername ? req.session.adminUsername : null;

    // Update or create session
    const sessionSql = `
      INSERT OR REPLACE INTO analytics_sessions 
      (session_id, ip_address, user_agent, is_admin, admin_username, last_activity)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    db.run(sessionSql, [sessionId, ipAddress, userAgent, isAdmin, adminUsername], (err) => {
      if (err) {
        console.error('Analytics session error:', err);
      }
    });

    // Track the API call as an event
    const eventSql = `
      INSERT INTO analytics_events 
      (session_id, event_type, event_category, event_action, page_path)
      VALUES (?, 'api_call', 'backend', ?, ?)
    `;

    db.run(eventSql, [sessionId, req.method, req.path], (err) => {
      if (err) {
        console.error('Analytics event error:', err);
      }
    });
  }
  next();
}

// Analytics API Endpoints

// POST /api/analytics/page-view - Track frontend page views
app.post("/api/analytics/page-view", (req, res) => {
  const { sessionId, pagePath, pageTitle, referrer, timeOnPage } = req.body;
  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!sessionId || !pagePath) {
    return res.status(400).json({ error: "Session ID and page path are required" });
  }

  // Ensure session exists
  const sessionSql = `
    INSERT OR IGNORE INTO analytics_sessions 
    (session_id, ip_address, user_agent, started_at, last_activity)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  db.run(sessionSql, [sessionId, ipAddress, userAgent], (err) => {
    if (err) {
      console.error('Session creation error:', err);
    }

    // Record page view
    const pageViewSql = `
      INSERT INTO analytics_page_views 
      (session_id, page_path, page_title, referrer, time_on_page)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(pageViewSql, [sessionId, pagePath, pageTitle, referrer, timeOnPage], (err) => {
      if (err) {
        console.error('Page view tracking error:', err);
        return res.status(500).json({ error: "Failed to track page view" });
      }
      res.json({ success: true });
    });
  });
});

// POST /api/analytics/event - Track custom events
app.post("/api/analytics/event", (req, res) => {
  const { sessionId, eventType, eventCategory, eventAction, eventLabel, eventValue, pagePath } = req.body;

  if (!sessionId || !eventType) {
    return res.status(400).json({ error: "Session ID and event type are required" });
  }

  const eventSql = `
    INSERT INTO analytics_events 
    (session_id, event_type, event_category, event_action, event_label, event_value, page_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(eventSql, [sessionId, eventType, eventCategory, eventAction, eventLabel, eventValue, pagePath], (err) => {
    if (err) {
      console.error('Event tracking error:', err);
      return res.status(500).json({ error: "Failed to track event" });
    }
    res.json({ success: true });
  });
});

// Admin Analytics APIs (protected)

// GET /api/admin/analytics/overview - Get analytics overview
app.get("/api/admin/analytics/overview", requirePermission('analytics.view'), (req, res) => {
  const { startDate, endDate } = req.query;
  
  let dateFilter = "";
  let params = [];
  
  if (startDate && endDate) {
    dateFilter = "WHERE DATE(started_at) BETWEEN ? AND ?";
    params = [startDate, endDate];
  }

  const overviewSql = `
    SELECT 
      COUNT(DISTINCT session_id) as total_sessions,
      COUNT(DISTINCT CASE WHEN is_admin = 0 THEN session_id END) as user_sessions,
      COUNT(DISTINCT CASE WHEN is_admin = 1 THEN session_id END) as admin_sessions,
      AVG(JULIANDAY(last_activity) - JULIANDAY(started_at)) * 24 * 60 as avg_session_duration_minutes
    FROM analytics_sessions 
    ${dateFilter}
  `;

  db.get(overviewSql, params, (err, overview) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    // Get page views count
    let pageViewSql = "SELECT COUNT(*) as total_page_views FROM analytics_page_views";
    let pageViewParams = [];
    
    if (startDate && endDate) {
      pageViewSql += " WHERE DATE(viewed_at) BETWEEN ? AND ?";
      pageViewParams = [startDate, endDate];
    }

    db.get(pageViewSql, pageViewParams, (err, pageViews) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      // Get events count
      let eventSql = "SELECT COUNT(*) as total_events FROM analytics_events";
      let eventParams = [];
      
      if (startDate && endDate) {
        eventSql += " WHERE DATE(occurred_at) BETWEEN ? AND ?";
        eventParams = [startDate, endDate];
      }

      db.get(eventSql, eventParams, (err, events) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Database error" });
        }

        res.json({
          ...overview,
          ...pageViews,
          ...events
        });
      });
    });
  });
});

// GET /api/admin/analytics/page-views - Get page view analytics
app.get("/api/admin/analytics/page-views", requirePermission('analytics.view'), (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  
  let dateFilter = "";
  let params = [];
  let groupByClause = "";
  
  if (startDate && endDate) {
    dateFilter = "WHERE DATE(viewed_at) BETWEEN ? AND ?";
    params = [startDate, endDate];
  }

  if (groupBy === 'day') {
    groupByClause = "GROUP BY DATE(viewed_at) ORDER BY DATE(viewed_at) DESC";
  } else if (groupBy === 'page') {
    groupByClause = "GROUP BY page_path ORDER BY COUNT(*) DESC";
  }

  const sql = `
    SELECT 
      page_path,
      COUNT(*) as views,
      COUNT(DISTINCT session_id) as unique_visitors,
      AVG(time_on_page) as avg_time_on_page,
      DATE(viewed_at) as date
    FROM analytics_page_views 
    ${dateFilter}
    ${groupByClause}
    LIMIT 50
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// GET /api/admin/analytics/events - Get event analytics
app.get("/api/admin/analytics/events", requirePermission('analytics.view'), (req, res) => {
  const { startDate, endDate, eventType, groupBy } = req.query;
  
  let conditions = [];
  let params = [];
  
  if (startDate && endDate) {
    conditions.push("DATE(occurred_at) BETWEEN ? AND ?");
    params.push(startDate, endDate);
  }
  
  if (eventType) {
    conditions.push("event_type = ?");
    params.push(eventType);
  }

  let whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  
  let groupByClause = "";
  if (groupBy === 'day') {
    groupByClause = "GROUP BY DATE(occurred_at) ORDER BY DATE(occurred_at) DESC";
  } else if (groupBy === 'type') {
    groupByClause = "GROUP BY event_type, event_category, event_action ORDER BY COUNT(*) DESC";
  }

  const sql = `
    SELECT 
      event_type,
      event_category,
      event_action,
      event_label,
      COUNT(*) as event_count,
      COUNT(DISTINCT session_id) as unique_sessions,
      DATE(occurred_at) as date
    FROM analytics_events 
    ${whereClause}
    ${groupByClause}
    LIMIT 50
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// GET /api/admin/analytics/sessions - Get session analytics
app.get("/api/admin/analytics/sessions", requirePermission('analytics.view'), (req, res) => {
  const { startDate, endDate } = req.query;
  
  let dateFilter = "";
  let params = [];
  
  if (startDate && endDate) {
    dateFilter = "WHERE DATE(started_at) BETWEEN ? AND ?";
    params = [startDate, endDate];
  }

  const sql = `
    SELECT 
      DATE(started_at) as date,
      COUNT(*) as sessions,
      COUNT(DISTINCT ip_address) as unique_visitors,
      AVG(JULIANDAY(last_activity) - JULIANDAY(started_at)) * 24 * 60 as avg_duration_minutes,
      COUNT(CASE WHEN is_admin = 1 THEN 1 END) as admin_sessions
    FROM analytics_sessions 
    ${dateFilter}
    GROUP BY DATE(started_at)
    ORDER BY DATE(started_at) DESC
    LIMIT 30
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// Admin User Management APIs

// GET /api/admin/users - Get all admin users
app.get("/api/admin/users", requirePermission('users.view'), (req, res) => {
  const sql = `
    SELECT u.id, u.username, u.full_name, u.email, u.is_active, u.last_login, u.created_at,
           r.name as role_name, r.description as role_description
    FROM admin_users u
    LEFT JOIN admin_roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    // Don't return password field
    const users = rows.map(user => ({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at,
      role_name: user.role_name,
      role_description: user.role_description
    }));
    
    res.json(users);
  });
});

// POST /api/admin/users - Create new admin user
app.post("/api/admin/users", requirePermission('users.create'), (req, res) => {
  const { username, password, full_name, email, role_id, is_active } = req.body;
  
  if (!username || !password || !full_name || !email || !role_id) {
    return res.status(400).json({ error: "Username, password, full name, email, and role are required" });
  }

  // Check if username already exists
  db.get("SELECT id FROM admin_users WHERE username = ?", [username], (err, existingUser) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error hashing password" });
      }

      const sql = `
        INSERT INTO admin_users (username, password, full_name, email, role_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [username, hashedPassword, full_name, email, role_id, is_active !== false ? 1 : 0], function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Database error" });
        }
        
        res.json({ 
          message: "Admin user created successfully", 
          userId: this.lastID 
        });
      });
    });
  });
});

// PUT /api/admin/users/:id - Update admin user
app.put("/api/admin/users/:id", requirePermission('users.update'), (req, res) => {
  const userId = req.params.id;
  const { username, full_name, email, role_id, is_active } = req.body;
  
  if (!username || !full_name || !email || !role_id) {
    return res.status(400).json({ error: "Username, full name, email, and role are required" });
  }

  // Check if username already exists for other users
  db.get("SELECT id FROM admin_users WHERE username = ? AND id != ?", [username, userId], (err, existingUser) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const sql = `
      UPDATE admin_users 
      SET username = ?, full_name = ?, email = ?, role_id = ?, is_active = ?
      WHERE id = ?
    `;
    
    db.run(sql, [username, full_name, email, role_id, is_active !== false ? 1 : 0, userId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ message: "Admin user updated successfully" });
    });
  });
});

// PUT /api/admin/users/:id/password - Change user password
app.put("/api/admin/users/:id/password", requirePermission('users.update'), (req, res) => {
  const userId = req.params.id;
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  // Hash new password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error hashing password" });
    }

    const sql = "UPDATE admin_users SET password = ? WHERE id = ?";
    
    db.run(sql, [hashedPassword, userId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ message: "Password updated successfully" });
    });
  });
});

// DELETE /api/admin/users/:id - Delete admin user
app.delete("/api/admin/users/:id", requirePermission('users.delete'), (req, res) => {
  const userId = req.params.id;
  
  // Prevent deleting yourself
  if (req.adminUser && req.adminUser.id == userId) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  const sql = "DELETE FROM admin_users WHERE id = ?";
  
  db.run(sql, [userId], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ message: "Admin user deleted successfully" });
  });
});

// Role Management APIs

// GET /api/admin/roles - Get all roles with permissions
app.get("/api/admin/roles", requirePermission('roles.view'), (req, res) => {
  const sql = `
    SELECT r.id, r.name, r.description, r.created_at,
           GROUP_CONCAT(p.name) as permissions
    FROM admin_roles r
    LEFT JOIN admin_role_permissions rp ON r.id = rp.role_id
    LEFT JOIN admin_permissions p ON rp.permission_id = p.id
    GROUP BY r.id, r.name, r.description, r.created_at
    ORDER BY r.name
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    const roles = rows.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      created_at: role.created_at,
      permissions: role.permissions ? role.permissions.split(',') : []
    }));
    
    res.json(roles);
  });
});

// GET /api/admin/permissions - Get all available permissions
app.get("/api/admin/permissions", requirePermission('roles.view'), (req, res) => {
  const sql = `
    SELECT id, name, description, resource, action
    FROM admin_permissions
    ORDER BY resource, action
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// POST /api/admin/roles - Create new role
app.post("/api/admin/roles", requirePermission('roles.create'), (req, res) => {
  const { name, description, permissions } = req.body;
  
  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required" });
  }

  // Check if role name already exists
  db.get("SELECT id FROM admin_roles WHERE name = ?", [name], (err, existingRole) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (existingRole) {
      return res.status(400).json({ error: "Role name already exists" });
    }

    const sql = "INSERT INTO admin_roles (name, description) VALUES (?, ?)";
    
    db.run(sql, [name, description], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      const roleId = this.lastID;
      
      // Add permissions if provided
      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        const permissionPromises = permissions.map(permissionId => {
          return new Promise((resolve, reject) => {
            db.run(
              "INSERT INTO admin_role_permissions (role_id, permission_id) VALUES (?, ?)",
              [roleId, permissionId],
              (err) => err ? reject(err) : resolve()
            );
          });
        });
        
        Promise.all(permissionPromises).then(() => {
          res.json({ message: "Role created successfully", roleId: roleId });
        }).catch((err) => {
          console.error(err);
          res.status(500).json({ error: "Error assigning permissions" });
        });
      } else {
        res.json({ message: "Role created successfully", roleId: roleId });
      }
    });
  });
});

// PUT /api/admin/roles/:id - Update role
app.put("/api/admin/roles/:id", requirePermission('roles.update'), (req, res) => {
  const roleId = req.params.id;
  const { name, description, permissions } = req.body;
  
  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required" });
  }

  // Check if role name already exists for other roles
  db.get("SELECT id FROM admin_roles WHERE name = ? AND id != ?", [name, roleId], (err, existingRole) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (existingRole) {
      return res.status(400).json({ error: "Role name already exists" });
    }

    const sql = "UPDATE admin_roles SET name = ?, description = ? WHERE id = ?";
    
    db.run(sql, [name, description, roleId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: "Role not found" });
      }

      // Update permissions if provided
      if (permissions && Array.isArray(permissions)) {
        // First delete existing permissions
        db.run("DELETE FROM admin_role_permissions WHERE role_id = ?", [roleId], (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error updating permissions" });
          }

          // Add new permissions
          if (permissions.length > 0) {
            const permissionPromises = permissions.map(permissionId => {
              return new Promise((resolve, reject) => {
                db.run(
                  "INSERT INTO admin_role_permissions (role_id, permission_id) VALUES (?, ?)",
                  [roleId, permissionId],
                  (err) => err ? reject(err) : resolve()
                );
              });
            });
            
            Promise.all(permissionPromises).then(() => {
              res.json({ message: "Role updated successfully" });
            }).catch((err) => {
              console.error(err);
              res.status(500).json({ error: "Error updating permissions" });
            });
          } else {
            res.json({ message: "Role updated successfully" });
          }
        });
      } else {
        res.json({ message: "Role updated successfully" });
      }
    });
  });
});

// DELETE /api/admin/roles/:id - Delete role
app.delete("/api/admin/roles/:id", requirePermission('roles.delete'), (req, res) => {
  const roleId = req.params.id;
  
  // Check if any users are assigned to this role
  db.get("SELECT COUNT(*) as count FROM admin_users WHERE role_id = ?", [roleId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (result.count > 0) {
      return res.status(400).json({ error: "Cannot delete role that is assigned to users" });
    }

    const sql = "DELETE FROM admin_roles WHERE id = ?";
    
    db.run(sql, [roleId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      res.json({ message: "Role deleted successfully" });
    });
  });
});

// Inventory Management APIs

// GET /api/admin/inventory - Get all ingredients with stock levels
app.get("/api/admin/inventory", requirePermission('inventory.view'), (req, res) => {
  const sql = `
    SELECT 
      i.*,
      CASE 
        WHEN i.current_stock <= i.minimum_stock THEN 'low'
        WHEN i.current_stock = 0 THEN 'out'
        ELSE 'ok'
      END as stock_status,
      COUNT(mii.id) as used_in_items
    FROM ingredients i
    LEFT JOIN menu_item_ingredients mii ON i.id = mii.ingredient_id
    GROUP BY i.id
    ORDER BY i.name
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// GET /api/admin/inventory/movements - Get stock movement history
app.get("/api/admin/inventory/movements", requirePermission('inventory.view'), (req, res) => {
  const { ingredient_id, movement_type, limit = 50 } = req.query;
  
  let sql = `
    SELECT sm.*, i.name as ingredient_name, i.unit, au.username as admin_username
    FROM stock_movements sm
    JOIN ingredients i ON sm.ingredient_id = i.id
    LEFT JOIN admin_users au ON sm.admin_id = au.id
    WHERE 1=1
  `;
  const params = [];
  
  if (ingredient_id) {
    sql += " AND sm.ingredient_id = ?";
    params.push(ingredient_id);
  }
  
  if (movement_type) {
    sql += " AND sm.movement_type = ?";
    params.push(movement_type);
  }
  
  sql += " ORDER BY sm.created_at DESC LIMIT ?";
  params.push(parseInt(limit));
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// GET /api/admin/inventory/:id - Get specific ingredient details
app.get("/api/admin/inventory/:id", requirePermission('inventory.view'), (req, res) => {
  const ingredientId = req.params.id;
  
  const sql = `
    SELECT 
      i.*,
      CASE 
        WHEN i.current_stock <= i.minimum_stock THEN 'low'
        WHEN i.current_stock = 0 THEN 'out'
        ELSE 'ok'
      END as stock_status
    FROM ingredients i
    WHERE i.id = ?
  `;
  
  db.get(sql, [ingredientId], (err, ingredient) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }
    
    // Get recent stock movements
    const movementsSql = `
      SELECT sm.*, au.username as admin_username
      FROM stock_movements sm
      LEFT JOIN admin_users au ON sm.admin_id = au.id
      WHERE sm.ingredient_id = ?
      ORDER BY sm.created_at DESC
      LIMIT 20
    `;
    
    db.all(movementsSql, [ingredientId], (err, movements) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      res.json({
        ...ingredient,
        recent_movements: movements
      });
    });
  });
});

// POST /api/admin/inventory - Create new ingredient
app.post("/api/admin/inventory", requirePermission('inventory.manage'), (req, res) => {
  const { name, description, unit, current_stock, minimum_stock, cost_per_unit, supplier } = req.body;
  
  if (!name || !unit || current_stock === undefined || minimum_stock === undefined) {
    return res.status(400).json({ error: "Name, unit, current stock, and minimum stock are required" });
  }

  const sql = `
    INSERT INTO ingredients (name, description, unit, current_stock, minimum_stock, cost_per_unit, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [name, description, unit, current_stock, minimum_stock, cost_per_unit || 0, supplier], function(err) {
    if (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ error: "Ingredient name already exists" });
      }
      return res.status(500).json({ error: "Database error" });
    }
    
    // Log initial stock as a purchase movement
    if (current_stock > 0) {
      db.run(`
        INSERT INTO stock_movements (ingredient_id, movement_type, quantity, reason, admin_id)
        VALUES (?, 'purchase', ?, 'Initial stock', ?)
      `, [this.lastID, current_stock, req.adminUser?.id]);
    }
    
    res.json({ 
      message: "Ingredient created successfully", 
      ingredientId: this.lastID 
    });
  });
});

// PUT /api/admin/inventory/:id - Update ingredient
app.put("/api/admin/inventory/:id", requirePermission('inventory.manage'), (req, res) => {
  const ingredientId = req.params.id;
  const { name, description, unit, minimum_stock, cost_per_unit, supplier } = req.body;
  
  if (!name || !unit || minimum_stock === undefined) {
    return res.status(400).json({ error: "Name, unit, and minimum stock are required" });
  }

  const sql = `
    UPDATE ingredients 
    SET name = ?, description = ?, unit = ?, minimum_stock = ?, cost_per_unit = ?, supplier = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(sql, [name, description, unit, minimum_stock, cost_per_unit || 0, supplier, ingredientId], function(err) {
    if (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ error: "Ingredient name already exists" });
      }
      return res.status(500).json({ error: "Database error" });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: "Ingredient not found" });
    }
    
    res.json({ message: "Ingredient updated successfully" });
  });
});

// PUT /api/admin/inventory/:id/stock - Update stock quantity
app.put("/api/admin/inventory/:id/stock", requirePermission('inventory.update'), (req, res) => {
  const ingredientId = req.params.id;
  const { quantity, movement_type, reason } = req.body;
  
  if (quantity === undefined || !movement_type) {
    return res.status(400).json({ error: "Quantity and movement type are required" });
  }

  const validTypes = ['purchase', 'adjustment', 'waste'];
  if (!validTypes.includes(movement_type)) {
    return res.status(400).json({ error: "Invalid movement type" });
  }

  // Get current stock
  db.get("SELECT current_stock FROM ingredients WHERE id = ?", [ingredientId], (err, ingredient) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    const newStock = ingredient.current_stock + quantity;
    if (newStock < 0) {
      return res.status(400).json({ error: "Cannot reduce stock below zero" });
    }

    // Update stock
    db.run("UPDATE ingredients SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
      [newStock, ingredientId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      // Log stock movement
      db.run(`
        INSERT INTO stock_movements (ingredient_id, movement_type, quantity, reason, admin_id)
        VALUES (?, ?, ?, ?, ?)
      `, [ingredientId, movement_type, quantity, reason, req.adminUser?.id], (err) => {
        if (err) {
          console.error(err);
          // Don't fail the request if logging fails
        }
      });

      res.json({ 
        message: "Stock updated successfully",
        new_stock: newStock
      });
    });
  });
});

// DELETE /api/admin/inventory/:id - Delete ingredient
app.delete("/api/admin/inventory/:id", requirePermission('inventory.manage'), (req, res) => {
  const ingredientId = req.params.id;
  
  // Check if ingredient is used in any menu items
  db.get("SELECT COUNT(*) as count FROM menu_item_ingredients WHERE ingredient_id = ?", [ingredientId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (result.count > 0) {
      return res.status(400).json({ error: "Cannot delete ingredient that is used in menu items" });
    }

    db.run("DELETE FROM ingredients WHERE id = ?", [ingredientId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      
      res.json({ message: "Ingredient deleted successfully" });
    });
  });
});


// GET /api/menu-availability - Check menu item availability (public endpoint)
app.get("/api/menu-availability", (req, res) => {
  const sql = `
    SELECT 
      mi.id,
      mi.name,
      mv.id as variant_id,
      mv.name as variant_name,
      CASE 
        WHEN MIN(i.current_stock / mii.quantity_needed) >= 1 THEN 'available'
        ELSE 'out_of_stock'
      END as availability_status,
      MIN(CAST(i.current_stock / mii.quantity_needed AS INTEGER)) as max_quantity_available
    FROM menu_items mi
    LEFT JOIN menu_variants mv ON mi.id = mv.menu_item_id
    LEFT JOIN menu_item_ingredients mii ON (mi.id = mii.menu_item_id AND (mii.menu_variant_id IS NULL OR mii.menu_variant_id = mv.id))
    LEFT JOIN ingredients i ON mii.ingredient_id = i.id
    GROUP BY mi.id, mv.id
    ORDER BY mi.name, mv.name
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// DELETE /api/admin/orders/all - Delete all orders (for testing)
app.delete("/api/admin/orders/all", requirePermission('orders.update'), (req, res) => {
  const sql = "DELETE FROM orders";
  db.run(sql, [], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ 
      message: "All orders deleted successfully", 
      deletedCount: this.changes 
    });
  });
});

// Apply analytics middleware to all routes (but not analytics endpoints themselves)
app.use((req, res, next) => {
  // Don't track analytics API calls to avoid infinite loops
  if (!req.path.includes('/analytics')) {
    trackPageView(req, res, next);
  } else {
    next();
  }
});

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Initialize server
initServer().catch(console.error);
