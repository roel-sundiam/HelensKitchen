// MongoDB Models for Helen's Kitchen
const mongoose = require('mongoose');

// Use environment variable for MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Menu Item Schema
const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image_url: { type: String, required: true },
  images: [{ type: String }],
  base_price: { type: Number, required: true }
}, { timestamps: true });

// Menu Variant Schema
const menuVariantSchema = new mongoose.Schema({
  menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true }
}, { timestamps: true });

// Order Schema
const orderSchema = new mongoose.Schema({
  customer_name: { type: String, required: true },
  phone: { type: String, required: true },
  delivery_option: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' },
  address: { type: String, required: true },
  plus_code: { type: String },
  payment_method: { type: String, required: true },
  total_price: { type: Number, required: true },
  delivery_fee: { type: Number, default: 0 },
  delivery_fee_status: { type: String, enum: ['pending', 'set', 'not_applicable'], default: 'pending' },
  quotation_id: { type: String },
  status: { type: String, enum: ['New', 'Processing', 'Delivered', 'Cancelled'], default: 'New' },
  payment_status: { type: String, enum: ['Pending', 'Confirmed'], default: 'Pending' },
  requested_delivery: { type: Date, required: true },
  items: [{
    menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    variant_name: String,
    quantity: Number,
    price: Number
  }]
}, { timestamps: true });

// Admin User Schema
const adminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: String,
  email: String,
  role_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminRole' },
  is_active: { type: Boolean, default: true },
  last_login: Date
}, { timestamps: true });

// Admin Role Schema
const adminRoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String
}, { timestamps: true });

// Admin Permission Schema
const adminPermissionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  resource: { type: String, required: true },
  action: { type: String, required: true }
}, { timestamps: true });

// Admin Role Permission Schema (many-to-many)
const adminRolePermissionSchema = new mongoose.Schema({
  role_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminRole', required: true },
  permission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminPermission', required: true }
}, { timestamps: true });

// Expense Schema
const expenseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  notes: String
}, { timestamps: true });

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  customer_name: { type: String, required: true },
  phone: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  moderated_at: Date,
  moderated_by: String
}, { timestamps: true });

// Analytics Session Schema
const analyticsSessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true },
  ip_address: String,
  user_agent: String,
  started_at: { type: Date, default: Date.now },
  last_activity: { type: Date, default: Date.now },
  is_admin: { type: Boolean, default: false },
  admin_username: String
}, { timestamps: true });

// Analytics Page View Schema
const analyticsPageViewSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  page_path: { type: String, required: true },
  page_title: String,
  referrer: String,
  viewed_at: { type: Date, default: Date.now },
  time_on_page: Number
}, { timestamps: true });

// Analytics Event Schema
const analyticsEventSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  event_type: { type: String, required: true },
  event_category: String,
  event_action: String,
  event_label: String,
  event_value: Number,
  page_path: String,
  occurred_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Ingredient Schema
const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  unit: { type: String, required: true },
  current_stock: { type: Number, default: 0 },
  minimum_stock: { type: Number, default: 0 },
  cost_per_unit: { type: Number, default: 0 },
  supplier: String
}, { timestamps: true });

// Menu Item Ingredient Schema (recipe mapping)
const menuItemIngredientSchema = new mongoose.Schema({
  menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  menu_variant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuVariant' },
  ingredient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  quantity_needed: { type: Number, required: true }
}, { timestamps: true });

// Stock Movement Schema
const stockMovementSchema = new mongoose.Schema({
  ingredient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  movement_type: { type: String, enum: ['purchase', 'usage', 'adjustment', 'waste'], required: true },
  quantity: { type: Number, required: true },
  reason: String,
  reference_id: mongoose.Schema.Types.ObjectId,
  reference_type: String,
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' }
}, { timestamps: true });

// Push Notification Subscription Schema
const pushSubscriptionSchema = new mongoose.Schema({
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  user_agent: String,
  is_active: { type: Boolean, default: true },
  last_used: { type: Date, default: Date.now }
}, { timestamps: true });

// Create compound index for efficient queries
pushSubscriptionSchema.index({ admin_id: 1, endpoint: 1 }, { unique: true });

// Create models
const MenuItem = mongoose.model('MenuItem', menuItemSchema);
const MenuVariant = mongoose.model('MenuVariant', menuVariantSchema);
const Order = mongoose.model('Order', orderSchema);
const AdminUser = mongoose.model('AdminUser', adminUserSchema);
const AdminRole = mongoose.model('AdminRole', adminRoleSchema);
const AdminPermission = mongoose.model('AdminPermission', adminPermissionSchema);
const AdminRolePermission = mongoose.model('AdminRolePermission', adminRolePermissionSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const AnalyticsSession = mongoose.model('AnalyticsSession', analyticsSessionSchema);
const AnalyticsPageView = mongoose.model('AnalyticsPageView', analyticsPageViewSchema);
const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
const Ingredient = mongoose.model('Ingredient', ingredientSchema);
const MenuItemIngredient = mongoose.model('MenuItemIngredient', menuItemIngredientSchema);
const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

module.exports = {
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
  PushSubscription
};