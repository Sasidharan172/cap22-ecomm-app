# CAP-22 frontend update

This update changes the frontend only. The Spring Boot backend and database schema are unchanged.

## UI structure
- Overview
- Orders
- Shipments
- Landed cost estimates
- Customers
- Products
- Destinations
- Duty and tax rules
- Exchange rates
- Documents and carrier events
- Exceptions

The navigation groups these screens by workspace, configuration, and shipment operations. Shipment cards include search and a status update control using the existing `PATCH /api/shipments/{id}/status` endpoint. Exception rows display tracking and order references instead of shortened database IDs.

The UI uses the existing backend routes under `/api`. No CSV import, reporting-currency settings, analytics refresh, or other unsupported controls were added.

## Run
```bash
cd frontend
npm install
npm run dev
```

The Vite development server proxies `/api` to `http://localhost:8080`.
