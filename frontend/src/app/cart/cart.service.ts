// cart.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MenuItem } from '../menu/menu.service';

export interface CartItem {
  menuItem: MenuItem;
  variant: string;
  price: number;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItems: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  addToCart(item: CartItem) {
    const index = this.cartItems.findIndex(
      (i) => i.menuItem.id === item.menuItem.id && i.variant === item.variant
    );
    if (index > -1) {
      this.cartItems[index].quantity += item.quantity;
    } else {
      this.cartItems.push(item);
    }
    this.cartSubject.next(this.cartItems);
  }

  removeFromCart(item: CartItem) {
    this.cartItems = this.cartItems.filter(
      (i) => !(i.menuItem.id === item.menuItem.id && i.variant === item.variant)
    );
    this.cartSubject.next(this.cartItems);
  }

  updateQuantity(item: CartItem, quantity: number) {
    const index = this.cartItems.findIndex(
      (i) => i.menuItem.id === item.menuItem.id && i.variant === item.variant
    );
    if (index > -1) {
      if (quantity <= 0) {
        this.removeFromCart(item);
      } else {
        this.cartItems[index].quantity = quantity;
      }
      this.cartSubject.next(this.cartItems);
    }
  }

  clearCart() {
    this.cartItems = [];
    this.cartSubject.next(this.cartItems);
  }

  getTotal(): number {
    return this.cartItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );
  }

  getItems(): CartItem[] {
    return this.cartItems;
  }
}
