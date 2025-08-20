import { Routes } from '@angular/router';
import { MenuComponent } from './menu/menu.component';
import { CartComponent } from './cart/cart.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { AdminOrdersComponent } from './admin-orders/admin-orders.component';
import { TrackOrderComponent } from './track-order/track-order.component';
import { AdminRevenue } from './admin-revenue/admin-revenue';
import { AdminExpenses } from './admin-expenses/admin-expenses';
import { AdminLogin } from './admin-login/admin-login';
import { FeedbackComponent } from './feedback/feedback';
import { AdminFeedback } from './admin-feedback/admin-feedback';
import { AdminAnalyticsComponent } from './admin-analytics/admin-analytics';
import { AdminInventoryComponent } from './admin-inventory/admin-inventory';
import { AdminMenuComponent } from './admin-menu/admin-menu.component';
import { AdminAvailabilityComponent } from './admin-availability/admin-availability';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', component: MenuComponent }, // default to menu
  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'track-order', component: TrackOrderComponent },
  { path: 'admin/login', component: AdminLogin },
  { path: 'admin/orders', component: AdminOrdersComponent, canActivate: [authGuard] },
  { path: 'admin/availability', component: AdminAvailabilityComponent, canActivate: [authGuard] },
  { path: 'admin/revenue', component: AdminRevenue, canActivate: [authGuard] },
  { path: 'admin/expenses', component: AdminExpenses, canActivate: [authGuard] },
  { path: 'admin/feedback', component: AdminFeedback, canActivate: [authGuard] },
  { path: 'admin/analytics', component: AdminAnalyticsComponent, canActivate: [authGuard] },
  { path: 'admin/inventory', component: AdminInventoryComponent, canActivate: [authGuard] },
  { path: 'admin/menu', component: AdminMenuComponent, canActivate: [authGuard] },
  { path: 'feedback', component: FeedbackComponent },
  { path: '**', redirectTo: '' }, // fallback redirect to menu
];
