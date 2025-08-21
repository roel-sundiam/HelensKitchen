import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { CustomerStorageService } from '../services/customer-storage.service';
import { environment } from '../../environments/environment';

interface OrderItem {
  menu_item_id: string;
  name: string;
  description: string;
  image_url: string;
  variant_name: string;
  quantity: number;
  price: number;
}

interface PaymentInstructions {
  order_id: string;
  payment_method: string;
  total_amount: number;
  method: string;
  account_name: string;
  account_number: string;
  bank_name?: string;
  instructions: string;
  steps: string[];
}

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  delivery_option: string;
  address: string;
  payment_method: string;
  total_price: number;
  delivery_fee: number;
  delivery_fee_status: 'pending' | 'set' | 'not_applicable';
  discount: number;
  status: string;
  payment_status: string;
  requested_delivery: string;
  created_at: string;
  items: OrderItem[];
}

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './track-order.component.html',
  styleUrls: ['./track-order.component.css'],
})
export class TrackOrderComponent implements OnInit {
  trackingForm: FormGroup;
  order: Order | null = null;
  paymentInstructions: PaymentInstructions | null = null;
  loading = false;
  loadingPaymentInstructions = false;
  error = '';
  paymentError = '';
  searched = false;

  constructor(
    private fb: FormBuilder, 
    private http: HttpClient, 
    private router: Router,
    private route: ActivatedRoute,
    private customerStorageService: CustomerStorageService
  ) {
    this.trackingForm = this.fb.group({
      orderId: ['', [Validators.required, Validators.pattern(/^[a-fA-F0-9]{24}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]]
    });
  }

  ngOnInit() {
    // Update stored data status for UI
    this.updateStoredDataStatus();
    
    // Priority 1: Check URL query parameters (from direct navigation from checkout)
    this.route.queryParams.subscribe(params => {
      const urlOrderId = params['orderId'];
      const urlPhone = params['phone'];
      
      if (urlOrderId && urlPhone) {
        // Auto-populate from URL parameters
        this.trackingForm.patchValue({
          orderId: urlOrderId,
          phone: urlPhone
        });
        
        // Automatically submit the form after a short delay
        setTimeout(() => {
          if (this.trackingForm.valid) {
            this.onSubmit();
          }
        }, 500);
        return; // Don't check localStorage if we have URL params
      }
      
      // Priority 2: Check localStorage for stored order details
      console.log('🔍 TrackOrderComponent: Checking for stored order details...');
      this.customerStorageService.getStoredOrderDetails().then(storedDetails => {
        if (storedDetails) {
          console.log('✅ TrackOrderComponent: Found stored order details, auto-filling form', storedDetails);
          this.trackingForm.patchValue({
            orderId: storedDetails.orderId,
            phone: storedDetails.phone
          });
          
          // Automatically submit the form after a short delay
          setTimeout(() => {
            if (this.trackingForm.valid) {
              console.log('🚀 TrackOrderComponent: Auto-submitting form with stored details');
              this.onSubmit();
            } else {
              console.warn('⚠️ TrackOrderComponent: Form is invalid, not auto-submitting');
            }
          }, 500);
        } else {
          console.log('ℹ️ TrackOrderComponent: No stored order details found');
        }
      }).catch(error => {
        console.error('❌ TrackOrderComponent: Error checking for stored order details:', error);
      });
    });
  }

  onSubmit() {
    if (this.trackingForm.invalid) {
      this.trackingForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    this.order = null;
    this.searched = true;

    const { orderId, phone } = this.trackingForm.value;
    
    this.http.get<Order>(`${environment.apiUrl}/track-order/${orderId}/${phone}`)
      .subscribe({
        next: (data) => {
          this.order = data;
          this.loading = false;
          // Automatically load payment instructions
          this.loadPaymentInstructions(data.id);
        },
        error: (err) => {
          this.error = err.status === 404 
            ? 'Order not found. Please check your Order ID and phone number.'
            : 'Error loading order. Please try again.';
          this.loading = false;
          console.error(err);
        }
      });
  }

  loadPaymentInstructions(orderId: string) {
    this.loadingPaymentInstructions = true;
    this.paymentError = '';
    this.paymentInstructions = null;

    this.http.get<PaymentInstructions>(`${environment.apiUrl}/payment-instructions/${orderId}`)
      .subscribe({
        next: (data) => {
          this.paymentInstructions = data;
          this.loadingPaymentInstructions = false;
        },
        error: (err) => {
          this.paymentError = 'Failed to load payment instructions. Please try again later.';
          this.loadingPaymentInstructions = false;
          console.error('Error loading payment instructions:', err);
        }
      });
  }

  getCustomerStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'New': 'Order Received',
      'Processing': 'Preparing Your Food',
      'Delivered': 'Order Complete',
      'Cancelled': 'Order Cancelled'
    };
    return statusMap[status] || status;
  }

  getPaymentStatus(paymentStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'Pending': 'Payment Verification Pending',
      'Confirmed': 'Payment Confirmed'
    };
    return statusMap[paymentStatus] || paymentStatus;
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

  reset() {
    this.trackingForm.reset();
    this.order = null;
    this.error = '';
    this.searched = false;
    this.loading = false;
  }

  goToFeedback() {
    if (this.order) {
      this.router.navigate(['/feedback'], { 
        queryParams: { 
          orderId: this.order.id,
          phone: this.order.phone
        } 
      });
    }
  }

  getFoodTotal(): number {
    if (!this.order || !this.order.items) return 0;
    return this.order.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  clearStoredData(): void {
    this.customerStorageService.clearStoredOrderDetails().then(() => {
      console.log('✅ TrackOrderComponent: Cleared stored data');
      this.trackingForm.reset();
      this.order = null;
      this.error = '';
      this.searched = false;
      this.loading = false;
    }).catch(error => {
      console.error('❌ TrackOrderComponent: Failed to clear stored data:', error);
    });
  }

  hasStoredData(): boolean {
    // For the template, we'll use a simple synchronous check
    // This will be updated after the async initialization
    return false;
  }

  // Add a property to track if stored data is available
  hasStoredDataSync = false;

  private async updateStoredDataStatus(): Promise<void> {
    try {
      this.hasStoredDataSync = await this.customerStorageService.hasStoredOrderDetails();
    } catch (error) {
      console.error('❌ TrackOrderComponent: Error checking stored data status:', error);
      this.hasStoredDataSync = false;
    }
  }
}