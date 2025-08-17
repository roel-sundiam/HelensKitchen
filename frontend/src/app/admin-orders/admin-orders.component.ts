import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth';
import { ConfirmationModalComponent } from '../shared/confirmation-modal.component';
import { NotificationModalComponent, NotificationType } from '../shared/notification-modal.component';
import { OrderDetailsModalComponent } from '../shared/order-details-modal.component';
import { environment } from '../../environments/environment';

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  delivery_option: string;
  address: string;
  plus_code?: string;
  payment_method: string;
  total_price: number;
  delivery_fee: number;
  delivery_fee_status: 'pending' | 'set' | 'not_applicable';
  status: string;
  payment_status: string;
  requested_delivery: string;
  created_at: string;
}

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
  delivery_option: string;
  address: string;
  plus_code?: string;
  payment_method: string;
  total_price: number;
  delivery_fee: number;
  delivery_fee_status: 'pending' | 'set' | 'not_applicable';
  status: string;
  payment_status: string;
  requested_delivery: string;
  created_at: string;
  items: OrderItem[];
}

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule, ConfirmationModalComponent, NotificationModalComponent, OrderDetailsModalComponent],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.css'],
})
export class AdminOrdersComponent implements OnInit {
  
  // Helper method to get datetime-local value
  getDateTimeValue(order: Order): string {
    if (!order.requested_delivery) return '';
    try {
      // Simple ISO string slice - no complex formatting
      return new Date(order.requested_delivery).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  }

  // Event handler for delivery date changes
  onDeliveryDateChange(order: Order, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target && target.value) {
      try {
        // Parse the date and convert to ISO string
        const newDate = new Date(target.value);
        if (!isNaN(newDate.getTime())) {
          this.updateDeliveryDate(order, newDate.toISOString());
        } else {
          // Invalid date format
          this.showNotification('error', 'Invalid Date', 'Please enter a valid date in MM/DD/YYYY HH:MM format');
          // Revert to original value
          target.value = new Date(order.requested_delivery).toLocaleDateString() + ' ' + 
                        new Date(order.requested_delivery).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
      } catch (error) {
        console.error('Date parsing error:', error);
        this.showNotification('error', 'Invalid Date', 'Please enter a valid date format');
      }
    }
  }

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

  // Order details modal states
  showOrderDetailsModal = false;
  selectedOrderDetails: OrderDetails | null = null;
  loadingOrderDetails = false;

  // Delivery fee modal states
  showDeliveryFeeModal = false;
  selectedOrderForFee: Order | null = null;
  deliveryFeeInput: number = 0;

  // Delete order state
  orderToDelete: Order | null = null;

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    // Load orders with automatic filtering for delivered/cancelled on initial load
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

    const headers = this.authService.getAuthHeaders();
    this.http.get<Order[]>(`${environment.apiUrl}/admin/orders`, { params, headers }).subscribe({
      next: (data) => {
        console.log('Orders loaded:', data);
        // Filter out delivered and cancelled orders unless specific filters are applied
        let filteredData = data;
        if (!this.filterStatus && !this.filterPaymentStatus) {
          // On initial load (no filters), exclude Delivered and Cancelled orders
          filteredData = data.filter(order => 
            order.status !== 'Delivered' && order.status !== 'Cancelled'
          );
          console.log('Filtered out delivered/cancelled orders:', filteredData);
        }
        this.orders = filteredData;
        // Initialize status tracking for all orders
        this.originalPaymentStatuses = {};
        this.originalStatuses = {};
        filteredData.forEach(order => {
          this.originalPaymentStatuses[order.id] = order.payment_status;
          this.originalStatuses[order.id] = order.status;
          this.originalDeliveryDates[order.id] = order.requested_delivery;
        });
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
    console.log('updateStatus called:', {
      orderId: order.id,
      currentStatus: order.status,
      newStatus: newStatus,
      originalTracked: this.originalStatuses[order.id]
    });

    // Store the original status before the first change attempt
    if (!(order.id in this.originalStatuses)) {
      this.originalStatuses[order.id] = order.status;
    }
    
    const originalStatus = this.originalStatuses[order.id];
    
    // Prevent auto-triggering during data loading or if status hasn't changed
    if (newStatus === originalStatus) {
      console.log('No change needed, returning early');
      return;
    }

    console.log('Proceeding with order status update');

    // Temporarily revert the dropdown to original value
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
          .put(`${environment.apiUrl}/admin/orders/${order.id}/status`, { status: newStatus }, { headers: this.authService.getAuthHeaders() })
          .subscribe({
            next: (response) => {
              console.log('Order status update response:', response);
              order.status = newStatus;
              // Update the tracked original status for future changes
              this.originalStatuses[order.id] = newStatus;
              this.showNotification('success', 'Success', `Order status updated to "${newStatus}" successfully.`);
              // Reload orders to apply filtering (hide Delivered/Cancelled orders)
              this.loadOrders();
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

  // Track original statuses before any changes
  private originalPaymentStatuses: { [orderId: string]: string } = {};
  private originalStatuses: { [orderId: string]: string } = {};
  private originalDeliveryDates: { [orderId: string]: string } = {};

  updatePaymentStatus(order: Order, newPaymentStatus: string) {
    console.log('updatePaymentStatus called:', {
      orderId: order.id,
      currentPaymentStatus: order.payment_status,
      newPaymentStatus: newPaymentStatus,
      originalTracked: this.originalPaymentStatuses[order.id]
    });

    // Store the original status before the first change attempt
    if (!(order.id in this.originalPaymentStatuses)) {
      this.originalPaymentStatuses[order.id] = order.payment_status;
    }
    
    const originalPaymentStatus = this.originalPaymentStatuses[order.id];
    
    // Prevent auto-triggering during data loading or if status hasn't changed
    if (newPaymentStatus === originalPaymentStatus) {
      console.log('No change needed, returning early');
      return;
    }

    console.log('Proceeding with payment status update');

    // Temporarily revert the dropdown to original value
    order.payment_status = originalPaymentStatus;

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
          }, { headers: this.authService.getAuthHeaders() })
          .subscribe({
            next: (response) => {
              console.log('Payment status update response:', response);
              order.payment_status = newPaymentStatus;
              // Update the tracked original status for future changes
              this.originalPaymentStatuses[order.id] = newPaymentStatus;
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

  updateDeliveryDate(order: Order, newDeliveryDate: string) {
    console.log('updateDeliveryDate called:', {
      orderId: order.id,
      currentDeliveryDate: order.requested_delivery,
      newDeliveryDate: newDeliveryDate,
      originalTracked: this.originalDeliveryDates[order.id]
    });

    // Store the original delivery date before the first change attempt
    if (!(order.id in this.originalDeliveryDates)) {
      this.originalDeliveryDates[order.id] = order.requested_delivery;
    }
    
    const originalDeliveryDate = this.originalDeliveryDates[order.id];
    
    // Prevent auto-triggering during data loading or if date hasn't changed
    if (newDeliveryDate === originalDeliveryDate) {
      console.log('No change needed, returning early');
      return;
    }

    // Validate 24-hour advance notice
    const newDate = new Date(newDeliveryDate);
    const now = new Date();
    const hoursDifference = (newDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDifference < 24) {
      // Revert to original date
      order.requested_delivery = originalDeliveryDate;
      this.showNotification('error', 'Invalid Date', 'Delivery date must be at least 24 hours from now.');
      return;
    }

    console.log('Proceeding with delivery date update');

    // Temporarily revert the input to original value
    order.requested_delivery = originalDeliveryDate;

    const formattedDate = new Date(newDeliveryDate).toLocaleDateString();
    this.showConfirmation(
      'Update Delivery Date',
      `Change delivery date for order #${order.id} to ${formattedDate}?`,
      () => {
        console.log('Updating delivery date:', {
          orderId: order.id,
          currentDeliveryDate: originalDeliveryDate,
          newDeliveryDate: newDeliveryDate
        });
        
        this.http
          .put(`${environment.apiUrl}/admin/orders/${order.id}/delivery-date`, { 
            requested_delivery: new Date(newDeliveryDate).toISOString() 
          }, { headers: this.authService.getAuthHeaders() })
          .subscribe({
            next: (response: any) => {
              console.log('Delivery date update response:', response);
              order.requested_delivery = response.requested_delivery || newDeliveryDate;
              // Update the tracked original date for future changes
              this.originalDeliveryDates[order.id] = order.requested_delivery;
              this.showNotification('success', 'Success', `Delivery date updated to ${formattedDate} successfully.`);
            },
            error: (err) => {
              console.error('Delivery date update error:', err);
              // Revert to original date on error
              order.requested_delivery = originalDeliveryDate;
              
              let errorMessage = 'Failed to update delivery date.';
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
        // On cancel, revert to original date
        order.requested_delivery = originalDeliveryDate;
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

  viewOrderDetails(order: Order) {
    this.loadingOrderDetails = true;
    this.showOrderDetailsModal = true;
    this.selectedOrderDetails = null;

    const headers = this.authService.getAuthHeaders();
    console.log('Making API call to:', `${environment.apiUrl}/admin/orders/${order.id}`);
    console.log('With headers:', headers);
    this.http.get<OrderDetails>(`${environment.apiUrl}/admin/orders/${order.id}`, { headers }).subscribe({
      next: (orderDetails) => {
        this.selectedOrderDetails = orderDetails;
        this.loadingOrderDetails = false;
      },
      error: (err) => {
        console.error('Failed to load order details:', err);
        this.loadingOrderDetails = false;
        
        let errorMessage = 'Failed to load order details.';
        let errorDetails = null;
        
        if (err.error && err.error.error) {
          errorMessage = err.error.error;
        }
        
        if (err.status) {
          errorDetails = `HTTP ${err.status}: ${err.statusText}\n${JSON.stringify(err.error, null, 2)}`;
        }
        
        this.showNotification('error', 'Loading Error', errorMessage, errorDetails);
        this.showOrderDetailsModal = false;
      }
    });
  }

  onOrderDetailsModalClosed() {
    this.showOrderDetailsModal = false;
    this.selectedOrderDetails = null;
    this.loadingOrderDetails = false;
  }

  setDeliveryFee(order: Order) {
    this.selectedOrderForFee = order;
    this.deliveryFeeInput = order.delivery_fee || 0;
    this.showDeliveryFeeModal = true;
  }

  closeDeliveryFeeModal() {
    this.showDeliveryFeeModal = false;
    this.selectedOrderForFee = null;
    this.deliveryFeeInput = 0;
  }

  onDeliveryFeeModalOverlayClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.closeDeliveryFeeModal();
    }
  }

  submitDeliveryFee() {
    if (!this.selectedOrderForFee || isNaN(this.deliveryFeeInput) || this.deliveryFeeInput < 0) {
      this.showNotification('error', 'Invalid Input', 'Please enter a valid delivery fee amount (0 or higher).');
      return;
    }

    const order = this.selectedOrderForFee;
    const deliveryFee = this.deliveryFeeInput;
    const endpoint = `${environment.apiUrl}/admin/orders/${order.id}/delivery-fee`;
    
    this.http.put(endpoint, { delivery_fee: deliveryFee }, {
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: (response: any) => {
        // Update the order in the local array
        order.delivery_fee = deliveryFee;
        order.delivery_fee_status = 'set';
        order.total_price = response.new_total || (order.total_price + deliveryFee);
        
        this.showNotification('success', 'Delivery Fee Set', 
          `Delivery fee of ₱${deliveryFee.toFixed(2)} has been set successfully.\nNew total: ₱${order.total_price.toFixed(2)}`);
        
        this.closeDeliveryFeeModal();
      },
      error: (err) => {
        console.error('Error setting delivery fee:', err);
        let errorMessage = 'Failed to set delivery fee. Please try again.';
        
        if (err.error && err.error.error) {
          errorMessage = err.error.error;
        }
        
        this.showNotification('error', 'Update Failed', errorMessage);
      }
    });
  }

  getFoodTotal(order: Order): number {
    // For delivery orders with set delivery fee, subtract delivery fee from total
    if (order.delivery_option === 'delivery' && order.delivery_fee_status === 'set') {
      return order.total_price - order.delivery_fee;
    }
    // For pickup orders or pending delivery fee orders, total price is the food total
    return order.total_price;
  }

  confirmDeleteOrder(order: Order) {
    this.orderToDelete = order;
    this.showConfirmModal = true;
    this.confirmModalTitle = 'Delete Order';
    this.confirmModalMessage = `Are you sure you want to delete Order #${order.id}?\n\nCustomer: ${order.customer_name}\nTotal: ₱${order.total_price.toFixed(2)}\n\nThis action cannot be undone.`;
    this.confirmModalAction = () => this.deleteOrder();
    this.confirmModalCancelAction = () => {
      this.orderToDelete = null;
    };
  }

  deleteOrder() {
    if (!this.orderToDelete) {
      console.error('No order selected for deletion');
      return;
    }

    const orderId = this.orderToDelete.id;
    const headers = this.authService.getAuthHeaders();

    this.http.delete(`${environment.apiUrl}/admin/orders/${orderId}`, { headers }).subscribe({
      next: () => {
        // Remove the order from the local array
        this.orders = this.orders.filter(order => order.id !== orderId);
        
        this.showNotification(
          'success',
          'Order Deleted',
          `Order #${orderId} has been successfully deleted.`
        );
        
        this.orderToDelete = null;
      },
      error: (err) => {
        console.error('Failed to delete order:', err);
        
        let errorMessage = 'Failed to delete order. Please try again.';
        let errorDetails = null;
        
        if (err.error && err.error.error) {
          errorMessage = err.error.error;
        }
        
        if (err.status) {
          errorDetails = `HTTP ${err.status}: ${err.statusText}\n${JSON.stringify(err.error, null, 2)}`;
        }
        
        this.showNotification('error', 'Delete Failed', errorMessage, errorDetails);
        this.orderToDelete = null;
      }
    });
  }
}
