import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface UpdateStatus {
  available: boolean;
  installing: boolean;
  activated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UpdateService {
  private updateAvailableSubject = new BehaviorSubject<boolean>(false);
  private updateStatusSubject = new BehaviorSubject<UpdateStatus>({
    available: false,
    installing: false,
    activated: false
  });
  
  private registration: ServiceWorkerRegistration | null = null;
  private newWorker: ServiceWorker | null = null;

  public updateAvailable$ = this.updateAvailableSubject.asObservable();
  public updateStatus$ = this.updateStatusSubject.asObservable();

  constructor() {
    this.initializeUpdateDetection();
  }

  private initializeUpdateDetection(): void {
    if ('serviceWorker' in navigator) {
      // Listen for service worker registration updates
      navigator.serviceWorker.ready.then(registration => {
        this.registration = registration;
        
        // Check for updates immediately
        this.checkForUpdates();
        
        // Set up periodic update checks (every 60 seconds)
        setInterval(() => {
          this.checkForUpdates();
        }, 60000);
        
        // Listen for new service worker installations
        registration.addEventListener('updatefound', () => {
          console.log('PWA Update: New service worker found');
          const installingWorker = registration.installing;
          
          if (installingWorker) {
            this.newWorker = installingWorker;
            this.updateStatus({
              available: false,
              installing: true,
              activated: false
            });
            
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New service worker installed, update available
                  console.log('PWA Update: New service worker installed, update available');
                  this.updateAvailableSubject.next(true);
                  this.updateStatus({
                    available: true,
                    installing: false,
                    activated: false
                  });
                } else {
                  // First time installation
                  console.log('PWA Update: Service worker installed for first time');
                  this.updateStatus({
                    available: false,
                    installing: false,
                    activated: true
                  });
                }
              }
            });
          }
        });
      });

      // Listen for service worker controller changes (when update is activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('PWA Update: Service worker controller changed');
        this.updateStatus({
          available: false,
          installing: false,
          activated: true
        });
        
        // Reload the page to apply updates
        if (this.shouldReloadOnUpdate()) {
          window.location.reload();
        }
      });

      // Listen for custom update events from index.html
      window.addEventListener('swUpdateAvailable', () => {
        console.log('PWA Update: Update available event received');
        this.updateAvailableSubject.next(true);
        this.updateStatus({
          available: true,
          installing: false,
          activated: false
        });
      });
    }
  }

  /**
   * Check for service worker updates manually
   */
  public async checkForUpdates(): Promise<void> {
    if (this.registration) {
      try {
        await this.registration.update();
        console.log('PWA Update: Checked for updates');
      } catch (error) {
        console.error('PWA Update: Error checking for updates:', error);
      }
    }
  }

  /**
   * Apply the available update immediately
   */
  public async applyUpdate(): Promise<void> {
    if (this.newWorker) {
      console.log('PWA Update: Applying update...');
      
      this.updateStatus({
        available: false,
        installing: false,
        activated: false
      });

      // Tell the new service worker to skip waiting and become active
      this.newWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // The controllerchange event will handle the reload
    } else if (this.registration && this.registration.waiting) {
      console.log('PWA Update: Applying waiting service worker...');
      
      this.updateStatus({
        available: false,
        installing: false,
        activated: false
      });

      // Tell the waiting service worker to skip waiting
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      console.warn('PWA Update: No new service worker available to apply');
    }
  }

  /**
   * Dismiss the current update notification
   */
  public dismissUpdate(): void {
    console.log('PWA Update: Update dismissed by user');
    this.updateAvailableSubject.next(false);
    this.updateStatus({
      available: false,
      installing: false,
      activated: false
    });
  }

  /**
   * Check if the app should reload automatically when an update is activated
   */
  private shouldReloadOnUpdate(): boolean {
    // Always reload to ensure users get the latest version
    return true;
  }

  /**
   * Update the status and notify subscribers
   */
  private updateStatus(status: UpdateStatus): void {
    this.updateStatusSubject.next(status);
  }

  /**
   * Get current update availability status
   */
  public isUpdateAvailable(): boolean {
    return this.updateAvailableSubject.value;
  }

  /**
   * Get current update status
   */
  public getCurrentStatus(): UpdateStatus {
    return this.updateStatusSubject.value;
  }

  /**
   * Enable automatic update checking
   */
  public enableAutoUpdate(): void {
    console.log('PWA Update: Auto-update enabled');
    // Auto-update is enabled by default, this is for future extensibility
  }

  /**
   * Disable automatic update checking
   */
  public disableAutoUpdate(): void {
    console.log('PWA Update: Auto-update disabled');
    // This could be implemented to stop the interval checking
  }
}