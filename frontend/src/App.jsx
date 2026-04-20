import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage.jsx";
import ReceiptsPage from "./pages/ReceiptsPage.jsx";
import RequestsPage from "./pages/RequestsPage.jsx";
import IssuancePage from "./pages/IssuancePage.jsx";
import MovementsPage from "./pages/MovementsPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/issuance" element={<IssuancePage />} />
        <Route path="/movements" element={<MovementsPage />} />
      </Route>
    </Routes>
  );
}
