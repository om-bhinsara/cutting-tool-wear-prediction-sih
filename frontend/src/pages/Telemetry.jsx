import React, { useState, useEffect } from "react";
import axios from "axios";
import TelemetryChart from "../components/TelemetryChart";
import StatCard from "../components/StatCard";

const API_BASE = "http://localhost:5000";

export default function Telemetry() {
  const activeMachineId = localStorage.getItem("active_machine_id") || "MCH-001";
  const activeMachineName = localStorage.getItem("active_machine_name") || "RFM760";

  const [telemetry, setTelemetry] = useState([]);
  const [quality, setQuality] = useState(null);
  const [activeChannel, setActiveChannel] = useState("fx");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE}/api/machines/${activeMachineId}/dashboard`)
      .then((res) => {
        if (res.data) {
          setTelemetry(res.data.sensor_waveforms || []);
          setQuality(res.data.sensor_quality || null);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [activeMachineId]);

  const channelButtons = [
    { id: "fx", label: "Fx Cutting Force", short: "Fx" },
    { id: "fy", label: "Fy Feed Force", short: "Fy" },
    { id: "fz", label: "Fz Passive Force", short: "Fz" },
    { id: "vibration", label: "Vibration Accel", short: "Vib" },
    { id: "ae", label: "Acoustic Emission", short: "AE" },
  ];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 mb-1 font-mono text-uppercase">
            Real-time Telemetry
          </span>
          <h4 className="fw-bold m-0 text-dark">
            Sensor Telemetry ({activeMachineName})
          </h4>
          <span className="text-secondary small">
            High-frequency multi-channel sensor dynamics for machine <strong className="text-dark">{activeMachineId}</strong>
          </span>
        </div>
        <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
          <span className="online-dot bg-success d-inline-block rounded-circle me-1" style={{ width: 8, height: 8 }} />
          Sensors Active
        </span>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="SIGNAL QUALITY"
            value={quality?.valid ? "Optimal Signal" : quality?.status || "—"}
            foot={quality?.valid ? "High SNR (5 Channels)" : "Check wiring/data"}
            icon="bi-shield-check"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="ACTIVE CHANNELS"
            value="5 / 5"
            foot="Fx · Fy · Fz · Vib · AE"
            icon="bi-activity"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="SAMPLING WINDOW"
            value="512"
            foot="samples / channel"
            icon="bi-cpu"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="SIGNAL CONFIDENCE"
            value={quality?.confidence != null ? `${Number(quality.confidence).toFixed(1)}%` : "—"}
            foot="Noise & integrity score"
            icon="bi-check-circle"
          />
        </div>
      </div>

      {/* Waveform Card */}
      <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3 border-bottom pb-3">
          <div>
            <h5 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
              <i className="bi bi-graph-up-arrow text-primary" /> Waveform Visualizer
            </h5>
            <div className="text-muted small">
              Displaying synchronized high-speed telemetry waveforms
            </div>
          </div>

          <div className="btn-group p-1 bg-light rounded-pill border">
            {channelButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 font-mono transition-all ${
                  activeChannel === btn.id
                    ? "btn-primary shadow-sm fw-semibold"
                    : "btn-light text-secondary border-0"
                }`}
                onClick={() => setActiveChannel(btn.id)}
              >
                {btn.short}
              </button>
            ))}
          </div>
        </div>

        <div style={{ minHeight: 400, width: "100%" }}>
          {loading ? (
            <div className="d-flex justify-content-center align-items-center h-100 py-5 text-secondary">
              <div className="spinner-border spinner-border-sm me-2 text-primary" />
              <span>Loading telemetry waveforms...</span>
            </div>
          ) : (
            <TelemetryChart telemetry={telemetry} activeChannel={activeChannel} />
          )}
        </div>
      </div>
    </div>
  );
}