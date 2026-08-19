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
  const [activeTab, setActiveTab] = useState('predict'); // 'predict', 'specs', 'implementation'

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
    const saved = localStorage.getItem('cad_wear_progression');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [machiningCycle, setMachiningCycle] = useState(() => {
    const saved = localStorage.getItem('cad_wear_progression');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.length > 0 ? parsed[parsed.length - 1].cycle + 1 : 1;
    }
    return 1;
  });

  useEffect(() => {
    localStorage.setItem('cad_wear_progression', JSON.stringify(progressionHistory));
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

      // Append live measurement
      const currentCycle = parseInt(machiningCycle) || (progressionHistory.length + 1);
      const wearMm = parseFloat((data.wear_um / 1000).toFixed(4));
      
      const newPoint = {
        cycle: currentCycle,
        wear_um: data.wear_um,
        wear_mm: wearMm,
        status: data.status,
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
      localStorage.removeItem('cad_wear_progression');
    }
  };

  const exportCSV = () => {
    if (progressionHistory.length === 0) return;
    const headers = 'Machining_Cycle,Wear_um,Wear_mm,Health_Status,Timestamp\n';
    const rows = progressionHistory
      .map((p) => `${p.cycle},${p.wear_um},${p.wear_mm},"${p.status}",${p.timestamp}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `machining_wear_progression_report_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-vh-100 position-relative pb-5">
      {/* ================= CONSTANTLY LIVING MECHANICAL BACKGROUND ================= */}
      <div className="live-cad-bg">
        <div className="cad-scanline" />
        
        {/* Animated Mechanical Vector Gear 1 */}
        <svg className="gear-rot-cw" viewBox="0 0 100 100" fill="none" stroke="#0284c7" strokeWidth="1.2">
          <circle cx="50" cy="50" r="42" strokeDasharray="4 2" />
          <circle cx="50" cy="50" r="28" />
          <circle cx="50" cy="50" r="12" fill="#0284c7" fillOpacity="0.08" />
          <path d="M50 0 L50 10 M50 90 L50 100 M0 50 L10 50 M90 50 L100 50 M15 15 L22 22 M78 78 L85 85 M15 85 L22 78 M78 22 L85 15" strokeWidth="2.5" />
          <path d="M50 20 L50 80 M20 50 L80 50" strokeDasharray="2 3" stroke="#64748b" />
        </svg>

        {/* Animated Mechanical Vector Gear 2 */}
        <svg className="gear-rot-ccw" viewBox="0 0 100 100" fill="none" stroke="#334155" strokeWidth="1">
          <circle cx="50" cy="50" r="46" strokeDasharray="6 3" />
          <circle cx="50" cy="50" r="32" />
          <circle cx="50" cy="50" r="8" fill="#334155" fillOpacity="0.12" />
          <path d="M50 4 L50 12 M50 88 L50 96 M4 50 L12 50 M88 50 L96 50 M18 18 L24 24 M76 76 L82 82 M18 82 L24 76 M76 24 L82 18" strokeWidth="3" />
        </svg>
      </div>

      {/* Top Industrial Navbar */}
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
                  CAD/CAM MONITOR
                </span>
              </div>
              <div className="text-secondary font-mono" style={{ fontSize: '11px' }}>
                INDUSTRIAL FLANK WEAR DIAGNOSTICS
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="d-flex gap-2">
            {[
              { id: 'predict', label: 'Live Predict & Tracking', icon: 'bi-activity' },
              { id: 'specs', label: 'Tool & Machine Info', icon: 'bi-tools' },
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
        {/* ================= TAB 1: PREDICT & LIVE WEAR TRACKING ================= */}
        {activeTab === 'predict' && (
          <div>
            {/* Header Banner */}
            <div className="cad-panel mb-4 p-4 text-center">
              <div className="crosshair ch-tl" />
              <div className="crosshair ch-tr" />
              <div className="crosshair ch-bl" />
              <div className="crosshair ch-br" />

              <h2 className="fw-bold text-dark mb-1">
                Live Cutting Tool Wear Monitoring
              </h2>
              <p className="text-secondary font-mono small mb-0">
                Dual-Stream Neural Model • Active Checkpoint: <strong className="text-primary font-mono">image_sensor.pt</strong> • $R^2 = 0.9938$[cite: 1]
              </p>
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
                      <i className="bi bi-cpu-fill"></i> Model Inference Inputs
                    </span>
                    <span className="badge bg-primary bg-opacity-10 text-primary font-mono" style={{ fontSize: '10px' }}>
                      2 STREAMS
                    </span>
                  </div>

                  <div className="p-4">
                    <form onSubmit={handlePredict}>
                      {/* Image Input */}
                      <div className="mb-3">
                        <label className="form-label text-dark fw-semibold small d-flex justify-content-between mb-1">
                          <span>1. Tool Edge Image (RGB, 224×224 Crop)[cite: 1]</span>
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
                          <span>2. Sensor Signal (.npy format, 5×512)[cite: 1]</span>
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
                          <span>3. Next Machining Cycle #</span>
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
                            Evaluating Multimodal Sensors...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-plus-circle-fill"></i> Predict & Record Wear Point
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
                      <i className="bi bi-speedometer2"></i> Instant Wear Assessment
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

                          <div className="font-mono text-primary fw-bold mb-3">
                            [ {(result.wear_um / 1000).toFixed(4)} mm ]
                          </div>

                          <span className={`badge bg-${result.badge_color} px-3 py-2 fs-6 font-mono`}>
                            {result.status}
                          </span>

                          <div className="row g-2 text-start font-mono small text-secondary mt-4 pt-3 border-top">
                            <div className="col-6">Active Checkpoint:</div>
                            <div className="col-6 text-end text-primary fw-bold">{result.model_used}[cite: 1]</div>
                            <div className="col-6">Test $R^2$ Score:</div>
                            <div className="col-6 text-end text-success fw-bold">{result.metrics.test_r2}[cite: 1]</div>
                            <div className="col-6">Model Test MAE:</div>
                            <div className="col-6 text-end text-dark fw-bold">{result.metrics.test_mae_um} µm[cite: 1]</div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="text-center py-5 font-mono text-secondary my-auto">
                          <i className="bi bi-radar display-4 d-block text-muted mb-2 opacity-50"></i>
                          <div className="fw-bold text-dark mb-1">SYSTEM READY FOR INFERENCE</div>
                          <div className="small">Upload image/sensor to record cycle #{machiningCycle}.</div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="p-3 bg-light border-top font-mono small text-secondary d-flex justify-content-between align-items-center">
                    <span><i className="bi bi-shield-check text-primary me-2"></i>Multimodal Fusion: CNN-2D (96d) + CNN-1D (64d)[cite: 1]</span>
                    <span className="badge bg-secondary font-mono">160d Head</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============= STEP 3: LIVE WEAR PROGRESSION GRAPH ============= */}
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
                        <i className="bi bi-graph-up-arrow"></i> Step 3 — Show Wear Progression (Live Tracker)
                      </h5>
                      <p className="text-secondary font-mono small mb-0">
                        {progressionHistory.length > 0
                          ? `Currently plotting ${progressionHistory.length} real measurement point(s) recorded in this session.`
                          : 'No points recorded yet. Upload an image above and click "Predict & Record Wear Point" to begin live plotting.'}
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

                  {/* Wear vs Machining Cycles Graph matching engineering sketches */}
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
                            domain={[0, (max) => Math.max(0.25, parseFloat((max * 1.25).toFixed(2)))]}
                            label={{ value: 'Wear (mm) ↑', angle: -90, position: 'insideLeft', fill: '#1e293b', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(val) => [`${val} mm (${(val * 1000).toFixed(1)} µm)`, 'Flank Wear ($V_B$)']}
                            labelFormatter={(label) => `Machining Cycle: #${label}`}
                          />
                          {/* ISO 8688 Failure Threshold Reference Line */}
                          <ReferenceLine
                            y={0.2}
                            label={{ value: 'FAILURE LIMIT (0.20 mm / 200 µm)', fill: '#dc2626', fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 600, position: 'top' }}
                            stroke="#dc2626"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                          />
                          <ReferenceLine
                            y={0.08}
                            label={{ value: 'STEADY WEAR ZONE (0.08 mm)', fill: '#16a34a', fontSize: 11, fontFamily: 'JetBrains Mono', position: 'insideBottomLeft' }}
                            stroke="#16a34a"
                            strokeWidth={1.5}
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
                        <i className="bi bi-soundwave text-primary me-2"></i>5-CHANNEL HIGH-FREQUENCY SENSOR TELEMETRY[cite: 1]
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
                      <span className="text-dark fw-bold">Kistler 9257B ($F_x, F_y, F_z$)[cite: 1]</span>
                    </div>
                    <div className="d-flex justify-content-between py-2">
                      <span className="text-secondary">Acoustic Emission</span>
                      <span className="text-dark fw-bold">Kistler 8152B (100 kHz - 1 MHz)[cite: 1]</span>
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
                      <span className="text-dark fw-bold">CK45 Carbon Steel (~200 HB)[cite: 1]</span>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <span className="text-secondary">Workpiece Material 02</span>
                      <span className="text-dark fw-bold">RVS304 Austenitic Stainless Steel[cite: 1]</span>
                    </div>
                    <div className="d-flex justify-content-between py-2">
                      <span className="text-secondary">Critical Wear Standard</span>
                      <span className="text-danger fw-bold">$V_B \ge 0.20\text{ mm}$ (ISO 8688-2)</span>
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
                    <i className="bi bi-sliders text-primary me-2"></i>OPERATING PROCESS PARAMETERS[cite: 1]
                  </h5>
                  <div className="table-responsive">
                    <table className="table table-bordered font-mono small align-middle mb-0">
                      <thead className="table-light text-secondary">
                        <tr>
                          <th>Parameter</th>
                          <th>Symbol</th>
                          <th>Nominal Range</th>
                          <th>Dataset Mean ($\mu$)[cite: 1]</th>
                          <th>Std Dev ($\sigma$)[cite: 1]</th>
                          <th>Primary Failure Mode Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>Cutting Speed</td><td>$V_c$</td><td>130 - 160 m/min</td><td>146.29 m/min[cite: 1]</td><td>3.68[cite: 1]</td><td>Controls cutting zone temperature & diffusion wear</td></tr>
                        <tr><td>Spindle Speed</td><td>$n$</td><td>3,100 - 3,300 RPM</td><td>3,207.88 RPM[cite: 1]</td><td>20.64[cite: 1]</td><td>Influences tooth engagement frequency</td></tr>
                        <tr><td>Feed per Tooth</td><td>$f_z$</td><td>0.048 - 0.055 mm/tooth</td><td>0.051 mm/tooth[cite: 1]</td><td>0.0006[cite: 1]</td><td>Dictates mechanical shear stress & micro-chipping</td></tr>
                        <tr><td>Feed Rate</td><td>$V_f$</td><td>150 - 170 mm/min</td><td>160.96 mm/min[cite: 1]</td><td>2.52[cite: 1]</td><td>Determines cycle time & tool contact length</td></tr>
                        <tr><td>Radial Depth of Cut</td><td>$a_e$</td><td>0.98 - 1.02 mm</td><td>1.00 mm[cite: 1]</td><td>0.003[cite: 1]</td><td>Governs radial engagement & chip thickness</td></tr>
                        <tr><td>Axial Depth of Cut</td><td>$a_p$</td><td>0.80 - 0.85 mm</td><td>0.82 mm[cite: 1]</td><td>0.011[cite: 1]</td><td>Controls contact height along the flank face</td></tr>
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
                  <h4 className="fw-bold text-dark mb-4 mt-1">PyTorch Neural Architecture Benchmark Results[cite: 1]</h4>

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
                          <td className="text-primary">image_sensor.pt[cite: 1, 3]</td>
                          <td>Optical Flank Micrograph + 5-Ch Sensor Signals[cite: 1]</td>
                          <td>3.09 µm[cite: 1]</td>
                          <td>4.29 µm[cite: 1]</td>
                          <td>0.9938[cite: 1]</td>
                          <td><span className="badge bg-primary">ACTIVE DEPLOYED MODEL</span></td>
                        </tr>
                        <tr>
                          <td>full_multimodal.pt[cite: 1]</td>
                          <td>Image + 5-Ch Sensors + 7 Process Metadata Parameters[cite: 1]</td>
                          <td>4.12 µm[cite: 1]</td>
                          <td>5.88 µm[cite: 1]</td>
                          <td>0.9882[cite: 1]</td>
                          <td><span className="badge bg-secondary">EVALUATED</span></td>
                        </tr>
                        <tr>
                          <td>image_only.pt[cite: 1, 2]</td>
                          <td>Tool Flank Optical Edge Image Only[cite: 1]</td>
                          <td>11.45 µm[cite: 1]</td>
                          <td>14.82 µm[cite: 1]</td>
                          <td>0.9250[cite: 1]</td>
                          <td><span className="badge bg-light text-dark border">BASELINE</span></td>
                        </tr>
                        <tr>
                          <td>sensor_only.pt[cite: 1, 5]</td>
                          <td>5-Channel Force, Acoustic & Vibration Array[cite: 1]</td>
                          <td>8.92 µm[cite: 1]</td>
                          <td>11.74 µm[cite: 1]</td>
                          <td>0.9528[cite: 1]</td>
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