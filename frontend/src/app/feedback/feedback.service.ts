import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CustomerFeedback {
  id: string;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
  days_ago: number;
}

export interface FeedbackStats {
  total_reviews: number;
  average_rating: number;
  five_star: number;
  four_star: number;
}

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private apiUrl = `${environment.apiUrl}/feedback`;
  
  // Cache for feedback data
  private feedbackCache$ = new BehaviorSubject<CustomerFeedback[]>([]);
  private statsCache$ = new BehaviorSubject<FeedbackStats | null>(null);
  private lastFetchTime = 0;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes cache

  constructor(private http: HttpClient) {}

  /**
   * Get approved feedback with caching
   */
  getApprovedFeedback(minRating: number = 4, limit: number = 20): Observable<CustomerFeedback[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (now - this.lastFetchTime < this.cacheExpiry && this.feedbackCache$.value.length > 0) {
      return this.feedbackCache$.asObservable();
    }

    // Fetch fresh data
    const params = {
      minRating: minRating.toString(),
      limit: limit.toString()
    };

    this.http.get<CustomerFeedback[]>(`${this.apiUrl}/approved`, { params })
      .subscribe({
        next: (feedback) => {
          this.feedbackCache$.next(feedback);
          this.lastFetchTime = now;
        },
        error: (error) => {
          console.error('Error fetching approved feedback:', error);
          // Keep existing cache on error
        }
      });

    return this.feedbackCache$.asObservable();
  }

  /**
   * Get feedback statistics with caching
   */
  getFeedbackStats(): Observable<FeedbackStats | null> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (now - this.lastFetchTime < this.cacheExpiry && this.statsCache$.value) {
      return this.statsCache$.asObservable();
    }

    // Fetch fresh data
    this.http.get<FeedbackStats>(`${this.apiUrl}/stats`)
      .subscribe({
        next: (stats) => {
          this.statsCache$.next(stats);
          this.lastFetchTime = now;
        },
        error: (error) => {
          console.error('Error fetching feedback stats:', error);
          // Keep existing cache on error
        }
      });

    return this.statsCache$.asObservable();
  }

  /**
   * Get star display for rating
   */
  getStarDisplay(rating: number): string {
    const fullStars = '⭐'.repeat(Math.floor(rating));
    const hasHalfStar = rating % 1 >= 0.5;
    const halfStar = hasHalfStar ? '⭐' : '';
    
    return fullStars + halfStar;
  }

  /**
   * Format time ago
   */
  formatTimeAgo(daysAgo: number): string {
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} week${Math.floor(daysAgo / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(daysAgo / 30)} month${Math.floor(daysAgo / 30) > 1 ? 's' : ''} ago`;
  }

  /**
   * Get random testimonials for rotation
   */
  getRandomTestimonials(count: number = 3): Observable<CustomerFeedback[]> {
    return new Observable(subscriber => {
      this.getApprovedFeedback().subscribe(feedback => {
        if (feedback.length === 0) {
          subscriber.next([]);
          return;
        }

        // Shuffle and take random testimonials
        const shuffled = [...feedback].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(count, shuffled.length));
        
        subscriber.next(selected);
      });
    });
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.feedbackCache$.next([]);
    this.statsCache$.next(null);
    this.lastFetchTime = 0;
  }
}