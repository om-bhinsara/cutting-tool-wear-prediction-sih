import React, { useMemo } from "react";

export default function TelemetryChart({
  telemetry,
  activeChannel = "fx",
}) {
  console.log("[TelemetryChart] telemetry:", telemetry);
  console.log("[TelemetryChart] active channel:", activeChannel);

  const samples = useMemo(() => {
    if (!telemetry) {
      return [];
    }

    let data = telemetry;

    // Support:
    // sensor_waveforms: [...]
    // { sensor_waveforms: [...] }
    // { data: [...] }
    if (!Array.isArray(data)) {
      data =
        data.sensor_waveforms ||
        data.telemetry ||
        data.data ||
        data.samples ||
        [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    // Backend uses Fx/Fy/Fz, while frontend buttons use
    // fx/fy/fz. Map them here.
    const channelMap = {
      fx: "Fx",
      fy: "Fy",
      fz: "Fz",
      vibration: "accel",
      ae: "acoustic",
    };

    const backendKey =
      channelMap[activeChannel] || activeChannel;

    const extracted = data
      .map((point, index) => {
        if (
          point === null ||
          typeof point !== "object"
        ) {
          return null;
        }

        const value = Number(
          point[backendKey]
        );

        if (!Number.isFinite(value)) {
          return null;
        }

        return {
          index,
          t:
            point.t != null
              ? Number(point.t)
              : index,
          value,
        };
      })
      .filter(Boolean);

    console.log(
      "[TelemetryChart] backend key:",
      backendKey
    );

    console.log(
      "[TelemetryChart] extracted samples:",
      extracted
    );

    return extracted;
  }, [telemetry, activeChannel]);

  if (!samples.length) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: "350px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "#eff6ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            color: "#1769e0",
            marginBottom: "16px",
          }}
        >
          ∿
        </div>

        <div
          style={{
            fontSize: "18px",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          No readable {getChannelLabel(activeChannel)} data
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#64748b",
          }}
        >
          Telemetry was received, but no numeric
          samples were found for this channel.
        </div>
      </div>
    );
  }

  const width = 1000;
  const height = 380;

  const paddingLeft = 65;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 45;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const values = samples.map(
    (sample) => sample.value
  );

  let min = Math.min(...values);
  let max = Math.max(...values);

  // Prevent zero-height graph when all values are identical.
  if (min === max) {
    const padding =
      Math.abs(min) > 0
        ? Math.abs(min) * 0.1
        : 1;

    min -= padding;
    max += padding;
  }

  const range = max - min;

  const points = samples
    .map((sample, index) => {
      const x =
        paddingLeft +
        (index /
          Math.max(samples.length - 1, 1)) *
          chartWidth;

      const y =
        paddingTop +
        chartHeight -
        ((sample.value - min) / range) *
          chartHeight;

      return `${x},${y}`;
    })
    .join(" ");

  const zeroY =
    min <= 0 && max >= 0
      ? paddingTop +
        chartHeight -
        ((0 - min) / range) *
          chartHeight
      : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "350px",
        padding: "10px 15px 15px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
          padding: "0 8px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {getChannelLabel(activeChannel)}
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginTop: "3px",
            }}
          >
            {samples.length} samples
          </div>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          Min {formatNumber(min)} · Max{" "}
          {formatNumber(max)}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="calc(100% - 45px)"
        preserveAspectRatio="none"
        style={{
          display: "block",
          overflow: "visible",
        }}
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(
          (fraction) => {
            const y =
              paddingTop +
              fraction * chartHeight;

            const value =
              max - fraction * range;

            return (
              <g key={fraction}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                >
                  {formatNumber(value)}
                </text>
              </g>
            );
          }
        )}

        {/* Zero reference line */}
        {zeroY !== null && (
          <line
            x1={paddingLeft}
            y1={zeroY}
            x2={width - paddingRight}
            y2={zeroY}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="5 5"
          />
        )}

        {/* Vertical axis */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={
            paddingTop +
            chartHeight
          }
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Bottom axis */}
        <line
          x1={paddingLeft}
          y1={
            paddingTop +
            chartHeight
          }
          x2={width - paddingRight}
          y2={
            paddingTop +
            chartHeight
          }
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Telemetry waveform */}
        <polyline
          points={points}
          fill="none"
          stroke="#1769e0"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start point */}
        {samples.length > 0 && (
          <circle
            cx={
              paddingLeft
            }
            cy={
              paddingTop +
              chartHeight -
              ((samples[0].value - min) /
                range) *
                chartHeight
            }
            r="4"
            fill="#1769e0"
          />
        )}

        {/* End point */}
        {samples.length > 1 && (
          <circle
            cx={
              paddingLeft +
              chartWidth
            }
            cy={
              paddingTop +
              chartHeight -
              ((samples[samples.length - 1].value -
                min) /
                range) *
                chartHeight
            }
            r="4"
            fill="#1769e0"
          />
        )}

        {/* X axis labels */}
        <text
          x={paddingLeft}
          y={height - 15}
          fontSize="11"
          fill="#64748b"
        >
          0
        </text>

        <text
          x={width - paddingRight}
          y={height - 15}
          textAnchor="end"
          fontSize="11"
          fill="#64748b"
        >
          {samples[samples.length - 1]?.t ?? samples.length - 1}
        </text>

        <text
          x={width / 2}
          y={height - 15}
          textAnchor="middle"
          fontSize="11"
          fill="#64748b"
        >
          Sample
        </text>
      </svg>
    </div>
  );
}

function getChannelLabel(channel) {
  const labels = {
    fx: "Fx",
    fy: "Fy",
    fz: "Fz",
    vibration: "Vibration",
    ae: "Acoustic Emission",
  };

  return labels[channel] || channel;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (
    Math.abs(value) >= 1000 ||
    Math.abs(value) < 0.01
  ) {
    return value.toExponential(2);
  }

  return value.toFixed(3);
}