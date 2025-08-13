const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcrypt');

let db;

// Initialize the database
async function initializeDatabase() {
  const SQL = await initSqlJs();
  
  // Try to load existing database
  let filebuffer;
  try {
    filebuffer = fs.readFileSync('./helens_kitchen.db');
  } catch (err) {
    // Database doesn't exist, will create new one
    filebuffer = null;
  }
  
  db = new SQL.Database(filebuffer);
  
  // Create wrapper object that provides sqlite3-like API for existing code
  const dbWrapper = {
    // Wrapper for run method
    run: function(sql, params = [], callback = null) {
      try {
        const stmt = db.prepare(sql);
        // Filter out undefined/null values and replace with empty string or 0
        const cleanParams = Array.isArray(params) ? 
          params.map(p => p === undefined || p === null ? '' : p) : 
          [params === undefined || params === null ? '' : params];
        const result = stmt.run(cleanParams);
        stmt.free();
        
        if (callback) {
          // Simulate sqlite3 callback with 'this' context
          callback.call({ 
            lastID: result.lastInsertRowid || db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0,
            changes: result.changes || 0
          }, null);
        }
        
        // Save database to file after every write operation
        const data = db.export();
        fs.writeFileSync('./helens_kitchen.db', data);
        
        return { 
          lastID: result.lastInsertRowid || db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0,
          changes: result.changes || 0
        };
      } catch (err) {
        if (callback) callback.call({}, err);
        else throw err;
      }
    },

    // Wrapper for get method (single row)
    get: function(sql, params = [], callback = null) {
      try {
        const stmt = db.prepare(sql);
        // Filter out undefined/null values and replace with empty string or 0
        const cleanParams = Array.isArray(params) ? 
          params.map(p => p === undefined || p === null ? '' : p) : 
          [params === undefined || params === null ? '' : params];
        const result = stmt.getAsObject(cleanParams);
        stmt.free();
        
        if (callback) callback(null, Object.keys(result).length ? result : undefined);
        return Object.keys(result).length ? result : undefined;
      } catch (err) {
        if (callback) callback(err, null);
        else throw err;
      }
    },

    // Wrapper for all method (multiple rows)
    all: function(sql, params = [], callback = null) {
      try {
        const stmt = db.prepare(sql);
        // Filter out undefined/null values and replace with empty string or 0
        const cleanParams = Array.isArray(params) ? 
          params.map(p => p === undefined || p === null ? '' : p) : 
          [params === undefined || params === null ? '' : params];
        
        // Bind parameters if any
        if (cleanParams.length > 0 && cleanParams[0] !== '') {
          stmt.bind(cleanParams);
        }
        
        const results = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          results.push(row);
        }
        stmt.free();
        
        if (callback) callback(null, results);
        return results;
      } catch (err) {
        if (callback) callback(err, null);
        else throw err;
      }
    },

    // Wrapper for serialize method
    serialize: function(callback) {
      if (callback) callback();
    }
  };

  // Create tables and setup
  setupDatabase(dbWrapper);
  
  return dbWrapper;
}

