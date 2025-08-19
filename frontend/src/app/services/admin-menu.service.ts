import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

export interface AdminMenuItem {
  id: string;
  name: string;
  description: string;
  image_url: string;
  images: string[];
  base_price: number;
  created_at: string;
  updated_at: string;
  variants: AdminMenuVariant[];
}

export interface AdminMenuVariant {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuItemRequest {
  name: string;
  description: string;
  image_url?: string;
  images?: string[];
  base_price: number;
}

export interface CreateVariantRequest {
  name: string;
  price: number;
}

export interface ImageUploadResponse {
  message: string;
  imageUrl: string;
  filename: string;
}


@Injectable({
  providedIn: 'root',
})
export class AdminMenuService {
  private apiUrl = `${environment.apiUrl}/admin/menu`;

  constructor(private http: HttpClient, private authService: AuthService) {}

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

  private getAuthHeadersForUpload(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type for file uploads - let browser set it
    });
  }

  // Menu Items
  getMenuItems(): Observable<AdminMenuItem[]> {
    return this.http.get<AdminMenuItem[]>(this.apiUrl, { 
      headers: this.getAuthHeaders() 
    });
  }

  createMenuItem(menuItem: CreateMenuItemRequest): Observable<AdminMenuItem> {
    return this.http.post<AdminMenuItem>(this.apiUrl, menuItem, { 
      headers: this.getAuthHeaders() 
    });
  }

  updateMenuItem(id: string, menuItem: CreateMenuItemRequest): Observable<AdminMenuItem> {
    return this.http.put<AdminMenuItem>(`${this.apiUrl}/${id}`, menuItem, { 
      headers: this.getAuthHeaders() 
    });
  }

  deleteMenuItem(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { 
      headers: this.getAuthHeaders() 
    });
  }

  // Variants
  createVariant(menuItemId: string, variant: CreateVariantRequest): Observable<AdminMenuVariant> {
    return this.http.post<AdminMenuVariant>(`${this.apiUrl}/${menuItemId}/variants`, variant, { 
      headers: this.getAuthHeaders() 
    });
  }

  updateVariant(variantId: string, variant: CreateVariantRequest): Observable<AdminMenuVariant> {
    return this.http.put<AdminMenuVariant>(`${this.apiUrl}/variants/${variantId}`, variant, { 
      headers: this.getAuthHeaders() 
    });
  }

  deleteVariant(variantId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/variants/${variantId}`, { 
      headers: this.getAuthHeaders() 
    });
  }

  // Image Upload
  uploadImage(file: File): Observable<ImageUploadResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<ImageUploadResponse>(
      `${this.apiUrl}/upload-image`, 
      formData, 
      { headers: this.getAuthHeadersForUpload() }
    );
  }

  deleteImage(filename: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete-image/${filename}`, { 
      headers: this.getAuthHeaders() 
    });
  }

}