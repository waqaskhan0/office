import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [form] = Form.useForm();

  const load = () =>
    Promise.all([api.get("/receipts"), api.get("/purchase-orders"), api.get("/products")]).then(
      ([receiptRows, poRows, productRows]) => {
        setReceipts(receiptRows);
        setPurchaseOrders(poRows);
        setProducts(productRows.map((row) => row.product));
      }
    );

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const handleSubmit = async (values) => {
    try {
      const result = await api.post("/receipts", {
        ...values,
        grnDate: values.grnDate.format("YYYY-MM-DD")
      });
      message.success(
        result.autoIssuance
          ? `Receipt posted and ${result.autoIssuance.quantityIssued} units auto-issued`
          : "Receipt posted successfully"
      );
      form.resetFields();
      load();
    } catch (error) {
      message.error(error.message);
    }
  };

  return (
    <div className="portal-page">
      <PageHeader
        title="Goods Receipts"
        subtitle="Capture GRNs in a cleaner receiving screen while keeping the same auto-issue workflow."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="Post Goods Receipt" className="portal-card">
            <Form layout="vertical" form={form} onFinish={handleSubmit} initialValues={{ grnDate: dayjs() }}>
              <Form.Item name="purchaseOrderId" label="Purchase Order">
                <Select allowClear options={purchaseOrders.map((item) => ({ value: item.id, label: item.poNumber }))} />
              </Form.Item>
              <Form.Item name="productId" label="Product">
                <Select allowClear options={products.map((item) => ({ value: item.id, label: `${item.sku} - ${item.name}` }))} />
              </Form.Item>
              <Form.Item name="quantityReceived" label="Quantity Received" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Form.Item name="grnDate" label="GRN Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="receivedBy" label="Received By">
                <Input />
              </Form.Item>
              <Form.Item name="location" label="Location" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button htmlType="submit" type="primary" block>
                Post Receipt
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="GRN Register" className="portal-card">
            <Typography.Text className="portal-table-note">
              Receipts update stock and can trigger pending request fulfillment automatically.
            </Typography.Text>
            <Table
              rowKey="id"
              dataSource={receipts}
              scroll={{ x: 1100 }}
              columns={[
                { title: "GRN", dataIndex: "grnNumber" },
                { title: "Date", dataIndex: "grnDate" },
                { title: "PO", render: (_, row) => row.purchaseOrder?.poNumber || "-" },
                { title: "Request", render: (_, row) => row.purchaseOrder?.sourceRequest?.requestNumber || "-" },
                { title: "Product", render: (_, row) => row.product?.name || "-" },
                { title: "Quantity", dataIndex: "quantityReceived" },
                { title: "Auto Issued", dataIndex: "autoIssuedQuantity" },
                { title: "Location", dataIndex: "location" }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
