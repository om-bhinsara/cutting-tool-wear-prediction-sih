import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "http://localhost:5000";

const WORKPIECE_MATERIALS = [
  {
    id: "CK45",
    name: "CK45 Carbon Steel",
    tag: "High Wear Resistance",
    desc: "DIN 1.1191 medium carbon structural steel",
    icon: "bi-shield-shaded",
  },
  {
    id: "RVS304",
    name: "RVS 304 Stainless",
    tag: "Abrasive / Austenitic",
    desc: "AISI 304 corrosion-resistant alloy",
    icon: "bi-shield-check",
  },
];

const MACHINE_TYPES = [
  {
    id: "High-Speed Machining Center",
    name: "High-Speed Milling Center",
    desc: "Up to 15,000 RPM · 3-5 Axis",
  },
  {
    id: "5-Axis Universal Mill",
    name: "5-Axis Universal Machining",
    desc: "Simultaneous 5-axis aerospace profiling",
  },
  {
    id: "Heavy Duty CNC Mill",
    name: "Heavy Roughing Mill",
    desc: "High torque · Heavy steel cutting",
  },
];

const CONTROLLERS = [
  {
    id: "Heidenhain TNC 640",
    name: "Heidenhain TNC 640",
  },
  {
    id: "Siemens Sinumerik 840D",
    name: "Siemens 840D sl",
  },
  {
    id: "Fanuc 31i-B5",
    name: "Fanuc Series 31i",
  },
];

