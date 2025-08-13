import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-add-to-cart-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './add-to-cart-modal.component.html',
  styleUrls: ['./add-to-cart-modal.component.css']
})
export class AddToCartModalComponent {
  @Input() isVisible = false;
  @Input() itemName = '';
  @Input() variant = '';
  @Input() price = 0;
  @Input() itemImage = '';
  @Input() cartCount = 0;
  
  @Output() closeModal = new EventEmitter<void>();
  @Output() continueShopping = new EventEmitter<void>();
  @Output() viewCart = new EventEmitter<void>();

  constructor(private router: Router) {}

  close() {
    this.closeModal.emit();
  }

  onOverlayClick(event: Event) {
    // Close modal when clicking on overlay (not on content)
    this.close();
  }

  onContinueShopping() {
    this.continueShopping.emit();
    this.close();
  }

  onViewCart() {
    this.viewCart.emit();
    this.router.navigate(['/cart']);
    this.close();
  }
}