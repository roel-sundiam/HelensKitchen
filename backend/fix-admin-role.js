const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./helens_kitchen.db");

console.log("Fixing admin user role assignment...");

// First, let's check the current state
db.get("SELECT * FROM admin_users WHERE username = 'admin'", (err, user) => {
  if (err) {
    console.error("Error checking admin user:", err);
    return;
  }
  
  console.log("Current admin user:", user);
  
  // Get super_admin role ID
  db.get("SELECT id FROM admin_roles WHERE name = 'super_admin'", (err, role) => {
    if (err) {
      console.error("Error getting super_admin role:", err);
      return;
    }
    
    if (!role) {
      console.error("super_admin role not found!");
      return;
    }
    
    console.log("Super admin role ID:", role.id);
    
    // Update admin user with role
    db.run(`
      UPDATE admin_users 
      SET role_id = ?,
          full_name = COALESCE(full_name, 'System Administrator'),
          email = COALESCE(email, 'admin@helenskitchen.com'),
          is_active = 1
      WHERE username = 'admin'
    `, [role.id], function(err) {
      if (err) {
        console.error("Error updating admin user:", err);
      } else {
        console.log("Admin user updated successfully. Changes:", this.changes);
        
        // Verify the update
        db.get(`
          SELECT u.*, r.name as role_name 
          FROM admin_users u 
          LEFT JOIN admin_roles r ON u.role_id = r.id 
          WHERE u.username = 'admin'
        `, (err, updatedUser) => {
          if (err) {
            console.error("Error verifying update:", err);
          } else {
            console.log("Updated admin user:", updatedUser);
          }
          db.close();
        });
      }
    });
  });
});