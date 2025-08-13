import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-modal.component.html',
  styleUrls: ['./error-modal.component.css']
})
export class ErrorModalComponent {
  @Input() isVisible = false;
  @Input() title = 'Error';
  @Input() message = '';
  @Input() details: string | null = null;
  
  @Output() closeModal = new EventEmitter<void>();

  close() {
    this.closeModal.emit();
  }

  onOverlayClick(event: Event) {
    // Close modal when clicking on overlay (not on content)
    this.close();
  }
}