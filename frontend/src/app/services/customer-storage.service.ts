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

  constructor() {}

  /**
   * Store the most recent order details (replaces any previous order)
   */
  storeOrderDetails(orderId: string, phone: string, customerName?: string): void {
    try {
      const orderDetails: StoredOrderDetails = {
        orderId,
        phone,
        customerName,
        storedAt: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orderDetails));
    } catch (error) {
      console.warn('Failed to store order details in localStorage:', error);
    }
  }

  /**
   * Retrieve the stored order details
   */
  getStoredOrderDetails(): StoredOrderDetails | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const orderDetails: StoredOrderDetails = JSON.parse(stored);
      
      // Validate the stored data structure
      if (!orderDetails.orderId || !orderDetails.phone) {
        this.clearStoredOrderDetails(); // Clean up invalid data
        return null;
      }

      return orderDetails;
    } catch (error) {
      console.warn('Failed to retrieve order details from localStorage:', error);
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