import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import PageHeader from "../components/PageHeader.jsx";

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({ q: "", status: "", source: "" });
  const [form] = Form.useForm();

  const loadOptions = () =>
    Promise.all([api.get("/products"), api.get("/suppliers")]).then(([productRows, supplierRows]) => {
      setProducts(productRows.map((row) => row.product));
      setSuppliers(supplierRows);
    });

  const loadOrders = (nextFilters = filters) => {
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => value && params.set(key, value));
    return api.get(`/purchase-orders?${params.toString()}`).then(setPurchaseOrders);
  };

  useEffect(() => {
    loadOptions().catch(console.error);
    loadOrders().catch(console.error);
  }, []);

  const handleCreate = async (values) => {
    try {
      await api.post("/purchase-orders", {
        ...values,
        issueDate: values.issueDate.format("YYYY-MM-DD")
      });
      message.success("Purchase order created");
      form.resetFields();
      loadOrders();
    } catch (error) {
      message.error(error.message);
    }
  };

  const applyFilters = (values) => {
    const next = {
      q: values.q || "",
      status: values.status || "",
      source: values.source || ""
    };
    setFilters(next);
    loadOrders(next).catch(console.error);
  };

  return (
    <div className="portal-page">
      <PageHeader
        title="Purchase Orders"
        subtitle="Review draft, shortage, and received orders in a more readable procurement workspace."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="Create Purchase Order" className="portal-card">
            <Form layout="vertical" form={form} onFinish={handleCreate} initialValues={{ issueDate: dayjs() }}>
              <Form.Item name="issueDate" label="Issue Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="supplierId" label="Supplier">
                <Select allowClear options={suppliers.map((item) => ({ value: item.id, label: item.name }))} />
              </Form.Item>
              <Form.Item name="productId" label="Product">
                <Select allowClear options={products.map((item) => ({ value: item.id, label: `${item.sku} - ${item.name}` }))} />
              </Form.Item>
              <Form.Item name="specifications" label="Specifications">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="quantityOrdered" label="Quantity Ordered" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Form.Item name="unitPrice" label="Unit Price">
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Form.Item name="status" label="Status" initialValue="pending">
                <Select
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "pending", label: "Pending" },
                    { value: "partial", label: "Partial" },
                    { value: "received", label: "Received" },
                    { value: "cancelled", label: "Cancelled" }
                  ]}
                />
              </Form.Item>
              <Form.Item name="location" label="Location">
                <Input />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button htmlType="submit" type="primary" block>
                Create Purchase Order
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Purchase Order Register" className="portal-card">
            <Form layout="vertical" initialValues={filters} onFinish={applyFilters}>
              <Row gutter={12}>
                <Col xs={24} md={10}>
                  <Form.Item name="q" label="Search">
                    <Input placeholder="PO, request, supplier, product" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={7}>
                  <Form.Item name="status" label="Status">
                    <Select allowClear options={[
                      { value: "draft", label: "Draft" },
                      { value: "pending", label: "Pending" },
                      { value: "partial", label: "Partial" },
                      { value: "received", label: "Received" },
                      { value: "cancelled", label: "Cancelled" }
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={7}>
                  <Form.Item name="source" label="Source">
                    <Select allowClear options={[
                      { value: "auto", label: "Auto-generated" },
                      { value: "manual", label: "Manual" }
                    ]} />
                  </Form.Item>
                </Col>
              </Row>
              <Space wrap style={{ marginBottom: 16 }}>
                <Button type="primary" htmlType="submit">Apply Filters</Button>
                <Button onClick={() => applyFilters({ q: "", status: "draft", source: "auto" })}>Draft Auto POs</Button>
                <Button onClick={() => applyFilters({ q: "", status: "", source: "" })}>Clear</Button>
              </Space>
            </Form>
            <Table
              rowKey="id"
              dataSource={purchaseOrders}
              scroll={{ x: 1200 }}
              columns={[
                { title: "PO", dataIndex: "poNumber" },
                { title: "Issue Date", dataIndex: "issueDate" },
                { title: "Supplier", render: (_, row) => row.supplier?.name || "-" },
                { title: "Product", render: (_, row) => row.product?.name || row.specifications || "-" },
                { title: "Request", render: (_, row) => row.sourceRequest?.requestNumber || "-" },
                { title: "Ordered", dataIndex: "quantityOrdered" },
                { title: "Shortage", dataIndex: "shortageQuantity" },
                { title: "Received", dataIndex: "quantityReceived" },
                { title: "Source", render: (_, row) => <Tag color={row.systemGenerated ? "blue" : "default"}>{row.systemGenerated ? "Auto" : "Manual"}</Tag> },
                { title: "Status", render: (_, row) => <Tag color={row.status === "draft" ? "orange" : "green"}>{row.status}</Tag> }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
