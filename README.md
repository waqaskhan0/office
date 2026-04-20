# IMS ERP Portal

This project now uses:

- `frontend/`: React + Ant Design
- `backend/`: Node.js + Express + Sequelize
- `database`: MySQL

## Run the Backend

1. Create a MySQL database, for example `ims_portal`
2. Copy the backend environment template:

```powershell
cd D:\IMS\backend
copy .env.example .env
```

3. Update `.env` with your MySQL credentials
4. Install packages:

```powershell
cd D:\IMS\backend
npm.cmd install
```

5. Start the backend:

```powershell
npm.cmd run dev
```

Backend default URL:
- `http://localhost:4000`

## Run the Frontend

1. Install packages:

```powershell
cd D:\IMS\frontend
npm.cmd install
```

2. Optional: create a frontend environment file:

```env
VITE_API_URL=http://localhost:4000/api
```

3. Start the frontend:

```powershell
cd D:\IMS\frontend
npm.cmd run dev
```

Frontend default URL:
- `http://localhost:5173`

## API Modules

- dashboard
- products
- suppliers
- purchase orders
- goods receipts
- requests
- issuance
- stock ledger

## Notes

- Use `npm.cmd` in PowerShell if `npm` is blocked by execution policy.
- `backend/.env` and `frontend/.env` are intentionally ignored.
