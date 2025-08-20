import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BusinessAvailability {
  _id: string;
  date: string;
  is_full_day: boolean;
  unavailable_time_slots: string[];
  reason: string;
  admin_id: {
    username: string;
    full_name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityRequest {
  date: string;
  is_full_day: boolean;
  unavailable_time_slots: string[];
  reason: string;
}

export interface AvailabilityCheckResponse {
  date: string;
  time?: string;
  is_available: boolean;
  reason: string;
}

export interface TimeSlotsResponse {
  date: string;
  available_slots: string[];
  unavailable_reason: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private apiUrl = `${environment.apiUrl}/admin/availability`;
  private publicApiUrl = `${environment.apiUrl}/availability`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Admin endpoints
  getAvailabilities(startDate?: string, endDate?: string): Observable<BusinessAvailability[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    
    return this.http.get<BusinessAvailability[]>(this.apiUrl, { 
      params,
      headers: this.getAuthHeaders() 
    });
  }

  createAvailability(availability: CreateAvailabilityRequest): Observable<BusinessAvailability> {
    return this.http.post<BusinessAvailability>(this.apiUrl, availability, {
      headers: this.getAuthHeaders()
    });
  }

  updateAvailability(id: string, availability: CreateAvailabilityRequest): Observable<BusinessAvailability> {
    return this.http.put<BusinessAvailability>(`${this.apiUrl}/${id}`, availability, {
      headers: this.getAuthHeaders()
    });
  }

  deleteAvailability(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Public endpoints for customer use
  checkAvailability(date: string, time?: string): Observable<AvailabilityCheckResponse> {
    let params = new HttpParams().set('date', date);
    if (time) params = params.set('time', time);
    
    return this.http.get<AvailabilityCheckResponse>(`${this.publicApiUrl}/check`, { params });
  }

  getAvailableTimeSlots(date: string): Observable<TimeSlotsResponse> {
    const params = new HttpParams().set('date', date);
    return this.http.get<TimeSlotsResponse>(`${this.publicApiUrl}/time-slots`, { params });
  }
}