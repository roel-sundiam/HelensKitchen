import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, fromEvent, EMPTY } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private badgeCountSubject = new BehaviorSubject<number>(0);
  private notificationPermissionSubject = new BehaviorSubject<NotificationPermission>('default');
  private isSubscribedSubject = new BehaviorSubject<boolean>(false);
  private vapidPublicKey: string = '';

  public badgeCount$ = this.badgeCountSubject.asObservable();
  public notificationPermission$ = this.notificationPermissionSubject.asObservable();
  public isSubscribed$ = this.isSubscribedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeNotificationService();
  }

  private async initializeNotificationService() {
    // Initialize notification permission status
    if ('Notification' in window) {
      this.notificationPermissionSubject.next(Notification.permission);
    }

    // Listen for service worker messages (badge updates)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'BADGE_UPDATED') {
          this.badgeCountSubject.next(event.data.count);
        }
      });
    }

    // Listen for badge updates from window events
    window.addEventListener('badgeUpdated', (event: any) => {
      this.badgeCountSubject.next(event.detail.count);
    });

    // Load initial badge count
    await this.loadBadgeCount();

    // Check if already subscribed to push notifications
    await this.checkSubscriptionStatus();
  }

  /**
   * Request notification permission from the user
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    console.log('=== NOTIFICATION PERMISSION DEBUG ===');
    console.log('Notification support check:', 'Notification' in window);
    console.log('Current permission:', Notification.permission);
    console.log('User agent:', navigator.userAgent);
    console.log('Service Worker support:', 'serviceWorker' in navigator);
    console.log('Push Manager support:', 'PushManager' in window);
    
    if (!('Notification' in window)) {
      console.warn('Notifications not supported by this browser');
      return 'denied';
    }

    console.log('Requesting notification permission...');
    
    try {
      // For iOS Safari, we need to request permission in a different way
      let permission: NotificationPermission;
      
      if (typeof Notification.requestPermission === 'function') {
        // Modern browsers
        console.log('Using modern requestPermission API');
        permission = await Notification.requestPermission();
      } else {
        // Legacy browsers (including some iOS versions)
        console.log('Using legacy requestPermission API');
        permission = await new Promise(resolve => {
          Notification.requestPermission(resolve);
        });
      }
      
      console.log('Permission result:', permission);
      this.notificationPermissionSubject.next(permission);
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        // Test with a simple notification first
        this.showTestNotification();
        // Then subscribe to push notifications
        await this.subscribeToPushNotifications();
      } else if (permission === 'denied') {
        console.log('❌ Notification permission denied');
      } else {
        console.log('⚠️ Notification permission default/not determined');
      }

      return permission;
      
    } catch (error) {
      console.error('=== ERROR requesting notification permission ===');
      console.error('Error type:', typeof error);
      console.error('Error message:', (error as any)?.message || String(error));
      console.error('Error stack:', (error as any)?.stack);
      console.error('Full error object:', error);
      this.notificationPermissionSubject.next('denied');
      return 'denied';
    }
  }

  /**
   * Show a test notification to verify permissions work
   */
  private showTestNotification(): void {
    try {
      console.log('Showing test notification...');
      const notification = new Notification('Helen\'s Kitchen', {
        body: 'Notifications are now enabled! 🔔',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'test-notification'
      });

      // Auto-close after 3 seconds
      setTimeout(() => {
        notification.close();
      }, 3000);

      console.log('✅ Test notification created successfully');
    } catch (error) {
      console.error('❌ Error creating test notification:', error);
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(): Promise<boolean> {
    try {
      console.log('=== STARTING PUSH SUBSCRIPTION ===');
      
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications not supported');
        return false;
      }
      console.log('✅ Push notifications supported');

      // Check if user is authenticated
      if (!this.authService.isLoggedIn()) {
        console.log('User not authenticated, skipping push subscription');
        return false;
      }
      console.log('✅ User authenticated');

      // Get VAPID public key from server
      if (!this.vapidPublicKey) {
        console.log('Loading VAPID public key...');
        await this.loadVapidPublicKey();
      }
      console.log('✅ VAPID key loaded:', this.vapidPublicKey.substring(0, 20) + '...');

      // Get service worker registration
      console.log('Getting service worker registration...');
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service worker ready:', registration);
      
      // Check if already subscribed
      console.log('Checking existing subscription...');
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Already subscribed to push notifications');
        this.isSubscribedSubject.next(true);
        return true;
      }
      console.log('✅ No existing subscription found');

      // Subscribe to push notifications
      console.log('Creating new push subscription...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });
      console.log('✅ Push subscription created:', subscription);

      // Send subscription to server
      console.log('Sending subscription to server...');
      const success = await this.sendSubscriptionToServer(subscription);
      console.log('✅ Server response:', success);
      
      this.isSubscribedSubject.next(success);
      
      if (success) {
        console.log('✅ Successfully subscribed to push notifications');
      } else {
        console.log('❌ Failed to save subscription to server');
      }

      return success;

    } catch (error) {
      console.error('=== ERROR subscribing to push notifications ===');
      console.error('Error type:', typeof error);
      console.error('Error name:', (error as any)?.name);
      console.error('Error message:', (error as any)?.message || String(error));
      console.error('Error stack:', (error as any)?.stack);
      console.error('Full error object:', error);
      this.isSubscribedSubject.next(false);
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator)) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe();
        
        // Notify server
        await this.removeSubscriptionFromServer(subscription.endpoint);
        
        console.log('Successfully unsubscribed from push notifications');
      }

      this.isSubscribedSubject.next(false);
      return true;

    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }

  /**
   * Get current badge count
   */
  getBadgeCount(): number {
    return this.badgeCountSubject.value;
  }

  /**
   * Update badge count
   */
  async updateBadgeCount(count: number): Promise<void> {
    this.badgeCountSubject.next(count);

    // Update service worker badge
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'UPDATE_BADGE',
        count: count
      });
    }

    // Update app badge (iOS 16.4+)
    if ('setAppBadge' in navigator) {
      try {
        await navigator.setAppBadge(count);
      } catch (error) {
        console.warn('Error setting app badge:', error);
      }
    }
  }

  /**
   * Clear badge count
   */
  async clearBadgeCount(): Promise<void> {
    await this.updateBadgeCount(0);
  }

  /**
   * Load current badge count from server
   */
  private async loadBadgeCount(): Promise<void> {
    try {
      if (!this.authService.isLoggedIn()) {
        return;
      }

      const headers = this.authService.getAuthHeaders();
      const response = await this.http.get<{count: number; warning?: string}>(`${environment.apiUrl}/admin/orders/unread-count`, { headers }).toPromise();
      
      if (response) {
        if (response.warning) {
          console.warn('Badge count warning:', response.warning);
        }
        await this.updateBadgeCount(response.count);
      }
    } catch (error) {
      console.error('Error loading badge count:', error);
      
      // Silently handle the error by setting badge count to 0
      // This prevents the error from disrupting the user experience
      await this.updateBadgeCount(0);
    }
  }

  /**
   * Check if currently subscribed to push notifications
   */
  private async checkSubscriptionStatus(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !this.authService.isLoggedIn()) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      this.isSubscribedSubject.next(!!subscription);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      this.isSubscribedSubject.next(false);
    }
  }

  /**
   * Load VAPID public key from server
   */
  private async loadVapidPublicKey(): Promise<void> {
    try {
      console.log('Loading VAPID public key from server...');
      
      if (!this.authService.isLoggedIn()) {
        throw new Error('User not authenticated');
      }

      const headers = this.authService.getAuthHeaders();
      console.log('Auth headers:', headers);
      console.log('API URL:', `${environment.apiUrl}/admin/push/vapid-public-key`);
      
      const response = await this.http.get<{publicKey: string}>(`${environment.apiUrl}/admin/push/vapid-public-key`, { headers }).toPromise();
      console.log('VAPID key response:', response);
      
      if (response && response.publicKey) {
        this.vapidPublicKey = response.publicKey;
        console.log('✅ VAPID public key loaded successfully');
      } else {
        throw new Error('Failed to get VAPID public key from response');
      }
    } catch (error) {
      console.error('=== ERROR loading VAPID public key ===');
      console.error('Error type:', typeof error);
      console.error('Error name:', (error as any)?.name);
      console.error('Error message:', (error as any)?.message || String(error));
      console.error('Error status:', (error as any)?.status);
      console.error('Error response:', (error as any)?.error);
      console.error('Full error object:', error);
      throw error;
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
    try {
      console.log('Preparing subscription data for server...');
      
      const headers = this.authService.getAuthHeaders();
      console.log('Auth headers for subscription:', headers);
      
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };
      
      console.log('Subscription data prepared:', {
        endpoint: subscriptionData.endpoint,
        keysPresent: !!subscriptionData.keys.p256dh && !!subscriptionData.keys.auth
      });

      console.log('Sending subscription to server...');
      const response = await this.http.post(`${environment.apiUrl}/admin/push/subscribe`, 
        { subscription: subscriptionData }, 
        { headers }
      ).toPromise();
      
      console.log('✅ Subscription sent to server successfully:', response);
      return true;
      
    } catch (error) {
      console.error('=== ERROR sending subscription to server ===');
      console.error('Error type:', typeof error);
      console.error('Error name:', (error as any)?.name);
      console.error('Error message:', (error as any)?.message || String(error));
      console.error('Error status:', (error as any)?.status);
      console.error('Error response:', (error as any)?.error);
      console.error('Full error object:', error);
      return false;
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(endpoint: string): Promise<void> {
    try {
      const headers = this.authService.getAuthHeaders();
      await this.http.delete(`${environment.apiUrl}/admin/push/unsubscribe`, 
        { 
          headers,
          body: { endpoint }
        }
      ).toPromise();
    } catch (error) {
      console.error('Error removing subscription from server:', error);
    }
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Show browser notification (fallback for when service worker is not available)
   */
  showBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return null;
    }

    const notification = new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      requireInteraction: true,
      ...options
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);

    return notification;
  }

  /**
   * Refresh badge count from server
   */
  async refreshBadgeCount(): Promise<void> {
    await this.loadBadgeCount();
  }

  /**
   * Initialize notifications for authenticated admin user
   */
  async initializeForAdmin(): Promise<void> {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    // Load initial badge count
    await this.loadBadgeCount();

    // Check if notifications are supported and permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      // Automatically subscribe to push notifications
      await this.subscribeToPushNotifications();
    }
  }

  /**
   * Cleanup when user logs out
   */
  async cleanup(): Promise<void> {
    // Clear badge count
    await this.clearBadgeCount();
    
    // Reset subscription status
    this.isSubscribedSubject.next(false);
    
    // Reset notification permission (don't actually revoke, just reset state)
    this.notificationPermissionSubject.next(Notification.permission);
  }
}