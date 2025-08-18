import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification.service';
import { ConfirmationModalComponent } from '../shared/confirmation-modal.component';
import { NotificationModalComponent, NotificationType } from '../shared/notification-modal.component';
import { OrderDetailsModalComponent } from '../shared/order-details-modal.component';
import { MenuService, MenuItem } from '../menu/menu.service';
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

interface NewOrder {
  customer_name: string;
  phone: string;
  delivery_option: string;
  address: string;
  plus_code?: string;
  payment_method: string;
  total_price: number;
  delivery_fee: number;
  delivery_fee_status: string;
  status: string;
  payment_status: string;
  requested_delivery: string;
  items: OrderItem[];
}

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule, ConfirmationModalComponent, NotificationModalComponent, OrderDetailsModalComponent],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.css'],
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  
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
  private isInitialLoad = true; // Track if this is the first load

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

  // Manual Order Entry modal states
  showAddOrderModal = false;
  submittingOrder = false;
  menuItems: MenuItem[] = [];
  selectedMenuItemId: string = '';
  selectedMenuItem: MenuItem | null = null;
  selectedVariantId: string = '';
  selectedVariant: any = null;
  selectedQuantity: number = 1;

  newOrder: NewOrder = {
    customer_name: '',
    phone: '',
    delivery_option: 'delivery',
    address: '',
    plus_code: '',
    payment_method: '',
    total_price: 0,
    delivery_fee: 0,
    delivery_fee_status: 'pending',
    status: 'New',
    payment_status: 'Pending',
    requested_delivery: '',
    items: []
  };

  // Notification-related properties
  badgeCount = 0;
  notificationPermission: NotificationPermission = 'default';
  isSubscribedToNotifications = false;
  showNotificationSetup = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private notificationService: NotificationService,
    private menuService: MenuService
  ) {}

  ngOnInit() {
    // Initialize notification service for admin
    this.initializeNotifications();
    
    // Load orders with automatic filtering for delivered/cancelled on initial load
    this.loadOrders();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeNotifications() {
    // Subscribe to badge count updates
    const badgeCountSub = this.notificationService.badgeCount$.subscribe(count => {
      this.badgeCount = count;
    });
    this.subscriptions.push(badgeCountSub);

    // Subscribe to notification permission changes
    const permissionSub = this.notificationService.notificationPermission$.subscribe(permission => {
      this.notificationPermission = permission;
      this.checkNotificationSetupNeeded();
    });
    this.subscriptions.push(permissionSub);

    // Subscribe to subscription status changes
    const subscriptionSub = this.notificationService.isSubscribed$.subscribe(isSubscribed => {
      this.isSubscribedToNotifications = isSubscribed;
      this.checkNotificationSetupNeeded();
    });
    this.subscriptions.push(subscriptionSub);

    // Initialize notifications for admin
    this.notificationService.initializeForAdmin();
  }

  private checkNotificationSetupNeeded() {
    // Show notification setup if permissions not granted or not subscribed
    this.showNotificationSetup = this.notificationPermission !== 'granted' || !this.isSubscribedToNotifications;
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
        // Only filter out delivered and cancelled orders on initial load
        // If user has interacted with filters (even selecting "All"), show all records
        let filteredData = data;
        if (this.isInitialLoad && !this.filterStatus && !this.filterPaymentStatus) {
          // On initial load only (no user interaction), exclude Delivered and Cancelled orders
          filteredData = data.filter(order => 
            order.status !== 'Delivered' && order.status !== 'Cancelled'
          );
          console.log('Initial load: Filtered out delivered/cancelled orders:', filteredData);
        } else {
          console.log('User has selected filters: Showing all matching records');
        }
        this.orders = filteredData;
        
        // Mark that initial load is complete
        this.isInitialLoad = false;
        // Initialize status tracking for all orders
        this.originalPaymentStatuses = {};
        this.originalStatuses = {};
        filteredData.forEach(order => {
          this.originalPaymentStatuses[order.id] = order.payment_status;
          this.originalStatuses[order.id] = order.status;
          this.originalDeliveryDates[order.id] = order.requested_delivery;
        });
        
        // Update badge count after loading orders
        this.updateBadgeCountAfterOrdersLoaded();
        
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

  // ========== MANUAL ORDER ENTRY METHODS ==========

  async openAddOrderModal() {
    this.showAddOrderModal = true;
    this.resetNewOrderForm();
    
    // Load menu items if not already loaded
    if (this.menuItems.length === 0) {
      try {
        this.menuItems = await this.menuService.getMenuItems().toPromise() || [];
      } catch (error) {
        console.error('Failed to load menu items:', error);
        this.showNotification('error', 'Loading Error', 'Failed to load menu items.');
      }
    }
  }

  closeAddOrderModal() {
    this.showAddOrderModal = false;
    this.resetNewOrderForm();
  }

  onAddOrderModalOverlayClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.closeAddOrderModal();
    }
  }

  resetNewOrderForm() {
    this.newOrder = {
      customer_name: '',
      phone: '',
      delivery_option: 'delivery',
      address: '',
      plus_code: '',
      payment_method: '',
      total_price: 0,
      delivery_fee: 0,
      delivery_fee_status: 'pending',
      status: 'New',
      payment_status: 'Pending',
      requested_delivery: '',
      items: []
    };
    this.selectedMenuItemId = '';
    this.selectedMenuItem = null;
    this.selectedVariantId = '';
    this.selectedVariant = null;
    this.selectedQuantity = 1;
    this.submittingOrder = false;
  }

  onDeliveryOptionChange() {
    // Clear address when switching to pickup
    if (this.newOrder.delivery_option === 'pickup') {
      this.newOrder.address = '';
      this.newOrder.plus_code = '';
      this.newOrder.delivery_fee = 0;
      this.newOrder.delivery_fee_status = 'not_applicable';
    } else {
      this.newOrder.delivery_fee_status = 'pending';
    }
    this.calculateTotal();
  }

  onMenuItemChange() {
    this.selectedMenuItem = this.menuItems.find(item => item.id.toString() === this.selectedMenuItemId) || null;
    this.selectedVariantId = '';
    this.selectedVariant = null;
  }

  onVariantChange() {
    if (this.selectedMenuItem) {
      this.selectedVariant = this.selectedMenuItem.variants.find(variant => variant.id.toString() === this.selectedVariantId) || null;
    }
  }

  addItemToOrder() {
    if (!this.selectedMenuItem || !this.selectedVariant || this.selectedQuantity < 1) {
      return;
    }

    // Check if item with same variant already exists
    const existingItemIndex = this.newOrder.items.findIndex(item => 
      item.menu_item_id === this.selectedMenuItem!.id.toString() && 
      item.variant_name === this.selectedVariant!.name
    );

    if (existingItemIndex > -1) {
      // Update quantity of existing item
      this.newOrder.items[existingItemIndex].quantity += this.selectedQuantity;
    } else {
      // Add new item
      const newItem: OrderItem = {
        menu_item_id: this.selectedMenuItem.id.toString(),
        name: this.selectedMenuItem.name,
        description: this.selectedMenuItem.description,
        image_url: this.selectedMenuItem.image_url,
        variant_name: this.selectedVariant.name,
        quantity: this.selectedQuantity,
        price: this.selectedVariant.price
      };
      this.newOrder.items.push(newItem);
    }

    // Reset selection
    this.selectedMenuItemId = '';
    this.selectedMenuItem = null;
    this.selectedVariantId = '';
    this.selectedVariant = null;
    this.selectedQuantity = 1;

    this.calculateTotal();
  }

  removeItemFromOrder(index: number) {
    this.newOrder.items.splice(index, 1);
    this.calculateTotal();
  }

  getItemsSubtotal(): number {
    return this.newOrder.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  getFinalTotal(): number {
    const itemsTotal = this.getItemsSubtotal();
    const deliveryFee = this.newOrder.delivery_option === 'delivery' ? (this.newOrder.delivery_fee || 0) : 0;
    return itemsTotal + deliveryFee;
  }

  calculateTotal() {
    this.newOrder.total_price = this.getFinalTotal();
  }

  async submitManualOrder() {
    // Validate required fields
    if (!this.newOrder.customer_name.trim()) {
      this.showNotification('error', 'Validation Error', 'Customer name is required.');
      return;
    }

    if (!this.newOrder.phone.trim()) {
      this.showNotification('error', 'Validation Error', 'Phone number is required.');
      return;
    }

    if (!this.newOrder.payment_method) {
      this.showNotification('error', 'Validation Error', 'Payment method is required.');
      return;
    }

    if (!this.newOrder.requested_delivery) {
      this.showNotification('error', 'Validation Error', 'Delivery/pickup date is required.');
      return;
    }

    if (this.newOrder.delivery_option === 'delivery' && !this.newOrder.address.trim()) {
      this.showNotification('error', 'Validation Error', 'Address is required for delivery orders.');
      return;
    }

    if (this.newOrder.items.length === 0) {
      this.showNotification('error', 'Validation Error', 'Please add at least one item to the order.');
      return;
    }

    this.submittingOrder = true;

    let orderData: any;

    try {
      // Prepare order data for API
      orderData = {
        customer_name: this.newOrder.customer_name,
        phone: this.newOrder.phone,
        delivery_option: this.newOrder.delivery_option,
        // For pickup orders, use a default address to satisfy backend validation
        address: this.newOrder.delivery_option === 'pickup' ? 'Pickup - No address required' : this.newOrder.address,
        plus_code: this.newOrder.plus_code || '',
        payment_method: this.newOrder.payment_method,
        total_price: this.getFinalTotal(),
        delivery_fee: this.newOrder.delivery_option === 'delivery' ? (this.newOrder.delivery_fee || 0) : 0,
        delivery_fee_status: this.newOrder.delivery_option === 'delivery' ? 
          (this.newOrder.delivery_fee > 0 ? 'set' : 'pending') : 'not_applicable',
        requested_delivery: new Date(this.newOrder.requested_delivery).toISOString(),
        items: this.newOrder.items.map(item => ({
          menu_item_id: parseInt(item.menu_item_id),
          variant_name: item.variant_name,
          quantity: item.quantity,
          price: item.price
        }))
      };

      // Debug: log the order data being sent
      console.log('Sending order data:', orderData);

      const response = await this.http.post(`${environment.apiUrl}/orders`, orderData).toPromise();
      
      this.showNotification('success', 'Order Created', 
        `Order has been successfully created for ${this.newOrder.customer_name}.`);
      
      this.closeAddOrderModal();
      this.loadOrders(); // Refresh the orders list

    } catch (error: any) {
      console.error('Failed to create manual order:', error);
      console.error('Order data that failed:', orderData);
      
      let errorMessage = 'Failed to create order. Please try again.';
      let errorDetails = '';
      
      if (error.error && error.error.error) {
        errorMessage = error.error.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Add more detailed error information
      if (error.status) {
        errorDetails = `Status: ${error.status}\nURL: ${error.url}\nResponse: ${JSON.stringify(error.error, null, 2)}`;
      }
      
      this.showNotification('error', 'Order Creation Failed', errorMessage, errorDetails);
    } finally {
      this.submittingOrder = false;
    }
  }

  // ========== NOTIFICATION METHODS ==========

  /**
   * Request notification permission and subscribe to push notifications
   */
  async enableNotifications() {
    try {
      console.log('Admin: Starting notification enable process...');
      const permission = await this.notificationService.requestNotificationPermission();
      console.log('Admin: Permission result:', permission);
      
      if (permission === 'granted') {
        console.log('Admin: Permission granted, attempting subscription...');
        const success = await this.notificationService.subscribeToPushNotifications();
        console.log('Admin: Subscription result:', success);
        
        if (success) {
          this.showNotification('success', 'Notifications Enabled', 
            'You will now receive push notifications for new orders on your iPhone.');
        } else {
          this.showNotification('error', 'Setup Failed', 
            'Failed to set up push notifications. Please try again. Check browser console for details.');
        }
      } else if (permission === 'denied') {
        this.showNotification('error', 'Permission Denied', 
          'Notifications were blocked. Please:\n\n' +
          '1. Close this app completely\n' +
          '2. Open iPhone Settings → Safari → Clear History and Website Data\n' +
          '3. Reopen this app and try again\n\n' +
          'Or try using Chrome/Firefox instead of Safari.');
      } else {
        this.showNotification('warning', 'Permission Not Granted', 
          'Notification permission was not granted. The permission dialog might not have appeared.\n\n' +
          'Try:\n' +
          '1. Using the installed PWA app instead of Safari\n' +
          '2. Clearing Safari data and trying again\n' +
          '3. Using a different browser');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      this.showNotification('error', 'Setup Error', 
        'An error occurred while setting up notifications. Check the browser console for details:\n\n' + 
        (error as any)?.message || String(error));
    }
  }

  /**
   * Disable push notifications
   */
  async disableNotifications() {
    try {
      const success = await this.notificationService.unsubscribeFromPushNotifications();
      
      if (success) {
        this.showNotification('info', 'Notifications Disabled', 
          'You will no longer receive push notifications for new orders.');
      } else {
        this.showNotification('error', 'Disable Failed', 
          'Failed to disable push notifications. Please try again.');
      }
    } catch (error) {
      console.error('Error disabling notifications:', error);
      this.showNotification('error', 'Disable Error', 
        'An error occurred while disabling notifications.');
    }
  }

  /**
   * Refresh badge count from server
   */
  async refreshNotifications() {
    try {
      await this.notificationService.refreshBadgeCount();
      this.showNotification('success', 'Refreshed', 'Notification count updated.');
    } catch (error) {
      console.error('Error refreshing notifications:', error);
      this.showNotification('error', 'Refresh Failed', 
        'Failed to refresh notification count.');
    }
  }

  /**
   * Update badge count based on loaded orders
   */
  private updateBadgeCountAfterOrdersLoaded() {
    // Count new orders with pending payment as unread
    const newOrderCount = this.orders.filter(order => 
      order.status === 'New' && order.payment_status === 'Pending'
    ).length;
    
    // Update badge count if different from current
    if (newOrderCount !== this.badgeCount) {
      this.notificationService.updateBadgeCount(newOrderCount);
    }
  }

  /**
   * Mark orders as viewed (clear badge when user views orders)
   */
  markOrdersAsViewed() {
    // Clear badge count when admin views the orders page
    this.notificationService.clearBadgeCount();
  }

  /**
   * Get notification setup help text
   */
  getNotificationHelpText(): string {
    if (this.notificationPermission === 'denied') {
      return 'Notifications are blocked. Please enable them in your browser settings.';
    } else if (this.notificationPermission === 'default') {
      return 'Enable notifications to get instant alerts for new orders on your iPhone.';
    } else if (!this.isSubscribedToNotifications) {
      return 'Finishing notification setup...';
    }
    return 'Notifications are enabled and working.';
  }

  /**
   * Check if notifications are fully enabled
   */
  get notificationsEnabled(): boolean {
    return this.notificationPermission === 'granted' && this.isSubscribedToNotifications;
  }

  /**
   * Dismiss notification setup banner
   */
  dismissNotificationSetup() {
    this.showNotificationSetup = false;
  }

}
