import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';
import { AnalyticsService } from './services/analytics';
import { CartService } from './cart/cart.service';
import { ModalComponent } from './shared/modal.component';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CommonModule, ModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
  cartItemCount = 0;
  showNavigation = true;

  constructor(
    public authService: AuthService,
    private analyticsService: AnalyticsService,
    private router: Router,
    private cartService: CartService
  ) {
    // Track page navigation
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.analyticsService.trackPageView(
          event.urlAfterRedirects, 
          document.title
        );
        
        // Hide navigation on admin login page
        this.showNavigation = !event.urlAfterRedirects.includes('/admin/login');
      });

    // Track cart item count
    this.cartService.cart$
      .pipe(
        map(items => items.reduce((total, item) => total + item.quantity, 0))
      )
      .subscribe(count => {
        this.cartItemCount = count;
      });
  }
}
