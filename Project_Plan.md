# Food Ordering App Project Plan

---

## 1. Project Overview

Create an easy-to-use online food ordering web app where customers order burgers and Charlie Chan pasta, pay via GCash or bank transfer, no user accounts needed, and admin can view/manage orders and track revenue & expenses.  
**Note:** Orders must be placed at least 24 hours before the requested delivery time.

---

## 2. Goals

- Simplify customer ordering process without login.
- Display menu with prices and photos.
- Support offline payment methods with clear instructions.
- Enable admin to monitor orders and financial performance (revenue & expenses).
- Enforce 24-hour advance order placement before delivery.
- Require pre-payment before delivery via GCash or bank transfer.
- Provide customers with live order tracking and estimated delivery times.
- Allow customers to view past orders and reorder favorites without login.
- Enable promotions and discounts via coupon codes.
- Improve operational efficiency with inventory and role-based access management.

---

## 3. Core Features

### Customer Side

- Menu browsing with item details, prices, and images
- Cart to add, remove, update items
- Checkout form (name, phone, address, payment method, requested delivery date/time)
- Validation to allow orders only if delivery is at least 24 hours later
- **Mandatory pre-payment:** Customers must pay via GCash or bank transfer **before** delivery
- Payment instructions display with clear steps for payment confirmation
- Order submission with payment status set to "Pending" until manual verification
- **Order feedback:** Customers can submit comments/ratings for their order; feedback requires admin approval
- **Order tracking:** Customers receive live updates on order status (e.g., Preparing, Out for Delivery)
- **Order history & favorites:** Customers can view and reorder previous orders without logging in

### Admin Side

- View incoming orders & update order status (including payment verification)
- Mark orders as "Payment Confirmed" before processing/delivery
- Add/Edit/Delete menu items (optional)
- Revenue reports (total sales, breakdowns by date & items)
- Expense management (record expenses by category/date)
- Profit summary (Revenue - Expenses) with charts
- Moderate customer feedback (approve/reject/delete)
- View site analytics on visits, page events, and user actions (even anonymous)
- Role-based admin access for order management, finance, and content editing
- Inventory management to track stock levels and avoid overselling
- Manage discounts and promo codes for marketing campaigns
- Send payment reminders and notifications to customers

---

## 4. Technology Stack

| Layer    | Technology                                             | Notes                     |
| -------- | ------------------------------------------------------ | ------------------------- |
| Frontend | Angular                                                | Mobile responsive web app |
| Backend  | Node.js + Express.js                                   | RESTful API server        |
| Database | SQLite                                                 | Lightweight relational DB |
| Hosting  | Vercel/Netlify (frontend), Render/Heroku/AWS (backend) | Simple deployment         |

---

## 5. User Stories

| Role     | Feature               | Description                                                      |
| -------- | --------------------- | ---------------------------------------------------------------- |
| Customer | Browse Menu           | View items and prices                                            |
| Customer | Manage Cart           | Add/remove/update quantities                                     |
| Customer | Checkout              | Enter info & select payment method and delivery date/time        |
| Customer | Order Time Validation | Cannot place orders less than 24 hours before delivery           |
| Customer | Pre-Payment           | Must pay before delivery via GCash or bank transfer              |
| Customer | Payment Instructions  | See GCash / Bank Transfer details                                |
| Customer | Submit Order          | Place order without login                                        |
| Customer | Submit Feedback       | Provide comments and ratings after order, pending admin approval |
| Customer | Track Order           | Receive live status updates on their orders                      |
| Customer | View Order History    | See and reorder previous orders without login                    |
| Admin    | View Orders           | Monitor orders & update statuses (incl. payment verification)    |
| Admin    | Manage Menu           | Add/edit/delete items (optional)                                 |
| Admin    | Revenue Report        | View sales summary & breakdowns                                  |
| Admin    | Expense Management    | Record and track expenses                                        |
| Admin    | Profit Summary        | See revenue minus expenses                                       |
| Admin    | Moderate Feedback     | Approve, reject or delete customer feedback                      |
| Admin    | View Site Analytics   | Analyze site visits and user events                              |
| Admin    | Manage Roles          | Control admin access levels                                      |
| Admin    | Manage Inventory      | Track ingredient stock levels                                    |
| Admin    | Manage Discounts      | Create and manage promo codes and discounts                      |
| Admin    | Payment Reminders     | Send automatic payment reminders to customers                    |

