import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-notification-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-modal.component.html',
  styleUrls: ['./notification-modal.component.css']
})
export class NotificationModalComponent {
  @Input() isVisible = false;
  @Input() type: NotificationType = 'info';
  @Input() title = 'Notification';
  @Input() message = '';
  @Input() details: string | null = null;
  @Input() autoClose = true;
  @Input() autoCloseDelay = 3000;
  
  @Output() closeModal = new EventEmitter<void>();

  private autoCloseTimer?: number;

  ngOnChanges() {
    if (this.isVisible && this.autoClose) {
      this.startAutoCloseTimer();
    } else {
      this.clearAutoCloseTimer();
    }
  }

  ngOnDestroy() {
    this.clearAutoCloseTimer();
  }

  close() {
    this.clearAutoCloseTimer();
    this.closeModal.emit();
  }

  onOverlayClick(event: Event) {
    this.close();
  }

  getIcon(): string {
    switch (this.type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  }

  getTypeClass(): string {
    return `notification-${this.type}`;
  }

  private startAutoCloseTimer() {
    this.clearAutoCloseTimer();
    this.autoCloseTimer = window.setTimeout(() => {
      this.close();
    }, this.autoCloseDelay);
  }

  private clearAutoCloseTimer() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
  }
}