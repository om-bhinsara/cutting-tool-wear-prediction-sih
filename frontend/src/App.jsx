import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import Login from "./pages/Login";
import Machines from "./pages/Machines";
import Dashboard from "./pages/Dashboard";
import ExplainableAI from "./pages/ExplainableAI";
import Progression from "./pages/Progression";
import Telemetry from "./pages/Telemetry";
import Specs from "./pages/Specs";
import Profile from "./pages/Profile";
import Guide from "./pages/Guide";

import { runWearPrediction } from "./services/api";

/* ============================================================
   STORAGE KEYS
============================================================ */

const HISTORY_KEY = "toolwear_progression_history";
const AUTH_KEY = "phm_auth_user";
const TOKEN_KEY = "phm_jwt_token";
const SELECTED_MACHINE_KEY = "phm_selected_machine";
const LAST_PREDICTION_KEY = "phm_last_prediction";

/* ============================================================
   HELPER
============================================================ */

function firstDefined(obj, keys, fallback = null) {
  if (!obj || typeof obj !== "object") {
    return fallback;
  }

  for (const key of keys) {
    const value = obj[key];
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      if (Array.isArray(value) && value.length === 0) {
        continue;
      }
      return value;
    }
  }

  return fallback;
}

/* ============================================================
   FIND PREDICTION PAYLOAD
============================================================ */

function getPredictionPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  if (
    raw.wear_um !== undefined ||
    raw.predicted_wear_um !== undefined ||
    raw.wear !== undefined ||
    raw.health_score !== undefined ||
    raw.sensor_waveforms !== undefined ||
    raw.telemetry !== undefined ||
    raw.telemetry_downsampled !== undefined ||
    raw.sensor_data !== undefined
  ) {
    return raw;
  }

  if (raw.result && typeof raw.result === "object") {
    return raw.result;
  }

  if (raw.prediction && typeof raw.prediction === "object") {
    return raw.prediction;
  }

  if (raw.data && typeof raw.data === "object") {
    return raw.data;
  }

  return raw;
}

/* ============================================================
   NORMALIZE BACKEND RESULT
============================================================ */

function normalizeResult(raw) {
  if (!raw) {
    return null;
  }

  const payload = getPredictionPayload(raw);

  const wear = Number(
    firstDefined(
      payload,
      [
        "wear_um",
        "wear",
        "predicted_wear_um",
        "prediction",
        "vb_um",
      ],
      NaN
    )
  );

  const health = Number(
    firstDefined(
      payload,
      [
        "health_score",
        "health",
        "tool_health",
      ],
      NaN
    )
  );

  const confidence = Number(
    firstDefined(
      payload,
      [
        "confidence",
        "prediction_confidence",
        "model_confidence",
      ],
      NaN
    )
  );

  const agreement = Number(
    firstDefined(
      payload,
      [
        "agreement_pct",
        "agreement",
        "cross_stream_agreement",
      ],
      NaN
    )
  );

  const telemetry = firstDefined(
    payload,
    [
      "sensor_waveforms",
      "telemetry",
      "telemetry_downsampled",
      "sensor_data",
      "sensor_telemetry",
      "signals",
    ],
    []
  );

  const signalQuality = firstDefined(
    payload,
    [
      "signal_quality",
      "telemetry_confidence",
      "sensor_confidence",
      "quality",
      "signalQuality",
    ],
    null
  );

  const telemetryValid = firstDefined(
    payload,
    [
      "telemetry_valid",
      "telemetryValid",
      "sensor_valid",
      "signal_valid",
      "valid",
    ],
    null
  );

  const samplingRate = firstDefined(
    payload,
    [
      "sampling_rate",
      "sampling",
      "sample_rate",
    ],
    512
  );

  return {
    ...payload,
    raw_response: raw,
    wear_um: Number.isFinite(wear) ? wear : null,
    health_score: Number.isFinite(health) ? health : null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    agreement: Number.isFinite(agreement) ? agreement : null,
    status: firstDefined(
      payload,
      ["status", "wear_status", "health_status"],
      "Healthy"
    ),
    recommendation: firstDefined(
      payload,
      ["recommendation", "maintenance_recommendation"],
      null
    ),
    rul_passes: firstDefined(
      payload,
      ["rul_passes", "rul", "remaining_passes"],
      null
    ),
    sensor_waveforms: payload.sensor_waveforms || telemetry,
    telemetry: Array.isArray(telemetry) && telemetry.length > 0 ? telemetry : (payload.sensor_waveforms || []),
    signal_quality: signalQuality,
    telemetry_valid: telemetryValid,
    sampling_rate: samplingRate,
    gradcam: payload.gradcam || payload.explainability || {},
  };
}

