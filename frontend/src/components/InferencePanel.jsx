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

  return (
    <div className="cad-panel inference-panel h-100">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <div className="panel-title">New analysis</div>
          <div className="panel-subtitle">Upload the latest tool image and telemetry.</div>
        </div>
        <i className="bi bi-shield-check" style={{ color: "var(--success)", fontSize: 18 }} />
      </div>

      <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files?.[0] || null)} />
      <input ref={sensorRef} type="file" accept=".npy,application/octet-stream" hidden onChange={(e) => setSensor(e.target.files?.[0] || null)} />

      <div className="row g-2">
        <div className="col-12">
          <div className={`drop-zone ${image ? "has-file" : ""}`} onClick={() => imageRef.current?.click()}>
            <div>
              <div className="drop-icon"><i className="bi bi-image" /></div>
              <div className="drop-title">{image ? image.name : "Tool micrograph"}</div>
              <div className="drop-hint">{image ? "Image selected" : "PNG, JPG or WEBP"}</div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className={`drop-zone ${sensor ? "has-file" : ""}`} onClick={() => sensorRef.current?.click()} style={{ minHeight: 92 }}>
            <div>
              <div className="drop-icon"><i className="bi bi-activity" /></div>
              <div className="drop-title">{sensor ? sensor.name : "Sensor telemetry"}</div>
              <div className="drop-hint">{sensor ? "Numpy file selected" : ".npy — 5 channels"}</div>
            </div>
          </div>
        </div>

        <div className="col-7">
          <label className="auth-label">Machining pass</label>
          <select className="form-select form-select-clean" value={pass} onChange={(e) => setPass(e.target.value)}>
            {Array.from({ length: 101 }, (_, i) => <option key={i} value={i + 1}>Pass {i + 1}</option>)}
          </select>
        </div>

        <div className="col-5 d-flex align-items-end">
          <button className="btn-main w-100" disabled={!image || loading} onClick={onRun}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
