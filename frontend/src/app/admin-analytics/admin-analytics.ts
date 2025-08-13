import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AnalyticsService, AnalyticsOverview, PageViewData, EventData, SessionData } from '../services/analytics';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './admin-analytics.html',
  styleUrl: './admin-analytics.scss'
})
export class AdminAnalyticsComponent implements OnInit {
  overview: AnalyticsOverview | null = null;
  pageViews: PageViewData[] = [];
  events: EventData[] = [];
  sessions: SessionData[] = [];
  
  isLoading = false;
  error = '';
  
  // Date filters
  startDate = '';
  endDate = '';
  
  // View options
  pageViewGroupBy = 'page';
  eventGroupBy = 'type';
  selectedEventType = '';
  
  // Chart data
  chartType = 'overview';
  availableEventTypes = ['user_action', 'navigation', 'api_call', 'form_submission'];

  constructor(
    private analyticsService: AnalyticsService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.setDefaultDateRange();
    this.loadAllAnalytics();
  }

  setDefaultDateRange() {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    this.endDate = today.toISOString().split('T')[0];
    this.startDate = lastWeek.toISOString().split('T')[0];
  }

  loadAllAnalytics() {
    this.isLoading = true;
    this.error = '';

    Promise.all([
      this.loadOverview(),
      this.loadPageViews(),
      this.loadEvents(),
      this.loadSessions()
    ]).then(() => {
      this.isLoading = false;
    }).catch((error) => {
      this.error = 'Failed to load analytics data.';
      this.isLoading = false;
      console.error('Analytics loading error:', error);
    });
  }

  private loadOverview(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.analyticsService.getAnalyticsOverview(this.startDate, this.endDate).subscribe({
        next: (data) => {
          this.overview = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  private loadPageViews(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.analyticsService.getPageViewAnalytics(this.startDate, this.endDate, this.pageViewGroupBy).subscribe({
        next: (data) => {
          this.pageViews = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  private loadEvents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.analyticsService.getEventAnalytics(this.startDate, this.endDate, this.selectedEventType, this.eventGroupBy).subscribe({
        next: (data) => {
          this.events = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  private loadSessions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.analyticsService.getSessionAnalytics(this.startDate, this.endDate).subscribe({
        next: (data) => {
          this.sessions = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  onDateRangeChange() {
    this.loadAllAnalytics();
  }

  onPageViewGroupByChange() {
    this.loadPageViews().catch(console.error);
  }

  onEventGroupByChange() {
    this.loadEvents().catch(console.error);
  }

  onEventTypeChange() {
    this.loadEvents().catch(console.error);
  }

  getTopPages(): PageViewData[] {
    return this.pageViews
      .filter(pv => pv.page_path)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  getTopEvents(): EventData[] {
    return this.events
      .sort((a, b) => b.event_count - a.event_count)
      .slice(0, 10);
  }

  formatDuration(minutes: number): string {
    if (!minutes) return '0m';
    const mins = Math.round(minutes);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  }

  getPageViewsChartData() {
    return this.pageViews.map(pv => ({
      label: pv.page_path || pv.date,
      value: pv.views
    }));
  }

  getSessionsChartData() {
    return this.sessions.map(s => ({
      label: this.formatDate(s.date),
      value: s.sessions
    }));
  }

  exportData() {
    const data = {
      overview: this.overview,
      pageViews: this.pageViews,
      events: this.events,
      sessions: this.sessions,
      dateRange: {
        startDate: this.startDate,
        endDate: this.endDate
      },
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-export-${this.startDate}-to-${this.endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Helper methods for chart calculations
  getPageViewChartHeight(item: any): number {
    const chartData = this.getPageViewsChartData();
    if (chartData.length === 0) return 0;
    const maxValue = Math.max(...chartData.map(d => d.value));
    return maxValue > 0 ? (item.value / maxValue * 100) : 0;
  }

  getSessionChartHeight(session: any): number {
    if (this.sessions.length === 0) return 0;
    const maxSessions = Math.max(...this.sessions.map(s => s.sessions));
    return maxSessions > 0 ? (session.sessions / maxSessions * 100) : 0;
  }

  getTopPageBarWidth(page: any): number {
    const topPages = this.getTopPages();
    if (topPages.length === 0) return 0;
    return topPages[0].views > 0 ? (page.views / topPages[0].views * 100) : 0;
  }
}