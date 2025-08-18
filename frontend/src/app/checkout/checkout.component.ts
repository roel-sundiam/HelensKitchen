import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
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
import { DeliveryService, DeliveryFeeResponse } from '../services/delivery.service';
import { environment } from '../../environments/environment';
import * as L from 'leaflet';
import { OpenLocationCode } from 'open-location-code';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink, ErrorModalComponent],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent implements OnInit, OnDestroy, AfterViewInit {
  paymentMethods = ['GCash', 'Bank Transfer'];
  cartItems: CartItem[] = [];
  isGettingLocation = false;
  orderSubmitted = false;
  orderId: number | null = null;
  deliveryFeeData: DeliveryFeeResponse | null = null;
  isCalculatingDeliveryFee = false;

  // Error modal properties
  showErrorModal = false;
  errorModalTitle = 'Error';
  errorModalMessage = '';
  errorModalDetails: string | null = null;

  // Leaflet Map properties
  map: L.Map | null = null;
  marker: L.Marker | null = null;
  isMapVisible = false;
  isMobileDevice = false;
  isMapLoading = false;
  searchResults: any[] = [];
  isSearching = false;
  isPickupMode = false;

  checkoutForm;

  paymentInstructions = {
    GCash:
      'Detailed GCash payment instructions will be provided after your order is confirmed.',
    'Bank Transfer':
      'Detailed bank transfer instructions will be provided after your order is confirmed.',
  };

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private http: HttpClient,
    private router: Router,
    private analyticsService: AnalyticsService,
    private deliveryService: DeliveryService,
    private cdr: ChangeDetectorRef
  ) {
    // Detect if we're on a mobile device
    this.isMobileDevice = window.innerWidth <= 768;
    this.checkoutForm = this.fb.group({
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],
      deliveryOption: ['delivery', Validators.required], // New field: 'delivery' or 'pickup'
      address: [''], // Will be required conditionally
      searchAddress: [''], // For address search
      plusCode: ['', this.validatePlusCode], // Optional Plus Code for precise location
      paymentMethod: ['', Validators.required],
      deliveryDateTime: [
        this.getDefaultDeliveryDateTime(),
        [Validators.required, this.validateDeliveryDateTime.bind(this)],
      ],
    });

    this.cartService.cart$.subscribe((items) => {
      this.cartItems = items;
    });

    // Note: Delivery fee calculation removed - admin will set delivery fee manually after order submission

    // Watch for delivery option changes
    this.checkoutForm.get('deliveryOption')?.valueChanges.subscribe((option) => {
      this.isPickupMode = option === 'pickup';
      this.updateFormValidation();
      
      if (this.isPickupMode) {
        // Clear delivery-related fields when switching to pickup
        this.searchResults = [];
        this.checkoutForm.patchValue({
          address: '',
          searchAddress: '',
          plusCode: ''
        });
      } else {
        // When switching back to delivery, reinitialize the map if needed
        setTimeout(() => {
          this.ensureMapIsInitialized();
        }, 100);
      }
    });

    // Note: Address change monitoring for delivery fee removed - admin will set delivery fee manually
  }

  private updateFormValidation(): void {
    const addressControl = this.checkoutForm.get('address');
    
    if (this.isPickupMode) {
      // Remove address validation for pickup
      addressControl?.clearValidators();
    } else {
      // Add address validation for delivery
      addressControl?.setValidators([Validators.required]);
    }
    
    addressControl?.updateValueAndValidity();
  }

  ngOnInit(): void {
    // Listen for window resize to update mobile detection
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  ngAfterViewInit(): void {
    // Initialize the map after the view has been initialized
    setTimeout(() => {
      this.initializeLeafletMap();
    }, 100);
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    // Clean up map
    if (this.map) {
      this.map.remove();
    }

    // Clean up search timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  private onWindowResize(): void {
    this.isMobileDevice = window.innerWidth <= 768;
  }

  private ensureMapIsInitialized(): void {
    // Check if map container exists and map is not initialized
    const mapElement = document.getElementById('leaflet-map');
    if (mapElement && !this.map) {
      this.initializeLeafletMap();
    } else if (this.map) {
      // If map exists, just invalidate size to ensure proper rendering
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 50);
    }
  }

  private initializeLeafletMap(): void {
    const mapElement = document.getElementById('leaflet-map');
    if (!mapElement) return;

    try {
      this.isMapLoading = true;

      // Default center (Philippines - Manila)
      const defaultLat = 14.5995;
      const defaultLng = 120.9842;

      // Initialize Leaflet map
      this.map = L.map('leaflet-map').setView([defaultLat, defaultLng], this.isMobileDevice ? 12 : 15);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Custom marker icon (fix for default icon issues)
      const customIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAyNCAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDM2QzEyIDM2IDI0IDI0IDI0IDEyQzI0IDUuMzcyNTggMTguNjI3NCAwIDEyIDBDNS4zNzI1OCAwIDAgNS4zNzI1OCAwIDEyQzAgMjQgMTIgMzYgMTIgMzZaIiBmaWxsPSIjQjkxQzFDIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjYiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
        iconSize: [24, 36],
        iconAnchor: [12, 36],
        popupAnchor: [0, -36]
      });

      // Initialize marker (hidden initially)
      this.marker = L.marker([defaultLat, defaultLng], { 
        icon: customIcon, 
        draggable: true 
      });

      // Handle marker drag
      this.marker.on('dragend', (event) => {
        const position = event.target.getLatLng();
        this.updatePlusCodeFromLatLng(position.lat, position.lng, true); // Force update when dragging
        this.reverseGeocode(position.lat, position.lng);
      });

      // Handle map click to place marker
      this.map.on('click', (event) => {
        const position = event.latlng;
        if (this.marker && this.map) {
          this.marker.setLatLng([position.lat, position.lng]).addTo(this.map);
          this.updatePlusCodeFromLatLng(position.lat, position.lng, true); // Force update when clicking
          this.reverseGeocode(position.lat, position.lng);
        }
      });

      this.isMapLoading = false;
    } catch (error) {
      console.error('Error initializing Leaflet map:', error);
      this.isMapLoading = false;
      this.showError('Map Loading Error', 'Failed to load the map. Please refresh the page and try again.');
    }
  }

  private updatePlusCodeFromLatLng(lat: number, lng: number, forceUpdate: boolean = false): void {
    try {
      const plusCode = this.encodePlusCode(lat, lng);
      // Update if field is empty OR if force update is requested (e.g., when dragging marker)
      if (!this.checkoutForm.value.plusCode || forceUpdate) {
        this.checkoutForm.patchValue({
          plusCode: plusCode
        });
      }
    } catch (error) {
      console.error('Error generating Plus Code:', error);
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const response = await this.http.get<any>(`${environment.apiUrl}/reverse-geocode?lat=${lat}&lon=${lng}`).toPromise();
      
      if (response && response.display_name) {
        this.checkoutForm.patchValue({
          address: response.display_name,
          searchAddress: response.display_name
        });
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  }

  // Add a debounce mechanism for search
  private searchTimeout: any = null;

  searchAddress(query: string): void {
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!query || query.length < 3) {
      this.searchResults = [];
      return;
    }

    // Debounce the search
    this.searchTimeout = setTimeout(async () => {
      this.isSearching = true;
      
      try {
        // Use our backend proxy to search for addresses (avoids CORS issues)
        const response = await this.http.get<any[]>(`${environment.apiUrl}/search-address?q=${encodeURIComponent(query)}&limit=5`).toPromise();
        
        this.searchResults = response || [];
        this.isSearching = false;
        
        // Manually trigger change detection for mobile
        this.cdr.detectChanges();
      } catch (error) {
        console.error('Error searching addresses:', error);
        this.searchResults = [];
        this.isSearching = false;
        this.cdr.detectChanges();
      }
    }, 500); // 500ms debounce
  }

  trackByFn(index: number, item: any): any {
    return item.place_id || index;
  }

  selectSearchResult(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Update form fields
    this.checkoutForm.patchValue({
      address: result.display_name,
      searchAddress: result.display_name
    });

    // Update Plus Code (force update since user selected a location)
    this.updatePlusCodeFromLatLng(lat, lng, true);

    // Update map
    if (this.map && this.marker) {
      this.map.setView([lat, lng], 17);
      this.marker.setLatLng([lat, lng]).addTo(this.map);
    }

    // Show map on mobile if it was hidden
    if (this.isMobileDevice && !this.isMapVisible) {
      this.toggleMapVisibility();
    }

    // Clear search results and searching state
    this.searchResults = [];
    this.isSearching = false;
    
    // Clear any pending search timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  toggleMapVisibility(): void {
    this.isMapVisible = !this.isMapVisible;
    
    // Trigger map resize after visibility change
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      } else if (this.isMapVisible) {
        // If map is not initialized but we're showing it, initialize now
        this.ensureMapIsInitialized();
      }
    }, 100);
  }

  centerMapOnCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.showError('Geolocation Error', 'Geolocation is not supported by this browser.');
      return;
    }

    this.isGettingLocation = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (this.map && this.marker) {
          this.map.setView([lat, lng], 17);
          this.marker.setLatLng([lat, lng]).addTo(this.map);
          
          // Update Plus Code (force update since user requested current location)
          this.updatePlusCodeFromLatLng(lat, lng, true);
          
          // Reverse geocode to get address
          this.reverseGeocode(lat, lng);
        }

        this.isGettingLocation = false;
      },
      (error) => {
        this.isGettingLocation = false;
        this.handleGeolocationError(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  }

  private getDefaultDeliveryDateTime(): string {
    const now = new Date();
    // Set default to 25 hours from now to ensure it passes validation
    now.setHours(now.getHours() + 25);
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    return now.toISOString().slice(0, 16);
  }

  validatePlusCode(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) {
      return null; // Plus code is optional
    }
    
    // Plus code format validation for both local and global codes
    // Local: G5J5+XY (4 chars + "+" + 2-3 chars)  
    // Global: 7Q63G5J5+XYZ (8 chars + "+" + 2-3 chars)
    // Allow Google's Plus Code character set: 23456789CFGHJMPQRVWX
    const plusCodePattern = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;
    if (!plusCodePattern.test(value)) {
      return { invalidPlusCode: true };
    }
    
    return null;
  }

  validateDeliveryDateTime(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const selectedDate = new Date(control.value);
    const now = new Date();
    // Add 24 hours to current time
    now.setHours(now.getHours() + 24);
    return selectedDate >= now ? null : { invalidDate: true };
  }

  // Note: calculateDeliveryFee method removed - admin will set delivery fee manually

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

    // Note: Delivery fee validation removed - admin will set delivery fee after order submission

    const subtotal = this.cartService.getTotal();
    // For delivery orders, delivery fee will be set by admin after review
    // For pickup orders, no delivery fee needed
    const deliveryFee = 0; // Will be set by admin for delivery orders
    const totalPrice = subtotal; // Only food cost initially

    const orderData = {
      customer_name: this.checkoutForm.value.name,
      phone: this.checkoutForm.value.phone,
      delivery_option: this.checkoutForm.value.deliveryOption,
      address: this.isPickupMode ? 'PICKUP - Helen\'s Kitchen Store' : this.checkoutForm.value.address,
      plus_code: this.isPickupMode ? '' : this.checkoutForm.value.plusCode,
      payment_method: this.checkoutForm.value.paymentMethod,
      requested_delivery: this.checkoutForm.value.deliveryDateTime,
      items: this.cartItems.map((item) => ({
        menu_item_id: item.menuItem.id,
        variant: item.variant,
        quantity: item.quantity,
        price: item.price,
      })),
      total_price: totalPrice,
      delivery_fee: deliveryFee,
      delivery_fee_status: this.isPickupMode ? 'not_applicable' : 'pending',
      quotation_id: null, // Will be set by admin if needed
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
          totalPrice
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

  // Note: Delivery fee helper methods removed - admin will set delivery fee manually
  
  getTotalForDisplay(): number {
    // Show only food total - delivery fee will be added by admin for delivery orders
    return this.getCartTotal();
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
    // Use the new Google Maps integrated method
    this.centerMapOnCurrentLocation();
  }

  private handleGeolocationError(error: GeolocationPositionError): void {
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
  }

  private encodePlusCode(lat: number, lng: number): string {
    try {
      // Use Google's official Open Location Code library
      const olc = new OpenLocationCode();
      // Generate a higher precision Plus code (11 characters) for better Google Maps compatibility
      const plusCode = olc.encode(lat, lng, 11);
      return plusCode;
    } catch (error) {
      console.error('Error generating Plus Code:', error);
      return '';
    }
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
    this.deliveryService.clearDeliveryFee();
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
