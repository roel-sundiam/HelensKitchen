import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

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
  private readonly apiUrl = 'http://localhost:4000/api/admin';
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
    return this.http.post(`${this.apiUrl}/login`, { username, password }, { withCredentials: true });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true });
  }

  checkAuthStatus(): void {
    this.http.get(`${this.apiUrl}/verify`, { withCredentials: true }).subscribe({
      next: (response: any) => {
        if (response.authenticated) {
          this.isAuthenticatedSubject.next(true);
          this.currentAdminSubject.next(response.admin);
        } else {
          this.isAuthenticatedSubject.next(false);
          this.currentAdminSubject.next(null);
        }
      },
      error: (err) => {
        this.isAuthenticatedSubject.next(false);
        this.currentAdminSubject.next(null);
      }
    });
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

  logoutAndRedirect(): void {
    this.logout().subscribe({
      next: () => {
        this.clearAuthentication();
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Logout error:', err);
        // Clear local state even if server request fails
        this.clearAuthentication();
        this.router.navigate(['/']);
      }
    });
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
