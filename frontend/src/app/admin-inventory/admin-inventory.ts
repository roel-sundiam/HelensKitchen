import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth';
import { ModalService } from '../shared/modal.service';
import { environment } from '../../environments/environment';

interface Ingredient {
  id: number;
  name: string;
  description: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  cost_per_unit: number;
  supplier: string;
  stock_status: 'ok' | 'low' | 'out';
  used_in_items: number;
  created_at: string;
  updated_at: string;
}

interface StockMovement {
  id: number;
  ingredient_id: number;
  movement_type: 'purchase' | 'usage' | 'adjustment' | 'waste';
  quantity: number;
  reason: string;
  reference_id: number;
  reference_type: string;
  admin_username: string;
  created_at: string;
  ingredient_name: string;
  unit: string;
}

@Component({
  selector: 'app-admin-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule],
  templateUrl: './admin-inventory.html',
  styleUrl: './admin-inventory.scss'
})
export class AdminInventoryComponent implements OnInit {
  ingredients: Ingredient[] = [];
  movements: StockMovement[] = [];
  
  isLoading = false;
  error = '';
  successMessage = '';
  
  // Filters
  stockFilter = 'all'; // 'all', 'low', 'out'
  
  // Forms
  showIngredientForm = false;
  showStockForm = false;
  editingIngredientId: number | null = null;
  stockUpdateIngredientId: number | null = null;
  
  ingredientForm = {
    name: '',
    description: '',
    unit: '',
    current_stock: 0,
    minimum_stock: 0,
    cost_per_unit: 0,
    supplier: ''
  };
  
  stockForm = {
    quantity: 0,
    movement_type: 'purchase',
    reason: ''
  };

  // Units dropdown
  commonUnits = [
    'pieces', 'grams', 'kg', 'liters', 'ml', 'cups', 'tablespoons', 'teaspoons', 'ounces', 'pounds'
  ];

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    this.loadInventory();
    this.loadMovements();
  }

  loadInventory() {
    this.isLoading = true;
    this.http.get<Ingredient[]>(`${environment.apiUrl}/admin/inventory`, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: (data) => {
        this.ingredients = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load inventory';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  loadMovements() {
    this.http.get<StockMovement[]>(`${environment.apiUrl}/admin/inventory/movements?limit=20`, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: (data) => {
        this.movements = data;
      },
      error: (err) => {
        console.error('Failed to load movements:', err);
      }
    });
  }

  getFilteredIngredients(): Ingredient[] {
    if (this.stockFilter === 'all') {
      return this.ingredients;
    }
    return this.ingredients.filter(ingredient => ingredient.stock_status === this.stockFilter);
  }

  getStockStatusClass(status: string): string {
    switch (status) {
      case 'ok': return 'status-ok';
      case 'low': return 'status-low';
      case 'out': return 'status-out';
      default: return '';
    }
  }

  getStockStatusText(status: string): string {
    switch (status) {
      case 'ok': return 'OK';
      case 'low': return 'Low Stock';
      case 'out': return 'Out of Stock';
      default: return status;
    }
  }

  // Ingredient Management
  showCreateIngredientForm() {
    this.editingIngredientId = null;
    this.ingredientForm = {
      name: '',
      description: '',
      unit: '',
      current_stock: 0,
      minimum_stock: 0,
      cost_per_unit: 0,
      supplier: ''
    };
    this.showIngredientForm = true;
  }

  editIngredient(ingredient: Ingredient) {
    this.editingIngredientId = ingredient.id;
    this.ingredientForm = {
      name: ingredient.name,
      description: ingredient.description,
      unit: ingredient.unit,
      current_stock: ingredient.current_stock,
      minimum_stock: ingredient.minimum_stock,
      cost_per_unit: ingredient.cost_per_unit,
      supplier: ingredient.supplier || ''
    };
    this.showIngredientForm = true;
  }

  saveIngredient() {
    if (!this.ingredientForm.name || !this.ingredientForm.unit) {
      this.error = 'Name and unit are required';
      return;
    }

    const url = this.editingIngredientId ? 
      `${environment.apiUrl}/admin/inventory/${this.editingIngredientId}` : 
      `${environment.apiUrl}/admin/inventory`;
    
    const method = this.editingIngredientId ? 'PUT' : 'POST';

    this.http.request(method, url, {
      body: this.ingredientForm,
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.successMessage = this.editingIngredientId ? 
          'Ingredient updated successfully' : 
          'Ingredient created successfully';
        this.showIngredientForm = false;
        this.loadInventory();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to save ingredient';
      }
    });
  }

  async deleteIngredient(ingredient: Ingredient) {
    const confirmed = await this.modalService.showConfirm(
      'Delete Ingredient',
      `Are you sure you want to delete "${ingredient.name}"?`,
      'Delete',
      'Cancel',
      '🗑️'
    );
    
    if (!confirmed) {
      return;
    }

    this.http.delete(`${environment.apiUrl}/admin/inventory/${ingredient.id}`, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: () => {
        this.successMessage = 'Ingredient deleted successfully';
        this.loadInventory();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to delete ingredient';
      }
    });
  }

  // Stock Management
  showStockUpdateForm(ingredient: Ingredient) {
    this.stockUpdateIngredientId = ingredient.id;
    this.stockForm = {
      quantity: 0,
      movement_type: 'purchase',
      reason: ''
    };
    this.showStockForm = true;
  }

  updateStock() {
    if (this.stockForm.quantity === 0) {
      this.error = 'Please enter a quantity';
      return;
    }

    this.http.put(`${environment.apiUrl}/admin/inventory/${this.stockUpdateIngredientId}/stock`, this.stockForm, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: (response: any) => {
        this.successMessage = `Stock updated successfully. New stock: ${response.new_stock}`;
        this.showStockForm = false;
        this.loadInventory();
        this.loadMovements();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update stock';
      }
    });
  }

  // Utility functions
  clearForms() {
    this.showIngredientForm = false;
    this.showStockForm = false;
    this.error = '';
    this.successMessage = '';
    this.editingIngredientId = null;
    this.stockUpdateIngredientId = null;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP' 
    }).format(amount);
  }

  getMovementTypeClass(type: string): string {
    switch (type) {
      case 'purchase': return 'movement-purchase';
      case 'usage': return 'movement-usage';
      case 'adjustment': return 'movement-adjustment';
      case 'waste': return 'movement-waste';
      default: return '';
    }
  }

  getMovementTypeIcon(type: string): string {
    switch (type) {
      case 'purchase': return '📦';
      case 'usage': return '🍽️';
      case 'adjustment': return '⚖️';
      case 'waste': return '🗑️';
      default: return '📋';
    }
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  getStockCount(status: 'ok' | 'low' | 'out'): number {
    return this.ingredients.filter(ingredient => ingredient.stock_status === status).length;
  }
}