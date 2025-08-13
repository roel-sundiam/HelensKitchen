import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ModalConfig {
  title: string;
  message: string;
  type: 'alert' | 'confirm' | 'prompt';
  confirmText?: string;
  cancelText?: string;
  icon?: string;
}

export interface ModalResult {
  confirmed: boolean;
  value?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalSubject = new BehaviorSubject<ModalConfig | null>(null);
  private resultSubject = new BehaviorSubject<ModalResult | null>(null);

  modal$ = this.modalSubject.asObservable();
  result$ = this.resultSubject.asObservable();

  showAlert(title: string, message: string, icon: string = '⚠️'): Promise<void> {
    return new Promise((resolve) => {
      const config: ModalConfig = {
        title,
        message,
        type: 'alert',
        confirmText: 'OK',
        icon
      };

      this.modalSubject.next(config);

      const subscription = this.result$.subscribe(result => {
        if (result !== null) {
          subscription.unsubscribe();
          resolve();
        }
      });
    });
  }

  showConfirm(title: string, message: string, confirmText: string = 'Yes', cancelText: string = 'No', icon: string = '❓'): Promise<boolean> {
    return new Promise((resolve) => {
      const config: ModalConfig = {
        title,
        message,
        type: 'confirm',
        confirmText,
        cancelText,
        icon
      };

      this.modalSubject.next(config);

      const subscription = this.result$.subscribe(result => {
        if (result !== null) {
          subscription.unsubscribe();
          resolve(result.confirmed);
        }
      });
    });
  }

  showPrompt(title: string, message: string, defaultValue: string = '', confirmText: string = 'OK', cancelText: string = 'Cancel', icon: string = '✏️'): Promise<string | null> {
    return new Promise((resolve) => {
      const config: ModalConfig = {
        title,
        message,
        type: 'prompt',
        confirmText,
        cancelText,
        icon
      };

      this.modalSubject.next(config);

      const subscription = this.result$.subscribe(result => {
        if (result !== null) {
          subscription.unsubscribe();
          resolve(result.confirmed ? (result.value || '') : null);
        }
      });
    });
  }

  closeModal(result: ModalResult) {
    this.modalSubject.next(null);
    this.resultSubject.next(result);
    // Reset result after a brief delay
    setTimeout(() => this.resultSubject.next(null), 100);
  }
}