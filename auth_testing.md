# Auth Testing Playbook

## MongoDB Verification
Check collections: `users`, `farmers`, `purchase_transactions`, `sales_trips`, `operational_expenses`, `app_settings`

## Credentials:
- Email: admin@makekal.id
- Password: SawitMakekal2026!

## Verification Steps:
1. Verify POST `/api/auth/check-init` returns initialization status
2. Verify POST `/api/auth/login` returns token and user payload
3. Verify GET `/api/auth/me` returns authenticated user data
4. Verify Offline-first field endpoints (`/api/purchases`, `/api/trips`, `/api/stock-pool`, `/api/expenses`, `/api/sync`)
5. Verify Anomaly detection for trips with shrinkage > 5% in `/api/dashboard/stats`
