import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService } from '../services/auth';
import { ModalService } from '../shared/modal.service';
import { environment } from '../../environments/environment';

interface FeedbackData {
  id: number;
  order_id: number;
  customer_name: string;
  phone: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  moderated_at?: string;
  moderated_by?: string;
  order_customer_name: string;
  total_price: number;
}

interface FeedbackStats {
  total_feedback: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './admin-feedback.html',
  styleUrl: './admin-feedback.scss'
})
export class AdminFeedback implements OnInit {
  feedback: FeedbackData[] = [];
  stats: FeedbackStats | null = null;
  filterStatus = '';
  filterRating = '';
  isLoading = false;
  error = '';

  statuses = ['pending', 'approved', 'rejected'];
  ratings = [1, 2, 3, 4, 5];

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    this.loadFeedback();
    this.loadStats();
  }

  loadFeedback() {
    this.isLoading = true;
    const params: any = {};
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.filterRating) params.rating = this.filterRating;

    this.http.get<FeedbackData[]>(`${environment.apiUrl}/admin/feedback`, { 
      params, 
      withCredentials: true 
    }).subscribe({
      next: (data) => {
        this.feedback = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load feedback.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  loadStats() {
    this.http.get<FeedbackStats>(`${environment.apiUrl}/admin/feedback/stats`, { 
      withCredentials: true 
    }).subscribe({
      next: (data) => {
        this.stats = data;
      },
      error: (err) => {
        console.error('Error loading stats:', err);
      }
    });
  }

  async updateStatus(feedback: FeedbackData, newStatus: 'pending' | 'approved' | 'rejected') {
    const actionText = newStatus === 'approved' ? 'Approve' : newStatus === 'rejected' ? 'Reject' : 'Mark as pending';
    const confirmed = await this.modalService.showConfirm(
      `${actionText} Feedback`,
      `${actionText} feedback from ${feedback.customer_name}?`,
      actionText,
      'Cancel',
      newStatus === 'approved' ? '✅' : newStatus === 'rejected' ? '❌' : '⏳'
    );
    
    if (!confirmed) {
      return;
    }

    this.http.put(`${environment.apiUrl}/admin/feedback/${feedback.id}/status`, 
      { status: newStatus }, 
      { withCredentials: true }
    ).subscribe({
      next: () => {
        feedback.status = newStatus;
        feedback.moderated_at = new Date().toISOString();
        feedback.moderated_by = this.authService.getCurrentAdmin()?.username || 'admin';
        this.loadStats(); // Refresh stats
        this.modalService.showAlert('Success', `Feedback ${newStatus} successfully.`, '✅');
      },
      error: (err) => {
        this.modalService.showAlert('Error', 'Failed to update feedback status.', '❌');
        console.error(err);
      }
    });
  }

  async deleteFeedback(feedback: FeedbackData) {
    const confirmed = await this.modalService.showConfirm(
      'Delete Feedback',
      `Are you sure you want to delete feedback from ${feedback.customer_name}? This action cannot be undone.`,
      'Delete',
      'Cancel',
      '🗑️'
    );
    
    if (!confirmed) {
      return;
    }

    this.http.delete(`${environment.apiUrl}/admin/feedback/${feedback.id}`, { 
      withCredentials: true 
    }).subscribe({
      next: () => {
        this.feedback = this.feedback.filter(f => f.id !== feedback.id);
        this.loadStats(); // Refresh stats
        this.modalService.showAlert('Success', 'Feedback deleted successfully.', '✅');
      },
      error: (err) => {
        this.modalService.showAlert('Error', 'Failed to delete feedback.', '❌');
        console.error(err);
      }
    });
  }

  getStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }

  getRatingClass(rating: number): string {
    if (rating >= 4) return 'rating-good';
    if (rating >= 3) return 'rating-average';
    return 'rating-poor';
  }

  getStarCount(star: number): number {
    if (!this.stats) return 0;
    switch (star) {
      case 5: return this.stats.five_star;
      case 4: return this.stats.four_star;
      case 3: return this.stats.three_star;
      case 2: return this.stats.two_star;
      case 1: return this.stats.one_star;
      default: return 0;
    }
  }

  clearFilters() {
    this.filterStatus = '';
    this.filterRating = '';
    this.loadFeedback();
  }
}