function setupDatabase(db) {
  // Create tables if they don't exist
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        base_price REAL NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS menu_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_item_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      )
    `);

    // Add orders table
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        plus_code TEXT,
        payment_method TEXT NOT NULL,
        total_price REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'New',
        payment_status TEXT NOT NULL DEFAULT 'Pending',
        requested_delivery TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add plus_code column to existing orders table if it doesn't exist
    try {
      db.run(`ALTER TABLE orders ADD COLUMN plus_code TEXT`);
    } catch (err) {
      // Ignore if column already exists
    }

    // Expenses table
    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        notes TEXT
      )
    `);

    // Admin users table for authentication
    db.run(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Feedback table for customer reviews
    db.run(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        moderated_at TEXT,
        moderated_by TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    // Create analytics tables
    db.run(`
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_activity TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_admin BOOLEAN DEFAULT FALSE,
        admin_username TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS analytics_page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        page_path TEXT NOT NULL,
        page_title TEXT,
        referrer TEXT,
        viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        time_on_page INTEGER,
        FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_category TEXT,
        event_action TEXT,
        event_label TEXT,
        event_value INTEGER,
        page_path TEXT,
        occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id)
      )
    `);

    // Create role-based access control tables
    db.run(`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS admin_role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE,
        UNIQUE(role_id, permission_id)
      )
    `);

    // Add additional columns to admin_users table
    try { db.run(`ALTER TABLE admin_users ADD COLUMN role_id INTEGER REFERENCES admin_roles(id)`); } catch(e) {}
    try { db.run(`ALTER TABLE admin_users ADD COLUMN email TEXT`); } catch(e) {}
    try { db.run(`ALTER TABLE admin_users ADD COLUMN full_name TEXT`); } catch(e) {}
    try { db.run(`ALTER TABLE admin_users ADD COLUMN is_active BOOLEAN DEFAULT 1`); } catch(e) {}
    try { db.run(`ALTER TABLE admin_users ADD COLUMN last_login TEXT`); } catch(e) {}

    // Create default roles
    const roles = [
      { name: 'super_admin', description: 'Full system access with all permissions' },
      { name: 'admin', description: 'Standard admin with most permissions except user management' },
      { name: 'manager', description: 'Manager role with order and revenue access' },
      { name: 'viewer', description: 'Read-only access to analytics and reports' }
    ];

    roles.forEach(role => {
      db.run(`INSERT OR IGNORE INTO admin_roles (name, description) VALUES (?, ?)`, [role.name, role.description]);
    });

    // Create default permissions
    const permissions = [
      // Orders
      { name: 'orders.view', description: 'View orders', resource: 'orders', action: 'read' },
      { name: 'orders.update', description: 'Update order status', resource: 'orders', action: 'update' },
      
      // Revenue
      { name: 'revenue.view', description: 'View revenue reports', resource: 'revenue', action: 'read' },
      
      // Expenses
      { name: 'expenses.view', description: 'View expenses', resource: 'expenses', action: 'read' },
      { name: 'expenses.create', description: 'Create expenses', resource: 'expenses', action: 'create' },
      { name: 'expenses.update', description: 'Update expenses', resource: 'expenses', action: 'update' },
      { name: 'expenses.delete', description: 'Delete expenses', resource: 'expenses', action: 'delete' },
      
      // Feedback
      { name: 'feedback.view', description: 'View feedback', resource: 'feedback', action: 'read' },
      { name: 'feedback.moderate', description: 'Moderate feedback', resource: 'feedback', action: 'update' },
      { name: 'feedback.delete', description: 'Delete feedback', resource: 'feedback', action: 'delete' },
      
      // Analytics
      { name: 'analytics.view', description: 'View analytics', resource: 'analytics', action: 'read' },
      
      // Users
      { name: 'users.view', description: 'View admin users', resource: 'users', action: 'read' },
      { name: 'users.create', description: 'Create admin users', resource: 'users', action: 'create' },
      { name: 'users.update', description: 'Update admin users', resource: 'users', action: 'update' },
      { name: 'users.delete', description: 'Delete admin users', resource: 'users', action: 'delete' },
      
      // Roles
      { name: 'roles.view', description: 'View roles', resource: 'roles', action: 'read' },
      { name: 'roles.create', description: 'Create roles', resource: 'roles', action: 'create' },
      { name: 'roles.update', description: 'Update roles', resource: 'roles', action: 'update' },
      { name: 'roles.delete', description: 'Delete roles', resource: 'roles', action: 'delete' },

      // Inventory
      { name: 'inventory.view', description: 'View inventory and stock levels', resource: 'inventory', action: 'read' },
      { name: 'inventory.update', description: 'Update stock quantities', resource: 'inventory', action: 'update' },
      { name: 'inventory.manage', description: 'Manage ingredients and recipes', resource: 'inventory', action: 'create' }
    ];

    permissions.forEach(permission => {
      db.run(`INSERT OR IGNORE INTO admin_permissions (name, description, resource, action) VALUES (?, ?, ?, ?)`, 
        [permission.name, permission.description, permission.resource, permission.action]);
    });

    // Assign permissions to roles
    const rolePermissions = {
      'super_admin': permissions.map(p => p.name), // All permissions
      'admin': permissions.filter(p => !p.name.startsWith('users.') && !p.name.startsWith('roles.')).map(p => p.name),
      'manager': ['orders.view', 'orders.update', 'revenue.view', 'expenses.view', 'analytics.view', 'inventory.view'],
      'viewer': ['orders.view', 'revenue.view', 'expenses.view', 'feedback.view', 'analytics.view', 'inventory.view']
    };

    // Create role-permission mappings
    Object.keys(rolePermissions).forEach(roleName => {
      rolePermissions[roleName].forEach(permissionName => {
        db.run(`
          INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id)
          SELECT r.id, p.id 
          FROM admin_roles r, admin_permissions p 
          WHERE r.name = ? AND p.name = ?
        `, [roleName, permissionName]);
      });
    });

    // Create default admin user (password: 'admin123')
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    // First, get the super_admin role ID
    const superAdminRole = db.get(`SELECT id FROM admin_roles WHERE name = 'super_admin'`);
    console.log('Super admin role:', superAdminRole);
    
    if (superAdminRole) {
      const result = db.run(`
        INSERT OR IGNORE INTO admin_users (username, password, full_name, email, role_id, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['admin', defaultPassword, 'System Administrator', 'admin@helenskitchen.com', superAdminRole.id, 1]);

      if (result.changes > 0) {
        console.log('Default super admin user created: username=admin, password=admin123');
      }

      // Update existing admin user to have super_admin role if it doesn't have one
      const updateResult = db.run(`
        UPDATE admin_users 
        SET role_id = ?, 
            full_name = COALESCE(full_name, 'System Administrator'),
            email = COALESCE(email, 'admin@helenskitchen.com'),
            is_active = 1
        WHERE username = 'admin'
      `, [superAdminRole.id]);

      if (updateResult.changes > 0) {
        console.log('Updated existing admin user with super_admin role');
      }
    } else {
      console.error('Could not find super_admin role!');
    }

    // Inventory Management Tables
    
    // Ingredients table
    db.run(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        unit TEXT NOT NULL,
        current_stock REAL NOT NULL DEFAULT 0,
        minimum_stock REAL NOT NULL DEFAULT 0,
        cost_per_unit REAL NOT NULL DEFAULT 0,
        supplier TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Menu item ingredients (recipe mapping)
    db.run(`
      CREATE TABLE IF NOT EXISTS menu_item_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_item_id INTEGER NOT NULL,
        menu_variant_id INTEGER,
        ingredient_id INTEGER NOT NULL,
        quantity_needed REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_variant_id) REFERENCES menu_variants(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
        UNIQUE(menu_item_id, menu_variant_id, ingredient_id)
      )
    `);

    // Stock movements (audit trail)
    db.run(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'usage', 'adjustment', 'waste')),
        quantity REAL NOT NULL,
        reason TEXT,
        reference_id INTEGER,
        reference_type TEXT,
        admin_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES admin_users(id)
      )
    `);

    console.log('Database initialized successfully with sql.js');

  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Initialize and export
let dbPromise = initializeDatabase();

module.exports = dbPromise;