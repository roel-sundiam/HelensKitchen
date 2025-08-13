import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  image_url: string;
  images?: string[]; // Array of images for carousel
  base_price: number;
  variants: { id: number; menu_item_id: number; name: string; price: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private apiUrl = 'http://localhost:4000/api/menu';

  constructor(private http: HttpClient) {}

  getMenuItems(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(this.apiUrl);
  }
}
