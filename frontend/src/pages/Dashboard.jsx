import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import InferencePanel from "../components/InferencePanel";
import PredictionCard from "../components/PredictionCard";
import ToolHealth from "../components/ToolHealth";
import StatCard from "../components/StatCard";
import AlertBanner from "../components/AlertBanner";

const API_BASE = "http://localhost:5000";

export default function Dashboard() {
  const activeMachineId = localStorage.getItem("active_machine_id") || "MCH-001";
  const activeMachineName = localStorage.getItem("active_machine_name") || "RFM760";

  const [machine, setMachine] = useState({
    id: activeMachineId,
    name: activeMachineName,
    model_type: "High-Speed Machining Center",
    status: "Online",
  });

  const [image, setImage] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [pass, setPass] = useState("1");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [result, setResult] = useState(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const loadMachineDashboard = useCallback(async () => {
    setFetching(true);
    setErrorMsg("");
    try {
      const res = await axios.get(
        `${API_BASE}/api/machines/${activeMachineId}/dashboard`
      );
      if (res.data) {
        if (res.data.machine) setMachine(res.data.machine);
        setResult(res.data.latest_result || null);

        if (res.data.history) {
          setHistoryCount(res.data.history.length);
          if (res.data.history.length > 0) {
            const nextPass = res.data.history[res.data.history.length - 1].cycle + 1;
            setPass(String(Math.min(nextPass, 100)));
          }
        }
      }
    } catch (err) {
      console.error("Failed to load machine dashboard:", err);
      setErrorMsg("Could not load machine data. Ensure backend is running.");
    } finally {
      setFetching(false);
    }
  }, [activeMachineId]);

  useEffect(() => {
    loadMachineDashboard();
  }, [loadMachineDashboard]);

  const handleRunAnalysis = async () => {
    if (!image) {
      alert("Please select a tool micrograph image first.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("image", image);
      if (sensor) formData.append("sensor", sensor);
      formData.append("pass", pass);
      formData.append("machine_id", machine.id);
      formData.append("machine_name", machine.name);

      const res = await axios.post(`${API_BASE}/predict`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data) {
        setResult(res.data);
        setHistoryCount((prev) => prev + 1);
        setPass((prev) => String(Math.min(Number(prev) + 1, 100)));
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setErrorMsg(
        err.response?.data?.error || "Inference failed. Check backend logs."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-view p-3 p-md-4">
      {/* Header Context */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <h4 className="fw-bold m-0" style={{ color: "var(--text)" }}>
            {machine.name} Monitoring Workspace
          </h4>
          <span className="text-secondary small font-mono">
            ID: {machine.id} • {machine.model_type} • Status:{" "}
            <span className="text-success fw-semibold">{machine.status}</span>
          </span>
        </div>
        {fetching && (
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
        )}
      </div>

      {errorMsg && (
        <div className="alert alert-danger d-flex align-items-center mb-4 py-2 px-3 small" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Real-Time Vibration & Tool End-of-Life Alerts */}
      <AlertBanner alerts={result?.system_alerts} />

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="CURRENT FLANK WEAR"
            value={result?.wear_um != null ? `${Number(result.wear_um).toFixed(1)} µm` : "—"}
            foot={`Pass #${pass} targeted`}
            icon="bi-speedometer2"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="TOOL HEALTH"
            value={result?.health_score != null ? `${Number(result.health_score).toFixed(0)}%` : "—"}
            foot={result?.status || "Awaiting run"}
            icon="bi-heart-pulse"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="ESTIMATED RUL"
            value={result?.rul_passes != null ? `${result.rul_passes} passes` : "—"}
            foot="Remaining Useful Life"
            icon="bi-hourglass-split"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="ANALYSIS HISTORY"
            value={`${historyCount} cycles`}
            foot={`Isolated for ${machine.id}`}
            icon="bi-clock-history"
          />
        </div>
      </div>

      {/* Core Operational Panels */}
      <div className="row g-3">
        <div className="col-12 col-lg-5 col-xl-4">
          <InferencePanel
            image={image}
            sensor={sensor}
            pass={pass}
            setImage={setImage}
            setSensor={setSensor}
            setPass={setPass}
            onRun={handleRunAnalysis}
            loading={loading}
          />
        </div>
        <div className="col-12 col-md-6 col-lg-3 col-xl-4">
          <PredictionCard result={result} />
        </div>
        <div className="col-12 col-md-6 col-lg-4 col-xl-4">
          <ToolHealth
            score={result?.health_score}
            wear={result?.wear_um}
            status={result?.status}
          />
        </div>
      </div>
    </div>
  );
}