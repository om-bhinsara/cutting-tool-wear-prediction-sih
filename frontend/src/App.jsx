import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { runWearPrediction } from './services/api';

const CHANNEL_CONFIG = [
  { key: 'accel', name: 'Vibration Accel (g)', color: '#0284c7' },
  { key: 'acoustic', name: 'Acoustic Emission (AE)', color: '#d97706' },
  { key: 'Fx', name: 'Cutting Force Fx (N)', color: '#16a34a' },
  { key: 'Fy', name: 'Feed Force Fy (N)', color: '#7c3aed' },
  { key: 'Fz', name: 'Passive Force Fz (N)', color: '#dc2626' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('predict');

  // Form Inputs & Inference State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sensorFile, setSensorFile] = useState(null);
  const [sensorName, setSensorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [activeChannels, setActiveChannels] = useState(['accel', 'acoustic', 'Fx', 'Fy', 'Fz']);

  // Pure Live Wear Progression Tracking
  const [progressionHistory, setProgressionHistory] = useState(() => {
    const saved = localStorage.getItem('cad_wear_progression_v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [machiningCycle, setMachiningCycle] = useState(() => {
    const saved = localStorage.getItem('cad_wear_progression_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.length > 0 ? parsed[parsed.length - 1].cycle + 1 : 1;
    }
    return 1;
  });

  useEffect(() => {
    localStorage.setItem('cad_wear_progression_v2', JSON.stringify(progressionHistory));
  }, [progressionHistory]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSensorChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSensorFile(file);
      setSensorName(file.name);
    }
  };

  const toggleChannel = (key) => {
    setActiveChannels((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      setError('Please upload a microscope tool edge image.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('image', imageFile);
    if (sensorFile) {
      formData.append('sensor', sensorFile);
    }

    try {
      const data = await runWearPrediction(formData);
      setResult(data);

      const currentCycle = parseInt(machiningCycle) || (progressionHistory.length + 1);
      const wearMm = parseFloat((data.wear_um / 1000).toFixed(4));
      
      const newPoint = {
        cycle: currentCycle,
        wear_um: data.wear_um,
        wear_mm: wearMm,
        status: data.status,
        recommendation: data.recommendation,
        timestamp: new Date().toLocaleTimeString()
      };

      setProgressionHistory((prev) => [...prev, newPoint]);
      setMachiningCycle(currentCycle + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to Flask API server.');
    } finally {
      setLoading(false);
    }
  };

  const clearLiveTracking = () => {
    if (window.confirm('Reset all live tracked machining wear cycles?')) {
      setProgressionHistory([]);
      setMachiningCycle(1);
      localStorage.removeItem('cad_wear_progression_v2');
    }
  };

  const exportCSV = () => {
    if (progressionHistory.length === 0) return;
    const headers = 'Machining_Cycle,Wear_um,Wear_mm,Health_Status,Recommendation,Timestamp\n';
    const rows = progressionHistory
      .map((p) => `${p.cycle},${p.wear_um},${p.wear_mm},"${p.status}","${p.recommendation || ''}",${p.timestamp}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `machining_wear_report_${Date.now()}.csv`;
    a.click();
  };

  // Full Scale Calculation (0 to 350 µm Scale)
  const MAX_SCALE_UM = 350.0;
  const currentWear = result ? result.wear_um : (progressionHistory.length > 0 ? progressionHistory[progressionHistory.length - 1].wear_um : 0);
  const lifeConsumedPct = Math.min(100, Math.max(0, (currentWear / 300.0) * 100));
  const remainingLifePct = Math.max(0, 100 - lifeConsumedPct);

  // Compute wear trend
  let wearTrendText = '– Baseline Ready';
  let wearTrendColor = 'text-secondary';
  if (progressionHistory.length >= 2) {
    const prev = progressionHistory[progressionHistory.length - 2].wear_um;
    const diff = currentWear - prev;
    if (diff > 0.5) {
      wearTrendText = `↑ Increasing (+${diff.toFixed(1)} µm / cycle)`;
      wearTrendColor = 'text-danger';
    } else if (diff < -0.5) {
      wearTrendText = `↓ Decreasing (${diff.toFixed(1)} µm)`;
      wearTrendColor = 'text-success';
    } else {
      wearTrendText = '→ Steady / Stable';
      wearTrendColor = 'text-primary';
    }
  } else if (result) {
    wearTrendText = '↑ Active Measurement';
    wearTrendColor = 'text-primary';
  }

  // Estimated remaining cycles
  const avgWearRate = progressionHistory.length >= 2
    ? (progressionHistory[progressionHistory.length - 1].wear_um - progressionHistory[0].wear_um) / Math.max(1, (progressionHistory[progressionHistory.length - 1].cycle - progressionHistory[0].cycle))
    : 4.0;
  const estimatedRemainingCycles = Math.max(0, Math.round((300.0 - currentWear) / Math.max(0.1, avgWearRate)));

  return (
    <div className="min-vh-100 position-relative pb-5">
      {/* Living Mechanical Background */}
      <div className="live-cad-bg">
        <div className="cad-scanline" />
        <svg className="gear-rot-cw" viewBox="0 0 100 100" fill="none" stroke="#0284c7" strokeWidth="1.2">
          <circle cx="50" cy="50" r="42" strokeDasharray="4 2" />
          <circle cx="50" cy="50" r="28" />
          <circle cx="50" cy="50" r="12" fill="#0284c7" fillOpacity="0.08" />
          <path d="M50 0 L50 10 M50 90 L50 100 M0 50 L10 50 M90 50 L100 50 M15 15 L22 22 M78 78 L85 85 M15 85 L22 78 M78 22 L85 15" strokeWidth="2.5" />
          <path d="M50 20 L50 80 M20 50 L80 50" strokeDasharray="2 3" stroke="#64748b" />
        </svg>
        <svg className="gear-rot-ccw" viewBox="0 0 100 100" fill="none" stroke="#334155" strokeWidth="1">
          <circle cx="50" cy="50" r="46" strokeDasharray="6 3" />
          <circle cx="50" cy="50" r="32" />
          <circle cx="50" cy="50" r="8" fill="#334155" fillOpacity="0.12" />
          <path d="M50 4 L50 12 M50 88 L50 96 M4 50 L12 50 M88 50 L96 50 M18 18 L24 24 M76 76 L82 82 M18 82 L24 76 M76 24 L82 18" strokeWidth="3" />
        </svg>
      </div>

      {/* Industrial Header */}
      <header className="sticky-top border-bottom" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', borderColor: '#cbd5e1', zIndex: 50 }}>
        <div className="container d-flex flex-wrap justify-content-between align-items-center py-2" style={{ maxWidth: '1280px' }}>
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 rounded bg-primary text-white d-flex align-items-center justify-content-center shadow-sm" style={{ width: '38px', height: '38px' }}>
              <i className="bi bi-gear-wide-connected fs-5"></i>
            </div>
            <div>
              <div className="fw-bold text-dark fs-5 tracking-tight d-flex align-items-center gap-2">
                ToolWear.AI
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 font-mono" style={{ fontSize: '10px' }}>
                  PROGNOSTICS MONITOR
                </span>
              </div>
              <div className="text-secondary font-mono" style={{ fontSize: '11px' }}>
                4-STAGE TOOL HEALTH & REPLACEMENT RECOMMENDATION ENGINE
              </div>
            </div>
          </div>

          <div className="d-flex gap-2">
            {[
              { id: 'predict', label: 'Live Wear & Tool Life', icon: 'bi-activity' },
              { id: 'specs', label: 'Tool & Machine Specs', icon: 'bi-tools' },
              { id: 'implementation', label: 'Implementation Details', icon: 'bi-diagram-3-fill' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`btn btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2 rounded-2 ${
                  activeTab === tab.id
                    ? 'btn-primary text-white shadow-sm'
                    : 'btn-outline-secondary text-dark bg-white'
                }`}
                style={{ fontSize: '12px' }}
              >
                <i className={`bi ${tab.icon}`}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container position-relative py-4" style={{ maxWidth: '1280px', zIndex: 10 }}>
        {activeTab === 'predict' && (
          <div>
            {/* Header Banner */}
            <div className="cad-panel mb-4 p-4 text-center">
              <div className="crosshair ch-tl" />
              <div className="crosshair ch-tr" />
              <div className="crosshair ch-bl" />
              <div className="crosshair ch-br" />

              <h2 className="fw-bold text-dark mb-1">
                AI Tool Wear Progression & Digital Health Curve
              </h2>
              <p className="text-secondary font-mono small mb-0">
                Tracking 4 Degradation Stages: <strong>Healthy (0–100 µm)</strong> &bull; <strong>Moderate (100–200 µm)</strong> &bull; <strong>High (200–300 µm)</strong> &bull; <strong>Critical (&gt;300 µm)</strong>
              </p>
            </div>

            {/* ============= 1. AI WEAR PROGRESSION / DIGITAL WEAR CURVE ============= */}
            <div className="row mb-4">
              <div className="col-12">
                <div className="cad-panel p-4" style={{ background: '#0b111e', color: '#f8fafc', borderColor: '#1e293b' }}>
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom border-secondary border-opacity-25">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold fs-5 font-mono text-info">
                        1. AI Wear Progression / Digital Wear Curve
                      </span>
                      <span className="text-warning">★★★★★</span>
                    </div>

                    {/* Active Recommendation Banner */}
                    {result?.recommendation && (
                      <div className={`badge bg-${result.rec_type === 'danger' ? 'danger' : result.rec_type === 'warning' ? 'warning text-dark' : 'success'} font-mono px-3 py-2 fs-6 shadow`}>
                        <i className="bi bi-shield-exclamation me-1"></i> Recommendation: {result.recommendation}
                      </div>
                    )}
                  </div>

                  {/* Digital Linear Wear Gauge (0–350 µm Scale) */}
                  <div className="px-3 py-4 position-relative">
                    {/* Scale Reference Line */}
                    <div className="position-relative" style={{ height: '4px', background: '#334155', borderRadius: '2px', margin: '40px 0 55px 0' }}>
                      {/* Active Colored Progress Bar */}
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (currentWear / MAX_SCALE_UM) * 100)}%`,
                          background: currentWear > 300 ? '#ef4444' : currentWear > 200 ? '#f97316' : currentWear > 100 ? '#f59e0b' : '#10b981',
                          boxShadow: `0 0 14px ${currentWear > 300 ? '#ef4444' : currentWear > 200 ? '#f97316' : '#10b981'}`,
                          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      />

                      {/* Scale Ticks matching 0, 50, 100 (Moderate), 200 (High), 300 (Critical) */}
                      {[
                        { label: '0 µm (New)', pos: 0, tag: 'Healthy' },
                        { label: '50', pos: (50 / MAX_SCALE_UM) * 100, tag: '' },
                        { label: '100 µm', pos: (100 / MAX_SCALE_UM) * 100, tag: 'Moderate' },
                        { label: '200 µm', pos: (200 / MAX_SCALE_UM) * 100, tag: 'High' },
                        { label: '300 µm (Limit)', pos: (300 / MAX_SCALE_UM) * 100, tag: 'Critical' },
                      ].map((tick, idx) => (
                        <div
                          key={idx}
                          className="position-absolute text-center font-mono"
                          style={{ left: `${tick.pos}%`, transform: 'translateX(-50%)', top: '-30px' }}
                        >
                          <span style={{ fontSize: '11px', color: tick.pos >= (300 / MAX_SCALE_UM) * 100 ? '#ef4444' : tick.pos >= (200 / MAX_SCALE_UM) * 100 ? '#f97316' : '#94a3b8' }}>
                            {tick.label}
                          </span>
                          <div style={{ width: '6px', height: '6px', background: '#ffffff', borderRadius: '50%', margin: '6px auto 0 auto' }} />
                        </div>
                      ))}

                      {/* Animated Pointer Marker */}
                      {currentWear > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="position-absolute text-center font-mono"
                          style={{
                            left: `${Math.min(100, (currentWear / MAX_SCALE_UM) * 100)}%`,
                            transform: 'translateX(-50%)',
                            top: '-5px'
                          }}
                        >
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              background: currentWear > 300 ? '#ef4444' : currentWear > 200 ? '#f97316' : currentWear > 100 ? '#f59e0b' : '#10b981',
                              borderRadius: '50%',
                              border: '2px solid #ffffff',
                              boxShadow: '0 0 10px #ffffff',
                              margin: '0 auto'
                            }}
                          />
                          <div className="mt-2 text-nowrap">
                            <div className="small text-info fw-bold">↑</div>
                            <div className="badge bg-light text-dark font-mono px-2 py-1 shadow fw-bold" style={{ fontSize: '12px', border: '1px solid #00f2fe' }}>
                              Current: {currentWear.toFixed(1)} µm
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Telemetry Summary & Trend Row */}
                    <div className="row g-3 pt-2 font-mono small border-top border-secondary border-opacity-25 mt-4">
                      <div className="col-md-3">
                        <span className="text-secondary d-block">Wear trend:</span>
                        <span className={`fw-bold ${wearTrendColor}`}>{wearTrendText}</span>
                      </div>

                      <div className="col-md-3">
                        <span className="text-secondary d-block">Tool Life Consumed (0–300 µm):</span>
                        <span className="fw-bold text-light">{lifeConsumedPct.toFixed(1)}%</span>
                        <span className="text-muted ms-1">({remainingLifePct.toFixed(1)}% left)</span>
                      </div>

                      <div className="col-md-3">
                        <span className="text-secondary d-block">Est. Cycles Remaining:</span>
                        <span className={`fw-bold ${estimatedRemainingCycles <= 3 ? 'text-danger' : estimatedRemainingCycles <= 10 ? 'text-warning' : 'text-success'}`}>
                          ~{estimatedRemainingCycles} Machining Cycles
                        </span>
                      </div>

                      <div className="col-md-3">
                        <span className="text-secondary d-block">Health Stage Classification:</span>
                        <span className={`badge bg-${currentWear <= 100 ? 'success' : currentWear <= 200 ? 'warning' : currentWear <= 300 ? 'danger' : 'dark'} font-mono px-2 py-1`}>
                          {currentWear <= 100 ? 'Healthy (0–100 µm)' : currentWear <= 200 ? 'Moderate (100–200 µm)' : currentWear <= 300 ? 'High (200–300 µm)' : 'Critical (>300 µm)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Input & Output Row */}
            <div className="row g-4">
              {/* Form Input Column */}
              <div className="col-lg-5">
                <div className="cad-panel h-100">
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <div className="cad-panel-header d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-primary font-mono small d-flex align-items-center gap-2">
                      <i className="bi bi-sliders2-vertical"></i> Model Inference Inputs
                    </span>
                    <span className="badge bg-primary bg-opacity-10 text-primary font-mono" style={{ fontSize: '10px' }}>
                      2 MODALITIES
                    </span>
                  </div>

                  <div className="p-4">
                    <form onSubmit={handlePredict}>
                      {/* Image Input */}
                      <div className="mb-3">
                        <label className="form-label text-dark fw-semibold small d-flex justify-content-between mb-1">
                          <span>1. Tool Edge Image (RGB, 224×224)</span>
                          <span className="text-primary font-mono" style={{ fontSize: '11px' }}>Micrograph</span>
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="form-control cad-form-control form-control-sm"
                        />
                        {imagePreview && (
                          <div className="mt-2 p-2 bg-light border rounded text-center">
                            <img
                              src={imagePreview}
                              alt="Tool Edge"
                              className="img-fluid rounded border border-primary border-opacity-25"
                              style={{ maxHeight: '130px', objectFit: 'cover' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Sensor Telemetry Input */}
                      <div className="mb-3">
                        <label className="form-label text-dark fw-semibold small d-flex justify-content-between mb-1">
                          <span>2. Sensor Signal (.npy format, 5×512)</span>
                          <span className="text-primary font-mono" style={{ fontSize: '11px' }}>Telemetry</span>
                        </label>
                        <input
                          type="file"
                          accept=".npy"
                          onChange={handleSensorChange}
                          className="form-control cad-form-control form-control-sm"
                        />
                        <small className="text-muted d-block mt-1 font-mono" style={{ fontSize: '11px' }}>
                          {sensorName ? `Loaded: ${sensorName}` : 'Auto-pairs with matching .npy from sensors/ directory.'}
                        </small>
                      </div>

                      {/* Machining Pass Number */}
                      <div className="mb-4">
                        <label className="form-label text-dark fw-semibold small d-flex justify-content-between mb-1">
                          <span>3. Machining Cycle Sequence #</span>
                          <span className="text-primary font-mono fw-bold" style={{ fontSize: '11px' }}>Recorded cuts: {progressionHistory.length}</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={machiningCycle}
                          onChange={(e) => setMachiningCycle(parseInt(e.target.value) || 1)}
                          className="form-control cad-form-control form-control-sm font-mono"
                        />
                      </div>

                      {error && (
                        <div className="alert alert-danger py-2 small mb-3" role="alert">
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm font-mono"
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            Evaluating Grad-CAM & Prediction...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-lightning-charge-fill"></i> Predict & Record Progression
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Assessment Telemetry Column */}
              <div className="col-lg-7">
                <div className="cad-panel h-100 d-flex flex-column justify-content-between">
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <div className="cad-panel-header d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-primary font-mono small d-flex align-items-center gap-2">
                      <i className="bi bi-speedometer2"></i> Instant Wear Assessment & Action
                    </span>
                    <span className="badge bg-success bg-opacity-10 text-success font-mono" style={{ fontSize: '10px' }}>
                      ONLINE
                    </span>
                  </div>

                  <div className="p-4 flex-grow-1 d-flex flex-column justify-content-center">
                    <AnimatePresence mode="wait">
                      {result ? (
                        <motion.div
                          key="result-block"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="p-4 bg-white border rounded text-center my-auto shadow-sm"
                        >
                          <div className="font-mono text-muted small text-uppercase mb-1">
                            PREDICTED FLANK WEAR WIDTH ($V_B$)
                          </div>
                          
                          <div className="display-4 fw-bold font-mono text-dark mb-1">
                            {result.wear_um} <span className="fs-5 text-secondary">µm</span>
                          </div>

                          <div className="font-mono text-primary fw-bold mb-2">
                            [ {(result.wear_um / 1000).toFixed(4)} mm ]
                          </div>

                          <div className="d-flex justify-content-center gap-2 my-2">
                            <span className={`badge bg-${result.badge_color} px-3 py-2 fs-6 font-mono`}>
                              Status: {result.status}
                            </span>
                          </div>

                          {/* Recommendation Box */}
                          <div className={`p-2 px-3 mt-3 rounded border font-mono small ${result.rec_type === 'danger' ? 'bg-danger bg-opacity-10 border-danger text-danger' : result.rec_type === 'warning' ? 'bg-warning bg-opacity-10 border-warning text-dark' : 'bg-success bg-opacity-10 border-success text-success'}`}>
                            <strong>Action:</strong> {result.recommendation}
                          </div>

                          <div className="row g-2 text-start font-mono small text-secondary mt-3 pt-2 border-top">
                            <div className="col-6">Active Checkpoint:</div>
                            <div className="col-6 text-end text-primary fw-bold">{result.model_used}</div>
                            <div className="col-6">Test $R^2$ Score:</div>
                            <div className="col-6 text-end text-success fw-bold">{result.metrics.test_r2}</div>
                            <div className="col-6">Model Test MAE:</div>
                            <div className="col-6 text-end text-dark fw-bold">{result.metrics.test_mae_um} µm</div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="text-center py-5 font-mono text-secondary my-auto">
                          <i className="bi bi-radar display-4 d-block text-muted mb-2 opacity-50"></i>
                          <div className="fw-bold text-dark mb-1">SYSTEM READY FOR INFERENCE</div>
                          <div className="small">Upload microscope image and sensor telemetry to calculate tool life.</div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="p-3 bg-light border-top font-mono small text-secondary d-flex justify-content-between align-items-center">
                    <span><i className="bi bi-shield-check text-primary me-2"></i>Fusion: <code>ImageEncoder (96d)</code> + <code>SensorEncoder (64d)</code></span>
                    <span className="badge bg-secondary font-mono">160d Head</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============= LIVE GRAD-CAM EXPLAINABILITY VIEWER ============= */}
            {result?.gradcam && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="row mt-4"
              >
                <div className="col-12">
                  <div className="cad-panel p-4">
                    <div className="crosshair ch-tl" />
                    <div className="crosshair ch-tr" />
                    <div className="crosshair ch-bl" />
                    <div className="crosshair ch-br" />

                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                      <div>
                        <h5 className="fw-bold text-dark mb-1 font-mono d-flex align-items-center gap-2">
                          <i className="bi bi-eye-fill text-primary"></i> Grad-CAM Visual Explainability (Layer: Conv2d net[9])
                        </h5>
                        <p className="text-secondary font-mono small mb-0">
                          Highlights regions of maximum neural network gradient activation determining the flank wear prediction.
                        </p>
                      </div>
                      <span className="badge bg-primary font-mono">128 Feature Channels</span>
                    </div>

                    <div className="row g-4 text-center">
                      <div className="col-md-4">
                        <div className="p-3 bg-light border rounded">
                          <span className="font-mono small fw-bold text-secondary d-block mb-2">Original Optical Micrograph</span>
                          {imagePreview && (
                            <img src={imagePreview} alt="Original Micrograph" className="img-fluid rounded border shadow-sm" style={{ maxHeight: '224px' }} />
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="p-3 bg-light border rounded">
                          <span className="font-mono small fw-bold text-primary d-block mb-2">Grad-CAM Heatmap Activation</span>
                          <img src={result.gradcam.heatmap} alt="Grad-CAM Heatmap" className="img-fluid rounded border shadow-sm" style={{ maxHeight: '224px' }} />
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="p-3 bg-light border rounded">
                          <span className="font-mono small fw-bold text-danger d-block mb-2">Tool Edge Overlay ($\alpha = 0.45$)</span>
                          <img src={result.gradcam.overlay} alt="Grad-CAM Overlay" className="img-fluid rounded border shadow-sm" style={{ maxHeight: '224px' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ============= STEP 3: LIVE WEAR PROGRESSION GRAPH (Measurement -> Wear -> Time) ============= */}
            <div className="row mt-4">
              <div className="col-12">
                <div className="cad-panel p-4">
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div>
                      <h5 className="fw-bold text-primary mb-1 font-mono d-flex align-items-center gap-2">
                        <i className="bi bi-graph-up-arrow"></i> Measurement $\rightarrow$ Wear $\rightarrow$ Time Trajectory
                      </h5>
                      <p className="text-secondary font-mono small mb-0">
                        {progressionHistory.length > 0
                          ? `Plotting ${progressionHistory.length} real wear point(s) tracked over machining sequence.`
                          : 'No points recorded yet. Upload an image above and click "Predict & Record Progression" to begin plotting.'}
                      </p>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        onClick={exportCSV}
                        disabled={progressionHistory.length === 0}
                        className="btn btn-sm btn-outline-primary font-mono d-flex align-items-center gap-1"
                      >
                        <i className="bi bi-download"></i> Export CSV
                      </button>
                      <button
                        onClick={clearLiveTracking}
                        disabled={progressionHistory.length === 0}
                        className="btn btn-sm btn-outline-danger font-mono d-flex align-items-center gap-1"
                      >
                        <i className="bi bi-trash3"></i> Clear Points
                      </button>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 350, background: '#ffffff', padding: '16px 12px 6px 0', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    {progressionHistory.length > 0 ? (
                      <ResponsiveContainer>
                        <LineChart data={progressionHistory} margin={{ top: 20, right: 30, left: 15, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="cycle"
                            stroke="#64748b"
                            tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                            label={{ value: 'Machining cycles →', position: 'insideBottom', offset: -10, fill: '#1e293b', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }}
                          />
                          <YAxis
                            stroke="#64748b"
                            tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                            domain={[0, (max) => Math.max(0.35, parseFloat((max * 1.2).toFixed(2)))]}
                            label={{ value: 'Wear (mm) ↑', angle: -90, position: 'insideLeft', fill: '#1e293b', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(val, name, item) => [`${val} mm (${(val * 1000).toFixed(1)} µm) - [${item.payload.status}]`, 'Tool Flank Wear']}
                            labelFormatter={(label) => `Machining Cycle: #${label}`}
                          />
                          {/* 4-Tier Health Threshold Lines */}
                          <ReferenceLine
                            y={0.3}
                            label={{ value: 'CRITICAL LIMIT (0.30 mm / 300 µm)', fill: '#dc2626', fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 600, position: 'top' }}
                            stroke="#dc2626"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                          />
                          <ReferenceLine
                            y={0.2}
                            label={{ value: 'HIGH WEAR ZONE (0.20 mm / 200 µm)', fill: '#ea580c', fontSize: 10, fontFamily: 'JetBrains Mono', position: 'top' }}
                            stroke="#ea580c"
                            strokeWidth={1.2}
                            strokeDasharray="3 3"
                          />
                          <ReferenceLine
                            y={0.1}
                            label={{ value: 'MODERATE WEAR ZONE (0.10 mm / 100 µm)', fill: '#d97706', fontSize: 10, fontFamily: 'JetBrains Mono', position: 'insideBottomLeft' }}
                            stroke="#d97706"
                            strokeWidth={1.2}
                            strokeDasharray="3 3"
                          />
                          <Line
                            type="monotone"
                            dataKey="wear_mm"
                            stroke="#0284c7"
                            strokeWidth={2.5}
                            dot={{ r: 6, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                            activeDot={{ r: 8, fill: '#0369a1' }}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted font-mono small">
                        <i className="bi bi-graph-up-arrow fs-2 text-primary opacity-50 mb-2"></i>
                        <div className="fw-semibold text-dark">Live wear progression graph is ready.</div>
                        <div className="text-secondary">Execute your first prediction above to plot Cycle #1.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 5-Channel Sensor Waveform Viewer */}
            {result?.sensor_waveforms && (
              <div className="row mt-4">
                <div className="col-12">
                  <div className="cad-panel p-4">
                    <div className="crosshair ch-tl" />
                    <div className="crosshair ch-tr" />
                    <div className="crosshair ch-bl" />
                    <div className="crosshair ch-br" />

                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
                      <span className="font-mono text-dark fw-bold small">
                        <i className="bi bi-soundwave text-primary me-2"></i>5-CHANNEL HIGH-FREQUENCY SENSOR TELEMETRY
                      </span>

                      <div className="d-flex flex-wrap gap-2">
                        {CHANNEL_CONFIG.map((ch) => (
                          <button
                            key={ch.key}
                            type="button"
                            onClick={() => toggleChannel(ch.key)}
                            className={`btn btn-sm font-mono ${
                              activeChannels.includes(ch.key)
                                ? 'btn-dark text-white fw-semibold'
                                : 'btn-light text-muted border'
                            }`}
                            style={{ fontSize: '11px' }}
                          >
                            <span style={{ color: ch.color, marginRight: '4px' }}>●</span>
                            {ch.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ width: '100%', height: 280, background: '#ffffff', padding: '16px 12px 6px 0', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <ResponsiveContainer>
                        <LineChart data={result.sensor_waveforms} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="t" stroke="#94a3b8" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                          <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
                          <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '11px', paddingTop: '10px' }} />
                          {CHANNEL_CONFIG.map(
                            (ch) =>
                              activeChannels.includes(ch.key) && (
                                <Line
                                  key={ch.key}
                                  type="monotone"
                                  dataKey={ch.key}
                                  name={ch.name}
                                  stroke={ch.color}
                                  strokeWidth={1.6}
                                  dot={false}
                                />
                              )
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: TOOL & MACHINE SPECS ================= */}
        {activeTab === 'specs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="row g-4">
              <div className="col-md-6">
                <div className="cad-panel p-4 h-100">
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <span className="font-mono text-primary small fw-semibold">// MACHINE SPECIFICATION</span>
                  <h4 className="fw-bold text-dark mb-4 mt-1">3-Axis CNC Machining Center</h4>
                  
                  <div className="font-mono small">
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Machine Center Type</span>
                      <span className="text-dark fw-bold">Vertical CNC High-Speed Center</span>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Spindle Drive Power</span>
                      <span className="text-dark fw-bold">15 kW Direct Drive</span>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Max Spindle Speed ($n$)</span>
                      <span className="text-dark fw-bold">6,000 RPM</span>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Dynamometer Sensor</span>
                      <span className="text-dark fw-bold">Kistler 9257B ($F_x, F_y, F_z$)</span>
                    </div>
                    <div className="d-flex justify-content-between py-2">
                      <span className="text-secondary">Acoustic Emission</span>
                      <span className="text-dark fw-bold">Kistler 8152B (100 kHz - 1 MHz)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="cad-panel p-4 h-100">
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <span className="font-mono text-primary small fw-semibold">// TOOLING & METALLURGY</span>
                  <h4 className="fw-bold text-dark mb-4 mt-1">Tool Insert & Workpiece Materials</h4>
                  
                  <div className="font-mono small">
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Insert Substrate</span>
                      <span className="text-dark fw-bold">TiAlN Coated Tungsten Carbide</span>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Rake Angle ($\gamma$)</span>
                      <span className="text-dark fw-bold">+6° Positive</span>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Workpiece Material 01</span>
                      <span className="text-dark fw-bold">CK45 Carbon Steel (~200 HB)</span>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Workpiece Material 02</span>
                      <span className="text-dark fw-bold">RVS304 Austenitic Stainless Steel</span>
                    </div>
                    <div className="d-flex justify-content-between py-2">
                      <span className="text-secondary">Critical Wear Standard</span>
                      <span className="text-danger fw-bold">$V_B \ge 0.30\text{ mm}$ (Critical Limit)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Process Parameters */}
              <div className="col-12">
                <div className="cad-panel p-4">
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <h5 className="fw-bold text-dark mb-3 font-mono">
                    <i className="bi bi-sliders text-primary me-2"></i>OPERATING PROCESS PARAMETERS
                  </h5>
                  <div className="table-responsive">
                    <table className="table table-bordered font-mono small align-middle mb-0">
                      <thead className="table-light text-secondary">
                        <tr>
                          <th>Parameter</th>
                          <th>Symbol</th>
                          <th>Nominal Range</th>
                          <th>Dataset Mean ($\mu$)</th>
                          <th>Std Dev ($\sigma$)</th>
                          <th>Primary Failure Mode Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>Cutting Speed</td><td>$V_c$</td><td>130 - 160 m/min</td><td>146.29 m/min</td><td>3.68</td><td>Controls cutting zone temperature & diffusion wear</td></tr>
                        <tr><td>Spindle Speed</td><td>$n$</td><td>3,100 - 3,300 RPM</td><td>3,207.88 RPM</td><td>20.64</td><td>Influences tooth engagement frequency</td></tr>
                        <tr><td>Feed per Tooth</td><td>$f_z$</td><td>0.048 - 0.055 mm/tooth</td><td>0.051 mm/tooth</td><td>0.0006</td><td>Dictates mechanical shear stress & micro-chipping</td></tr>
                        <tr><td>Feed Rate</td><td>$V_f$</td><td>150 - 170 mm/min</td><td>160.96 mm/min</td><td>2.52</td><td>Determines cycle time & tool contact length</td></tr>
                        <tr><td>Radial Depth of Cut</td><td>$a_e$</td><td>0.98 - 1.02 mm</td><td>1.00 mm</td><td>0.003</td><td>Governs radial engagement & chip thickness</td></tr>
                        <tr><td>Axial Depth of Cut</td><td>$a_p$</td><td>0.80 - 0.85 mm</td><td>0.82 mm</td><td>0.011</td><td>Controls contact height along the flank face</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= TAB 3: IMPLEMENTATION DETAILS ================= */}
        {activeTab === 'implementation' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="row g-4">
              <div className="col-12">
                <div className="cad-panel p-4">
                  <div className="crosshair ch-tl" />
                  <div className="crosshair ch-tr" />
                  <div className="crosshair ch-bl" />
                  <div className="crosshair ch-br" />

                  <span className="font-mono text-primary small fw-semibold">// MODEL ABLATION STUDY</span>
                  <h4 className="fw-bold text-dark mb-4 mt-1">PyTorch Neural Architecture Benchmark Results</h4>

                  <div className="table-responsive">
                    <table className="table table-bordered font-mono small align-middle mb-0">
                      <thead className="table-light text-secondary">
                        <tr>
                          <th>EXPERIMENT MODEL</th>
                          <th>INPUT MODALITIES</th>
                          <th>TEST MAE</th>
                          <th>TEST RMSE</th>
                          <th>$R^2$ SCORE</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="table-primary fw-bold">
                          <td className="text-primary">image_sensor.pt</td>
                          <td>Optical Flank Micrograph + 5-Ch Sensor Signals</td>
                          <td>3.09 µm</td>
                          <td>4.29 µm</td>
                          <td>0.9938</td>
                          <td><span className="badge bg-primary">ACTIVE DEPLOYED MODEL</span></td>
                        </tr>
                        <tr>
                          <td>full_multimodal.pt</td>
                          <td>Image + 5-Ch Sensors + 7 Process Metadata Parameters</td>
                          <td>4.12 µm</td>
                          <td>5.88 µm</td>
                          <td>0.9882</td>
                          <td><span className="badge bg-secondary">EVALUATED</span></td>
                        </tr>
                        <tr>
                          <td>image_only.pt</td>
                          <td>Tool Flank Optical Edge Image Only</td>
                          <td>11.45 µm</td>
                          <td>14.82 µm</td>
                          <td>0.9250</td>
                          <td><span className="badge bg-light text-dark border">BASELINE</span></td>
                        </tr>
                        <tr>
                          <td>sensor_only.pt</td>
                          <td>5-Channel Force, Acoustic & Vibration Array</td>
                          <td>8.92 µm</td>
                          <td>11.74 µm</td>
                          <td>0.9528</td>
                          <td><span className="badge bg-light text-dark border">BASELINE</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}