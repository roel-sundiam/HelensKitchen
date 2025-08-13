import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { HttpClientModule, HttpClient } from '@angular/common/http';
import { CartItem, CartService } from '../cart/cart.service';
import { AnalyticsService } from '../services/analytics';
import { ErrorModalComponent } from '../shared/error-modal.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink, ErrorModalComponent],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent {
  paymentMethods = ['GCash', 'Bank Transfer'];
  cartItems: CartItem[] = [];
  isGettingLocation = false;
  orderSubmitted = false;
  orderId: number | null = null;

  // Error modal properties
  showErrorModal = false;
  errorModalTitle = 'Error';
  errorModalMessage = '';
  errorModalDetails: string | null = null;

  checkoutForm;

  paymentInstructions = {
    GCash:
      'Send payment to GCash number 0917-XXXX-XXX. Include your order ID as reference.',
    'Bank Transfer':
      'Transfer to BPI Account 1234-5678-9012. Include your order ID as reference.',
  };

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private http: HttpClient,
    private router: Router,
    private analyticsService: AnalyticsService
  ) {
    this.checkoutForm = this.fb.group({
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],
      address: ['', Validators.required],
      plusCode: [''], // Remove strict validation for now
      paymentMethod: ['', Validators.required],
      deliveryDateTime: [
        '',
        [Validators.required, this.validateDeliveryDateTime.bind(this)],
      ],
    });

    this.cartService.cart$.subscribe((items) => {
      this.cartItems = items;
    });
  }

  validateDeliveryDateTime(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const selectedDate = new Date(control.value);
    const now = new Date();
    // Add 24 hours to current time
    now.setHours(now.getHours() + 24);
    return selectedDate >= now ? null : { invalidDate: true };
  }

  onSubmit() {
    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      this.showError('Form Validation Error', 'Please fix the highlighted errors before submitting your order.');
      return;
    }

    if (this.cartItems.length === 0) {
      this.showError('Empty Cart', 'Your cart is empty. Please add some items before placing an order.');
      return;
    }

    const orderData = {
      customer_name: this.checkoutForm.value.name,
      phone: this.checkoutForm.value.phone,
      address: this.checkoutForm.value.address,
      plus_code: this.checkoutForm.value.plusCode,
      payment_method: this.checkoutForm.value.paymentMethod,
      requested_delivery: this.checkoutForm.value.deliveryDateTime,
      items: this.cartItems.map((item) => ({
        menu_item_id: item.menuItem.id,
        variant: item.variant,
        quantity: item.quantity,
        price: item.price,
      })),
      total_price: this.cartService.getTotal(),
      payment_status: 'Pending',
      status: 'New',
    };

    this.http.post<{orderId: number}>(`${environment.apiUrl}/orders`, orderData).subscribe({
      next: (response) => {
        this.orderId = response.orderId;
        this.orderSubmitted = true;
        this.cartService.clearCart();
        
        // Track order submission event
        this.analyticsService.trackEvent(
          'form_submission', 
          'order', 
          'order_completed', 
          `Order ${response.orderId}`, 
          orderData.total_price
        );
      },
      error: (err) => {
        let errorMessage = 'Failed to submit order. Please try again.';
        let errorDetails = null;
        
        if (err.error && err.error.error) {
          errorMessage = err.error.error;
        }
        
        if (err.status) {
          errorDetails = `HTTP ${err.status}: ${err.statusText}\n${JSON.stringify(err.error, null, 2)}`;
        }
        
        this.showError('Order Submission Failed', errorMessage, errorDetails);
        console.error(err);
        
        // Track order failure event
        this.analyticsService.trackEvent(
          'form_submission', 
          'order', 
          'order_failed'
        );
      },
    });
  }

  getPaymentInstructions(): string {
    const paymentMethod = this.checkoutForm.get('paymentMethod')?.value;
    if (paymentMethod && paymentMethod in this.paymentInstructions) {
      return this.paymentInstructions[paymentMethod as keyof typeof this.paymentInstructions];
    }
    return '';
  }

  getCartTotal(): number {
    return this.cartService.getTotal();
  }

  getFormErrors(): string {
    const errors: string[] = [];
    Object.keys(this.checkoutForm.controls).forEach(key => {
      const control = this.checkoutForm.get(key);
      if (control && control.errors) {
        errors.push(`${key}: ${JSON.stringify(control.errors)}`);
      }
    });
    return errors.length > 0 ? errors.join(', ') : 'No errors';
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.showError('Geolocation Error', 'Geolocation is not supported by this browser.');
      return;
    }

    this.isGettingLocation = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        try {
          // Convert coordinates to Plus Code
          const plusCode = this.encodePlusCode(lat, lng);
          
          // Update the form with the Plus Code
          this.checkoutForm.patchValue({
            plusCode: plusCode
          });
          
          this.isGettingLocation = false;
        } catch (error) {
          console.error('Error converting to Plus Code:', error);
          this.showError('Location Error', 'Error converting location to Plus Code. Please try again.', error?.toString());
          this.isGettingLocation = false;
        }
      },
      (error) => {
        this.isGettingLocation = false;
        let message = 'Unable to get your location. ';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message += 'Location access was denied.';
            break;
          case error.POSITION_UNAVAILABLE:
            message += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            message += 'Location request timed out.';
            break;
          default:
            message += 'An unknown error occurred.';
            break;
        }
        
        this.showError('Location Error', message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  }

  private encodePlusCode(lat: number, lng: number): string {
    // Plus Code character set
    const ALPHABET = '23456789CFGHJMPQRVWX';
    
    // Normalize coordinates
    let normalizedLat = lat + 90;
    let normalizedLng = lng + 180;
    
    let code = '';
    let latPrecision = 20;
    let lngPrecision = 20;
    
    // Generate 8 characters (4 pairs)
    for (let i = 0; i < 4; i++) {
      const latDigit = Math.floor(normalizedLat / latPrecision);
      const lngDigit = Math.floor(normalizedLng / lngPrecision);
      
      code += ALPHABET[latDigit];
      code += ALPHABET[lngDigit];
      
      normalizedLat = normalizedLat % latPrecision;
      normalizedLng = normalizedLng % lngPrecision;
      
      latPrecision = latPrecision / 20;
      lngPrecision = lngPrecision / 20;
    }
    
    // Add the separator
    code = code.substring(0, 8) + '+' + code.substring(8);
    
    // For now, return just the first 8 characters + separator
    return code.substring(0, 9);
  }

  goToFeedback(): void {
    if (this.orderId) {
      const phone = this.checkoutForm.get('phone')?.value;
      this.router.navigate(['/feedback'], { 
        queryParams: { 
          orderId: this.orderId,
          phone: phone
        } 
      });
    }
  }

  startNewOrder(): void {
    this.orderSubmitted = false;
    this.orderId = null;
    this.checkoutForm.reset();
    this.router.navigate(['/']);
  }

  trackOrder(): void {
    if (this.orderId) {
      this.router.navigate(['/track-order'], { queryParams: { orderId: this.orderId } });
    }
  }

  showError(title: string, message: string, details: string | null = null): void {
    this.errorModalTitle = title;
    this.errorModalMessage = message;
    this.errorModalDetails = details;
    this.showErrorModal = true;
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
  }
}
