import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Area, ComposedChart
} from "recharts";

export default function WearChart({ history = [] }) {
  const data = history.map((x) => ({ cycle: Number(x.cycle), wear: Number(x.wear_um) })).filter((x) => Number.isFinite(x.wear));

  return (
    <div className="cad-panel">
      <div className="cad-panel-header">
        <div>
          <div className="panel-title">Wear trajectory</div>
          <div className="panel-subtitle">Predicted flank wear by machining pass</div>
        </div>
        <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)" }}>µm</span>
      </div>
      <div className="chart-card-body">
        {data.length < 1 ? (
          <div className="h-100 d-flex align-items-center justify-content-center text-secondary small">
            Run an analysis to build the wear trajectory.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 15, right: 18, left: -10, bottom: 4 }}>
              <defs>
                <linearGradient id="wearFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1769e0" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#1769e0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#edf1f5" vertical={false} />
              <XAxis dataKey="cycle" tick={{ fontSize: 9, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={200} stroke="#d97706" strokeDasharray="5 5" />
              <ReferenceLine y={300} stroke="#dc2626" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="wear" stroke="none" fill="url(#wearFill)" />
              <Line type="monotone" dataKey="wear" stroke="#1769e0" strokeWidth={2.5} dot={{ r: 3, fill: "#1769e0" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
