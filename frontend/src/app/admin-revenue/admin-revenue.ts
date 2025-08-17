import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../services/auth';
import { environment } from '../../environments/environment';

Chart.register(...registerables);

interface RevenueData {
  date: string;
  payment_method: string;
  total_revenue: number;
}

interface DetailedRevenueData {
  order_id: string;
  customer_name: string;
  phone: string;
  date: string;
  payment_method: string;
  delivery_option: string;
  total_revenue: number;
  created_at: string;
}

interface RevenueApiResponse {
  detailed: DetailedRevenueData[];
  aggregated: RevenueData[];
}

interface ExpenseData {
  id: number;
  date: string;
  category: string;
  amount: number;
  notes?: string;
}

@Component({
  selector: 'app-admin-revenue',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './admin-revenue.html',
  styleUrl: './admin-revenue.scss'
})
export class AdminRevenue implements OnInit, AfterViewInit {
  @ViewChild('revenueChart') revenueChartRef!: ElementRef;
  @ViewChild('profitChart') profitChartRef!: ElementRef;

  revenueData: RevenueData[] = [];
  detailedRevenueData: DetailedRevenueData[] = [];
  expenseData: ExpenseData[] = [];
  totalRevenue = 0;
  totalExpenses = 0;
  profit = 0;

  private revenueChart: Chart | null = null;
  private profitChart: Chart | null = null;

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadRevenueData();
    this.loadExpenseData();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initCharts();
    }, 100);
  }

  loadRevenueData() {
    this.http.get<RevenueApiResponse | RevenueData[]>(`${environment.apiUrl}/admin/revenue`, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: (response) => {
        // Handle new API response format
        if (response && typeof response === 'object' && 'detailed' in response && 'aggregated' in response) {
          this.revenueData = response.aggregated;
          this.detailedRevenueData = response.detailed;
          this.totalRevenue = this.detailedRevenueData.reduce((sum, item) => sum + item.total_revenue, 0);
        } 
        // Handle old API response format (fallback)
        else if (Array.isArray(response)) {
          this.revenueData = response as RevenueData[];
          this.detailedRevenueData = []; // No detailed data available in old format
          this.totalRevenue = this.revenueData.reduce((sum, item) => sum + item.total_revenue, 0);
        }
        
        this.calculateProfit();
        this.updateCharts();
      },
      error: (err) => {
        console.error('Error loading revenue data:', err);
      }
    });
  }

  loadExpenseData() {
    this.http.get<ExpenseData[]>(`${environment.apiUrl}/admin/expenses`, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: (data) => {
        this.expenseData = data;
        this.totalExpenses = data.reduce((sum, item) => sum + item.amount, 0);
        this.calculateProfit();
        this.updateCharts();
      },
      error: (err) => {
        console.error('Error loading expense data:', err);
      }
    });
  }

  calculateProfit() {
    this.profit = this.totalRevenue - this.totalExpenses;
  }

  initCharts() {
    this.createRevenueChart();
    this.createProfitChart();
  }

  updateCharts() {
    if (this.revenueChart) {
      this.createRevenueChart();
    }
    if (this.profitChart) {
      this.createProfitChart();
    }
  }

  createRevenueChart() {
    if (this.revenueChart) {
      this.revenueChart.destroy();
    }

    const ctx = this.revenueChartRef.nativeElement.getContext('2d');
    
    // Group revenue by payment method
    const paymentMethods: { [key: string]: number } = {};
    this.revenueData.forEach(item => {
      if (paymentMethods[item.payment_method]) {
        paymentMethods[item.payment_method] += item.total_revenue;
      } else {
        paymentMethods[item.payment_method] = item.total_revenue;
      }
    });

    this.revenueChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(paymentMethods),
        datasets: [{
          data: Object.values(paymentMethods),
          backgroundColor: [
            '#A67B5B',
            '#E6B17A',
            '#8B4513',
            '#CD853F'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Revenue by Payment Method'
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  createProfitChart() {
    if (this.profitChart) {
      this.profitChart.destroy();
    }

    const ctx = this.profitChartRef.nativeElement.getContext('2d');
    
    this.profitChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Revenue', 'Expenses', 'Profit'],
        datasets: [{
          data: [this.totalRevenue, this.totalExpenses, this.profit],
          backgroundColor: [
            '#4CAF50',
            '#F44336',
            this.profit >= 0 ? '#4CAF50' : '#F44336'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Financial Summary'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₱' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }
}
