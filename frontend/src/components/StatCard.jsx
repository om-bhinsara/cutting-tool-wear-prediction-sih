export default function StatCard({ label, value, foot, icon }) {
  return (
    <div className="cad-panel stat-card">
      <div className="d-flex justify-content-between align-items-start">
        <div className="stat-label">{label}</div>
        {icon && <i className={`bi ${icon}`} style={{ color: "var(--primary)", fontSize: 16 }} />}
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}