export default function Machines({
  user,
  selectedMachine,
  onMachineSelect,
  onViewMachine,
}) {
  const navigate = useNavigate();

  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    id: "",
    name: "",
    material: "CK45",
    tool_material: "Coated Carbide (TiAlN)",
    insert_type: "CoroMill 390 (10mm)",
    model_type: "High-Speed Machining Center",
    controller: "Heidenhain TNC 640",
    spindle_max_rpm: 15000,
    feed_max_mm_min: 30000,
  });

  const loadMachines = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_BASE}/api/machines`);

      setMachines(res.data || []);
    } catch (err) {
      console.error("Failed to load machines:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const handleSelectMachine = (machine) => {
    if (!machine) return;

    console.log("Selecting machine:", machine);

    // Store selected machine information
    localStorage.setItem(
      "active_machine_id",
      machine.id
    );

    localStorage.setItem(
      "active_machine_name",
      machine.name
    );

    // Store complete machine object
    localStorage.setItem(
      "active_machine",
      JSON.stringify(machine)
    );

    // Update App state
    if (onMachineSelect) {
      onMachineSelect(machine);
    }

    // Optional callback if App provides it
    if (onViewMachine) {
      onViewMachine(machine);
    }

    // Navigate directly to dashboard
    navigate("/dashboard");
  };

  const handleAddMachine = async (e) => {
    e.preventDefault();

    if (!form.id || !form.name) {
      alert("Please enter machine ID and machine name.");
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/api/machines`,
        form
      );

      setShowModal(false);

      setForm({
        id: "",
        name: "",
        material: "CK45",
        tool_material: "Coated Carbide (TiAlN)",
        insert_type: "CoroMill 390 (10mm)",
        model_type: "High-Speed Machining Center",
        controller: "Heidenhain TNC 640",
        spindle_max_rpm: 15000,
        feed_max_mm_min: 30000,
      });

      await loadMachines();
    } catch (err) {
      console.error("Failed to create machine:", err);

      alert(
        err.response?.data?.error ||
          "Failed to create machine"
      );
    }
  };

  return (
    <div className="p-4">

      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">

        <div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 mb-1 font-mono text-uppercase">
            Fleet Control
          </span>

          <h4 className="fw-bold m-0 text-dark">
            CNC Machine Fleet
          </h4>

          <span className="text-secondary small">
            Select an active CNC machine to monitor its isolated
            telemetry and tool degradation lifecycle
          </span>
        </div>

        <button
          className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 shadow-sm"
          onClick={() => setShowModal(true)}
        >
          <i className="bi bi-plus-circle-fill" />
          Add Machine
        </button>

      </div>

      {loading ? (

        <div className="text-center py-5 text-secondary">

          <div
            className="spinner-border text-primary me-2"
            role="status"
          />

          <span>
            Loading machine fleet...
          </span>

        </div>

      ) : (

        <div className="row g-4">

          {machines.map((machine) => {

            const isActive =
              selectedMachine?.id === machine.id;

            return (

              <div
                className="col-12 col-md-6 col-xl-4"
                key={machine.id}
              >

                <div
                  className={`card h-100 border-0 rounded-4 shadow-sm p-4 transition-all ${
                    isActive
                      ? "ring-2 ring-primary border-primary bg-primary bg-opacity-10"
                      : "bg-white"
                  }`}
                  style={{
                    border: isActive
                      ? "2px solid #1769e0"
                      : "1px solid #edf2f7",
                  }}
                >

                  <div className="d-flex justify-content-between align-items-start mb-3">

                    <div className="d-flex align-items-center gap-3">

                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center bg-light text-primary shadow-sm"
                        style={{
                          width: 44,
                          height: 44,
                          fontSize: 20,
                        }}
                      >
                        ⚙
                      </div>

                      <div>

                        <h5 className="fw-bold text-dark m-0">
                          {machine.name}
                        </h5>

                        <span className="font-mono text-muted small">
                          {machine.id}
                        </span>

                      </div>

                    </div>

                    <span
                      className={`badge rounded-pill px-2 py-1 text-uppercase ${
                        isActive
                          ? "bg-primary text-white"
                          : "bg-success-subtle text-success border border-success-subtle"
                      }`}
                      style={{ fontSize: 10 }}
                    >
                      {isActive
                        ? "ACTIVE"
                        : machine.status || "ONLINE"}
                    </span>

                  </div>

                  <div className="bg-light bg-opacity-75 rounded-3 p-3 mb-4">

                    <div className="d-flex justify-content-between mb-1 small">

                      <span className="text-muted">
                        Workpiece Material:
                      </span>

                      <span className="badge bg-secondary-subtle text-dark border">
                        {machine.material || "CK45"}
                      </span>

                    </div>

                    <div className="d-flex justify-content-between mb-1 small">

                      <span className="text-muted">
                        Machining Type:
                      </span>

                      <span className="fw-semibold text-dark text-end">
                        {machine.model_type ||
                          "High-Speed Machining Center"}
                      </span>

                    </div>

                    <div className="d-flex justify-content-between mb-1 small">

                      <span className="text-muted">
                        Controller:
                      </span>

                      <span className="fw-semibold text-dark">
                        {machine.controller ||
                          "Heidenhain TNC 640"}
                      </span>

                    </div>

                    <div className="d-flex justify-content-between mb-1 small">

                      <span className="text-muted">
                        Logged Passes:
                      </span>

                      <span className="fw-semibold text-dark">
                        {machine.passes_count || 0} cycles
                      </span>

                    </div>

                    <div className="d-flex justify-content-between small pt-2 border-top">

                      <span className="text-muted">
                        Latest Wear:
                      </span>

                      <span className="fw-bold text-primary">
                        {machine.wear_um != null
                          ? `${Number(
                              machine.wear_um
                            ).toFixed(1)} µm`
                          : "No data logged"}
                      </span>

                    </div>

                  </div>

                  <button
                    className={`btn w-100 rounded-pill py-2 font-medium ${
                      isActive
                        ? "btn-outline-primary fw-semibold"
                        : "btn-primary shadow-sm"
                    }`}
                    onClick={() =>
                      handleSelectMachine(machine)
                    }
                  >
                    {isActive
                      ? "✓ Currently Active"
                      : "Select & Monitor"}
                  </button>

                </div>

              </div>

            );
          })}

        </div>

      )}

      {showModal && (

        <div
          className="modal show d-block"
          style={{
            backgroundColor:
              "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
          }}
        >

          <div className="modal-dialog modal-dialog-centered modal-lg">

            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">

              <form onSubmit={handleAddMachine}>

                <div className="modal-header bg-primary text-white p-4">

                  <div>

                    <h5 className="modal-title fw-bold m-0">
                      Register New CNC Machine
                    </h5>

                    <span className="small opacity-85">
                      Define telemetry specifications and cutting
                      tool materials
                    </span>

                  </div>

                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() =>
                      setShowModal(false)
                    }
                  />

                </div>

                <div
                  className="modal-body p-4"
                  style={{
                    maxHeight: "70vh",
                    overflowY: "auto",
                  }}
                >

                  <div className="row g-3 mb-4">

                    <div className="col-12 col-md-6">

                      <label className="form-label small fw-bold text-secondary">
                        MACHINE ID (UNIQUE CODE)
                      </label>

                      <input
                        className="form-control rounded-3 font-mono"
                        placeholder="e.g. MCH-002"
                        value={form.id}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            id: e.target.value.toUpperCase(),
                          })
                        }
                        required
                      />

                    </div>

                    <div className="col-12 col-md-6">

                      <label className="form-label small fw-bold text-secondary">
                        MACHINE NAME / MODEL
                      </label>

                      <input
                        className="form-control rounded-3"
                        placeholder="e.g. DMU 50 EVO"
                        value={form.name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            name: e.target.value,
                          })
                        }
                        required
                      />

                    </div>

                  </div>

                  <div className="mb-4">

                    <label className="form-label small fw-bold text-secondary d-block mb-2">
                      TARGET WORKPIECE MATERIAL
                    </label>

                    <div className="row g-3">

                      {WORKPIECE_MATERIALS.map((material) => {

                        const selected =
                          form.material === material.id;

                        return (

                          <div
                            className="col-12 col-md-6"
                            key={material.id}
                          >

                            <div
                              className={`card p-3 rounded-4 cursor-pointer transition-all border-2 ${
                                selected
                                  ? "border-primary bg-primary bg-opacity-10 shadow-sm"
                                  : "border-light bg-light bg-opacity-50"
                              }`}
                              style={{
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  material:
                                    material.id,
                                })
                              }
                            >

                              <div className="d-flex justify-content-between align-items-center mb-1">

                                <div className="d-flex align-items-center gap-2">

                                  <i
                                    className={`bi ${material.icon} text-primary fs-5`}
                                  />

                                  <span className="fw-bold text-dark">
                                    {material.name}
                                  </span>

                                </div>

                                <input
                                  type="radio"
                                  className="form-check-input"
                                  checked={selected}
                                  onChange={() =>
                                    setForm({
                                      ...form,
                                      material:
                                        material.id,
                                    })
                                  }
                                />

                              </div>

                              <span
                                className="badge bg-secondary-subtle text-secondary w-auto align-self-start my-1"
                                style={{
                                  fontSize: "10px",
                                }}
                              >
                                {material.tag}
                              </span>

                              <div className="text-muted small mt-1">
                                {material.desc}
                              </div>

                            </div>

                          </div>

                        );
                      })}

                    </div>

                  </div>

                  <div className="mb-4">

                    <label className="form-label small fw-bold text-secondary d-block mb-2">
                      MACHINING TYPE & OPERATION
                    </label>

                    <div className="row g-2">

                      {MACHINE_TYPES.map((type) => {

                        const selected =
                          form.model_type === type.id;

                        return (

                          <div
                            className="col-12 col-md-4"
                            key={type.id}
                          >

                            <div
                              className={`card p-3 rounded-3 h-100 cursor-pointer border-2 ${
                                selected
                                  ? "border-primary bg-primary bg-opacity-10 shadow-sm"
                                  : "border-light bg-light"
                              }`}
                              style={{
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  model_type:
                                    type.id,
                                })
                              }
                            >

                              <div className="fw-bold small text-dark mb-1">
                                {type.name}
                              </div>

                              <div
                                className="text-muted"
                                style={{
                                  fontSize: "11px",
                                }}
                              >
                                {type.desc}
                              </div>

                            </div>

                          </div>

                        );
                      })}

                    </div>

                  </div>

                  <div className="mb-2">

                    <label className="form-label small fw-bold text-secondary d-block mb-2">
                      CONTROLLER UNIT
                    </label>

                    <div className="row g-2">

                      {CONTROLLERS.map((controller) => {

                        const selected =
                          form.controller ===
                          controller.id;

                        return (

                          <div
                            className="col-12 col-md-4"
                            key={controller.id}
                          >

                            <div
                              className={`card p-2 rounded-3 text-center cursor-pointer border-2 ${
                                selected
                                  ? "border-primary bg-primary bg-opacity-10 shadow-sm"
                                  : "border-light bg-light"
                              }`}
                              style={{
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  controller:
                                    controller.id,
                                })
                              }
                            >

                              <span
                                className={`small ${
                                  selected
                                    ? "fw-bold text-primary"
                                    : "text-dark"
                                }`}
                              >
                                {controller.name}
                              </span>

                            </div>

                          </div>

                        );
                      })}

                    </div>

                  </div>

                </div>

                <div className="modal-footer border-0 p-4 pt-0">

                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-4"
                    onClick={() =>
                      setShowModal(false)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary rounded-pill px-4"
                  >
                    Register Machine
                  </button>

                </div>

              </form>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}