# Agricultural Water Bill Tracker - PRD

## Problem Statement
Mobile PWA to track agricultural water billing. Features: consumer management, rate per bigha, total bigha/katha used, total amount received, total amount due, login system, manual payment entry + payment history, land measurement (bigha/katha with manual conversion rate), WhatsApp messaging to consumers (Bengali language templates).

## User Personas
- **Admin**: Full access to all features + user management
- **Standard User**: Can view/manage consumers, bills, payments, but cannot manage other users

## Tech Stack
- Frontend: React + Tailwind CSS + Shadcn UI (PWA)
- Backend: FastAPI (modular routes)
- Database: MongoDB
- Auth: JWT cookies + bcrypt

## Architecture
```
/app/backend/
  server.py          - Main entry point (rate-config, SMS, dashboard, startup)
  routes/auth.py     - Login, logout, /me, user management
  routes/consumers.py - Consumer CRUD with pagination
  routes/bills.py    - Bills CRUD with pagination
  routes/payments.py - Payments CRUD with pagination
  models/schemas.py  - Pydantic models
  utils/auth.py      - JWT/bcrypt helpers

/app/frontend/src/
  pages/Dashboard.js, Consumers.js, Bills.js, Payments.js, SMS.js, Users.js, Login.js
  components/MobileLayout.js (bottom nav, conditional Users tab for admin)
  contexts/AuthContext.js
```

## What's Been Implemented
- [x] Consumer CRUD (add, edit, delete)
- [x] Bill generation with bigha/katha land measurement + rate config
- [x] Payment tracking with bill updates
- [x] Dashboard with aggregate stats
- [x] WhatsApp deep-link messaging (Bengali templates)
- [x] Mobile-first PWA with offline support (service worker caching)
- [x] JWT cookie auth with admin seeding
- [x] Backend modularization (monolith → modular routes)
- [x] Pagination on GET endpoints (skip/limit, default 50)
- [x] Service worker try/catch + offline API caching
- [x] Multi-user login system (admin creates users, role-based access)
- [x] Users management page (admin only)

## API Endpoints
- POST /api/auth/login, /logout, GET /me
- GET/POST/DELETE /api/auth/users (admin only)
- GET/POST/PUT/DELETE /api/consumers
- GET/POST/DELETE /api/bills
- GET /api/rate-config, PUT /api/rate-config
- GET/POST/PUT/DELETE /api/payments
- POST /api/sms/send (logs only)
- GET /api/dashboard/stats

## Remaining / Backlog
- Enhanced offline mode (queue write operations for sync when online)
- Data export (CSV/PDF)
- Dashboard analytics improvements
- Password reset flow for users