/* ============================================================
   LAST PREDICTION STORAGE
============================================================ */

function saveLastPrediction(result) {
  try {
    if (!result) return;
    localStorage.setItem(LAST_PREDICTION_KEY, JSON.stringify(result));
  } catch (error) {
    console.error("[App] Unable to save last prediction:", error);
  }
}

function clearLastPrediction() {
  try {
    localStorage.removeItem(LAST_PREDICTION_KEY);
  } catch (error) {
    console.error("[App] Unable to clear last prediction:", error);
  }
}

/* ============================================================
   CSV EXPORT
============================================================ */

function downloadCsv(rows) {
  if (!rows || rows.length === 0) {
    window.alert("There is no prediction history to export.");
    return;
  }

  const headers = [
    "cycle",
    "wear_um",
    "wear_mm",
    "health_score",
    "status",
    "recommendation",
    "timestamp",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => JSON.stringify(row[header] ?? ""))
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "toolwear-history.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ============================================================
   APP
============================================================ */

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("[App] Unable to restore user:", error);
      return null;
    }
  });

  const [selectedMachine, setSelectedMachine] = useState(() => {
    try {
      const stored = localStorage.getItem(SELECTED_MACHINE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("[App] Unable to restore machine:", error);
      return null;
    }
  });

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [result, setResult] = useState(() => {
    try {
      const stored = localStorage.getItem(LAST_PREDICTION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("[App] Unable to restore last prediction:", error);
      return null;
    }
  });

  const [image, setImage] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [pass, setPass] = useState("1");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("[App] Unable to restore history:", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("[App] Unable to save history:", error);
    }
  }, [history]);

  useEffect(() => {
    try {
      if (selectedMachine) {
        localStorage.setItem(
          SELECTED_MACHINE_KEY,
          JSON.stringify(selectedMachine)
        );
      } else {
        localStorage.removeItem(SELECTED_MACHINE_KEY);
      }
    } catch (error) {
      console.error("[App] Unable to save selected machine:", error);
    }
  }, [selectedMachine]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleMachineSelect = (machine) => {
    if (!machine) return;

    setSelectedMachine(machine);
    setResult(null);
    setImage(null);
    setSensor(null);
    setPass("1");
    setLoading(false);
    clearLastPrediction();

    window.dispatchEvent(new CustomEvent("phm:prediction-cleared"));
    navigate("/dashboard");
  };

  const handleChangeMachine = () => {
    setSelectedMachine(null);
    setResult(null);
    setImage(null);
    setSensor(null);
    setPass("1");
    setLoading(false);
    clearLastPrediction();

    window.dispatchEvent(new CustomEvent("phm:prediction-cleared"));
    navigate("/machines", { replace: true });
  };

  const runPrediction = async () => {
    if (!selectedMachine) {
      window.alert("Please select a machine before running the analysis.");
      navigate("/machines");
      return;
    }

    if (!image) {
      window.alert("Please select a tool image before running the analysis.");
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const form = new FormData();
      form.append("image", image);

      if (sensor) {
        form.append("sensor", sensor);
      }

      form.append("pass", pass);
      form.append("cycle", pass);

      const machineId =
        selectedMachine?.id ||
        selectedMachine?.machineId ||
        selectedMachine?.machine_id;

      if (machineId) {
        form.append("machine_id", machineId);
      }

      const machineName =
        selectedMachine?.name ||
        selectedMachine?.machineName ||
        selectedMachine?.machine_name;

      if (machineName) {
        form.append("machine_name", machineName);
      }

      const raw = await runWearPrediction(form);
      const normalized = normalizeResult(raw);

      setResult(normalized);
      saveLastPrediction(normalized);

      window.dispatchEvent(
        new CustomEvent("phm:prediction-complete", {
          detail: normalized,
        })
      );

      if (
        normalized?.wear_um !== null &&
        normalized?.wear_um !== undefined
      ) {
        const cycle = Number(pass) || history.length + 1;
        const row = {
          cycle,
          wear_um: normalized.wear_um,
          wear_mm: normalized.wear_um / 1000,
          health_score: normalized.health_score,
          status: normalized.status,
          recommendation: normalized.recommendation,
          timestamp: new Date().toISOString(),
        };

        setHistory((previous) => {
          const filtered = previous.filter(
            (item) => Number(item.cycle) !== cycle
          );
          return [...filtered, row].sort(
            (a, b) => Number(a.cycle) - Number(b.cycle)
          );
        });
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("[App] Prediction failed:", error);
      let message = "Prediction failed. Please try again.";

      if (error?.response?.data?.error) {
        message = error.response.data.error;
      } else if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.status === 400) {
        message =
          "The backend rejected the uploaded data. Please check the tool image, sensor file and machining pass.";
      } else if (error?.response?.status === 401) {
        message = "Your login session has expired. Please log in again.";
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setSelectedMachine(null);
        clearLastPrediction();
        navigate("/", { replace: true });
      } else if (error?.response?.status === 404) {
        message =
          "Prediction API endpoint was not found. Make sure the Flask backend is running and /predict exists.";
      } else if (error?.response?.status === 500) {
        message =
          "The backend encountered an error while running the prediction.";
      } else if (error?.message === "Network Error") {
        message =
          "Cannot connect to the prediction server. Make sure the backend is running.";
      } else if (error?.message) {
        message = error.message;
      }

      window.alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticated = (authenticatedUser) => {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(authenticatedUser));
    } catch (error) {
      console.error("[App] Unable to save authenticated user:", error);
    }
    setUser(authenticatedUser);
    navigate("/machines", { replace: true });
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SELECTED_MACHINE_KEY);
    clearLastPrediction();

    setUser(null);
    setSelectedMachine(null);
    setResult(null);
    setImage(null);
    setSensor(null);
    setPass("1");
    setLoading(false);
    setMobileOpen(false);

    window.dispatchEvent(new CustomEvent("phm:prediction-cleared"));
    navigate("/", { replace: true });
  };

  const exportHistory = () => {
    downloadCsv(history);
  };

  const resetHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error("[App] Unable to clear history:", error);
    }
  };

  const appContext = useMemo(
    () => ({
      result,
      history,
      image,
      sensor,
      pass,
      setImage,
      setSensor,
      setPass,
      runPrediction,
      loading,
      selectedMachine,
    }),
    [
      result,
      history,
      image,
      sensor,
      pass,
      loading,
      selectedMachine,
    ]
  );

  if (!user) {
    return (
      <Routes>
        <Route
          path="/"
          element={<Login onAuthenticated={handleAuthenticated} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />

      {mobileOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.22)",
            backdropFilter: "blur(2px)",
            zIndex: 950,
          }}
        />
      )}

      <div
        className={`main-layout-wrapper ${expanded ? "with-expanded-sidebar" : "with-collapsed-sidebar"
          } ${mobileOpen ? "with-mobile-open" : ""}`}
      >
        <Topbar
          user={user}
          onMobileMenu={() => setMobileOpen(true)}
          onLogout={logout}
        />

        <main className="app-main page-content">
          <Routes>
            <Route
              path="/machines"
              element={
                <Machines
                  user={user}
                  selectedMachine={selectedMachine}
                  onMachineSelect={handleMachineSelect}
                  onViewMachine={handleMachineSelect}
                />
              }
            />

            <Route
              path="/dashboard"
              element={
                selectedMachine ? (
                  <Dashboard {...appContext} />
                ) : (
                  <Navigate to="/machines" replace />
                )
              }
            />

            <Route
              path="/explainable-ai"
              element={
                selectedMachine ? (
                  <ExplainableAI
                    result={result}
                    image={image}
                    selectedMachine={selectedMachine}
                  />
                ) : (
                  <Navigate to="/machines" replace />
                )
              }
            />

            <Route
              path="/explainable"
              element={<Navigate to="/explainable-ai" replace />}
            />

            <Route
              path="/progression"
              element={
                selectedMachine ? (
                  <Progression
                    history={history}
                    onExport={exportHistory}
                    onReset={resetHistory}
                    selectedMachine={selectedMachine}
                  />
                ) : (
                  <Navigate to="/machines" replace />
                )
              }
            />

            <Route
              path="/telemetry"
              element={
                selectedMachine ? (
                  <Telemetry
                    result={result}
                    selectedMachine={selectedMachine}
                  />
                ) : (
                  <Navigate to="/machines" replace />
                )
              }
            />

            <Route
              path="/specs"
              element={
                selectedMachine ? (
                  <Specs selectedMachine={selectedMachine} />
                ) : (
                  <Navigate to="/machines" replace />
                )
              }
            />

            <Route
              path="/guide"
              element={
                <Guide
                  user={user}
                  selectedMachine={selectedMachine}
                />
              }
            />

            <Route
              path="/profile"
              element={
                <Profile
                  user={user}
                  selectedMachine={selectedMachine}
                  onLogout={logout}
                />
              }
            />

            <Route path="/" element={<Navigate to="/machines" replace />} />
            <Route path="*" element={<Navigate to="/machines" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}