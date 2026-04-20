import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntdApp, ConfigProvider } from "antd";
import App from "./App.jsx";
import "antd/dist/reset.css";
import "./styles/portal.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#185fa5",
            colorInfo: "#185fa5",
            colorSuccess: "#2f855a",
            colorWarning: "#b7791f",
            colorBgLayout: "transparent",
            colorBgContainer: "rgba(255,255,255,0.82)",
            colorBorderSecondary: "#dbe7ed",
            colorText: "#143247",
            fontFamily: "\"Segoe UI\", \"Inter\", system-ui, sans-serif",
            borderRadius: 18
          }
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
