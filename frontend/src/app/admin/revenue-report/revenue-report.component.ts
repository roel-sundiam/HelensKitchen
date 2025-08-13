import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, ChartType, registerables } from 'chart.js';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-revenue-report',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './revenue-report.component.html',
  styleUrls: ['./revenue-report.component.css'],
})
export class RevenueReportComponent implements OnInit {
  revenueData: any[] = [];

  // Chart data & options for a bar chart
  public barChartLabels: string[] = [];
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      { data: [], label: 'GCash' },
      { data: [], label: 'Bank Transfer' },
    ]
  };
  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
  };
  public barChartLegend = true;

  constructor(private http: HttpClient) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.loadRevenue();
  }

  loadRevenue() {
    this.http.get<any[]>(`${environment.apiUrl}/admin/revenue`).subscribe((data) => {
      this.revenueData = data;

      // Extract unique dates as labels
      const dates = [...new Set(data.map((d) => d.date))];
      this.barChartLabels = dates;

      // Separate sums per payment method by date
      const gCashTotals = dates.map((date) => {
        const rec = data.find(
          (d) => d.date === date && d.payment_method === 'GCash'
        );
        return rec ? rec.total_revenue : 0;
      });
      const bankTotals = dates.map((date) => {
        const rec = data.find(
          (d) => d.date === date && d.payment_method === 'Bank Transfer'
        );
        return rec ? rec.total_revenue : 0;
      });

      this.barChartData = {
        labels: dates,
        datasets: [
          { data: gCashTotals, label: 'GCash' },
          { data: bankTotals, label: 'Bank Transfer' },
        ]
      };
    });
  }
}
