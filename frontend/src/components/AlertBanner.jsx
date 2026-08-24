import React from "react";

export default function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-2 mb-4">
      {alerts.map((alt, idx) => {
        const isCritical = alt.level === "critical";
        return (
          <div
            key={idx}
            className={`alert ${
              isCritical ? "alert-danger border-danger" : "alert-warning border-warning"
            } shadow-sm rounded-4 d-flex align-items-start gap-3 p-3 m-0`}
            role="alert"
          >
            <div
              className={`rounded-circle p-2 d-flex align-items-center justify-content-center ${
                isCritical ? "bg-danger text-white" : "bg-warning text-dark"
              }`}
              style={{ width: 36, height: 36, fontSize: 18 }}
            >
              <i className={`bi ${isCritical ? "bi-exclamation-octagon-fill" : "bi-exclamation-triangle-fill"}`} />
            </div>

            <div className="flex-grow-1">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <strong className="text-dark" style={{ fontSize: "14px" }}>
                  {alt.title}
                </strong>
                <span
                  className={`badge ${
                    isCritical ? "bg-danger" : "bg-warning text-dark"
                  } text-uppercase font-mono`}
                  style={{ fontSize: "10px" }}
                >
                  {alt.level}
                </span>
              </div>
              <p className="small mb-1 text-secondary">{alt.message}</p>
              <div className="small fw-semibold text-dark">
                <strong>Recommended Action:</strong> {alt.action}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}