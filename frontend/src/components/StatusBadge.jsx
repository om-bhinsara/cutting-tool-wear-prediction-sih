export default function StatusBadge({ status = "Healthy" }) {
  const value = String(status).toLowerCase();
  let cls = "status-healthy";
  if (value.includes("critical")) cls = "status-critical";
  else if (value.includes("warning") || value.includes("high")) cls = "status-warning";
  else if (value.includes("moderate")) cls = "status-moderate";

  return <span className={`status-badge ${cls}`}>{status}</span>;
}
