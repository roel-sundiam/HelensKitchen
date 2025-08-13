import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Expense {
  id?: number;
  date: string;
  category: string;
  amount: number;
  notes?: string;
}

@Component({
  selector: 'app-expense-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-management.component.html',
  styleUrls: ['./expense-management.component.css'],
})
export class ExpenseManagementComponent implements OnInit {
  expenses: Expense[] = [];
  newExpense: Expense = { date: '', category: '', amount: 0, notes: '' };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadExpenses();
  }

  loadExpenses() {
    this.http.get<Expense[]>('http://localhost:4000/api/admin/expenses').subscribe((data) => {
      this.expenses = data;
    });
  }

  addExpense() {
    if (
      !this.newExpense.date ||
      !this.newExpense.category ||
      this.newExpense.amount <= 0
    ) {
      alert('Please fill out all required fields.');
      return;
    }
    this.http.post('http://localhost:4000/api/admin/expenses', this.newExpense).subscribe(() => {
      this.loadExpenses();
      this.newExpense = { date: '', category: '', amount: 0, notes: '' };
    });
  }

  deleteExpense(id: number) {
    if (confirm('Are you sure you want to delete this expense?')) {
      this.http.delete(`http://localhost:4000/api/admin/expenses/${id}`).subscribe(() => {
        this.loadExpenses();
      });
    }
  }
}
