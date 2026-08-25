import { useRef } from "react";

export default function InferencePanel({
  image,
  sensor,
  pass,
  setImage,
  setSensor,
  setPass,
  onRun,
  loading,
}) {
  const imageRef = useRef(null);
  const sensorRef = useRef(null);

  const canAnalyze = image && sensor && !loading;

  return (
    <div className="cad-panel inference-panel h-100">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <div className="panel-title">New analysis</div>
          <div className="panel-subtitle">
            Upload the latest tool image and telemetry.
          </div>
        </div>

        <i
          className="bi bi-shield-check"
          style={{
            color: "var(--success)",
            fontSize: 18,
          }}
        />
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) =>
          setImage(e.target.files?.[0] || null)
        }
      />

      <input
        ref={sensorRef}
        type="file"
        accept=".npy,application/octet-stream"
        hidden
        onChange={(e) =>
          setSensor(e.target.files?.[0] || null)
        }
      />

      <div className="row g-2">

        {/* =====================================================
            TOOL MICROGRAPH
        ====================================================== */}
        <div className="col-12">
          <div
            className={`drop-zone ${image ? "has-file" : ""}`}
            onClick={() => imageRef.current?.click()}
            style={{ cursor: "pointer" }}
          >
            <div>
              <div className="drop-icon">
                <i className="bi bi-image" />
              </div>

              <div className="drop-title">
                {image ? image.name : "Tool micrograph"}
              </div>

              <div className="drop-hint">
                {image
                  ? "Image selected"
                  : "PNG, JPG or WEBP"}
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            SENSOR TELEMETRY
        ====================================================== */}
        <div className="col-12">
          <div
            className={`drop-zone ${sensor ? "has-file" : ""}`}
            onClick={() => sensorRef.current?.click()}
            style={{
              minHeight: 92,
              cursor: "pointer",
            }}
          >
            <div>
              <div className="drop-icon">
                <i className="bi bi-activity" />
              </div>

              <div className="drop-title">
                {sensor
                  ? sensor.name
                  : "Sensor telemetry"}
              </div>

              <div className="drop-hint">
                {sensor
                  ? "Numpy sensor file selected"
                  : ".npy — 5 channels"}
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            MACHINING PASS
        ====================================================== */}
        <div className="col-7">
          <label className="auth-label">
            Machining pass
          </label>

          <select
            className="form-select form-select-clean"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          >
            {Array.from(
              { length: 101 },
              (_, i) => (
                <option
                  key={i}
                  value={i + 1}
                >
                  Pass {i + 1}
                </option>
              )
            )}
          </select>
        </div>

        {/* =====================================================
            ANALYZE BUTTON
        ====================================================== */}
        <div className="col-5 d-flex align-items-end">
          <button
            className="btn-main w-100"
            disabled={!canAnalyze}
            onClick={onRun}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

      </div>

      {/* =====================================================
          INPUT STATUS
      ====================================================== */}
      <div className="mt-3">
        {!image && !sensor && (
          <div className="small text-secondary">
            <i className="bi bi-info-circle me-1" />
            Upload both a tool micrograph and sensor telemetry
            to run the analysis.
          </div>
        )}

        {image && !sensor && (
          <div className="small text-warning">
            <i className="bi bi-exclamation-triangle me-1" />
            Tool image selected. Please upload the sensor
            telemetry file.
          </div>
        )}

        {!image && sensor && (
          <div className="small text-warning">
            <i className="bi bi-exclamation-triangle me-1" />
            Sensor telemetry selected. Please upload the tool
            micrograph.
          </div>
        )}

        {image && sensor && !loading && (
          <div className="small text-success">
            <i className="bi bi-check-circle me-1" />
            Image and sensor telemetry ready for analysis.
          </div>
        )}

        {loading && (
          <div className="small text-primary">
            <i className="bi bi-cpu me-1" />
            Analyzing tool condition and vibration telemetry…
          </div>
        )}
      </div>
    </div>
  );
}