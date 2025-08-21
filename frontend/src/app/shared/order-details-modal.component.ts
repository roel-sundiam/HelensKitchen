import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
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
  delivery_option: string;
  delivery_fee: number;
  delivery_fee_status: 'pending' | 'set' | 'not_applicable';
  discount: number;
  plus_code?: string;
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
                <strong>Order Type:</strong> 
                <span class="delivery-type" [class.pickup]="getDeliveryOption() === 'pickup'">
                  {{ getDeliveryOption() === 'pickup' ? '🏪 Store Pickup' : '🚚 Home Delivery' }}
                </span>
              </div>
              <div class="delivery-item" *ngIf="getDeliveryOption() === 'delivery'">
                <strong>Address:</strong> {{ orderDetails.address }}
              </div>
              <div class="delivery-item" *ngIf="orderDetails.plus_code">
                <strong>Plus Code:</strong> {{ orderDetails.plus_code }}
              </div>
              <div class="delivery-item">
                <strong>Requested {{ getDeliveryOption() === 'pickup' ? 'Pickup' : 'Delivery' }}:</strong> 
                {{ orderDetails.requested_delivery | date:'medium' }}
              </div>
            </div>
          </div>

          <!-- Order Total Breakdown -->
          <div class="order-total-section">
            <h3>💰 Order Total</h3>
            <div class="total-breakdown">
              <div class="total-item">
                <span>Food Total:</span>
                <span>₱{{ getFoodTotal().toFixed(2) }}</span>
              </div>
              
              <!-- Delivery Fee Section -->
              <div class="total-item delivery-fee-item" *ngIf="getDeliveryOption() === 'delivery'">
                <span>Delivery Fee:</span>
                <span *ngIf="getDeliveryFeeStatus() === 'pending'" class="delivery-fee-pending">
                  <em>Pending calculation</em>
                </span>
                <span *ngIf="getDeliveryFeeStatus() === 'set'" class="delivery-fee-set">
                  ₱{{ getDeliveryFee().toFixed(2) }}
                </span>
              </div>
              
              <div class="total-item delivery-fee-item" *ngIf="getDeliveryOption() === 'pickup'">
                <span>Delivery Fee:</span>
                <span class="not-applicable">N/A (Store Pickup)</span>
              </div>
              
              <!-- Discount Section -->
              <div class="total-item discount-item" *ngIf="getDiscount() > 0">
                <span>Discount:</span>
                <span class="discount-amount">-₱{{ getDiscount().toFixed(2) }}</span>
              </div>
              
              <div class="total-item final-total">
                <strong>
                  <span>Total Amount:</span>
                  <span>₱{{ orderDetails.total_price.toFixed(2) }}</span>
                </strong>
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
export class OrderDetailsModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() orderDetails: OrderDetails | null = null;
  @Output() closeModal = new EventEmitter<void>();

  ngOnChanges() {
    // Component lifecycle hook for when inputs change
  }

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

  getFoodTotal(): number {
    if (!this.orderDetails) return 0;
    
    // Calculate food total by adding back delivery fee and discount to the total price
    // Formula: food_total = total_price + discount - delivery_fee
    let foodTotal = this.orderDetails.total_price;
    
    // Add back discount to get the original food total
    foodTotal += this.getDiscount();
    
    // Subtract delivery fee if it's set
    if (this.getDeliveryOption() === 'delivery' && 
        this.getDeliveryFeeStatus() === 'set') {
      foodTotal -= this.getDeliveryFee();
    }
    
    return Math.max(0, foodTotal); // Ensure non-negative
  }

  getDeliveryOption(): string {
    if (!this.orderDetails) return 'delivery';
    return this.orderDetails.delivery_option && this.orderDetails.delivery_option.trim() !== '' 
      ? this.orderDetails.delivery_option 
      : 'delivery';
  }

  getDeliveryFee(): number {
    if (!this.orderDetails) return 0;
    return this.orderDetails.delivery_fee || 0;
  }

  getDeliveryFeeStatus(): string {
    if (!this.orderDetails) return 'pending';
    
    if (this.orderDetails.delivery_fee_status && this.orderDetails.delivery_fee_status.trim() !== '') {
      return this.orderDetails.delivery_fee_status;
    }
    
    // Determine status based on other factors
    const deliveryOption = this.getDeliveryOption();
    const deliveryFee = this.getDeliveryFee();
    
    if (deliveryOption === 'pickup') {
      return 'not_applicable';
    } else if (deliveryFee > 0) {
      return 'set';
    } else {
      return 'pending';
    }
  }

  getDiscount(): number {
    if (!this.orderDetails) return 0;
    return this.orderDetails.discount || 0;
  }
}