import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

interface OrderItem {
  menu_item_id: string;
  name: string;
  description: string;
  image_url: string;
  variant_name: string;
  quantity: number;
  price: number;
}

interface OrderDetails {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  payment_method: string;
  total_price: number;
  status: string;
  payment_status: string;
  requested_delivery: string;
  created_at: string;
  items: OrderItem[];
}

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="onOverlayClick($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Order Details #{{ orderDetails?.id }}</h2>
          <button class="close-btn" (click)="onCloseModal()" type="button">
            <span>&times;</span>
          </button>
        </div>

        <div class="modal-body" *ngIf="orderDetails">
          <div class="order-summary">
            <div class="order-date">
              Ordered on {{ orderDetails.created_at | date:'medium' }}
            </div>
          </div>

          <div class="status-section">
            <div class="status-card">
              <div class="status-icon">{{ getStatusIcon(orderDetails.status) }}</div>
              <div class="status-info">
                <h3>{{ orderDetails.status }}</h3>
                <p class="status-description">
                  <span *ngIf="orderDetails.status === 'New'">Order has been received and is pending preparation.</span>
                  <span *ngIf="orderDetails.status === 'Processing'">Kitchen is preparing the order.</span>
                  <span *ngIf="orderDetails.status === 'Delivered'">Order has been successfully delivered.</span>
                  <span *ngIf="orderDetails.status === 'Cancelled'">This order has been cancelled.</span>
                </p>
              </div>
            </div>

            <div class="payment-card">
              <div class="payment-icon">{{ getPaymentIcon(orderDetails.payment_status) }}</div>
              <div class="payment-info">
                <h4>Payment {{ orderDetails.payment_status }}</h4>
                <p class="payment-method">via {{ orderDetails.payment_method }}</p>
              </div>
            </div>
          </div>

          <!-- Order Items Section -->
          <div class="order-items-section" *ngIf="orderDetails.items && orderDetails.items.length > 0">
            <h3>🍽️ Order Items</h3>
            <div class="order-items-list">
              <div class="order-item" *ngFor="let item of orderDetails.items">
                <div class="item-image">
                  <img [src]="item.image_url" [alt]="item.name" onerror="this.src='assets/images/default-food.jpg'" />
                </div>
                <div class="item-details">
                  <h4>{{ item.name }}</h4>
                  <p class="item-description">{{ item.description }}</p>
                  <div class="item-variant" *ngIf="item.variant_name">
                    <span class="variant-label">Size/Type:</span>
                    <span class="variant-value">{{ item.variant_name }}</span>
                  </div>
                  <div class="item-quantity-price">
                    <span class="quantity">Qty: {{ item.quantity }}</span>
                    <span class="price">₱{{ item.price.toFixed(2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="delivery-info">
            <h3>📍 Delivery Details</h3>
            <div class="delivery-details">
              <div class="delivery-item">
                <strong>Customer:</strong> {{ orderDetails.customer_name }}
              </div>
              <div class="delivery-item">
                <strong>Phone:</strong> {{ orderDetails.phone }}
              </div>
              <div class="delivery-item">
                <strong>Address:</strong> {{ orderDetails.address }}
              </div>
              <div class="delivery-item">
                <strong>Requested Delivery:</strong> {{ orderDetails.requested_delivery | date:'medium' }}
              </div>
              <div class="delivery-item total">
                <strong>Total Amount:</strong> ₱{{ orderDetails.total_price.toFixed(2) }}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="close-button" (click)="onCloseModal()" type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./order-details-modal.component.css']
})
export class OrderDetailsModalComponent {
  @Input() isVisible = false;
  @Input() orderDetails: OrderDetails | null = null;
  @Output() closeModal = new EventEmitter<void>();

  onOverlayClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onCloseModal();
    }
  }

  onCloseModal() {
    this.closeModal.emit();
  }

  getStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'New': '📝',
      'Processing': '👨‍🍳',
      'Delivered': '✅',
      'Cancelled': '❌'
    };
    return iconMap[status] || '📋';
  }

  getPaymentIcon(paymentStatus: string): string {
    return paymentStatus === 'Confirmed' ? '💰' : '⏳';
  }
}