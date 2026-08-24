import React, { useState, useEffect } from "react";
import axios from "axios";
import ImagePanel from "../components/ImagePanel";

const API_BASE = "http://localhost:5000";

export default function ExplainableAI() {
  const activeMachineId = localStorage.getItem("active_machine_id") || "MCH-001";
  const activeMachineName = localStorage.getItem("active_machine_name") || "RFM760";

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/machines/${activeMachineId}/dashboard`)
      .then((res) => {
        if (res.data?.latest_result) {
          setResult(res.data.latest_result);
        } else {
          setResult(null);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [activeMachineId]);

  return (
    <div className="p-4">
      <div className="mb-4">
        <h4 className="fw-bold m-0">Why this prediction? ({activeMachineName})</h4>
        <span className="text-secondary small">Visual attention and cross-sensor agreement for {activeMachineId}</span>
      </div>

      {loading ? (
        <div>Loading explainability...</div>
      ) : result?.gradcam?.heatmap || result?.gradcam?.overlay ? (
        <ImagePanel result={result} />
      ) : (
        <div className="cad-panel text-center p-5">
          <div className="text-secondary">No analysis available for {activeMachineName} ({activeMachineId}).</div>
          <div className="small text-muted mt-1">Run an analysis from the Dashboard to generate Grad-CAM explanations.</div>
        </div>
      )}
    </div>
  );
}