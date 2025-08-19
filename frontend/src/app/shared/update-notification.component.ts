import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { UpdateService } from '../services/update.service';

@Component({
  selector: 'app-update-notification',
  imports: [CommonModule],
  template: `
    <div 
      *ngIf="showUpdateNotification" 
      class="update-notification"
      [class.slide-in]="showUpdateNotification"
    >
      <div class="update-content">
        <div class="update-icon">
          🔄
        </div>
        <div class="update-text">
          <h4>App Update Available</h4>
          <p>A new version of Helen's Kitchen is ready to install.</p>
        </div>
        <div class="update-actions">
          <button 
            class="btn-update" 
            (click)="applyUpdate()"
            [disabled]="isUpdating"
          >
            {{ isUpdating ? 'Updating...' : 'Update Now' }}
          </button>
          <button 
            class="btn-later" 
            (click)="dismissUpdate()"
            [disabled]="isUpdating"
          >
            Later
          </button>
        </div>
      </div>
    </div>

    <!-- Toast notification for quick updates -->
    <div 
      *ngIf="showToastNotification" 
      class="update-toast"
      [class.toast-show]="showToastNotification"
    >
      <span>{{ toastMessage }}</span>
      <button (click)="hideToast()">×</button>
    </div>
  `,
  styles: [`
    .update-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      border: 1px solid #e0e0e0;
      max-width: 400px;
      z-index: 9999;
      transform: translateX(100%);
      transition: transform 0.3s ease-in-out;
      font-family: 'Poppins', sans-serif;
    }

    .update-notification.slide-in {
      transform: translateX(0);
    }

    .update-content {
      padding: 20px;
      display: flex;
      align-items: flex-start;
      gap: 15px;
    }

    .update-icon {
      font-size: 24px;
      margin-top: 5px;
      animation: rotate 2s linear infinite;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .update-text {
      flex: 1;
    }

    .update-text h4 {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .update-text p {
      margin: 0;
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    }

    .update-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 15px;
    }

    .btn-update, .btn-later {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'Poppins', sans-serif;
    }

    .btn-update {
      background: #D4AF37;
      color: white;
    }

    .btn-update:hover:not(:disabled) {
      background: #B8941F;
      transform: translateY(-1px);
    }

    .btn-update:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-later {
      background: #f5f5f5;
      color: #666;
      border: 1px solid #e0e0e0;
    }

    .btn-later:hover:not(:disabled) {
      background: #e9e9e9;
    }

    .btn-later:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .update-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 15px;
      z-index: 10000;
      transition: transform 0.3s ease-in-out;
      font-family: 'Poppins', sans-serif;
      font-size: 14px;
    }

    .update-toast.toast-show {
      transform: translateX(-50%) translateY(0);
    }

    .update-toast button {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      margin: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .update-toast button:hover {
      opacity: 0.7;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .update-notification {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }

      .update-content {
        padding: 15px;
      }

      .update-actions {
        flex-direction: row;
        justify-content: space-between;
      }

      .btn-update, .btn-later {
        flex: 1;
        margin: 0;
      }

      .update-toast {
        left: 10px;
        right: 10px;
        transform: translateY(100px);
      }

      .update-toast.toast-show {
        transform: translateY(0);
      }
    }
  `]
})
export class UpdateNotificationComponent implements OnInit, OnDestroy {
  showUpdateNotification = false;
  showToastNotification = false;
  toastMessage = '';
  isUpdating = false;
  
  private subscriptions: Subscription[] = [];

  constructor(private updateService: UpdateService) {}

  ngOnInit(): void {
    // Subscribe to update availability
    this.subscriptions.push(
      this.updateService.updateAvailable$.subscribe(available => {
        this.showUpdateNotification = available;
      })
    );

    // Subscribe to update status changes
    this.subscriptions.push(
      this.updateService.updateStatus$.subscribe(status => {
        if (status.installing) {
          this.isUpdating = true;
          this.displayToast('Downloading update...', 3000);
        } else if (status.activated) {
          this.isUpdating = false;
          this.displayToast('Update applied successfully!', 2000);
          this.showUpdateNotification = false;
        } else {
          this.isUpdating = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  applyUpdate(): void {
    console.log('User clicked: Apply update');
    this.isUpdating = true;
    this.updateService.applyUpdate();
    this.displayToast('Installing update...', 2000);
  }

  dismissUpdate(): void {
    console.log('User clicked: Dismiss update');
    this.updateService.dismissUpdate();
    this.showUpdateNotification = false;
    this.displayToast('Update postponed', 2000);
  }

  private displayToast(message: string, duration: number = 3000): void {
    this.toastMessage = message;
    this.showToastNotification = true;
    
    setTimeout(() => {
      this.hideToast();
    }, duration);
  }

  hideToast(): void {
    this.showToastNotification = false;
  }
}