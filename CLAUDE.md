# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Helen's Kitchen is a food ordering web application built with Angular frontend and Node.js/Express backend. It's designed for a local food business selling burgers and Charlie Chan pasta with features for customer ordering and admin management.

## Git Workflow

**Note**: Claude will handle `git add` and `git commit` operations. User will handle `git push` to remote repository.

## Development Commands

### Frontend (Angular)
```bash
cd frontend
npm start               # Start development server (localhost:4200)
ng serve                # Alternative development server command
ng build                # Build for production
ng test                 # Run unit tests with Karma
ng generate component   # Generate new component
```

### Backend (Node.js/Express)
```bash
cd backend
node server.js          # Start server (default port 4000)
npm test                # Currently no tests configured
node clear-orders.js    # Clear all orders data (for testing)
```

## Architecture Overview

### Backend Structure
- **Entry Point**: `server.js` - Express server with CORS enabled
- **Database**: MongoDB with Mongoose ODM for data modeling
- **API Pattern**: RESTful API with `/api` prefix
- **Database Collections**: 
  - `menuitems` - Food items with base pricing
  - `menuvariants` - Item variants (sizes/types) with individual pricing
  - `orders` - Customer orders with status tracking
  - `expenses` - Admin expense management

### Frontend Structure
- **Framework**: Angular 20+ with standalone components
- **Styling**: SCSS with component-specific styles
- **Routing**: Client-side routing with `/menu`, `/cart`, `/checkout` routes
- **Services**: 
  - `MenuService` - Handles menu data fetching
  - `CartService` - Shopping cart state management with BehaviorSubject
- **Components**:
  - `MenuComponent` - Menu browsing and item selection
  - `CartComponent` - Shopping cart management
  - `CheckoutComponent` - Order placement
  - `AdminOrdersComponent` - Order management
  - Admin components for expenses and revenue reporting

### Key API Endpoints
- `GET /api/menu` - Fetch menu items with variants
- `GET /api/admin/orders` - Admin order management with filtering
- `PUT /api/admin/orders/:id/status` - Update order status
- `PUT /api/admin/orders/:id/payment-status` - Update payment verification
- `GET /api/admin/revenue` - Revenue reporting
- `GET/POST/PUT/DELETE /api/admin/expenses` - Expense CRUD operations

### Business Logic Notes
- Orders require 24-hour advance notice for delivery
- Payment status tracking (Pending/Confirmed) separate from order status
- Menu items have base pricing with variant-specific pricing
- Admin can filter orders by status and payment status
- Revenue reports only include confirmed payments

### Data Flow
1. Frontend fetches menu via `MenuService`
2. Cart state managed by `CartService` using BehaviorSubject pattern
3. Orders submitted to backend API
4. Admin interface for order status updates
5. MongoDB database persists all data with cloud/local deployment options

## Database Schema Key Points
- Menu items have variants (single/double patty, different sizes)
- Orders track both order status and payment verification separately
- Expenses collection for admin financial tracking
- All documents include timestamps managed by Mongoose

## Development Notes
- Backend runs on port 4000, frontend on 4200
- CORS enabled for local development
- MongoDB connection via environment variable MONGODB_URI
- Frontend uses HttpClient for API communication
- Services are provided at root level with `providedIn: 'root'`

## Testing and Data Management

### Clear Orders Data
For testing purposes, you can clear all orders from the database:

**Windows PowerShell:**
```powershell
cd C:\Projects2\HelensKitchen\backend
node clear-orders.js
```

**Linux/Mac:**
```bash
cd backend
node clear-orders.js
```

This script:
- Deletes all documents from the `orders` collection
- Preserves all other data (menu items, expenses, users, etc.)
- Updates the MongoDB database automatically
- Useful for resetting order data between testing sessions

## Application URLs

### Customer Interface (Public Access)
- **Homepage/Menu**: `http://localhost:4200/` or `http://localhost:4200/menu`
- **Shopping Cart**: `http://localhost:4200/cart`
- **Checkout**: `http://localhost:4200/checkout`
- **Track Order**: `http://localhost:4200/track-order`

### Admin Interface (Authentication Required)
- **Admin Login**: `http://localhost:4200/admin/login`
  - Default credentials: username `admin`, password `admin123`
- **Order Management**: `http://localhost:4200/admin/orders`
- **Revenue Reports**: `http://localhost:4200/admin/revenue`
- **Expense Management**: `http://localhost:4200/admin/expenses`
- **Customer Feedback**: `http://localhost:4200/admin/feedback`
- **Analytics Dashboard**: `http://localhost:4200/admin/analytics`
- **Inventory Management**: `http://localhost:4200/admin/inventory`
- **User Management**: `http://localhost:4200/admin/users`

### API Endpoints (Backend)
- **Base URL**: `http://localhost:4000/api`
- **Menu Data**: `GET /api/menu`
- **Place Order**: `POST /api/orders`
- **Admin Orders**: `GET /api/admin/orders`
- **Update Order Status**: `PUT /api/admin/orders/:id/status`
- **Revenue Data**: `GET /api/admin/revenue`
- **Expenses CRUD**: `/api/admin/expenses`

### Access Notes
- Customer interface has no authentication requirements
- Admin interface requires login with role-based permissions
- Admin Login button is hidden from customer navigation for cleaner UX
- Direct URL access to admin routes is protected by AuthGuard