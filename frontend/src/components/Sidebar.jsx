import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const [collapsed, setCollapsed] = useState(false);
  const [activeMachine, setActiveMachine] = useState({
    id: localStorage.getItem("active_machine_id") || "MCH-001",
    name: localStorage.getItem("active_machine_name") || "RFM760",
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setActiveMachine({
        id: localStorage.getItem("active_machine_id") || "MCH-001",
        name: localStorage.getItem("active_machine_name") || "RFM760",
      });
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-current",
      collapsed ? "76px" : "244px"
    );
    document.body.classList.toggle("sidebar-is-collapsed", collapsed);
    return () => {
      document.documentElement.style.setProperty("--sidebar-current", "244px");
      document.body.classList.remove("sidebar-is-collapsed");
    };
  }, [collapsed]);

  const isMachinesPage = pathname === "/machines";

  return (
    <aside className={`app-sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">⚙</div>
        <div className="brand-copy">
          <div className="brand-name">ToolWear.AI</div>
          <div className="brand-sub">CNC PHM SUITE</div>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed ? (
        <div className="sidebar-machine-context">
          <div className="sidebar-machine-icon">⚙</div>
          <div className="sidebar-machine-copy">
            <div className="sidebar-machine-label">ACTIVE MACHINE</div>
            <div className="sidebar-machine-name">{activeMachine.name}</div>
            <div className="sidebar-machine-id">{activeMachine.id}</div>
          </div>
        </div>
      ) : (
        <div
          className="sidebar-collapsed-machine"
          title={`Active machine: ${activeMachine.name} (${activeMachine.id})`}
        >
          ⚙
        </div>
      )}

      <nav className="sidebar-nav">
        {isMachinesPage ? (
          <>
            <div className="nav-section-label">MACHINE MANAGEMENT</div>
            <SidebarItem
              icon="▦"
              label="Machines"
              active={pathname === "/machines"}
              onClick={() => navigate("/machines")}
            />
          </>
        ) : (
          <>
            <div className="nav-section-label">MONITOR</div>
            <SidebarItem
              icon="▦"
              label="Dashboard"
              active={pathname === "/dashboard"}
              onClick={() => navigate("/dashboard")}
            />
            <SidebarItem
              icon="✦"
              label="Explainable AI"
              active={pathname === "/explainable-ai"}
              onClick={() => navigate("/explainable-ai")}
            />
            <SidebarItem
              icon="⌁"
              label="Wear Progression"
              active={pathname === "/progression"}
              onClick={() => navigate("/progression")}
            />
            <SidebarItem
              icon="〽"
              label="Telemetry"
              active={pathname === "/telemetry"}
              onClick={() => navigate("/telemetry")}
            />

            <div className="nav-section-label">SYSTEM</div>
            <SidebarItem
              icon="⚙"
              label="Machine Specs"
              active={pathname === "/specs"}
              onClick={() => navigate("/specs")}
            />
          </>
        )}

        <div className="nav-section-label">HELP & ACCOUNT</div>
        <SidebarItem
          icon="▢"
          label="Guide"
          active={pathname === "/guide"}
          onClick={() => navigate("/guide")}
        />
        <SidebarItem
          icon="●"
          label="Profile"
          active={pathname === "/profile"}
          onClick={() => navigate("/profile")}
        />
        {!isMachinesPage && (
          <SidebarItem
            icon="⇄"
            label="Change Machine"
            active={false}
            onClick={() => navigate("/machines")}
          />
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="operator-card">
          <div className="operator-avatar">M</div>
          <div className="sidebar-footer-copy">
            <div className="operator-name">mayuresh</div>
            <div className="operator-role">CNC Operator</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`nav-item-btn ${active ? "active" : ""}`}
      onClick={onClick}
      title={label}
    >
      <span className="nav-icon-badge">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}