import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function IssuancePage() {
  const [issuances, setIssuances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [form] = Form.useForm();

  const load = () =>
    Promise.all([api.get("/issuances"), api.get("/requests"), api.get("/products")]).then(
      ([issuanceRows, requestRows, productRows]) => {
        setIssuances(issuanceRows);
        setRequests(requestRows.filter((item) => item.fulfillmentStatus !== "issued"));
        setProducts(productRows.map((row) => row.product));
      }
    );

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const handleSubmit = async (values) => {
    try {
      await api.post("/issuances", {
        ...values,
        issueDate: values.issueDate.format("YYYY-MM-DD")
      });
      message.success("Issuance posted");
      form.resetFields();
      load();
    } catch (error) {
      message.error(error.message);
    }
  };

  return (
    <div className="portal-page">
      <PageHeader
        title="Issuance"
        subtitle="Post manual issues and review auto-issued stock in a more readable dispatch register."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="Create Issuance" className="portal-card">
            <Form layout="vertical" form={form} onFinish={handleSubmit} initialValues={{ issueDate: dayjs() }}>
              <Form.Item name="inventoryRequestId" label="Request">
                <Select allowClear options={requests.map((item) => ({ value: item.id, label: item.requestNumber }))} />
              </Form.Item>
              <Form.Item name="productId" label="Product">
                <Select allowClear options={products.map((item) => ({ value: item.id, label: `${item.sku} - ${item.name}` }))} />
              </Form.Item>
              <Form.Item name="quantityIssued" label="Quantity Issued" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Form.Item name="issueDate" label="Issue Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="issuedTo" label="Issued To">
                <Input />
              </Form.Item>
              <Form.Item name="issuedBy" label="Issued By">
                <Input />
              </Form.Item>
              <Form.Item name="location" label="Location" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button htmlType="submit" type="primary" block>
                Post Issuance
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Issuance Register" className="portal-card">
            <Typography.Text className="portal-table-note">
              Every entry here still posts stock-out through the same existing backend process.
            </Typography.Text>
            <Table
              rowKey="id"
              dataSource={issuances}
              scroll={{ x: 1000 }}
              columns={[
                { title: "Issue No", dataIndex: "issueNumber" },
                { title: "Date", dataIndex: "issueDate" },
                { title: "Request", render: (_, row) => row.inventoryRequest?.requestNumber || "-" },
                { title: "Product", render: (_, row) => row.product?.name || "-" },
                { title: "Quantity", dataIndex: "quantityIssued" },
                { title: "Issued To", dataIndex: "issuedTo" },
                { title: "Source", render: (_, row) => <Tag color={row.systemGenerated ? "blue" : "default"}>{row.systemGenerated ? "Auto" : "Manual"}</Tag> },
                { title: "Location", dataIndex: "location" }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
