import { Typography } from "antd";

export default function PageHeader({ eyebrow = "ERP Inventory Portal", title, subtitle }) {
  return (
    <div className="page-header">
      <Typography.Text className="page-header-eyebrow">{eyebrow}</Typography.Text>
      <Typography.Title level={2} className="page-header-title">
        {title}
      </Typography.Title>
      {subtitle ? <Typography.Paragraph className="page-header-subtitle">{subtitle}</Typography.Paragraph> : null}
    </div>
  );
}
