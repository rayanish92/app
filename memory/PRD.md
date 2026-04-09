# Agricultural Water Bill Tracker - PRD

## Problem Statement
Mobile PWA to track agricultural water billing. Features: consumer management, rate per bigha, total bigha/katha used, total amount received, total amount due, login system, manual payment entry + payment history, land measurement (bigha/katha with manual conversion rate), WhatsApp messaging to consumers (Bengali language templates).

## User Personas
- **Admin**: Full access to all features + user management + password resets
- **Standard User**: Can view/manage consumers, bills, payments, export data, but cannot manage other users

## Tech Stack
- Frontend: React + Tailwind CSS + Shadcn UI (PWA)
- Backend: FastAPI (modular routes)
- Database: MongoDB
- Auth: JWT cookies + bcrypt
- Export: CSV (server-side) + PDF (client-side via jspdf)

## Architecture
```
/app/backend/
  server.py              - Main entry point (rate-config, SMS, dashboard, startup)
  routes/auth.py         - Login, logout, /me, password reset, user management
  routes/consumers.py    - Consumer CRUD with pagination
  routes/bills.py        - Bills CRUD with pagination
  routes/payments.py     - Payments CRUD with pagination
  routes/export.py       - CSV export endpoints
  models/schemas.py      - Pydantic models
  utils/auth.py          - JWT/bcrypt helpers

/app/frontend/src/
  pages/Dashboard.js, Consumers.js, Bills.js, Payments.js, SMS.js, Users.js, Login.js
  pages/ForgotPassword.js, ResetPassword.js
  components/MobileLayout.js (bottom nav, offline banner, sync)
  contexts/AuthContext.js
  lib/exportUtils.js (CSV + PDF generation)
  lib/offlineQueue.js (offline operation queue)
```

## What's Been Implemented
- [x] Consumer CRUD (add, edit, delete)
- [x] Bill generation with bigha/katha land measurement + rate config
- [x] Payment tracking with bill updates
- [x] Dashboard with aggregate stats
- [x] WhatsApp deep-link messaging (Bengali templates)
- [x] Mobile-first PWA with offline support (service worker caching)
- [x] JWT cookie auth with admin seeding
- [x] Backend modularization (monolith -> modular routes)
- [x] Pagination on GET endpoints (skip/limit, default 50)
- [x] Service worker try/catch + offline API caching
- [x] Multi-user login system (admin creates users, role-based access)
- [x] Users management page (admin only)
- [x] Password reset (self-service via token + admin reset from Users page)
- [x] Data export: CSV and PDF for Consumers, Bills, Payments
- [x] Enhanced offline mode: offline banner, pending ops queue, auto-sync

## API Endpoints
- POST /api/auth/login, /logout, GET /me
- POST /api/auth/forgot-password, /reset-password
- GET/POST/DELETE /api/auth/users (admin only)
- PUT /api/auth/users/{id}/reset-password (admin only)
- GET/POST/PUT/DELETE /api/consumers
- GET/POST/DELETE /api/bills
- GET /api/rate-config, PUT /api/rate-config
- GET/POST/PUT/DELETE /api/payments
- GET /api/export/consumers, /api/export/bills, /api/export/payments
- POST /api/sms/send (logs only)
- GET /api/dashboard/stats

## Remaining / Backlog
- Email integration for password reset (currently logs token to console)
- Consumer-facing bill check portal (shared link, no login needed)
- Advanced dashboard analytics (charts, trends)
