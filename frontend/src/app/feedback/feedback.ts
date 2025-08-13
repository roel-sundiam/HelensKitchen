import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss'
})
export class FeedbackComponent implements OnInit {
  feedbackForm: FormGroup;
  isLoading = false;
  isSubmitted = false;
  errorMessage = '';
  orderId: string = '';
  orderData: any = null;
  existingFeedback: any = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    public router: Router,
    private http: HttpClient
  ) {
    this.feedbackForm = this.fb.group({
      rating: ['', Validators.required],
      comment: ['', [Validators.maxLength(500)]]
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.orderId = params['orderId'];
      const phone = params['phone'];
      
      if (!this.orderId || !phone) {
        this.errorMessage = 'Missing order information. Please access feedback through order tracking.';
        return;
      }

      this.loadOrderData(this.orderId, phone);
      this.checkExistingFeedback(this.orderId, phone);
    });
  }

  loadOrderData(orderId: string, phone: string) {
    this.http.get(`${environment.apiUrl}/track-order/${orderId}/${phone}`).subscribe({
      next: (data: any) => {
        this.orderData = data;
      },
      error: (err) => {
        this.errorMessage = 'Order not found or invalid details.';
        console.error(err);
      }
    });
  }

  checkExistingFeedback(orderId: string, phone: string) {
    this.http.get(`${environment.apiUrl}/feedback/check/${orderId}/${phone}`).subscribe({
      next: (response: any) => {
        if (response.hasFeedback) {
          this.existingFeedback = response.feedback;
        }
      },
      error: (err) => {
        console.error('Error checking feedback:', err);
      }
    });
  }

  onSubmit() {
    if (this.feedbackForm.invalid || !this.orderData) {
      this.feedbackForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const feedbackData = {
      order_id: this.orderData.id,
      customer_name: this.orderData.customer_name,
      phone: this.orderData.phone,
      rating: parseInt(this.feedbackForm.value.rating),
      comment: this.feedbackForm.value.comment
    };

    this.http.post(`${environment.apiUrl}/feedback`, feedbackData).subscribe({
      next: (response: any) => {
        this.isSubmitted = true;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 400) {
          this.errorMessage = err.error.error || 'Invalid feedback data';
        } else {
          this.errorMessage = 'Failed to submit feedback. Please try again.';
        }
        console.error(err);
      }
    });
  }

  getStars(rating: number): string[] {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rating ? '★' : '☆');
    }
    return stars;
  }

  goToTracking() {
    if (this.orderData) {
      this.router.navigate(['/track-order'], {
        queryParams: {
          orderId: this.orderData.id,
          phone: this.orderData.phone
        }
      });
    }
  }
}
