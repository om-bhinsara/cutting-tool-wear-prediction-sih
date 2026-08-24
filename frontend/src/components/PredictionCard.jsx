import StatusBadge from "./StatusBadge";

export default function PredictionCard({ result }) {
  const wear = result?.wear_um;
  const status = result?.status || "Awaiting analysis";
  const health = result?.health_score;
  const recommendation = result?.recommendation;

  return (
    <div className="cad-panel prediction-card h-100">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="section-kicker">Latest assessment</div>
          <div className="prediction-number">{wear == null ? "—" : Number(wear).toFixed(1)}</div>
          <div className="prediction-unit">µm flank wear</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="prediction-meta">
        {health != null && <div className="meta-chip">Health {Number(health).toFixed(0)}%</div>}
        {result?.confidence != null && <div className="meta-chip">Confidence {Number(result.confidence).toFixed(1)}%</div>}
        {result?.agreement != null && <div className="meta-chip">Agreement {Number(result.agreement).toFixed(1)}%</div>}
      </div>

      <div className="mt-4 pt-3 border-top">
        <div className="panel-subtitle">Recommendation</div>
        <div className="mt-1 fw-bold" style={{ fontSize: 13, color: "var(--text)" }}>
          {recommendation || "Run an analysis to receive a maintenance recommendation."}
        </div>
      </div>
    </div>
  );
}
