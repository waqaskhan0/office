import { Button, Card, Col, Form, Input, InputNumber, Row, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function ProductsPage() {
  const [rows, setRows] = useState([]);
  const [form] = Form.useForm();

  const loadRows = () => api.get("/products").then(setRows);

  useEffect(() => {
    loadRows().catch(console.error);
  }, []);

  const handleSubmit = async (values) => {
    try {
      await api.post("/products", values);
      message.success("Product saved");
      form.resetFields();
      loadRows();
    } catch (error) {
      message.error(error.message);
    }
  };

  return (
    <div className="portal-page">
      <PageHeader
        title="Products"
        subtitle="Maintain your item master and keep reorder settings visible without changing any inventory rules."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="Add Product" className="portal-card">
            <Form layout="vertical" form={form} onFinish={handleSubmit}>
              <Form.Item name="sku" label="SKU" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="category" label="Category">
                <Input />
              </Form.Item>
              <Form.Item name="productType" label="Type">
                <Input />
              </Form.Item>
              <Form.Item name="unit" label="Unit">
                <Input />
              </Form.Item>
              <Form.Item name="defaultLocation" label="Default Location">
                <Input />
              </Form.Item>
              <Form.Item name="reorderLevel" label="Reorder Level">
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button htmlType="submit" type="primary" block>
                Save Product
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Inventory List" className="portal-card">
            <Typography.Text className="portal-table-note">
              Product catalog with on-hand stock and reorder thresholds.
            </Typography.Text>
            <Table
              rowKey={(row) => row.product.id}
              dataSource={rows}
              scroll={{ x: 900 }}
              columns={[
                { title: "SKU", dataIndex: ["product", "sku"] },
                { title: "Name", dataIndex: ["product", "name"] },
                { title: "Category", dataIndex: ["product", "category"] },
                { title: "Type", dataIndex: ["product", "productType"] },
                { title: "Location", dataIndex: ["product", "defaultLocation"] },
                {
                  title: "Stock",
                  render: (_, row) =>
                    row.isLow ? <Tag color="orange">{row.stockTotal}</Tag> : row.stockTotal
                },
                { title: "Reorder", dataIndex: ["product", "reorderLevel"] }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
