import React from "react";

function asSrc(value) {
  if (!value) return null;
  if (value.startsWith("data:image")) return value;
  return `data:image/png;base64,${value}`;
}

function Frame({ src, title, tag, badgeColor = "secondary", icon = "bi-image" }) {
  return (
    <div className="col-12 col-md-4">
      <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light bg-opacity-50">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${icon} text-primary fs-5`} />
            <div>
              <div className="fw-bold text-dark" style={{ fontSize: "13px" }}>{title}</div>
              <div className="text-muted" style={{ fontSize: "11px" }}>{tag}</div>
            </div>
          </div>
          <span className={`badge bg-${badgeColor}-subtle text-${badgeColor} border border-${badgeColor}-subtle px-2 py-1`} style={{ fontSize: "10px" }}>
            {badgeColor === "primary" ? "ATTENTION" : badgeColor === "danger" ? "GRADIENT" : "RAW"}
          </span>
        </div>

        <div className="p-3 d-flex align-items-center justify-content-center bg-light bg-opacity-25" style={{ minHeight: 250 }}>
          {src ? (
            <div className="position-relative rounded-3 overflow-hidden border shadow-sm w-100 d-flex align-items-center justify-content-center bg-white" style={{ height: 230 }}>
              <img
                src={asSrc(src)}
                alt={title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          ) : (
            <div className="text-secondary small d-flex flex-column align-items-center py-5">
              <i className="bi bi-image text-muted mb-2" style={{ fontSize: 32 }} />
              <span>No image captured</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ImagePanel({ result }) {
  const images = result?.gradcam || result?.explainability || {};
  const rawImage = images.original || images.raw || result?.raw_image || result?.image || result?.original;

  return (
    <div className="cad-panel p-4 rounded-4 shadow-sm border-0 bg-white">
      <div className="d-flex justify-content-between align-items-start mb-4 border-bottom pb-3">
        <div>
          <h5 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
            <i className="bi bi-cpu text-primary" /> Visual Saliency & Model Attention
          </h5>
          <span className="text-muted small">Layer 6 CNN activation mapping highlighting micro-flank tool wear features</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5">
            <i className="bi bi-check2-circle me-1" /> Multi-modal Aligned
          </span>
        </div>
      </div>

      <div className="row g-3">
        <Frame
          src={rawImage}
          title="Original Micrograph"
          tag="Pre-processed optical crop (224x224)"
          badgeColor="secondary"
          icon="bi-camera"
        />
        <Frame
          src={images.heatmap || result?.heatmap}
          title="Attention Heatmap"
          tag="Normalized gradient saliency"
          badgeColor="danger"
          icon="bi-fire"
        />
        <Frame
          src={images.overlay || result?.overlay}
          title="Grad-CAM Overlay"
          tag="Visual attention localized on tool edge"
          badgeColor="primary"
          icon="bi-layers"
        />
      </div>
    </div>
  );
}