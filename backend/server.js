require('dotenv').config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

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
  StockMovement
} = require('./models');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const corsOptions = {
  origin: [
    'http://localhost:4200',
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

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'helens_kitchen_jwt_secret_2024';

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
          address: order.address,
          plus_code: order.plus_code,
          payment_method: order.payment_method,
          total_price: order.total_price,
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

    // POST /api/orders - Submit new order
    app.post("/api/orders", async (req, res) => {
      const { customer_name, phone, address, plus_code, payment_method, requested_delivery, items, total_price } = req.body;
      
      if (!customer_name || !phone || !address || !payment_method || !requested_delivery || !items || !total_price) {
        return res.status(400).json({ error: "All required fields must be provided" });
      }

      try {
        const order = await Order.create({
          customer_name,
          phone,
          address,
          plus_code,
          payment_method,
          total_price,
          requested_delivery: new Date(requested_delivery),
          items: items.map(item => ({
            menu_item_id: item.menuItemId,
            variant_name: item.variant,
            quantity: item.quantity,
            price: item.price
          }))
        });

        console.log('Order created successfully:', order._id);
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
        
        // Format response to match frontend expectations
        const formattedOrder = {
          id: order._id,
          customer_name: order.customer_name,
          phone: order.phone,
          address: order.address,
          plus_code: order.plus_code,
          payment_method: order.payment_method,
          total_price: order.total_price,
          status: order.status,
          payment_status: order.payment_status,
          requested_delivery: order.requested_delivery,
          created_at: order.createdAt,
          items: order.items.map(item => {
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
              // Fallback for legacy orders without menu_item_id populated
              return {
                menu_item_id: null,
                name: item.variant_name || 'Menu Item',
                description: 'Item details not available',
                image_url: '/assets/images/placeholder-food.jpg',
                variant_name: item.variant_name,
                quantity: item.quantity,
                price: item.price
              };
            }
          })
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

        const revenueData = await Order.aggregate([
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

        res.json(revenueData);
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
          created_at: ingredient.createdAt
        }));

        res.json(formattedIngredients);
      } catch (error) {
        console.error('Error fetching inventory:', error);
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