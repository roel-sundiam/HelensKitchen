
# Food Ordering App Developer Prompts

---

## Meta Instruction to Developer AI

You will receive a series of numbered prompts.

Read and fully understand the file `Project_Plan.md` before starting any prompt.

Complete each prompt in full before moving to the next.

After finishing a prompt, stop and clearly state:  
"Prompt X completed. Awaiting confirmation to proceed to Prompt X+1."

Do not skip ahead, merge prompts, or partially complete tasks unless explicitly instructed.

All features must follow the requirements, design, and technical details from `Project_Plan.md`.

If a prompt references a previous one, ensure full integration with prior work.

---

## Prompt 1 — Setup Development Environment & Dependencies

- Initialize Git repository.
- Setup Angular frontend project with necessary dependencies.
- Setup Node.js + Express backend project.
- Configure SQLite database connection.
- Configure environment variables and project structure.
- Setup basic API endpoint to verify server is running.
- Setup Angular app base structure with routing.

**Stop and wait for confirmation before proceeding to Prompt 2.**

---

## Prompt 2 — Implement Menu Module

- Backend: Create API endpoints to get menu items, including variants and images.
- Frontend: Display menu items in a responsive grid with photos, description, prices, and "Add to Cart" buttons using the provided design style.
- Allow variant selection on menu items (e.g., Single/Double Patty).
- Store menu data in SQLite database as per schema.

**Stop and wait for confirmation before proceeding to Prompt 3.**

---

## Prompt 3 — Implement Cart and Checkout Form

- Frontend cart functionality to add/remove/update item quantities.
- Display cart summary with item images, prices, and total.
- Checkout form capturing customer info: name, phone, delivery address, payment method, requested delivery date/time.
- Validate delivery date/time is at least 24 hours ahead.
- Show payment instructions for GCash and bank transfer.
- Prevent order submission if validation fails.
- Submit order to backend.

**Stop and wait for confirmation before proceeding to Prompt 4.**

---

## Prompt 4 — Orders Module

- Backend: API to store orders with customer info, items, payment method, status, payment verification.
- Admin API endpoints to get all orders, update order status, and update payment verification status.
- Frontend admin orders page to view orders, filter by status, and update statuses.

**Stop and wait for confirmation before proceeding to Prompt 5.**

---

## Prompt 5 — Revenue and Expense Reporting

- Backend: Aggregate revenue data by date and payment method.
- Backend: CRUD for expense records.
- Frontend admin pages to display revenue reports and expense management with charts.
- Profit summary calculation (revenue minus expenses) with visual charts.

**Stop and wait for confirmation before proceeding to Prompt 6.**

---

## Prompt 6 — Feedback/Comments Module

- Backend: API to submit feedback tied to orders.
- Backend: Admin API to view, approve, reject, and delete feedback.
- Frontend: Customer feedback submission form after order confirmation.
- Frontend: Admin feedback moderation interface.

**Stop and wait for confirmation before proceeding to Prompt 7.**

---

## Prompt 7 — Site Analytics Module

- Backend: Log site visits, page views, and user events (even anonymous).
- Backend: Admin API to retrieve analytics data with filtering options.
- Frontend: Admin dashboard to display site analytics with visual reports.

**Stop and wait for confirmation before proceeding to Prompt 8.**

---

## Prompt 8 — Admin Role-Based Access Control

- Backend: Define admin roles and permissions.
- Backend: Secure routes and actions based on roles.
- Frontend: Admin user management to create/edit/delete roles and assign permissions.

**Stop and wait for confirmation before proceeding to Prompt 9.**

---

## Prompt 9 — Inventory Management

- Backend: Track ingredient stock quantities linked to menu items.
- Backend: Update stock on order placement and admin adjustments.
- Frontend: Admin interface to view and update inventory.
- Disable ordering of out-of-stock items in frontend menu.

**Stop and wait for confirmation before proceeding to Prompt 10.**

---

## Prompt 10 — Discounts & Promotions

- Backend: CRUD API for promo codes and discounts.
- Frontend: Admin interface to manage discount codes.
- Frontend: Checkout integration to apply valid discount codes.

**Stop and wait for confirmation before proceeding to Prompt 11.**

---

## Prompt 11 — Payment Reminders & Notifications

- Backend: Schedule and send automated payment reminders for pending orders via email/SMS (basic mock implementation).
- Frontend: Display payment reminder status.
- Prepare system for future integration with real notification services.

**Stop and wait for confirmation before proceeding to Prompt 12.**

---

## Prompt 12 — Order Tracking & History

- Backend: Add order status updates (Preparing, Out for Delivery, Delivered).
- Frontend: Customer order tracking UI with live status updates.
- Frontend: Display customer's past orders and allow reordering favorites without requiring login.

**Stop and wait for confirmation before proceeding to Prompt 13.**

---

## Prompt 13 — Deployment Preparation

- Prepare production builds for frontend and backend.
- Setup hosting on Vercel/Netlify for frontend and Render/Heroku/AWS for backend.
- Configure environment variables and database backups.
- Finalize README and deployment documentation.

**Stop and wait for confirmation before proceeding to Prompt 14.**

---

## Prompt 14 — Testing and QA

- Write unit and integration tests for backend APIs.
- Write unit and e2e tests for frontend components.
- Conduct functional, usability, and data accuracy testing.
- Fix bugs and optimize performance.

**Stop and wait for confirmation before proceeding to Prompt 15.**

---

## Prompt 15 — Optional Enhancements

- Integrate online payment gateways (e.g., GCash API, PayPal).
- Implement SMS/email notifications for orders and promotions.
- Add live chat support functionality.
- Implement multi-language support and accessibility compliance.

**Stop and wait for confirmation before proceeding to Prompt 16.**

---

## Prompt 16 — Documentation & Handoff

- Complete developer and user documentation.
- Prepare deployment guides and environment setup instructions.
- Provide API documentation and frontend usage notes.

**Stop and wait for confirmation before proceeding to Prompt 17.**

---

## Prompt 17 — Project Wrap-up and Review

- Final project review and handoff.
- Address any final bug fixes or feature adjustments.
- Plan for maintenance and future feature roadmap.

---
