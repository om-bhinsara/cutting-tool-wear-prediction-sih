import StatusBadge from "./StatusBadge";

export default function ToolHealth({ score = 0, wear = null, status = "Awaiting analysis" }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const color = safe >= 70 ? "#1769e0" : safe >= 35 ? "#d97706" : "#dc2626";

  return (
    <div className="cad-panel">
      <div className="cad-panel-header">
        <div>
          <div className="panel-title">Tool health</div>
          <div className="panel-subtitle">Current condition</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="health-wrap">
        <div
          className="health-gauge"
          style={{ "--health": `${safe}%`, background: `conic-gradient(${color} ${safe}%, #e8eef6 0)` }}
        >
          <div className="health-gauge-content">
            <div className="health-value">{safe.toFixed(0)}%</div>
            <div className="health-caption">HEALTH</div>
          </div>
        </div>

        <div>
          <div className="section-kicker">Wear state</div>
          <div className="prediction-number" style={{ fontSize: 40 }}>
            {wear == null ? "—" : Number(wear).toFixed(1)}
          </div>
          <div className="prediction-unit">µm flank wear</div>
          <div className="health-scale">
            <span>0</span><span>100</span><span>200</span><span>300 µm</span>
          </div>
          <div className="mt-3">
            <div className="progress" style={{ height: 6, background: "#e8eef6" }}>
              <div style={{ width: `${Math.min((Number(wear) || 0) / 300 * 100, 100)}%`, background: color, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
