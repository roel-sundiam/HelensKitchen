import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

export interface AnalyticsOverview {
  total_sessions: number;
  user_sessions: number;
  admin_sessions: number;
  avg_session_duration_minutes: number;
  total_page_views: number;
  total_events: number;
}

export interface PageViewData {
  page_path: string;
  views: number;
  unique_visitors: number;
  avg_time_on_page: number;
  date: string;
}

export interface EventData {
  event_type: string;
  event_category: string;
  event_action: string;
  event_label: string;
  event_count: number;
  unique_sessions: number;
  date: string;
}

export interface SessionData {
  date: string;
  sessions: number;
  unique_visitors: number;
  avg_duration_minutes: number;
  admin_sessions: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = environment.apiUrl;
  private sessionId: string;

  constructor(private http: HttpClient, private authService: AuthService) {
    this.sessionId = this.getOrCreateSessionId();
    this.trackPageView();
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

  trackPageView(pagePath?: string, pageTitle?: string, referrer?: string, timeOnPage?: number): void {
    const data = {
      sessionId: this.sessionId,
      pagePath: pagePath || window.location.pathname,
      pageTitle: pageTitle || document.title,
      referrer: referrer || document.referrer,
      timeOnPage: timeOnPage
    };

    this.http.post(`${this.apiUrl}/analytics/page-view`, data).subscribe({
      next: () => {
        // Silent success
      },
      error: (err) => {
        console.error('Analytics tracking error:', err);
      }
    });
  }

  trackEvent(eventType: string, eventCategory?: string, eventAction?: string, eventLabel?: string, eventValue?: number): void {
    const data = {
      sessionId: this.sessionId,
      eventType,
      eventCategory,
      eventAction,
      eventLabel,
      eventValue,
      pagePath: window.location.pathname
    };

    this.http.post(`${this.apiUrl}/analytics/event`, data).subscribe({
      next: () => {
        // Silent success
      },
      error: (err) => {
        console.error('Event tracking error:', err);
      }
    });
  }

  // Admin Analytics APIs
  getAnalyticsOverview(startDate?: string, endDate?: string): Observable<AnalyticsOverview> {
    let params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return this.http.get<AnalyticsOverview>(`${this.apiUrl}/admin/analytics/overview`, {
      params,
      headers: this.authService.getAuthHeaders()
    });
  }

  getPageViewAnalytics(startDate?: string, endDate?: string, groupBy?: string): Observable<PageViewData[]> {
    let params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (groupBy) params.groupBy = groupBy;

    return this.http.get<PageViewData[]>(`${this.apiUrl}/admin/analytics/page-views`, {
      params,
      headers: this.authService.getAuthHeaders()
    });
  }

  getEventAnalytics(startDate?: string, endDate?: string, eventType?: string, groupBy?: string): Observable<EventData[]> {
    let params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (eventType) params.eventType = eventType;
    if (groupBy) params.groupBy = groupBy;

    return this.http.get<EventData[]>(`${this.apiUrl}/admin/analytics/events`, {
      params,
      headers: this.authService.getAuthHeaders()
    });
  }

  getSessionAnalytics(startDate?: string, endDate?: string): Observable<SessionData[]> {
    let params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return this.http.get<SessionData[]>(`${this.apiUrl}/admin/analytics/sessions`, {
      params,
      headers: this.authService.getAuthHeaders()
    });
  }
}