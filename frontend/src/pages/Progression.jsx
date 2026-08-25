import React, { useState, useEffect } from "react";
import axios from "axios";
import WearChart from "../components/WearChart";
import StatCard from "../components/StatCard";

const API_BASE = "http://localhost:5000";

export default function Progression() {
  const activeMachineId = localStorage.getItem("active_machine_id") || "MCH-001";
  const activeMachineName = localStorage.getItem("active_machine_name") || "RFM760";

  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/machines/${activeMachineId}/dashboard`)
      .then((res) => {
        if (res.data) {
          setHistory(res.data.history || []);
          setLatest(res.data.latest_result || null);
        }
      })
      .catch((err) => console.error(err));
  }, [activeMachineId]);

  const wearRate = history.length > 1
    ? ((history[history.length - 1].wear_um - history[0].wear_um) / (history.length - 1)).toFixed(2)
    : "0.0";

  return (
    <div className="p-4">
      <div className="mb-4">
        <h4 className="fw-bold m-0">Wear Progression ({activeMachineName})</h4>
        <span className="text-secondary small">Track degradation and estimate remaining machining life for {activeMachineId}</span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="CURRENT WEAR"
            value={latest?.wear_um != null ? `${latest.wear_um} µm` : "—"}
            foot={latest?.status || "Awaiting run"}
            icon="bi-speedometer2"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="WEAR RATE"
            value={`${wearRate} µm/pass`}
            foot="Average wear increment"
            icon="bi-graph-up-arrow"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="RUL"
            value={latest?.rul_passes != null ? `${latest.rul_passes} passes` : "—"}
            foot="Passes to 300 µm limit"
            icon="bi-hourglass-split"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="PASSES LOGGED"
            value={`${history.length}`}
            foot={`Logged for ${activeMachineId}`}
            icon="bi-clock-history"
          />
        </div>
      </div>

      <div className="cad-panel">
        <WearChart history={history} />
      </div>
    </div>
  );
}