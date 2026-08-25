import hero from "../assets/hero.png";

export default function Specs() {
  const specs = [
    ["Machine", "Roders RFM760"],
    ["Workpiece", "CK45 / RVS 304"],
    ["Image input", "224 × 224 RGB"],
    ["Sensor input", "5 × 512"],
    ["Image embedding", "96-D"],
    ["Sensor embedding", "64-D"],
    ["Fusion", "160 → 96 → 48 → 1"],
    ["Framework", "PyTorch"],
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="section-kicker">SYSTEM / CONFIGURATION</div>
          <h1 className="page-heading">Machine & model</h1>
          <p className="page-description">The setup behind ToolWear.AI predictions.</p>
        </div>
      </div>

      <div className="specs-grid">
        <div className="cad-panel spec-hero">
          <img src={hero} alt="CNC machining environment" />
          <div className="spec-hero-overlay">
            <div className="spec-hero-title">Roders RFM760</div>
            <div className="spec-hero-sub">High-speed milling center · Tool wear PHM</div>
          </div>
        </div>

        <div className="cad-panel">
          <div className="cad-panel-header">
            <div><div className="panel-title">System snapshot</div><div className="panel-subtitle">Core configuration</div></div>
          </div>
          <div className="spec-list">
            {specs.map(([a, b]) => <div className="spec-item" key={a}><div className="spec-item-label">{a}</div><div className="spec-item-value">{b}</div></div>)}
          </div>
        </div>
      </div>

      <div className="cad-panel mt-3">
        <div className="cad-panel-header">
          <div><div className="panel-title">Multimodal model</div><div className="panel-subtitle">Image + sensor fusion</div></div>
        </div>
        <div className="architecture">
          <div className="arch-node">224×224<br />Tool Image</div>
          <div className="arch-arrow">→</div>
          <div className="arch-node">CNN<br />96-D</div>
          <div className="arch-arrow">→</div>
          <div className="arch-node">Fusion<br />160-D</div>
          <div className="arch-arrow">←</div>
          <div className="arch-node">Sensor CNN<br />64-D</div>
          <div className="arch-arrow">←</div>
          <div className="arch-node">5 × 512<br />Telemetry</div>
        </div>
      </div>

      <div className="cad-panel mt-3 overflow-hidden">
        <div className="cad-panel-header">
          <div><div className="panel-title">Operating parameters</div><div className="panel-subtitle">Machine setup reference</div></div>
        </div>
        <div className="table-responsive">
          <table className="history-table">
            <thead><tr><th>Parameter</th><th>Symbol</th><th>Purpose</th></tr></thead>
            <tbody>
              <tr><td>Cutting speed</td><td className="font-mono">Vc</td><td>Material removal conditions</td></tr>
              <tr><td>Spindle speed</td><td className="font-mono">n</td><td>Rotational speed</td></tr>
              <tr><td>Feed per tooth</td><td className="font-mono">fz</td><td>Tool engagement</td></tr>
              <tr><td>Feed rate</td><td className="font-mono">Vf</td><td>Table feed</td></tr>
              <tr><td>Radial depth</td><td className="font-mono">ae</td><td>Radial engagement</td></tr>
              <tr><td>Axial depth</td><td className="font-mono">ap</td><td>Axial engagement</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
