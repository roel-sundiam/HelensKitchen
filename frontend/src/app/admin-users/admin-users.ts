import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth';

interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_active: boolean;
  last_login: string;
  created_at: string;
  role_name: string;
  role_description: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  created_at: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
  resource: string;
  action: string;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss'
})
export class AdminUsersComponent implements OnInit {
  users: AdminUser[] = [];
  roles: Role[] = [];
  permissions: Permission[] = [];
  
  isLoading = false;
  error = '';
  successMessage = '';
  
  // Active tab
  activeTab = 'users'; // 'users', 'roles'
  
  // User form
  showUserForm = false;
  editingUserId: number | null = null;
  userForm = {
    username: '',
    password: '',
    full_name: '',
    email: '',
    role_id: '',
    is_active: true
  };
  
  // Role form
  showRoleForm = false;
  editingRoleId: number | null = null;
  roleForm = {
    name: '',
    description: '',
    permissions: [] as number[]
  };
  
  // Password change form
  showPasswordForm = false;
  passwordChangeUserId: number | null = null;
  passwordForm = {
    password: '',
    confirmPassword: ''
  };

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadAllData();
  }

  loadAllData() {
    this.isLoading = true;
    this.error = '';
    
    Promise.all([
      this.loadUsers(),
      this.loadRoles(),
      this.loadPermissions()
    ]).then(() => {
      this.isLoading = false;
    }).catch((error) => {
      this.error = 'Failed to load data';
      this.isLoading = false;
      console.error('Data loading error:', error);
    });
  }

  private loadUsers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<AdminUser[]>('/api/admin/users', { headers: this.authService.getAuthHeaders() }).subscribe({
        next: (data) => {
          this.users = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  private loadRoles(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<Role[]>('/api/admin/roles', { headers: this.authService.getAuthHeaders() }).subscribe({
        next: (data) => {
          this.roles = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  private loadPermissions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<Permission[]>('/api/admin/permissions', { headers: this.authService.getAuthHeaders() }).subscribe({
        next: (data) => {
          this.permissions = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  // Tab management
  switchTab(tab: string) {
    this.activeTab = tab;
    this.clearForms();
  }

  // User management
  showCreateUserForm() {
    this.editingUserId = null;
    this.userForm = {
      username: '',
      password: '',
      full_name: '',
      email: '',
      role_id: '',
      is_active: true
    };
    this.showUserForm = true;
  }

  editUser(user: AdminUser) {
    this.editingUserId = user.id;
    this.userForm = {
      username: user.username,
      password: '', // Don't pre-fill password
      full_name: user.full_name,
      email: user.email,
      role_id: this.roles.find(r => r.name === user.role_name)?.id.toString() || '',
      is_active: user.is_active
    };
    this.showUserForm = true;
  }

  saveUser() {
    if (!this.userForm.username || !this.userForm.full_name || !this.userForm.email || !this.userForm.role_id) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (!this.editingUserId && !this.userForm.password) {
      this.error = 'Password is required for new users';
      return;
    }

    const url = this.editingUserId ? 
      `/api/admin/users/${this.editingUserId}` : 
      '/api/admin/users';
    
    const method = this.editingUserId ? 'PUT' : 'POST';
    
    // Don't include password in update requests unless it's being changed
    const userData = this.editingUserId ? 
      {
        username: this.userForm.username,
        full_name: this.userForm.full_name,
        email: this.userForm.email,
        role_id: parseInt(this.userForm.role_id),
        is_active: this.userForm.is_active
      } :
      {
        ...this.userForm,
        role_id: parseInt(this.userForm.role_id)
      };

    this.http.request(method, url, {
      body: userData,
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.successMessage = this.editingUserId ? 
          'User updated successfully' : 
          'User created successfully';
        this.showUserForm = false;
        this.loadUsers();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to save user';
      }
    });
  }

  deleteUser(user: AdminUser) {
    if (confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      this.http.delete(`/api/admin/users/${user.id}`, { headers: this.authService.getAuthHeaders() }).subscribe({
        next: () => {
          this.successMessage = 'User deleted successfully';
          this.loadUsers();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err) => {
          this.error = err.error?.error || 'Failed to delete user';
        }
      });
    }
  }

  // Password management
  showChangePasswordForm(user: AdminUser) {
    this.passwordChangeUserId = user.id;
    this.passwordForm = {
      password: '',
      confirmPassword: ''
    };
    this.showPasswordForm = true;
  }

  changePassword() {
    if (!this.passwordForm.password) {
      this.error = 'Password is required';
      return;
    }

    if (this.passwordForm.password !== this.passwordForm.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.passwordForm.password.length < 6) {
      this.error = 'Password must be at least 6 characters long';
      return;
    }

    this.http.put(`/api/admin/users/${this.passwordChangeUserId}/password`, {
      password: this.passwordForm.password
    }, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: () => {
        this.successMessage = 'Password changed successfully';
        this.showPasswordForm = false;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to change password';
      }
    });
  }

  // Role management
  showCreateRoleForm() {
    this.editingRoleId = null;
    this.roleForm = {
      name: '',
      description: '',
      permissions: []
    };
    this.showRoleForm = true;
  }

  editRole(role: Role) {
    this.editingRoleId = role.id;
    this.roleForm = {
      name: role.name,
      description: role.description,
      permissions: role.permissions.map(permName => {
        const perm = this.permissions.find(p => p.name === permName);
        return perm ? perm.id : 0;
      }).filter(id => id > 0)
    };
    this.showRoleForm = true;
  }

  saveRole() {
    if (!this.roleForm.name || !this.roleForm.description) {
      this.error = 'Name and description are required';
      return;
    }

    const url = this.editingRoleId ? 
      `/api/admin/roles/${this.editingRoleId}` : 
      '/api/admin/roles';
    
    const method = this.editingRoleId ? 'PUT' : 'POST';

    this.http.request(method, url, {
      body: this.roleForm,
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.successMessage = this.editingRoleId ? 
          'Role updated successfully' : 
          'Role created successfully';
        this.showRoleForm = false;
        this.loadRoles();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to save role';
      }
    });
  }

  deleteRole(role: Role) {
    if (confirm(`Are you sure you want to delete role "${role.name}"?`)) {
      this.http.delete(`/api/admin/roles/${role.id}`, { headers: this.authService.getAuthHeaders() }).subscribe({
        next: () => {
          this.successMessage = 'Role deleted successfully';
          this.loadRoles();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err) => {
          this.error = err.error?.error || 'Failed to delete role';
        }
      });
    }
  }

  // Permission management
  togglePermission(permissionId: number) {
    const index = this.roleForm.permissions.indexOf(permissionId);
    if (index > -1) {
      this.roleForm.permissions.splice(index, 1);
    } else {
      this.roleForm.permissions.push(permissionId);
    }
  }

  isPermissionSelected(permissionId: number): boolean {
    return this.roleForm.permissions.includes(permissionId);
  }

  getPermissionsByResource() {
    const grouped: { [key: string]: Permission[] } = {};
    this.permissions.forEach(permission => {
      if (!grouped[permission.resource]) {
        grouped[permission.resource] = [];
      }
      grouped[permission.resource].push(permission);
    });
    return grouped;
  }

  // Utility functions
  clearForms() {
    this.showUserForm = false;
    this.showRoleForm = false;
    this.showPasswordForm = false;
    this.error = '';
    this.successMessage = '';
    this.editingUserId = null;
    this.editingRoleId = null;
    this.passwordChangeUserId = null;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  getRoleName(roleId: string): string {
    const role = this.roles.find(r => r.id.toString() === roleId);
    return role ? role.name : '';
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }
}