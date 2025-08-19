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

  private storageMethod: 'localStorage' | 'indexedDB' | 'none' = 'none';
  private dbName = 'HelensKitchenDB';
  private storeName = 'CustomerData';

  constructor() {
    // Test localStorage availability on service initialization
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    console.log('🧪 CustomerStorageService: Initializing storage...');
    
    // Test localStorage first
    if (this.testLocalStorage()) {
      this.storageMethod = 'localStorage';
      console.log('✅ CustomerStorageService: Using localStorage');
      return;
    }
    
    // Fallback to IndexedDB for PWAs on iOS
    if (await this.testIndexedDB()) {
      this.storageMethod = 'indexedDB';
      console.log('✅ CustomerStorageService: Using IndexedDB fallback');
      return;
    }
    
    console.error('❌ CustomerStorageService: No storage method available');
    this.storageMethod = 'none';
  }

  private testLocalStorage(): boolean {
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
        return true;
      } else {
        console.error('❌ CustomerStorageService: localStorage read/write test failed');
        return false;
      }
      
    } catch (error) {
      console.error('❌ CustomerStorageService: localStorage test failed:', error);
      
      // Check for specific localStorage issues
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError') {
          console.error('💾 CustomerStorageService: localStorage quota exceeded');
        } else if (error.name === 'SecurityError') {
          console.error('🔒 CustomerStorageService: localStorage blocked by security policy (likely private browsing or PWA restrictions)');
        }
      }
      return false;
    }
  }

  private async testIndexedDB(): Promise<boolean> {
    console.log('🧪 CustomerStorageService: Testing IndexedDB availability...');
    
    if (!window.indexedDB) {
      console.error('❌ CustomerStorageService: IndexedDB not supported');
      return false;
    }

    try {
      const testDbName = 'test_db_' + Date.now();
      
      return new Promise((resolve) => {
        const request = indexedDB.open(testDbName, 1);
        
        request.onerror = () => {
          console.error('❌ CustomerStorageService: IndexedDB test failed');
          resolve(false);
        };
        
        request.onsuccess = () => {
          console.log('✅ CustomerStorageService: IndexedDB is working properly');
          // Clean up test database
          request.result.close();
          indexedDB.deleteDatabase(testDbName);
          resolve(true);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          db.createObjectStore('test', { keyPath: 'id' });
        };
      });
    } catch (error) {
      console.error('❌ CustomerStorageService: IndexedDB test failed:', error);
      return false;
    }
  }

  /**
   * Store the most recent order details (replaces any previous order)
   */
  async storeOrderDetails(orderId: string, phone: string, customerName?: string): Promise<void> {
    console.log('🔄 CustomerStorageService: Attempting to store order details', { orderId, phone, customerName });
    
    const orderDetails: StoredOrderDetails = {
      orderId,
      phone,
      customerName,
      storedAt: Date.now()
    };

    if (this.storageMethod === 'localStorage') {
      await this.storeInLocalStorage(orderDetails);
    } else if (this.storageMethod === 'indexedDB') {
      await this.storeInIndexedDB(orderDetails);
    } else {
      console.error('❌ CustomerStorageService: No storage method available');
    }
  }

  private async storeInLocalStorage(orderDetails: StoredOrderDetails): Promise<void> {
    try {
      console.log('💾 CustomerStorageService: Storing in localStorage with key:', this.STORAGE_KEY, orderDetails);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orderDetails));
      
      // Verify storage was successful
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        console.log('✅ CustomerStorageService: Order details stored successfully in localStorage');
      } else {
        console.error('❌ CustomerStorageService: Failed to verify localStorage data');
      }
    } catch (error) {
      console.error('❌ CustomerStorageService: Failed to store in localStorage:', error);
    }
  }

  private async storeInIndexedDB(orderDetails: StoredOrderDetails): Promise<void> {
    try {
      console.log('💾 CustomerStorageService: Storing in IndexedDB:', orderDetails);
      
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.put({ id: this.STORAGE_KEY, data: orderDetails });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      console.log('✅ CustomerStorageService: Order details stored successfully in IndexedDB');
      db.close();
    } catch (error) {
      console.error('❌ CustomerStorageService: Failed to store in IndexedDB:', error);
    }
  }

  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Retrieve the stored order details
   */
  async getStoredOrderDetails(): Promise<StoredOrderDetails | null> {
    console.log('🔍 CustomerStorageService: Attempting to retrieve stored order details');
    
    if (this.storageMethod === 'localStorage') {
      return await this.getFromLocalStorage();
    } else if (this.storageMethod === 'indexedDB') {
      return await this.getFromIndexedDB();
    } else {
      console.log('ℹ️ CustomerStorageService: No storage method available');
      return null;
    }
  }

  private async getFromLocalStorage(): Promise<StoredOrderDetails | null> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      console.log('📖 CustomerStorageService: Raw localStorage data:', stored);
      
      if (!stored) {
        console.log('ℹ️ CustomerStorageService: No stored order details found in localStorage');
        return null;
      }

      const orderDetails: StoredOrderDetails = JSON.parse(stored);
      console.log('📦 CustomerStorageService: Parsed order details from localStorage:', orderDetails);
      
      // Validate the stored data structure
      if (!orderDetails.orderId || !orderDetails.phone) {
        console.error('❌ CustomerStorageService: Invalid localStorage data structure, clearing');
        await this.clearStoredOrderDetails();
        return null;
      }

      console.log('✅ CustomerStorageService: Successfully retrieved valid order details from localStorage');
      return orderDetails;
    } catch (error) {
      console.error('❌ CustomerStorageService: Failed to retrieve from localStorage:', error);
      await this.clearStoredOrderDetails();
      return null;
    }
  }

  private async getFromIndexedDB(): Promise<StoredOrderDetails | null> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get(this.STORAGE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      
      if (!result || !result.data) {
        console.log('ℹ️ CustomerStorageService: No stored order details found in IndexedDB');
        return null;
      }

      const orderDetails: StoredOrderDetails = result.data;
      console.log('📦 CustomerStorageService: Retrieved order details from IndexedDB:', orderDetails);
      
      // Validate the stored data structure
      if (!orderDetails.orderId || !orderDetails.phone) {
        console.error('❌ CustomerStorageService: Invalid IndexedDB data structure, clearing');
        await this.clearStoredOrderDetails();
        return null;
      }

      console.log('✅ CustomerStorageService: Successfully retrieved valid order details from IndexedDB');
      return orderDetails;
    } catch (error) {
      console.error('❌ CustomerStorageService: Failed to retrieve from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Clear stored order details
   */
  async clearStoredOrderDetails(): Promise<void> {
    console.log('🗑️ CustomerStorageService: Clearing stored order details');
    
    if (this.storageMethod === 'localStorage') {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('✅ CustomerStorageService: Cleared localStorage data');
      } catch (error) {
        console.error('❌ CustomerStorageService: Failed to clear localStorage:', error);
      }
    } else if (this.storageMethod === 'indexedDB') {
      try {
        const db = await this.openIndexedDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        await new Promise((resolve, reject) => {
          const request = store.delete(this.STORAGE_KEY);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        db.close();
        console.log('✅ CustomerStorageService: Cleared IndexedDB data');
      } catch (error) {
        console.error('❌ CustomerStorageService: Failed to clear IndexedDB:', error);
      }
    }
  }

  /**
   * Check if there are stored order details
   */
  async hasStoredOrderDetails(): Promise<boolean> {
    const details = await this.getStoredOrderDetails();
    return details !== null;
  }

  /**
   * Get just the order ID from stored details
   */
  async getStoredOrderId(): Promise<string | null> {
    const details = await this.getStoredOrderDetails();
    return details ? details.orderId : null;
  }

  /**
   * Get just the phone number from stored details
   */
  async getStoredPhone(): Promise<string | null> {
    const details = await this.getStoredOrderDetails();
    return details ? details.phone : null;
  }
}