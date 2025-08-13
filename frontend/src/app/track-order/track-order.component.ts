import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface Order {
  id: number;
  customer_name: string;
  phone: string;
  address: string;
  payment_method: string;
  total_price: number;
  status: string;
  payment_status: string;
  requested_delivery: string;
  created_at: string;
}

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './track-order.component.html',
  styleUrls: ['./track-order.component.css'],
})
export class TrackOrderComponent {
  trackingForm: FormGroup;
  order: Order | null = null;
  loading = false;
  error = '';
  searched = false;

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.trackingForm = this.fb.group({
      orderId: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]]
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
}