---

## 6. Milestones & Timeline

| Milestone                  | Description                                                                                              | Time Estimate |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------- |
| Requirement Finalization   | Confirm menu, payments, reports scope                                                                    | 1 day         |
| UI/UX Design               | Design user and admin pages                                                                              | 3 days        |
| Backend Setup              | Node.js + Express + SQLite setup, basic APIs                                                             | 5 days        |
| Frontend Development       | Angular app with menu, cart, checkout                                                                    | 6-8 days      |
| API Integration            | Connect frontend and backend                                                                             | 2 days        |
| Admin Features Development | Order management, revenue & expense reports, feedback moderation, analytics, inventory, roles, discounts | 7-8 days      |
| Testing & QA               | Functional, usability, and data accuracy testing                                                         | 3 days        |
| Deployment                 | Launch frontend and backend                                                                              | 1 day         |
| Optional Enhancements      | Online payments, SMS/email notifications, live chat, multi-language support                              | 4+ days       |

---

## 7. Detailed Feature Breakdown

### 7.1 Menu Module

- API endpoint to list menu items with images
- Frontend menu display with prices, descriptions, and attractive images
- Responsive layout for easy browsing on mobile and desktop
- Include image upload support in admin panel (optional)
- Allow users to select item variants (e.g., single/double patty, size for Charlie Chan)
- Display images clearly alongside each menu item to enhance user experience

### 7.2 Cart & Ordering Form

- User-friendly cart to add/remove items and adjust quantities
- Checkout form to capture necessary details (name, phone, delivery address, delivery date/time)
- Show selected menu item images in the cart and order summary
- Validate delivery date/time (minimum 24 hours in advance)
- Display payment instructions prominently
- Enforce mandatory pre-payment before order confirmation

### 7.3 Orders Module

- Store orders with customer info, items, payment method, status, payment confirmation status
- Admin API to get/update orders including payment verification and status updates
- Order tracking status updates sent to customers

### 7.4 Revenue Report

- Aggregate sales data by date and payment method
- Breakdown by menu items

### 7.5 Expense Management

- Record expenses (date, category, amount, notes)
- View/edit/delete expense records

### 7.6 Profit Summary

- Calculate profit (revenue - expenses)
- Visual charts (bar, line, pie)

### 7.7 Feedback/Comments Module

- Customers can submit feedback/comments for their orders
- Admin can moderate feedback: approve, reject, or delete
- Optionally display approved feedback on site for social proof

### 7.8 Site Analytics Module

- Track site visits, page views, and user events (even anonymous)
- Log event type, page URL, timestamp
- Provide admin reports on analytics with filters and visualizations

### 7.9 Admin Role & Access Management

- Differentiate admin permissions (order management, finance, content)
- Secure admin routes and actions accordingly

### 7.10 Inventory Management

- Track ingredient stock levels based on orders
- Alert or disable menu items when out of stock

### 7.11 Discounts & Promotions

- Create and manage promo codes or discounts
- Apply discount codes during checkout

### 7.12 Payment Notifications & Reminders

- Automatically send payment reminders to customers for pending payments
- Optionally integrate email or SMS notifications

### 7.13 FAQ Page

- Static FAQ page accessible from menu or footer
- Display common questions and answers clearly with icons/emojis for friendliness
- Initial FAQs include:
  1. **Do you deliver?**  
     🍔 Yes, via rider.
  2. **Where are you located?**  
     🍔 Dela Paz Norte, San Fernando, Pampanga
  3. **Payment methods?**  
     🍔 We prefer contactless transactions for safety purposes. We accept BPI, BDO, and GCash.
- Mobile-friendly layout for easy reading

---

## 8. Menu Items Pricing Examples

