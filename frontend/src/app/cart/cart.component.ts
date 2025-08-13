import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartItem, CartService } from './cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];

  constructor(private cartService: CartService) {}

  ngOnInit() {
    this.cartService.cart$.subscribe((items) => {
      this.cartItems = items;
    });
  }

  updateQuantity(item: CartItem, qty: number) {
    if (qty >= 1 && qty <= 99) {
      this.cartService.updateQuantity(item, qty);
    }
  }

  increaseQuantity(item: CartItem) {
    if (item.quantity < 99) {
      this.cartService.updateQuantity(item, item.quantity + 1);
    }
  }

  decreaseQuantity(item: CartItem) {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item, item.quantity - 1);
    }
  }

  removeItem(item: CartItem) {
    this.cartService.removeFromCart(item);
  }

  getTotal(): number {
    return this.cartService.getTotal();
  }

  getTotalItems(): number {
    return this.cartItems.reduce((total, item) => total + item.quantity, 0);
  }

  trackByItem(index: number, item: CartItem): any {
    return item.menuItem.id + '_' + item.variant;
  }
}
