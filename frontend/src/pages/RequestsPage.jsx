import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [form] = Form.useForm();

  const load = () =>
    Promise.all([api.get("/requests"), api.get("/products")]).then(([requestRows, productRows]) => {
      setRequests(requestRows);
      setProducts(productRows.map((row) => row.product));
    });

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const handleSubmit = async (values) => {
    try {
      const result = await api.post("/requests", {
        ...values,
        requestDate: values.requestDate.format("YYYY-MM-DD")
      });
      if (result.purchaseOrder && result.issuedQuantity > 0) {
        message.success(`Partially issued ${result.issuedQuantity}. Draft PO ${result.purchaseOrder.poNumber} created.`);
      } else if (result.purchaseOrder) {
        message.warning(`Stock unavailable. Draft PO ${result.purchaseOrder.poNumber} created.`);
      } else {
        message.success("Request fully issued from available stock.");
      }
      form.resetFields();
      load();
    } catch (error) {
      message.error(error.message);
    }
  };

  return (
    <div className="portal-page">
      <PageHeader
        title="Department Requests"
        subtitle="Submit demand, see stock availability, and track shortage-driven PO generation in one cleaner view."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="Create Request" className="portal-card">
            <Form layout="vertical" form={form} onFinish={handleSubmit} initialValues={{ requestDate: dayjs() }}>
              <Form.Item name="requestDate" label="Request Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="requestedBy" label="Requested By" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="department" label="Department">
                <Input />
              </Form.Item>
              <Form.Item name="location" label="Location" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
                <Select options={products.map((item) => ({ value: item.id, label: `${item.sku} - ${item.name}` }))} />
              </Form.Item>
              <Form.Item name="quantityRequested" label="Quantity Requested" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Form.Item name="managerEmail" label="Manager Email">
                <Input />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button htmlType="submit" type="primary" block>
                Submit Request
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Request Register" className="portal-card">
            <Typography.Text className="portal-table-note">
              The fulfillment numbers below still come from the same request-to-issue backend logic.
            </Typography.Text>
            <Table
              rowKey="id"
              dataSource={requests}
              scroll={{ x: 1200 }}
              columns={[
                { title: "Request", dataIndex: "requestNumber" },
                { title: "Date", dataIndex: "requestDate" },
                { title: "Requested By", dataIndex: "requestedBy" },
                { title: "Product", render: (_, row) => row.product?.name || "-" },
                { title: "Available", dataIndex: "availableQuantity" },
                { title: "Requested", dataIndex: "quantityRequested" },
                { title: "Issued", dataIndex: "quantityIssued" },
                { title: "Short", dataIndex: "shortQuantity" },
                { title: "Fulfillment", render: (_, row) => <Tag color={row.fulfillmentStatus === "issued" ? "green" : "orange"}>{row.fulfillmentStatus}</Tag> },
                { title: "PO", render: (_, row) => row.purchaseOrders?.[0]?.poNumber || "-" }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
