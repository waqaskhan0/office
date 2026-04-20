import { Card, Col, Row, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function MovementsPage() {
  const [data, setData] = useState({ locationSummary: [], movements: [] });

  useEffect(() => {
    api.get("/movements").then(setData).catch(console.error);
  }, []);

  return (
    <div className="portal-page">
      <PageHeader
        title="Stock Ledger"
        subtitle="Follow location balances and movement history with a cleaner reporting surface."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="Net Stock by Location" className="portal-card">
            <Table
              rowKey={(row) => row.location || "unassigned"}
              dataSource={data.locationSummary}
              pagination={false}
              columns={[
                { title: "Location", dataIndex: "location", render: (value) => value || "Unassigned" },
                { title: "Net Quantity", dataIndex: "netQuantity" }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Movement History" className="portal-card">
            <Typography.Text className="portal-table-note">
              Receipts and issues remain ledger-based; this page is visual-only refresh work.
            </Typography.Text>
            <Table
              rowKey="id"
              dataSource={data.movements}
              scroll={{ x: 1000 }}
              columns={[
                { title: "Date", dataIndex: "transactionDate" },
                { title: "Product", render: (_, row) => row.product?.name || "-" },
                { title: "Type", dataIndex: "transactionType" },
                { title: "Quantity", dataIndex: "quantity" },
                { title: "Reference", dataIndex: "referenceNumber" },
                { title: "Location", dataIndex: "location" }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
