import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DeliveryFeeResponse {
  deliveryFee: number;
  distance: number;
  priceBreakdown: {
    baseFee: number;
    distanceFee: number;
    totalFee: number;
  };
  quotationId: string;
  currency: string;
  isEstimate: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  private deliveryFeeSubject = new BehaviorSubject<DeliveryFeeResponse | null>(null);
  public deliveryFee$ = this.deliveryFeeSubject.asObservable();
  
  private isCalculatingSubject = new BehaviorSubject<boolean>(false);
  public isCalculating$ = this.isCalculatingSubject.asObservable();

  constructor(private http: HttpClient) {}

  estimateDeliveryFee(deliveryAddress: string): Observable<DeliveryFeeResponse> {
    this.isCalculatingSubject.next(true);
    
    return this.http.post<DeliveryFeeResponse>(
      `${environment.apiUrl}/delivery/estimate-fee`, 
      { deliveryAddress }
    ).pipe(
      catchError((error) => {
        console.error('Error estimating delivery fee:', error);
        this.isCalculatingSubject.next(false);
        
        // Return fallback estimate on error
        const fallbackResponse: DeliveryFeeResponse = {
          deliveryFee: 100,
          distance: 8,
          priceBreakdown: {
            baseFee: 80,
            distanceFee: 20,
            totalFee: 100
          },
          quotationId: `error_fallback_${Date.now()}`,
          currency: 'PHP',
          isEstimate: true,
          message: 'Unable to calculate accurate delivery fee. Using fallback estimate.'
        };
        
        this.deliveryFeeSubject.next(fallbackResponse);
        throw error;
      })
    );
  }

  updateDeliveryFee(feeData: DeliveryFeeResponse | null): void {
    this.deliveryFeeSubject.next(feeData);
    this.isCalculatingSubject.next(false);
  }

  getCurrentDeliveryFee(): DeliveryFeeResponse | null {
    return this.deliveryFeeSubject.value;
  }

  clearDeliveryFee(): void {
    this.deliveryFeeSubject.next(null);
    this.isCalculatingSubject.next(false);
  }

  isCalculatingDeliveryFee(): boolean {
    return this.isCalculatingSubject.value;
  }
}