| Item Name                  | Description                                                           | Variant / Size | Price (Php) |
| -------------------------- | --------------------------------------------------------------------- | -------------- | ----------- |
| 4 Cheese Burger            | Classic 4 cheese burger                                               | Single Patty   | 159         |
|                            |                                                                       | Double Patty   | 199         |
| Spicy Bulgogi 3 Cheese     | Bulgogi with 3 cheese                                                 | Single Patty   | 159         |
|                            |                                                                       | Double Patty   | 199         |
| Charlie Chan Chicken Pasta | Pasta with chicken, mushrooms, peanuts in sticky, sweet & spicy sauce | 700ml box      | 199         |
|                            |                                                                       | 1000ml box     | 289         |
|                            |                                                                       | 1400ml box     | 379         |

---

## 9. Database Schema (SQLite)

| Table         | Columns                                                                                                                     | Description               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Menu          | id (PK), name, description, variant, price, image_url                                                                       | Food items                |
| Orders        | id (PK), customer_name, phone, address, payment_method, total_price, status, payment_status, requested_delivery, created_at | Customer orders           |
| OrderItems    | id (PK), order_id (FK), menu_id (FK), variant, quantity, price                                                              | Ordered items per order   |
| Expenses      | id (PK), date, category, amount, notes                                                                                      | Expense records           |
| Feedback      | id (PK), order_id (FK), customer_name, comment, status, created_at                                                          | Customer feedback         |
| AnalyticsLogs | id (PK), event_type, page_url, user_id, timestamp                                                                           | Site analytics logs       |
| AdminRoles    | id (PK), role_name, permissions                                                                                             | Admin roles & permissions |
| Inventory     | id (PK), menu_id (FK), stock_quantity, last_updated                                                                         | Stock levels per item     |
| Discounts     | id (PK), code, description, discount_type, amount, valid_from, valid_to                                                     | Promo codes               |

---

## 10. Backend API Endpoints (examples)

| Method | Endpoint                         | Description                            |
| ------ | -------------------------------- | -------------------------------------- |
| GET    | /menu                            | Get list of menu items                 |
| POST   | /orders                          | Submit a new order                     |
| GET    | /admin/orders                    | Admin view all orders                  |
| PUT    | /admin/orders/:id/status         | Update order status                    |
| PUT    | /admin/orders/:id/payment-status | Update payment verification status     |
| GET    | /admin/revenue                   | Get revenue report (with date filters) |
| GET    | /admin/expenses                  | Get expense records (with filters)     |
| POST   | /admin/expenses                  | Add a new expense                      |
| PUT    | /admin/expenses/:id              | Update expense                         |
| DELETE | /admin/expenses/:id              | Delete expense                         |
| POST   | /feedback                        | Customer submits feedback              |
| GET    | /admin/feedback                  | Admin views feedback                   |
| PUT    | /admin/feedback/:id/status       | Update feedback approval status        |
| DELETE | /admin/feedback/:id              | Delete feedback                        |
| POST   | /analytics/log                   | Log site visit or user event           |
| GET    | /admin/analytics                 | View aggregated site analytics         |
| GET    | /admin/roles                     | Get admin roles and permissions        |
| POST   | /admin/roles                     | Create new admin role                  |
| PUT    | /admin/roles/:id                 | Update admin role                      |
| DELETE | /admin/roles/:id                 | Delete admin role                      |
| GET    | /admin/inventory                 | View current stock levels              |
| PUT    | /admin/inventory/:menu_id        | Update stock quantity                  |
| GET    | /discounts                       | List promo codes                       |
| POST   | /discounts                       | Create promo code                      |
| PUT    | /discounts/:id                   | Update promo code                      |
| DELETE | /discounts/:id                   | Delete promo code                      |

---

## 11. Deployment Notes

- Backend deploy with SQLite DB file in place; consider regular backups
- Frontend deploy on static hosting (Netlify/Vercel)
- Backend deploy on managed platform supporting Node.js (Render, Heroku, AWS)

---

## 12. Future Enhancements

- Integrate online payment gateways (e.g., GCash API, PayPal) for automatic payment confirmation and instant checkout
- SMS/email order notifications and marketing campaigns
- Delivery time slots and live delivery tracking integration
- Analytics dashboard with advanced filtering and customer behavior insights
- Multi-language support and full accessibility compliance
- Live chat support for customer service
- Security enhancements including rate limiting and PCI compliance for payments

---
