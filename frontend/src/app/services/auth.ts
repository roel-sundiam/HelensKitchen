import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  role_description: string;
  permissions: string[];
  last_login: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private currentAdminSubject = new BehaviorSubject<AdminUser | null>(null);

  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public currentAdmin$ = this.currentAdminSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Check authentication status on service initialization
    this.checkAuthStatus();
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { username, password });
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    this.clearAuthentication();
    this.router.navigate(['/admin/login']);
  }

  checkAuthStatus(): void {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token with backend
      const headers = { Authorization: `Bearer ${token}` };
      this.http.get(`${this.apiUrl}/verify`, { headers }).subscribe({
        next: (response: any) => {
          if (response.authenticated) {
            this.isAuthenticatedSubject.next(true);
            this.currentAdminSubject.next(response.admin);
          } else {
            this.clearTokenAndAuth();
          }
        },
        error: (err) => {
          this.clearTokenAndAuth();
        }
      });
    } else {
      this.clearAuthentication();
    }
  }

  private clearTokenAndAuth(): void {
    localStorage.removeItem('auth_token');
    this.clearAuthentication();
  }

  setAuthenticated(admin: AdminUser): void {
    this.isAuthenticatedSubject.next(true);
    this.currentAdminSubject.next(admin);
  }

  clearAuthentication(): void {
    this.isAuthenticatedSubject.next(false);
    this.currentAdminSubject.next(null);
  }

  isLoggedIn(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getCurrentAdmin(): AdminUser | null {
    return this.currentAdminSubject.value;
  }

  getAuthHeaders(): { Authorization: string } | {} {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  storeToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  logoutAndRedirect(): void {
    this.logout();
    this.router.navigate(['/']);
  }

  hasPermission(permission: string): boolean {
    const admin = this.getCurrentAdmin();
    return admin?.permissions?.includes(permission) || false;
  }

  hasAnyPermission(permissions: string[]): boolean {
    const admin = this.getCurrentAdmin();
    if (!admin?.permissions) return false;
    return permissions.some(permission => admin.permissions.includes(permission));
  }

  getUserRole(): string {
    const admin = this.getCurrentAdmin();
    return admin?.role || '';
  }

  getUserPermissions(): string[] {
    const admin = this.getCurrentAdmin();
    return admin?.permissions || [];
  }
}
