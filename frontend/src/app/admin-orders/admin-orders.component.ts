import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth';
import { ConfirmationModalComponent } from '../shared/confirmation-modal.component';
import { NotificationModalComponent, NotificationType } from '../shared/notification-modal.component';
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
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule, ConfirmationModalComponent, NotificationModalComponent],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.css'],
})
export class AdminOrdersComponent implements OnInit {
  orders: Order[] = [];
  filterStatus = '';
  filterPaymentStatus = '';

  statuses = ['New', 'Processing', 'Delivered', 'Cancelled'];
  paymentStatuses = ['Pending', 'Confirmed'];

  loading = false;
  error = '';

  // Modal states
  showConfirmModal = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalAction: (() => void) | null = null;
  confirmModalCancelAction: (() => void) | null = null;

  showNotificationModal = false;
  notificationType: NotificationType = 'info';
  notificationTitle = '';
  notificationMessage = '';
  notificationDetails: string | null = null;

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading = true;
    this.error = '';
    const params: any = {};
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.filterPaymentStatus)
      params.payment_status = this.filterPaymentStatus;

    console.log('Loading orders with params:', params);

    this.http.get<Order[]>('${environment.apiUrl}/admin/orders', { params, withCredentials: true }).subscribe({
      next: (data) => {
        console.log('Orders loaded:', data);
        this.orders = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load orders:', err);
        this.error = 'Failed to load orders.';
        this.loading = false;
        
        // Show error notification for better user feedback
        let errorMessage = 'Failed to load orders from server.';
        let errorDetails = null;
        
        if (err.error && err.error.error) {
          errorMessage = err.error.error;
        }
        
        if (err.status) {
          errorDetails = `HTTP ${err.status}: ${err.statusText}\n${JSON.stringify(err.error, null, 2)}`;
        }
        
        this.showNotification('error', 'Loading Error', errorMessage, errorDetails);
      },
    });
  }

  updateStatus(order: Order, newStatus: string) {
    // Prevent auto-triggering during data loading
    if (newStatus === order.status) {
      return;
    }

    // Temporarily revert the dropdown to original value
    const originalStatus = order.status;
    order.status = originalStatus;

    this.showConfirmation(
      'Update Order Status',
      `Change order #${order.id} status to "${newStatus}"?`,
      () => {
        console.log('Updating order status:', {
          orderId: order.id,
          currentStatus: originalStatus,
          newStatus: newStatus
        });
        
        this.http
          .put(`${environment.apiUrl}/admin/orders/${order.id}/status`, { status: newStatus }, { withCredentials: true })
          .subscribe({
            next: (response) => {
              console.log('Order status update response:', response);
              order.status = newStatus;
              this.showNotification('success', 'Success', `Order status updated to "${newStatus}" successfully.`);
            },
            error: (err) => {
              console.error('Order status update error:', err);
              // Revert to original status on error
              order.status = originalStatus;
              
              let errorMessage = 'Failed to update order status.';
              let errorDetails = null;
              
              if (err.error && err.error.error) {
                errorMessage = err.error.error;
              }
              
              if (err.status) {
                errorDetails = `HTTP ${err.status}: ${err.statusText}\n${JSON.stringify(err.error, null, 2)}`;
              }
              
              this.showNotification('error', 'Update Failed', errorMessage, errorDetails);
            },
          });
      },
      () => {
        // On cancel, revert to original status
        order.status = originalStatus;
      }
    );
  }

  updatePaymentStatus(order: Order, newPaymentStatus: string) {
    // Store the original status before any changes
    const originalPaymentStatus = order.payment_status;
    
    // Prevent auto-triggering during data loading or if status hasn't changed
    if (newPaymentStatus === originalPaymentStatus) {
      return;
    }

    this.showConfirmation(
      'Update Payment Status',
      `Change payment status of order #${order.id} to "${newPaymentStatus}"?`,
      () => {
        console.log('Updating payment status:', {
          orderId: order.id,
          currentStatus: originalPaymentStatus,
          newStatus: newPaymentStatus
        });
        
        this.http
          .put(`${environment.apiUrl}/admin/orders/${order.id}/payment-status`, {
            payment_status: newPaymentStatus,
          }, { withCredentials: true })
          .subscribe({
            next: (response) => {
              console.log('Payment status update response:', response);
              order.payment_status = newPaymentStatus;
              this.showNotification('success', 'Success', `Payment status updated to "${newPaymentStatus}" successfully.`);
            },
            error: (err) => {
              console.error('Payment status update error:', err);
              // Revert to original status on error
              order.payment_status = originalPaymentStatus;
              
              let errorMessage = 'Failed to update payment status.';
              let errorDetails = null;
              
              if (err.error && err.error.error) {
                errorMessage = err.error.error;
              }
              
              if (err.status) {
                errorDetails = `HTTP ${err.status}: ${err.statusText}\n${JSON.stringify(err.error, null, 2)}`;
              }
              
              this.showNotification('error', 'Update Failed', errorMessage, errorDetails);
            },
          });
      },
      () => {
        // On cancel, revert to original status
        order.payment_status = originalPaymentStatus;
      }
    );
  }

  getOrdersByStatus(status: string): Order[] {
    return this.orders.filter(order => order.status === status);
  }

  // Modal helper methods
  showConfirmation(title: string, message: string, action: () => void, cancelAction?: () => void) {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalAction = action;
    this.confirmModalCancelAction = cancelAction || null;
    this.showConfirmModal = true;
  }

  onConfirmModalConfirmed() {
    this.showConfirmModal = false;
    if (this.confirmModalAction) {
      this.confirmModalAction();
      this.confirmModalAction = null;
    }
  }

  onConfirmModalCancelled() {
    this.showConfirmModal = false;
    if (this.confirmModalCancelAction) {
      this.confirmModalCancelAction();
      this.confirmModalCancelAction = null;
    }
    this.confirmModalAction = null;
  }

  showNotification(type: NotificationType, title: string, message: string, details: string | null = null) {
    this.notificationType = type;
    this.notificationTitle = title;
    this.notificationMessage = message;
    this.notificationDetails = details;
    this.showNotificationModal = true;
  }

  onNotificationModalClosed() {
    this.showNotificationModal = false;
  }
}
