import {
  ApartmentOutlined,
  DashboardOutlined,
  DeliveredProcedureOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TeamOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import { Input, Layout, Menu, Tag, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Header, Content, Sider } = Layout;

const sections = [
  {
    label: "Main",
    items: [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
      { key: "/products", icon: <InboxOutlined />, label: "Products" },
      { key: "/suppliers", icon: <TeamOutlined />, label: "Suppliers" }
    ]
  },
  {
    label: "Transactions",
    items: [
      { key: "/purchase-orders", icon: <ShoppingCartOutlined />, label: "Purchase Orders" },
      { key: "/receipts", icon: <DeliveredProcedureOutlined />, label: "Goods Receipts" },
      { key: "/requests", icon: <ApartmentOutlined />, label: "Requests" },
      { key: "/issuance", icon: <SwapOutlined />, label: "Issuance" }
    ]
  },
  {
    label: "Reports",
    items: [{ key: "/movements", icon: <UnorderedListOutlined />, label: "Stock Ledger" }]
  }
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentItem = sections.flatMap((section) => section.items).find((item) => item.key === location.pathname);

  return (
    <Layout className="portal-layout">
      <Sider breakpoint="lg" collapsedWidth="0" width={252} className="portal-sider">
        <div className="portal-brand">
          <div className="portal-brand-badge">IMS</div>
          <Typography.Title level={4} className="portal-brand-title">
            ERP Inventory Portal
          </Typography.Title>
          <Typography.Text className="portal-brand-subtitle">
            React UI on top of your existing workflow logic
          </Typography.Text>
        </div>
        <div className="portal-nav-wrap">
          {sections.map((section) => (
            <div key={section.label} className="portal-nav-group">
              <div className="portal-nav-label">{section.label}</div>
              <Menu
                className="portal-menu"
                theme="dark"
                mode="inline"
                selectedKeys={[location.pathname]}
                items={section.items}
                onClick={({ key }) => navigate(key)}
              />
            </div>
          ))}
        </div>
      </Sider>
      <Layout className="portal-main">
        <Header className="portal-topbar">
          <div className="portal-topbar-card">
            <div>
              <h1 className="portal-topbar-title">{currentItem?.label || "ERP Inventory Portal"}</h1>
              <Typography.Text className="portal-topbar-subtitle">
                A cleaner, portal-style interface with the same backend behavior underneath.
              </Typography.Text>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Quick search coming soon"
                style={{ width: 240 }}
              />
              <Tag icon={<SafetyCertificateOutlined />} className="portal-topbar-chip">
                Logic unchanged
              </Tag>
            </div>
          </div>
        </Header>
        <Content className="portal-content">
          <div className="portal-content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
