import { Injectable } from '@angular/core';

export interface StoredOrderDetails {
  orderId: string;
  phone: string;
  customerName?: string;
  storedAt: number; // timestamp
}

@Injectable({
  providedIn: 'root'
})
export class CustomerStorageService {
  private readonly STORAGE_KEY = 'customer_last_order';

  constructor() {
    // Test localStorage availability on service initialization
    this.testLocalStorage();
  }

  private testLocalStorage(): void {
    console.log('🧪 CustomerStorageService: Testing localStorage availability...');
    
    try {
      // Test basic localStorage functionality
      const testKey = 'localStorage_test';
      const testValue = 'test_data_' + Date.now();
      
      // Try to set an item
      localStorage.setItem(testKey, testValue);
      
      // Try to get the item
      const retrieved = localStorage.getItem(testKey);
      
      if (retrieved === testValue) {
        console.log('✅ CustomerStorageService: localStorage is working properly');
        // Clean up test data
        localStorage.removeItem(testKey);
      } else {
        console.error('❌ CustomerStorageService: localStorage read/write test failed');
      }
      
      // Check storage quota if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          console.log('💾 CustomerStorageService: Storage estimate:', {
            usage: estimate.usage,
            quota: estimate.quota,
            available: estimate.quota ? estimate.quota - (estimate.usage || 0) : 'unknown'
          });
        });
      }
      
    } catch (error) {
      console.error('❌ CustomerStorageService: localStorage test failed:', error);
      
      // Check for specific localStorage issues
      if (error.name === 'QuotaExceededError') {
        console.error('💾 CustomerStorageService: localStorage quota exceeded');
      } else if (error.name === 'SecurityError') {
        console.error('🔒 CustomerStorageService: localStorage blocked by security policy (likely private browsing or same-origin issues)');
      }
    }
  }

  /**
   * Store the most recent order details (replaces any previous order)
   */
  storeOrderDetails(orderId: string, phone: string, customerName?: string): void {
    console.log('🔄 CustomerStorageService: Attempting to store order details', { orderId, phone, customerName });
    
    try {
      // Check if localStorage is available
      if (typeof Storage === 'undefined') {
        console.error('❌ CustomerStorageService: localStorage is not supported in this browser');
        return;
      }

      const orderDetails: StoredOrderDetails = {
        orderId,
        phone,
        customerName,
        storedAt: Date.now()
      };
      
      console.log('💾 CustomerStorageService: Storing order details with key:', this.STORAGE_KEY, orderDetails);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orderDetails));
      
      // Verify storage was successful
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        console.log('✅ CustomerStorageService: Order details stored successfully');
      } else {
        console.error('❌ CustomerStorageService: Failed to verify stored data');
      }
    } catch (error) {
      console.error('❌ CustomerStorageService: Failed to store order details in localStorage:', error);
    }
  }

  /**
   * Retrieve the stored order details
   */
  getStoredOrderDetails(): StoredOrderDetails | null {
    console.log('🔍 CustomerStorageService: Attempting to retrieve stored order details');
    
    try {
      // Check if localStorage is available
      if (typeof Storage === 'undefined') {
        console.error('❌ CustomerStorageService: localStorage is not supported in this browser');
        return null;
      }

      const stored = localStorage.getItem(this.STORAGE_KEY);
      console.log('📖 CustomerStorageService: Raw stored data:', stored);
      
      if (!stored) {
        console.log('ℹ️ CustomerStorageService: No stored order details found');
        return null;
      }

      const orderDetails: StoredOrderDetails = JSON.parse(stored);
      console.log('📦 CustomerStorageService: Parsed order details:', orderDetails);
      
      // Validate the stored data structure
      if (!orderDetails.orderId || !orderDetails.phone) {
        console.error('❌ CustomerStorageService: Invalid stored data structure, clearing');
        this.clearStoredOrderDetails(); // Clean up invalid data
        return null;
      }

      console.log('✅ CustomerStorageService: Successfully retrieved valid order details');
      return orderDetails;
    } catch (error) {
      console.error('❌ CustomerStorageService: Failed to retrieve order details from localStorage:', error);
      this.clearStoredOrderDetails(); // Clean up corrupted data
      return null;
    }
  }

  /**
   * Clear stored order details
   */
  clearStoredOrderDetails(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear order details from localStorage:', error);
    }
  }

  /**
   * Check if there are stored order details
   */
  hasStoredOrderDetails(): boolean {
    return this.getStoredOrderDetails() !== null;
  }

  /**
   * Get just the order ID from stored details
   */
  getStoredOrderId(): string | null {
    const details = this.getStoredOrderDetails();
    return details ? details.orderId : null;
  }

  /**
   * Get just the phone number from stored details
   */
  getStoredPhone(): string | null {
    const details = this.getStoredOrderDetails();
    return details ? details.phone : null;
  }
}