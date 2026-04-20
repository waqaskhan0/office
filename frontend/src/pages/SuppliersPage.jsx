import { Button, Card, Col, Form, Input, Row, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [form] = Form.useForm();

  const load = () => api.get("/suppliers").then(setSuppliers);

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const handleSubmit = async (values) => {
    try {
      await api.post("/suppliers", values);
      message.success("Supplier saved");
      form.resetFields();
      load();
    } catch (error) {
      message.error(error.message);
    }
  };

  return (
    <div className="portal-page">
      <PageHeader
        title="Suppliers"
        subtitle="Keep vendor details in one cleaner directory while preserving the existing purchasing flow."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="Add Supplier" className="portal-card">
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="contactPerson" label="Contact Person">
                <Input />
              </Form.Item>
              <Form.Item name="phone" label="Phone">
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button htmlType="submit" type="primary" block>
                Save Supplier
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Supplier Directory" className="portal-card">
            <Typography.Text className="portal-table-note">
              Verified contacts used for manual and auto-generated purchase orders.
            </Typography.Text>
            <Table
              rowKey="id"
              dataSource={suppliers}
              scroll={{ x: 700 }}
              columns={[
                { title: "Name", dataIndex: "name" },
                { title: "Contact", dataIndex: "contactPerson" },
                { title: "Phone", dataIndex: "phone" },
                { title: "Email", dataIndex: "email" }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
