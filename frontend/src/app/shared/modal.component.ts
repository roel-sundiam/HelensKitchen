import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ModalService, ModalConfig } from './modal.service';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="currentModal" (click)="onOverlayClick()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">
            <span class="modal-icon">{{currentModal.icon}}</span>
            <h3>{{currentModal.title}}</h3>
          </div>
          <button class="close-btn" (click)="onCancel()" type="button">✕</button>
        </div>
        
        <div class="modal-body">
          <p>{{currentModal.message}}</p>
          
          <input 
            *ngIf="currentModal.type === 'prompt'" 
            type="text" 
            [(ngModel)]="promptValue" 
            class="prompt-input"
            #promptInput
            (keyup.enter)="onConfirm()"
            placeholder="Enter value...">
        </div>
        
        <div class="modal-actions">
          <button 
            *ngIf="currentModal.type !== 'alert'" 
            class="cancel-btn" 
            (click)="onCancel()"
            type="button">
            {{currentModal.cancelText}}
          </button>
          <button 
            class="confirm-btn" 
            (click)="onConfirm()"
            type="button">
            {{currentModal.confirmText}}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    }

    .modal-content {
      background: linear-gradient(135deg, #2D2D2D 0%, #3A3A3A 100%);
      border-radius: 16px;
      min-width: 400px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: slideUp 0.3s ease;
      color: #FFFFFF;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2rem 2rem 0 2rem;
      margin-bottom: 1.5rem;
    }

    .modal-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .modal-icon {
      font-size: 1.5rem;
    }

    .modal-title h3 {
      font-family: "Poppins", sans-serif;
      font-size: 1.3rem;
      font-weight: 600;
      color: #FFFFFF;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      color: #D1D5DB;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #FFFFFF;
    }

    .modal-body {
      padding: 0 2rem 1.5rem 2rem;
    }

    .modal-body p {
      font-family: "Poppins", sans-serif;
      font-size: 1rem;
      line-height: 1.5;
      color: #D1D5DB;
      margin: 0 0 1rem 0;
    }

    .prompt-input {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #FFFFFF;
      font-family: "Poppins", sans-serif;
      font-size: 0.9rem;
      transition: all 0.3s ease;
    }

    .prompt-input:focus {
      outline: none;
      border-color: #3B82F6;
      background: rgba(59, 130, 246, 0.1);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .prompt-input::placeholder {
      color: #9CA3AF;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      padding: 0 2rem 2rem 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin-top: 1rem;
      padding-top: 1.5rem;
    }

    .cancel-btn,
    .confirm-btn {
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-family: "Poppins", sans-serif;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 100px;
    }

    .cancel-btn {
      background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%);
      color: #FFFFFF;
    }

    .cancel-btn:hover {
      background: linear-gradient(135deg, #4B5563 0%, #374151 100%);
      transform: translateY(-2px);
    }

    .confirm-btn {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      color: #FFFFFF;
    }

    .confirm-btn:hover {
      background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (max-width: 768px) {
      .modal-content {
        min-width: unset;
        width: 95%;
        margin: 1rem;
      }

      .modal-header {
        padding: 1.5rem 1.5rem 0 1.5rem;
      }

      .modal-body {
        padding: 0 1.5rem 1.5rem 1.5rem;
      }

      .modal-actions {
        flex-direction: column;
        padding: 0 1.5rem 1.5rem 1.5rem;
      }

      .cancel-btn,
      .confirm-btn {
        width: 100%;
      }
    }
  `]
})
export class ModalComponent implements OnInit, OnDestroy {
  currentModal: ModalConfig | null = null;
  promptValue: string = '';
  private subscription: Subscription = new Subscription();

  constructor(private modalService: ModalService) {}

  ngOnInit() {
    this.subscription.add(
      this.modalService.modal$.subscribe(modal => {
        this.currentModal = modal;
        this.promptValue = '';
        
        // Auto-focus prompt input if it's a prompt modal
        if (modal?.type === 'prompt') {
          setTimeout(() => {
            const input = document.querySelector('.prompt-input') as HTMLInputElement;
            if (input) input.focus();
          }, 100);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  onConfirm() {
    const result = {
      confirmed: true,
      value: this.currentModal?.type === 'prompt' ? this.promptValue : undefined
    };
    this.modalService.closeModal(result);
  }

  onCancel() {
    const result = {
      confirmed: false,
      value: undefined
    };
    this.modalService.closeModal(result);
  }

  onOverlayClick() {
    // Close modal when clicking on overlay (same as cancel)
    this.onCancel();
  }
}