# ERP Inventory Portal

A browser-based inventory management portal built in Python with Django and SQLite. It includes:

- Login-protected dashboard
- Product and supplier management
- Purchase orders
- Goods receipts with stock posting
- Department requests and approvals
- Issuance with stock deduction
- Stock ledger and location summary
- Excel import command for the provided workbook

## Run the portal

```powershell
python -m pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Open `http://127.0.0.1:8000/` and log in with the superuser you created.

## Import your workbook

```powershell
python manage.py import_inventory_workbook --path "C:\Users\mwaqa\Downloads\Inventory Management System.xlsx" --replace
```

## Notes

- The default database is SQLite in `db.sqlite3`.
- You can change the database later in [settings.py](/d:/IMS/erp_portal/settings.py) to PostgreSQL or MySQL.
- Historical rows from the workbook are imported where the source data is clear enough to map safely.
