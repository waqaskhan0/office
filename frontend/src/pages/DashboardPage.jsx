import { Card, Col, Row, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then(setData).catch(console.error);
  }, []);

  const stats = data
    ? [
        ["Products", data.productCount],
        ["Suppliers", data.supplierCount],
        ["Open Requests", data.openRequests],
        ["Low Stock", data.lowStockCount],
        ["Pending Shortages", data.pendingShortages],
        ["Auto Draft POs", data.autoDraftPos],
        ["Auto-Fulfilled Requests", data.autoFulfilledRequests]
      ]
    : [];

  return (
    <div className="portal-page">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Monitor products, shortages, and recent activity from a cleaner ERP home screen."
      />
      <Row gutter={[16, 16]} className="portal-stat-grid">
        {stats.map(([label, value], index) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={label}>
            <Card className="metric-card">
              <div className="metric-label">{label}</div>
              <div className="metric-value">{value}</div>
              <div className={`metric-note ${index % 3 === 0 ? "good" : index % 3 === 1 ? "warn" : "info"}`}>
                {index % 3 === 0 ? "Live summary" : index % 3 === 1 ? "Watch closely" : "Updated now"}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="portal-two-column">
        <Col xs={24} xl={12}>
          <Card title="Inventory Snapshot" className="portal-card">
            <Typography.Text className="portal-table-note">
              A fast view of current stock levels and items that need attention.
            </Typography.Text>
            <Table
              rowKey={(row) => row.product.id}
              dataSource={data?.inventoryPreview || []}
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: "SKU", dataIndex: ["product", "sku"] },
                { title: "Product", dataIndex: ["product", "name"] },
                { title: "Location", dataIndex: ["product", "defaultLocation"] },
                { title: "Stock", dataIndex: "stockTotal" },
                {
                  title: "Status",
                  render: (_, row) => (
                    <Tag color={row.isLow ? "orange" : "green"}>{row.isLow ? "Needs Attention" : "Healthy"}</Tag>
                  )
                }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Recent Stock Movements" className="portal-card">
            <Typography.Text className="portal-table-note">
              Latest receipts and issues flowing through the stock ledger.
            </Typography.Text>
            <Table
              rowKey="id"
              dataSource={data?.recentMovements || []}
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: "Date", dataIndex: "transactionDate" },
                { title: "Reference", dataIndex: "referenceNumber" },
                { title: "Product", render: (_, row) => row.product?.name || "-" },
                { title: "Quantity", dataIndex: "quantity" },
                { title: "Location", dataIndex: "location" }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
