// Migration script to populate MongoDB with initial data
const {
  connectToMongoDB,
  MenuItem,
  MenuVariant,
  AdminUser,
  AdminRole,
  AdminPermission,
  AdminRolePermission
} = require('./models');
const bcrypt = require('bcrypt');

async function migrateToMongoDB() {
  try {
    console.log('🔄 Starting migration to MongoDB...');
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Clear existing data
    console.log('🗑️ Clearing existing data...');
    await Promise.all([
      MenuItem.deleteMany({}),
      MenuVariant.deleteMany({}),
      AdminUser.deleteMany({}),
      AdminRole.deleteMany({}),
      AdminPermission.deleteMany({}),
      AdminRolePermission.deleteMany({})
    ]);
    
    // Create roles
    console.log('👥 Creating admin roles...');
    const roles = [
      { name: 'super_admin', description: 'Full system access with all permissions' },
      { name: 'admin', description: 'Standard admin with most permissions except user management' },
      { name: 'manager', description: 'Manager role with order and revenue access' },
      { name: 'viewer', description: 'Read-only access to analytics and reports' }
    ];
    
    const createdRoles = await AdminRole.insertMany(roles);
    const superAdminRole = createdRoles.find(r => r.name === 'super_admin');
    
    // Create permissions
    console.log('🔐 Creating permissions...');
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
    
    const createdPermissions = await AdminPermission.insertMany(permissions);
    
    // Assign all permissions to super_admin role
    console.log('🔗 Linking permissions to roles...');
    const rolePermissions = createdPermissions.map(permission => ({
      role_id: superAdminRole._id,
      permission_id: permission._id
    }));
    
    await AdminRolePermission.insertMany(rolePermissions);
    
    // Create default admin user
    console.log('👤 Creating default admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await AdminUser.create({
      username: 'admin',
      password: hashedPassword,
      full_name: 'System Administrator',
      email: 'admin@helenskitchen.com',
      role_id: superAdminRole._id,
      is_active: true
    });
    
    // Create menu items
    console.log('🍽️ Creating menu items...');
    const menuData = [
      {
        name: "Charlie Chan Chicken Pasta",
        description: "Perfectly cooked pasta with chicken, mushrooms and peanuts, coated in a sticky, sweet and spicy sauce with special ingredients. Must try, you will surely love it!",
        image_url: "images/food/pasta/pasta_1.jpg",
        images: [
          "images/food/pasta/pasta_1.jpg",
          "images/food/pasta/pasta_2.jpg",
          "images/food/pasta/pasta_3.jpg"
        ],
        base_price: 199.00,
        variants: [
          { name: "700ml box", price: 199.00 },
          { name: "1000ml box", price: 289.00 },
          { name: "1400ml box", price: 379.00 }
        ]
      },
      {
        name: "Four Cheese Burger",
        description: "Our signature burger featuring a blend of four premium cheeses, perfectly melted over a juicy patty. A cheese lover's dream!",
        image_url: "images/food/burgers/burger_1.jpg",
        images: [
          "images/food/burgers/burger_1.jpg"
        ],
        base_price: 159.00,
        variants: [
          { name: "Single Patty", price: 159.00 },
          { name: "Double Patty", price: 199.00 }
        ]
      },
      {
        name: "Spicy Bulgogi",
        description: "Korean-inspired bulgogi beef with a spicy kick, topped with our signature three-cheese blend for the ultimate flavor experience.",
        image_url: "images/food/bulgogi/bulgogi_1.jpg",
        images: [
          "images/food/bulgogi/bulgogi_1.jpg",
          "images/food/bulgogi/bulgogi_2.jpg"
        ],
        base_price: 159.00,
        variants: [
          { name: "Single Patty", price: 159.00 },
          { name: "Double Patty", price: 199.00 }
        ]
      }
    ];
    
    for (const itemData of menuData) {
      const { variants, ...menuItemData } = itemData;
      
      // Create menu item
      const menuItem = await MenuItem.create(menuItemData);
      console.log(`✅ Created menu item: ${menuItem.name}`);
      
      // Create variants
      const variantPromises = variants.map(variant => 
        MenuVariant.create({
          menu_item_id: menuItem._id,
          name: variant.name,
          price: variant.price
        })
      );
      
      await Promise.all(variantPromises);
      console.log(`✅ Created ${variants.length} variants for ${menuItem.name}`);
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Verify data
    const menuCount = await MenuItem.countDocuments();
    const variantCount = await MenuVariant.countDocuments();
    const userCount = await AdminUser.countDocuments();
    const roleCount = await AdminRole.countDocuments();
    const permissionCount = await AdminPermission.countDocuments();
    
    console.log('📊 Data verification:');
    console.log(`   • Menu items: ${menuCount}`);
    console.log(`   • Variants: ${variantCount}`);
    console.log(`   • Admin users: ${userCount}`);
    console.log(`   • Roles: ${roleCount}`);
    console.log(`   • Permissions: ${permissionCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToMongoDB()
    .then(() => {
      console.log('✅ Migration completed, exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToMongoDB };