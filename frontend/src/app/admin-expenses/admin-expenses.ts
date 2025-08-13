import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService } from '../services/auth';
import { ModalService } from '../shared/modal.service';
import { environment } from '../../environments/environment';

interface ExpenseData {
  id: number;
  date: string;
  category: string;
  amount: number;
  notes?: string;
}

@Component({
  selector: 'app-admin-expenses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './admin-expenses.html',
  styleUrl: './admin-expenses.scss'
})
export class AdminExpenses implements OnInit {
  expenseForm: FormGroup;
  expenses: ExpenseData[] = [];
  editingExpense: ExpenseData | null = null;
  isLoading = false;

  expenseCategories = [
    'Ingredients',
    'Equipment',
    'Utilities',
    'Marketing',
    'Transportation',
    'Packaging',
    'Staff',
    'Other'
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public authService: AuthService,
    private modalService: ModalService
  ) {
    this.expenseForm = this.fb.group({
      date: ['', Validators.required],
      category: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0)]],
      notes: ['']
    });
  }

  ngOnInit() {
    this.loadExpenses();
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    this.expenseForm.patchValue({ date: today });
  }

  loadExpenses() {
    this.isLoading = true;
    this.http.get<ExpenseData[]>(`${environment.apiUrl}/admin/expenses`, { withCredentials: true }).subscribe({
      next: (data) => {
        this.expenses = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading expenses:', err);
        this.modalService.showAlert('Error', 'Error loading expenses', '❌');
        this.isLoading = false;
      }
    });
  }

  onSubmit() {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const expenseData = this.expenseForm.value;
    this.isLoading = true;

    if (this.editingExpense) {
      // Update existing expense
      this.http.put(`${environment.apiUrl}/admin/expenses/${this.editingExpense.id}`, expenseData, { withCredentials: true }).subscribe({
        next: () => {
          this.modalService.showAlert('Success', 'Expense updated successfully', '✅');
          this.loadExpenses();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error updating expense:', err);
          this.modalService.showAlert('Error', 'Error updating expense', '❌');
          this.isLoading = false;
        }
      });
    } else {
      // Create new expense
      this.http.post(`${environment.apiUrl}/admin/expenses`, expenseData, { withCredentials: true }).subscribe({
        next: () => {
          this.modalService.showAlert('Success', 'Expense added successfully', '✅');
          this.loadExpenses();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error adding expense:', err);
          this.modalService.showAlert('Error', 'Error adding expense', '❌');
          this.isLoading = false;
        }
      });
    }
  }

  editExpense(expense: ExpenseData) {
    this.editingExpense = expense;
    this.expenseForm.patchValue({
      date: expense.date,
      category: expense.category,
      amount: expense.amount,
      notes: expense.notes || ''
    });
  }

  async deleteExpense(expense: ExpenseData) {
    const confirmed = await this.modalService.showConfirm(
      'Delete Expense',
      `Are you sure you want to delete the expense: ${expense.category} - ₱${expense.amount}?`,
      'Delete',
      'Cancel',
      '🗑️'
    );
    
    if (!confirmed) {
      return;
    }

    this.isLoading = true;
    this.http.delete(`${environment.apiUrl}/admin/expenses/${expense.id}`, { withCredentials: true }).subscribe({
      next: () => {
        this.modalService.showAlert('Success', 'Expense deleted successfully', '✅');
        this.loadExpenses();
      },
      error: (err) => {
        console.error('Error deleting expense:', err);
        this.modalService.showAlert('Error', 'Error deleting expense', '❌');
        this.isLoading = false;
      }
    });
  }

  resetForm() {
    this.editingExpense = null;
    this.expenseForm.reset();
    const today = new Date().toISOString().split('T')[0];
    this.expenseForm.patchValue({ date: today });
    this.isLoading = false;
  }

  cancelEdit() {
    this.resetForm();
  }

  getTotalExpenses(): number {
    return this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }
}
