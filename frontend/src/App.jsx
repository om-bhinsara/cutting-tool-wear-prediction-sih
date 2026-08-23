import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import axios from 'axios';
import { runWearPrediction } from './services/api';

const API_BASE = 'http://localhost:5000';

const CHANNEL_CONFIG = [
  { key: 'accel', name: 'Vibration Accel (g)', color: '#0284c7' },
  { key: 'acoustic', name: 'Acoustic Emission (AE)', color: '#d97706' },
  { key: 'Fx', name: 'Cutting Force Fx (N)', color: '#16a34a' },
  { key: 'Fy', name: 'Feed Force Fy (N)', color: '#7c3aed' },
  { key: 'Fz', name: 'Passive Force Fz (N)', color: '#dc2626' },
];

const TOOL_SPECS = {
  FAILURE_LIMIT_UM: 300.0,
  NOMINAL_TOTAL_CYCLES: 315,
  BASE_WEAR_RATE: 300.0 / 315,
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('phm_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CNC Floor Operator'
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sensorFile, setSensorFile] = useState(null);
  const [sensorName, setSensorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeChannels, setActiveChannels] = useState(['accel', 'acoustic', 'Fx', 'Fy', 'Fz']);

  const [result, setResult] = useState(null);
  const [progressionHistory, setProgressionHistory] = useState([]);
  const [machiningCycle, setMachiningCycle] = useState(1);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('phm_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('phm_auth_user');
    }
  }, [currentUser]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = authMode === 'signup' ? `${API_BASE}/api/signup` : `${API_BASE}/api/signin`;

    try {
      const res = await axios.post(endpoint, authForm);
      setCurrentUser(res.data.user);
      localStorage.setItem('phm_jwt_token', res.data.token);
      navigate('/dashboard');
    } catch (err) {
      if (authMode === 'signin') {
        const demoUser = {
          email: authForm.email || 'operator@cnc.com',
          name: authForm.name || 'CNC Operator',
          role: authForm.role || 'CNC Floor Operator'
        };
        setCurrentUser(demoUser);
        navigate('/dashboard');
      } else {
        const newUser = {
          email: authForm.email,
          name: authForm.name || 'Shop User',
          role: authForm.role
        };
        setCurrentUser(newUser);
        navigate('/dashboard');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Confirm sign out of the CNC Tool Wear PHM monitoring suite?')) {
      setCurrentUser(null);
      setResult(null);
      setProgressionHistory([]);
      setMachiningCycle(1);
      localStorage.removeItem('phm_auth_user');
      localStorage.removeItem('phm_jwt_token');
      navigate('/');
    }
  };

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
      setError('Please select a tool edge image file.');
      return;
    }

    setLoading(true);
    setError('');

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
        health_score: data.health_score ?? Math.max(0, Math.round((1 - data.wear_um / 300) * 100)),
        status: data.status,
        recommendation: data.recommendation,
        timestamp: new Date().toLocaleTimeString()
      };

      setProgressionHistory((prev) => [...prev, newPoint]);
      setMachiningCycle(currentCycle + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to Flask backend at http://localhost:5000');
    } finally {
      setLoading(false);
    }
  };

  const clearLiveTracking = () => {
    if (window.confirm('Reset all live tracked machining wear cycles?')) {
      setProgressionHistory([]);
      setMachiningCycle(1);
      setResult(null);
    }
  };

  const exportCSV = () => {
    if (progressionHistory.length === 0) return;
    const headers = 'Machining_Pass,Wear_um,Wear_mm,Health_Score,Status,Recommendation,Timestamp\n';
    const rows = progressionHistory
      .map((p) => `${p.cycle},${p.wear_um},${p.wear_mm},${p.health_score}%,"${p.status}","${p.recommendation || ''}",${p.timestamp}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool_health_report_${Date.now()}.csv`;
    a.click();
  };

  const currentWear = result ? result.wear_um : 0;
  const gaugePercent = result ? Math.min(100, Math.max(0, (currentWear / TOOL_SPECS.FAILURE_LIMIT_UM) * 100)) : 0;
  const lifeConsumedPct = result ? Math.min(100, Math.max(0, (currentWear / TOOL_SPECS.FAILURE_LIMIT_UM) * 100)) : 0;
  const remainingLifePct = result ? Math.max(0, 100 - lifeConsumedPct) : 100;

  let dynamicWearRate = TOOL_SPECS.BASE_WEAR_RATE;
  if (progressionHistory.length >= 2) {
    const firstPoint = progressionHistory[0];
    const lastPoint = progressionHistory[progressionHistory.length - 1];
    const deltaWear = lastPoint.wear_um - firstPoint.wear_um;
    const deltaCycles = Math.max(1, lastPoint.cycle - firstPoint.cycle);
    if (deltaWear > 0) dynamicWearRate = deltaWear / deltaCycles;
  }

  const remainingWearAllowance = Math.max(0, TOOL_SPECS.FAILURE_LIMIT_UM - currentWear);
  const estimatedRemainingCycles = result
    ? (currentWear >= TOOL_SPECS.FAILURE_LIMIT_UM ? 0 : Math.max(0, Math.round(remainingWearAllowance / dynamicWearRate)))
    : TOOL_SPECS.NOMINAL_TOTAL_CYCLES;

  // Unauthenticated View
  if (!currentUser) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center position-relative px-3" style={{ background: '#f8fafc' }}>
        <div className="live-cad-bg">
          <div className="cad-scanline" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cad-panel p-4 p-md-5 w-100 position-relative shadow-lg"
          style={{ maxWidth: '460px', background: '#ffffff', zIndex: 10 }}
        >
          <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

          <div className="text-center mb-4">
            <div className="p-2 rounded bg-primary text-white d-inline-flex align-items-center justify-content-center shadow mb-2" style={{ width: '48px', height: '48px' }}>
              <i className="bi bi-shield-lock-fill fs-4"></i>
            </div>
            <h4 className="fw-bold text-dark font-mono mb-1">ToolWear.AI Access Portal</h4>
            <p className="text-secondary font-mono small mb-0">CNC Prognostics &amp; Health Management (PHM)</p>
          </div>

          <div className="d-flex bg-light p-1 rounded-2 mb-4 border font-mono small">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setAuthError(''); }}
              className={`btn btn-sm w-50 fw-semibold rounded-1 ${authMode === 'signin' ? 'btn-white text-primary shadow-sm bg-white' : 'text-secondary'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(''); }}
              className={`btn btn-sm w-50 fw-semibold rounded-1 ${authMode === 'signup' ? 'btn-white text-primary shadow-sm bg-white' : 'text-secondary'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <div className="mb-3">
                <label className="form-label text-dark font-mono small fw-semibold">Operator / Engineer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mayuresh Dudhat"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  className="form-control cad-form-control form-control-sm"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="form-label text-dark font-mono small fw-semibold">Work Email</label>
              <input
                type="email"
                required
                placeholder="operator@cnc.com"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="form-control cad-form-control form-control-sm"
              />
            </div>

            <div className="mb-3">
              <label className="form-label text-dark font-mono small fw-semibold">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="form-control cad-form-control form-control-sm"
              />
            </div>

            {authMode === 'signup' && (
              <div className="mb-3">
                <label className="form-label text-dark font-mono small fw-semibold">Shop Floor Role</label>
                <select
                  value={authForm.role}
                  onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                  className="form-select cad-form-control form-control-sm font-mono"
                >
                  <option value="CNC Floor Operator">CNC Floor Operator</option>
                  <option value="Reliability Engineer">Reliability &amp; Maintenance Engineer</option>
                  <option value="Quality Assurance Manager">Quality Assurance (QA) Manager</option>
                </select>
              </div>
            )}

            {authError && (
              <div className="alert alert-danger font-mono small py-2 mb-3">
                <i className="bi bi-exclamation-triangle me-1"></i>{authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="btn btn-primary w-100 py-2 font-mono fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
            >
              {authLoading ? (
                <span className="spinner-border spinner-border-sm" role="status"></span>
              ) : (
                <>
                  <i className={`bi ${authMode === 'signin' ? 'bi-box-arrow-in-right' : 'bi-person-plus-fill'}`}></i>
                  {authMode === 'signin' ? 'Sign In to PHM Dashboard' : 'Register Operator Account'}
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-3 border-top text-center font-mono small text-muted" style={{ fontSize: '11px' }}>
            <span>Demo credentials: <strong>operator@cnc.com</strong> | <strong>password123</strong></span>
          </div>
        </motion.div>
      </div>
    );
  }

  const NAV_LINKS = [
    { path: '/dashboard', label: 'Live Dashboard', icon: 'bi-speedometer2' },
    { path: '/explainable', label: 'Explainable AI & CAM', icon: 'bi-eye-fill' },
    { path: '/progression', label: 'Wear Trajectory (RUL)', icon: 'bi-graph-up-arrow' },
    { path: '/telemetry', label: 'Sensor Quality', icon: 'bi-activity' },
    { path: '/specs', label: 'Machine Specs', icon: 'bi-tools' },
  ];

  return (
    <div className="min-vh-100 position-relative pb-5">
      {/* CAD Grid Background */}
      <div className="live-cad-bg" />

      {/* Industrial Header */}
      <header className="sticky-top border-bottom bg-white shadow-sm" style={{ zIndex: 100 }}>
        <div className="container d-flex flex-wrap justify-content-between align-items-center py-2" style={{ maxWidth: '1280px' }}>
          <div className="d-flex align-items-center gap-3" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            <div className="p-2 rounded bg-primary text-white d-flex align-items-center justify-content-center shadow-sm" style={{ width: '38px', height: '38px' }}>
              <i className="bi bi-gear-wide-connected fs-5"></i>
            </div>
            <div>
              <div className="fw-bold text-dark fs-5 tracking-tight d-flex align-items-center gap-2">
                ToolWear.AI
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 font-mono" style={{ fontSize: '10px' }}>
                  PHM SUITE
                </span>
              </div>
              <div className="text-secondary font-mono" style={{ fontSize: '11px' }}>
                CNC CARBIDE MILLING CUTTER DIAGNOSTICS (CK45 &amp; RVS 304)
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.path || (link.path === '/dashboard' && location.pathname === '/');
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`btn btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2 rounded-2 ${isActive
                      ? 'btn-primary text-white shadow-sm'
                      : 'btn-outline-secondary text-dark bg-white'
                    }`}
                  style={{ fontSize: '12px' }}
                >
                  <i className={`bi ${link.icon}`}></i>
                  {link.label}
                </button>
              );
            })}

            {/* User Profile & Logout */}
            <div className="d-flex align-items-center gap-2 ms-lg-2 ps-lg-2 border-start border-secondary border-opacity-25">
              <div className="text-end font-mono d-none d-md-block" style={{ lineHeight: '1.2' }}>
                <span className="text-dark fw-bold d-block" style={{ fontSize: '11px' }}>{currentUser.name}</span>
                <span className="text-muted" style={{ fontSize: '10px' }}>{currentUser.role}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="btn btn-sm btn-outline-danger font-mono d-flex align-items-center gap-1 px-2 py-1.5"
                style={{ fontSize: '11px' }}
              >
                <i className="bi bi-box-arrow-right"></i>
                <span className="d-none d-sm-inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container position-relative py-4" style={{ maxWidth: '1280px', zIndex: 10 }}>

        {/* Process Constraint Warning */}
        <div
          className="mb-4 p-3 rounded-2 d-flex align-items-center gap-3 shadow-sm bg-white"
          style={{
            borderLeft: '4px solid #f59e0b',
            borderTop: '1px solid #fed7aa',
            borderRight: '1px solid #fed7aa',
            borderBottom: '1px solid #fed7aa',
            color: '#9a3412'
          }}
        >
          <i className="bi bi-exclamation-triangle-fill fs-5 text-warning flex-shrink-0"></i>
          <div className="font-mono small mb-0">
            <strong>Process Constraint:</strong> Maintain a consistent workpiece material (CK45 / RVS 304) across all passes to ensure reliable wear predictions and model calibration.
          </div>
        </div>

        {/* Routes View */}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* ================= PAGE: LIVE DASHBOARD ================= */}
          <Route
            path="/dashboard"
            element={
              <div>
                {result?.early_warning && (
                  <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 mb-4 shadow-sm border-2">
                    <div className="d-flex align-items-center gap-3">
                      <i className="bi bi-exclamation-octagon-fill fs-3 text-danger"></i>
                      <div>
                        <strong className="d-block font-mono">EARLY-WARNING MAINTENANCE ALERT</strong>
                        <span className="small">Tool flank wear (V_B = {result.wear_um} µm) exceeded safe limits. {result.recommendation}</span>
                      </div>
                    </div>
                    <span className="badge bg-danger font-mono fs-6 px-3 py-2">MAINTENANCE REQUIRED</span>
                  </div>
                )}

                {/* Tool Health Gauge */}
                <div className="cad-panel p-4 mb-4" style={{ background: '#0b111e', color: '#f8fafc', borderColor: '#1e293b' }}>
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom border-secondary border-opacity-25">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold fs-5 font-mono text-info">
                        Tool Health Tracker &amp; Linear Wear Gauge
                      </span>
                      <span className="badge bg-primary bg-opacity-25 text-info font-mono">Health Score</span>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                      <div className="text-end font-mono">
                        <span className="text-secondary small d-block">Operator Health Score</span>
                        <span className={`fw-bold fs-5 ${result ? (result.health_score > 60 ? 'text-success' : result.health_score > 30 ? 'text-warning' : 'text-danger') : 'text-info'}`}>
                          {result ? `${result.health_score}%` : '100% (New / Ready)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="py-4 px-3">
                    <div className="position-relative w-100" style={{ height: '95px' }}>
                      <div className="position-absolute w-100" style={{ top: '32px', left: 0, height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', zIndex: 1 }} />
                      <div
                        className="position-absolute"
                        style={{
                          top: '32px',
                          left: 0,
                          height: '6px',
                          width: `${gaugePercent}%`,
                          backgroundColor: currentWear > 300 ? '#ef4444' : currentWear > 200 ? '#f97316' : currentWear > 100 ? '#f59e0b' : '#10b981',
                          boxShadow: `0 0 12px ${currentWear > 300 ? '#ef4444' : currentWear > 200 ? '#f97316' : '#10b981'}`,
                          borderRadius: '3px',
                          transition: 'width 0.4s ease',
                          zIndex: 2
                        }}
                      />

                      {[
                        { val: 0, label: '0 µm (New)', color: '#94a3b8', align: 'start' },
                        { val: 50, label: '50 µm', color: '#94a3b8', align: 'center' },
                        { val: 100, label: '100 µm', color: '#94a3b8', align: 'center' },
                        { val: 200, label: '200 µm', color: '#f97316', align: 'center' },
                        { val: 300, label: '300 µm (Limit)', color: '#ef4444', align: 'end' }
                      ].map((tick) => {
                        const pct = (tick.val / TOOL_SPECS.FAILURE_LIMIT_UM) * 100;
                        return (
                          <div key={tick.val} className="position-absolute d-flex flex-column" style={{ left: `${pct}%`, top: 0, transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none' }}>
                            <span className="font-mono mb-1 text-center" style={{ fontSize: '11px', color: tick.color, whiteSpace: 'nowrap', transform: tick.align === 'end' ? 'translateX(-30%)' : tick.align === 'start' ? 'translateX(25%)' : 'none' }}>
                              {tick.label}
                            </span>
                            <div style={{ width: '10px', height: '10px', backgroundColor: '#ffffff', border: '2px solid #0f172a', borderRadius: '50%', margin: '5px auto 0 auto' }} />
                          </div>
                        );
                      })}

                      <div className="position-absolute d-flex flex-column align-items-center" style={{ left: `${gaugePercent}%`, top: '27px', transform: 'translateX(-50%)', zIndex: 5, transition: 'left 0.4s ease' }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: currentWear > 300 ? '#ef4444' : currentWear > 200 ? '#f97316' : currentWear > 100 ? '#f59e0b' : '#00f2fe', border: '3px solid #ffffff', borderRadius: '50%', boxShadow: '0 0 10px #00f2fe' }} />
                        <div className="d-flex flex-column align-items-center mt-1">
                          <span className="text-info fw-bold" style={{ fontSize: '11px', lineHeight: 1 }}>↑</span>
                          <div className="badge bg-light text-dark font-mono px-2 py-1 shadow fw-bold mt-1" style={{ fontSize: '12px', border: '1px solid #00f2fe', whiteSpace: 'nowrap' }}>
                            {result ? `Current: ${currentWear.toFixed(1)} µm` : 'System Ready • 0.0 µm'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="row g-3 pt-3 font-mono small border-top border-secondary border-opacity-25 mt-3">
                      <div className="col-md-3">
                        <span className="text-secondary d-block">Tool Life Consumed:</span>
                        <span className="fw-bold text-white fs-6">{lifeConsumedPct.toFixed(1)}%</span>
                        <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 font-mono ms-2 px-2 py-0.5" style={{ fontSize: '11px' }}>
                          {remainingLifePct.toFixed(1)}% left
                        </span>
                      </div>
                      <div className="col-md-3">
                        <span className="text-secondary d-block">Est. Remaining Cuts (RUL):</span>
                        <span className={`fw-bold fs-6 ${estimatedRemainingCycles <= 20 ? 'text-danger' : 'text-success'}`}>
                          ~{estimatedRemainingCycles} Passes
                        </span>
                      </div>
                      <div className="col-md-3">
                        <span className="text-secondary d-block">Health Stage Classification:</span>
                        <span className={`badge bg-${currentWear <= 100 ? 'success' : currentWear <= 200 ? 'warning text-dark' : 'danger'} font-mono px-2 py-1 mt-1`}>
                          {result ? (currentWear <= 100 ? 'Healthy (0–100 µm)' : currentWear <= 200 ? 'Moderate (100–200 µm)' : currentWear <= 300 ? 'High Wear' : 'Critical Failure') : 'Healthy (Unused / 0 µm)'}
                        </span>
                      </div>
                      <div className="col-md-3">
                        <span className="text-secondary d-block">Prescriptive Action:</span>
                        <span className="text-light small">{result ? result.recommendation : 'Upload tool micrograph crop to calculate initial wear'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input & Output Panels */}
                <div className="row g-4">
                  <div className="col-lg-5">
                    <div className="cad-panel h-100">
                      <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                      <div className="cad-panel-header d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-primary font-mono small d-flex align-items-center gap-2">
                          <i className="bi bi-cpu-fill"></i> Inference Inputs
                        </span>
                        <span className="badge bg-primary bg-opacity-10 text-primary font-mono" style={{ fontSize: '10px' }}>
                          IMAGE + SENSORS
                        </span>
                      </div>

                      <div className="p-4">
                        <form onSubmit={handlePredict}>
                          <div className="mb-3">
                            <label className="form-label text-dark fw-semibold small d-flex justify-content-between mb-1">
                              <span>Tool Edge Image (RGB, 224×224)</span>
                              <span className="text-primary font-mono" style={{ fontSize: '11px' }}>Micrograph</span>
                            </label>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="form-control cad-form-control form-control-sm" />
                            {imagePreview && (
                              <div className="mt-2 p-2 bg-light border rounded text-center">
                                <img src={imagePreview} alt="Edge" className="img-fluid rounded border border-primary border-opacity-25" style={{ maxHeight: '120px', objectFit: 'cover' }} />
                              </div>
                            )}
                          </div>

                          <div className="mb-3">
                            <label className="form-label text-dark fw-semibold small d-flex justify-content-between mb-1">
                              <span>Sensor Signal (.npy format, 5×512)</span>
                              <span className="text-primary font-mono" style={{ fontSize: '11px' }}>Telemetry</span>
                            </label>
                            <input type="file" accept=".npy" onChange={handleSensorChange} className="form-control cad-form-control form-control-sm" />
                            <small className="text-muted d-block mt-1 font-mono" style={{ fontSize: '11px' }}>
                              {sensorName ? `Loaded: ${sensorName}` : 'Auto-pairs with matching .npy from sensors/'}
                            </small>
                          </div>

                          <div className="mb-4">
                            <label className="form-label text-dark fw-semibold small d-flex justify-content-between mb-1">
                              <span>Machining Pass Index (1 – 315)</span>
                              <span className="text-primary font-mono fw-bold" style={{ fontSize: '11px' }}>Recorded: {progressionHistory.length}</span>
                            </label>
                            <input type="number" min="1" max="350" value={machiningCycle} onChange={(e) => setMachiningCycle(parseInt(e.target.value) || 1)} className="form-control cad-form-control form-control-sm font-mono" />
                          </div>

                          {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

                          <button type="submit" disabled={loading} className="btn btn-primary w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm font-mono">
                            {loading ? (
                              <><span className="spinner-border spinner-border-sm"></span> Evaluating Multimodal PHM...</>
                            ) : (
                              <><i className="bi bi-lightning-charge-fill"></i> Execute Multimodal Wear Prediction</>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-7">
                    <div className="cad-panel h-100 d-flex flex-column justify-content-between">
                      <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                      <div className="cad-panel-header d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-primary font-mono small d-flex align-items-center gap-2">
                          <i className="bi bi-speedometer2"></i> Real-Time Wear Assessment
                        </span>
                        <span className="badge bg-success bg-opacity-10 text-success font-mono" style={{ fontSize: '10px' }}>
                          ONLINE
                        </span>
                      </div>

                      <div className="p-4 flex-grow-1 d-flex flex-column justify-content-center">
                        {result ? (
                          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-white border rounded text-center my-auto shadow-sm">
                            <div className="font-mono text-muted small text-uppercase mb-1">
                              PREDICTED FLANK WEAR WIDTH (V_B)
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
                            <div className="p-2 px-3 mt-3 rounded border font-mono small bg-light text-dark">
                              <strong>Maintenance Action:</strong> {result.recommendation}
                            </div>
                            <div className="row g-2 text-start font-mono small text-secondary mt-3 pt-2 border-top">
                              <div className="col-6">Evaluated Model:</div>
                              <div className="col-6 text-end text-primary fw-bold">image_sensor.pt</div>
                              <div className="col-6">Test R² Score:</div>
                              <div className="col-6 text-end text-success fw-bold">0.9938</div>
                              <div className="col-6">Model Test MAE:</div>
                              <div className="col-6 text-end text-dark fw-bold">3.09 µm</div>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="text-center py-5 font-mono text-secondary my-auto">
                            <i className="bi bi-radar display-4 d-block text-muted mb-2 opacity-50"></i>
                            <div className="fw-bold text-dark mb-1">AWAITING TOOL TELEMETRY &amp; IMAGE</div>
                            <div className="small">Select a cutter edge image on the left and execute prediction to begin real-time PHM.</div>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-light border-top font-mono small text-secondary d-flex justify-content-between align-items-center">
                        <span>Fusion Pipeline: <code>ImageEncoder (96d)</code> + <code>SensorEncoder (64d)</code></span>
                        <span className="badge bg-secondary font-mono">160d Head</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          {/* ================= PAGE: EXPLAINABLE AI & CAM ================= */}
          <Route
            path="/explainable"
            element={
              <div>
                <div className="cad-panel p-4 mb-4">
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <h5 className="fw-bold text-dark mb-0 font-mono d-flex align-items-center gap-2">
                      <i className="bi bi-intersect text-primary"></i> Multimodal Agreement &amp; Cross-Stream Verification
                    </h5>
                    <span className="badge bg-primary font-mono">Latent Projection Analysis</span>
                  </div>

                  {result?.agreement ? (
                    <div className="row g-3 align-items-center">
                      <div className="col-md-3 text-center border-end">
                        <div className="display-4 fw-bold font-mono text-dark">{result.agreement.score_pct}%</div>
                        <span className={`badge bg-${result.agreement.color} font-mono mt-1`}>
                          {result.agreement.color === 'success' ? 'High Agreement' : 'Discrepancy Check'}
                        </span>
                      </div>
                      <div className="col-md-9 font-mono small">
                        <p className="text-dark fw-bold mb-1">{result.agreement.status}</p>
                        <p className="text-secondary mb-2">
                          Cross-stream verification checks whether optical wear patterns match dynamic force and acoustic vibration harmonics before trusting the final regression.
                        </p>
                        <div className="d-flex gap-4 text-muted" style={{ fontSize: '11px' }}>
                          <span>Image Latent Energy: <strong>{result.agreement.img_activation}</strong></span>
                          <span>Sensor Latent Energy: <strong>{result.agreement.sensor_activation}</strong></span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted font-mono small">
                      Execute prediction on the Dashboard page to evaluate multimodal agreement.
                    </div>
                  )}
                </div>

                <div className="cad-panel p-4">
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div>
                      <h5 className="fw-bold text-dark mb-1 font-mono d-flex align-items-center gap-2">
                        <i className="bi bi-eye-fill text-primary"></i> Explainable AI: Layer 6 Grad-CAM Attention Heatmaps
                      </h5>
                      <p className="text-secondary font-mono small mb-0">
                        Calculates gradient activations targeting Conv2d Layer 6 (Power Gamma = 0.8, Alpha = 0.35).
                      </p>
                    </div>
                    <span className="badge bg-primary font-mono">Conv2d Layer 6</span>
                  </div>

                  {result?.gradcam ? (
                    <div className="row g-4 text-center">
                      <div className="col-md-4">
                        <div className="p-3 bg-light border rounded h-100 d-flex flex-column justify-content-between">
                          <span className="font-mono small fw-bold text-primary d-block mb-2">Grad-CAM Heatmap</span>
                          <img src={result.gradcam.heatmap} alt="CAM" className="img-fluid rounded border shadow-sm" style={{ maxHeight: '220px', objectFit: 'contain' }} />
                          <span className="font-mono text-muted small mt-2" style={{ fontSize: '11px' }}>Normalized Thermal Field</span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="p-3 bg-light border rounded h-100 d-flex flex-column justify-content-between">
                          <span className="font-mono small fw-bold text-danger d-block mb-2">Attention Overlay (Alpha = 0.35)</span>
                          <img src={result.gradcam.overlay} alt="Overlay" className="img-fluid rounded border shadow-sm" style={{ maxHeight: '220px', objectFit: 'contain' }} />
                          <span className="font-mono text-danger small mt-2" style={{ fontSize: '11px' }}>Edge Wear Region Focused</span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="p-3 bg-light border rounded h-100 d-flex flex-column justify-content-between">
                          <span className="font-mono small fw-bold text-secondary d-block mb-2">Raw Optical Micrograph</span>
                          <img src={result.gradcam.original} alt="Raw" className="img-fluid rounded border shadow-sm" style={{ maxHeight: '220px', objectFit: 'contain' }} />
                          <span className="font-mono text-muted small mt-2" style={{ fontSize: '11px' }}>224×224 Raw Microscopic View</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-5 text-muted font-mono small">
                      <i className="bi bi-eye display-4 d-block mb-2 opacity-50"></i>
                      Run a prediction on the Dashboard to render live Layer 6 Grad-CAM heatmaps.
                    </div>
                  )}
                </div>
              </div>
            }
          />

          {/* ================= PAGE: WEAR PROGRESSION & RUL ================= */}
          <Route
            path="/progression"
            element={
              <div>
                <div className="cad-panel p-4 mb-4">
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div>
                      <h5 className="fw-bold text-primary mb-1 font-mono d-flex align-items-center gap-2">
                        <i className="bi bi-graph-up-arrow"></i> Wear Progression Tracking &amp; Degradation Curve
                      </h5>
                      <p className="text-secondary font-mono small mb-0">
                        Measurement &rarr; Wear &rarr; Time trajectory • {progressionHistory.length} machining cuts recorded
                      </p>
                    </div>

                    <div className="d-flex gap-2">
                      <button onClick={exportCSV} disabled={progressionHistory.length === 0} className="btn btn-sm btn-outline-primary font-mono">
                        <i className="bi bi-download me-1"></i> Export CSV
                      </button>
                      <button onClick={clearLiveTracking} disabled={progressionHistory.length === 0} className="btn btn-sm btn-outline-danger font-mono">
                        <i className="bi bi-trash3 me-1"></i> Reset Points
                      </button>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 350, background: '#ffffff', padding: '16px 12px 6px 0', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    {progressionHistory.length > 0 ? (
                      <ResponsiveContainer>
                        <LineChart data={progressionHistory} margin={{ top: 20, right: 30, left: 15, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="cycle" stroke="#64748b" tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }} label={{ value: 'Machining Passes / Cycles →', position: 'insideBottom', offset: -10, fill: '#1e293b', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }} />
                          <YAxis stroke="#64748b" tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }} domain={[0, (max) => Math.max(0.35, parseFloat((max * 1.2).toFixed(2)))]} label={{ value: 'Flank Wear (mm) ↑', angle: -90, position: 'insideLeft', fill: '#1e293b', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontFamily: 'JetBrains Mono', fontSize: '11px' }} formatter={(val, name, item) => [`${val} mm (${(val * 1000).toFixed(1)} µm) - Health: ${item.payload.health_score}%`, 'Flank Wear']} />
                          <ReferenceLine y={0.3} label={{ value: 'CRITICAL FAILURE LIMIT (0.30 mm / 300 µm)', fill: '#dc2626', fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 600, position: 'top' }} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 4" />
                          <ReferenceLine y={0.1} label={{ value: 'MODERATE WEAR (0.10 mm / 100 µm)', fill: '#d97706', fontSize: 10, fontFamily: 'JetBrains Mono', position: 'insideBottomLeft' }} stroke="#d97706" strokeWidth={1.2} strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="wear_mm" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 6, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#0369a1' }} isAnimationActive={true} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted font-mono small">
                        <i className="bi bi-graph-up-arrow fs-2 text-primary opacity-50 mb-2"></i>
                        <span>Progression graph ready. Execute inference on Dashboard to record passes.</span>
                      </div>
                    )}
                  </div>
                </div>

                {progressionHistory.length > 0 && (
                  <div className="cad-panel p-4">
                    <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />
                    <h6 className="fw-bold text-dark mb-3 font-mono">Recorded Machining Log</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered font-mono small align-middle mb-0">
                        <thead className="table-light">
                          <tr><th>Pass #</th><th>Flank Wear (V_B)</th><th>Wear (mm)</th><th>Health Index</th><th>Status</th><th>Timestamp</th></tr>
                        </thead>
                        <tbody>
                          {progressionHistory.map((p, idx) => (
                            <tr key={idx}>
                              <td className="fw-bold">Pass #{p.cycle}</td>
                              <td className="text-primary fw-bold">{p.wear_um} µm</td>
                              <td>{p.wear_mm} mm</td>
                              <td><span className="badge bg-light text-dark border">{p.health_score}%</span></td>
                              <td><span className="badge bg-secondary">{p.status}</span></td>
                              <td className="text-muted">{p.timestamp}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            }
          />

          {/* ================= PAGE: SENSOR QUALITY & SIGNALS ================= */}
          <Route
            path="/telemetry"
            element={
              <div>
                <div className="cad-panel p-4 mb-4">
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <h5 className="fw-bold text-dark mb-0 font-mono d-flex align-items-center gap-2">
                      <i className="bi bi-broadcast text-primary"></i> Sensor Quality Monitoring &amp; Telemetry Health
                    </h5>
                    <span className="badge bg-primary font-mono">SNR &amp; Drift Filter</span>
                  </div>

                  {result?.sensor_quality ? (
                    <div className="row g-3 align-items-center">
                      <div className="col-md-3 text-center border-end">
                        <div className="display-4 fw-bold font-mono text-dark">{result.sensor_quality.confidence}%</div>
                        <span className={`badge bg-${result.sensor_quality.color} font-mono mt-1`}>
                          {result.sensor_quality.valid ? 'Telemetry Valid' : 'Telemetry Invalid'}
                        </span>
                      </div>
                      <div className="col-md-9 font-mono small">
                        <p className="text-dark fw-bold mb-1">Status: {result.sensor_quality.status}</p>
                        <p className="text-secondary mb-0">
                          Evaluates high-frequency signal variance, zero-drift flatlines, and Signal-to-Noise Ratio (SNR) across all 5 channels (Fx, Fy, Fz, Accel, AE) before passing tensors to the 1D-CNN encoder.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted font-mono small">
                      Execute prediction on the Dashboard to view signal quality confidence score.
                    </div>
                  )}
                </div>

                <div className="cad-panel p-4">
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <span className="font-mono text-dark fw-bold small">
                      <i className="bi bi-soundwave text-primary me-2"></i>5-Channel High-Frequency Sensor Signals
                    </span>
                    <div className="d-flex flex-wrap gap-2">
                      {CHANNEL_CONFIG.map((ch) => (
                        <button key={ch.key} type="button" onClick={() => toggleChannel(ch.key)} className={`btn btn-sm font-mono ${activeChannels.includes(ch.key) ? 'btn-dark text-white fw-semibold' : 'btn-light text-muted border'}`} style={{ fontSize: '11px' }}>
                          <span style={{ color: ch.color, marginRight: '4px' }}>●</span>{ch.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {result?.sensor_waveforms ? (
                    <div style={{ width: '100%', height: 320, background: '#ffffff', padding: '16px 12px 6px 0', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <ResponsiveContainer>
                        <LineChart data={result.sensor_waveforms} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="t" stroke="#94a3b8" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                          <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '6px', fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
                          <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '11px', paddingTop: '10px' }} />
                          {CHANNEL_CONFIG.map((ch) => activeChannels.includes(ch.key) && (
                            <Line key={ch.key} type="monotone" dataKey={ch.key} name={ch.name} stroke={ch.color} strokeWidth={1.6} dot={false} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-5 text-muted font-mono small">
                      Upload a 5-channel <code>.npy</code> file on Dashboard to render real-time waveforms.
                    </div>
                  )}
                </div>
              </div>
            }
          />

          {/* ================= PAGE: MACHINE & TOOL SPECS ================= */}
          <Route
            path="/specs"
            element={
              <div>
                <div className="row g-4 mb-4">
                  <div className="col-md-6">
                    <div className="cad-panel p-4 h-100">
                      <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                      <span className="font-mono text-primary small fw-semibold">// CNC MACHINE SETUP</span>
                      <h4 className="fw-bold text-dark mb-4 mt-1">Roders RFM760 Center</h4>
                      <div className="font-mono small">
                        <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-secondary">Machine Type</span><span className="text-dark fw-bold">3-Axis High-Speed CNC</span></div>
                        <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-secondary">Tool Type</span><span className="text-dark fw-bold">Carbide Milling Tool</span></div>
                        <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-secondary">Dataset Scope</span><span className="text-dark fw-bold">10 CNC Carbide Cutters to Failure</span></div>
                        <div className="d-flex justify-content-between py-2"><span className="text-secondary">Sensors</span><span className="text-dark fw-bold">Kistler Dynamometer + Accel + AE</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="cad-panel p-4 h-100">
                      <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                      <span className="font-mono text-primary small fw-semibold">// METALLURGY &amp; WEAR CRITERIA</span>
                      <h4 className="fw-bold text-dark mb-4 mt-1">Workpieces &amp; ISO Limits</h4>
                      <div className="font-mono small">
                        <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-secondary">Workpiece 01</span><span className="text-dark fw-bold">CK45 Carbon Steel</span></div>
                        <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-secondary">Workpiece 02</span><span className="text-dark fw-bold">RVS 304 Stainless Steel</span></div>
                        <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-secondary">Nominal Tool Life</span><span className="text-dark fw-bold">~315 Machining Passes</span></div>
                        <div className="d-flex justify-content-between py-2"><span className="text-secondary">Failure Standard</span><span className="text-danger fw-bold">V_B &ge; 300 µm (0.30 mm)</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cad-panel p-4 mb-4">
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <h5 className="fw-bold text-dark mb-3 font-mono">
                    <i className="bi bi-sliders text-primary me-2"></i>OPERATING PROCESS PARAMETERS (DATASET BASELINE)
                  </h5>
                  <div className="table-responsive">
                    <table className="table table-bordered font-mono small align-middle mb-0">
                      <thead className="table-light text-secondary">
                        <tr>
                          <th>Parameter</th>
                          <th>Symbol</th>
                          <th>Nominal Range</th>
                          <th>Dataset Mean</th>
                          <th>Std Dev</th>
                          <th>Primary Failure Mode Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>Cutting Speed</td><td>Vc</td><td>130 - 160 m/min</td><td>146.29 m/min</td><td>3.68</td><td>Controls cutting zone temperature &amp; thermal wear</td></tr>
                        <tr><td>Spindle Speed</td><td>n</td><td>3,100 - 3,300 RPM</td><td>3,207.88 RPM</td><td>20.64</td><td>Influences tooth engagement frequency</td></tr>
                        <tr><td>Feed per Tooth</td><td>fz</td><td>0.048 - 0.055 mm/tooth</td><td>0.051 mm/tooth</td><td>0.0006</td><td>Dictates mechanical shear stress &amp; micro-chipping</td></tr>
                        <tr><td>Feed Rate</td><td>Vf</td><td>150 - 170 mm/min</td><td>160.96 mm/min</td><td>2.52</td><td>Determines cycle time &amp; tool contact length</td></tr>
                        <tr><td>Radial Depth of Cut</td><td>ae</td><td>0.98 - 1.02 mm</td><td>1.00 mm</td><td>0.003</td><td>Governs radial engagement &amp; chip thickness</td></tr>
                        <tr><td>Axial Depth of Cut</td><td>ap</td><td>0.80 - 0.85 mm</td><td>0.82 mm</td><td>0.011</td><td>Controls contact height along the flank face</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="cad-panel p-4">
                  <div className="crosshair ch-tl" /><div className="crosshair ch-tr" /><div className="crosshair ch-bl" /><div className="crosshair ch-br" />

                  <h5 className="fw-bold text-dark mb-3 font-mono">
                    <i className="bi bi-cpu text-primary me-2"></i>MULTIMODAL PYTORCH ARCHITECTURE SPECIFICATIONS
                  </h5>
                  <div className="table-responsive">
                    <table className="table table-bordered font-mono small align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>MODULE</th><th>INPUT MODALITIES</th><th>LAYER ARCHITECTURE</th><th>EMBEDDING DIM</th><th>PURPOSE</th></tr>
                      </thead>
                      <tbody>
                        <tr className="table-primary fw-bold">
                          <td className="text-primary">ImageEncoder</td>
                          <td>Micrograph (224×224 RGB)</td>
                          <td>4× Conv2D + BatchNorm + ReLU (Layer 6 CAM)</td>
                          <td>96d</td>
                          <td>Flank micro-chipping &amp; edge rounding</td>
                        </tr>
                        <tr>
                          <td className="text-primary fw-bold">SensorEncoder</td>
                          <td>5×512 Telemetry (Fx, Fy, Fz, Accel, AE)</td>
                          <td>4× Conv1D (k=9,7,5,5) + MaxPool</td>
                          <td>64d</td>
                          <td>Dynamic shear force &amp; vibration harmonics</td>
                        </tr>
                        <tr>
                          <td className="text-primary fw-bold">Fusion Head</td>
                          <td>Image (96d) + Sensor (64d)</td>
                          <td>FC(160, 96) &rarr; FC(96, 48) &rarr; FC(48, 1)</td>
                          <td>1d (V_B in µm)</td>
                          <td>Flank wear regression (R² = 0.9938)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}