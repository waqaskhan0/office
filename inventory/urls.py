from django.urls import path

from . import views


urlpatterns = [
    path("", views.home, name="home"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("products/", views.products_page, name="products"),
    path("suppliers/", views.suppliers_page, name="suppliers"),
    path("purchase-orders/", views.purchase_orders_page, name="purchase_orders"),
    path("receipts/", views.receipts_page, name="receipts"),
    path("requests/", views.requests_page, name="requests"),
    path("requests/<int:pk>/<str:status>/", views.request_status, name="request_status"),
    path("issuance/", views.issuance_page, name="issuance"),
    path("movements/", views.movements_page, name="movements"),
]
