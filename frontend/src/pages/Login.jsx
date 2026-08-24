import { useState } from "react";
import { sendOtp, verifyOtp } from "../services/api";
import hero from "../assets/hero.png";

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [step, setStep] = useState("credentials");
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "Operator" });
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key, value) => setForm((x) => ({ ...x, [key]: value }));

  const requestOtp = async (e) => {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await sendOtp({ ...form, mode });
      setStep("otp");
    } catch (err) {
      setMessage(err?.response?.data?.error || err?.response?.data?.message || "Unable to send verification code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const data = await verifyOtp({ email: form.email, otp });
      const user = data.user || { email: form.email, name: form.name || "Operator", role: form.role };
      if (data.token) localStorage.setItem("phm_jwt_token", data.token);
      localStorage.setItem("phm_auth_user", JSON.stringify(user));
      onAuthenticated(user);
    } catch (err) {
      setMessage(err?.response?.data?.error || err?.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-visual">
        <img src={hero} alt="CNC machining" />
        <div className="login-visual-copy">
          <div className="login-kicker">INDUSTRIAL PHM PLATFORM</div>
          <h1>Tool health, made clear.</h1>
          <p>Multimodal wear prediction for high-speed CNC machining — image, sensor telemetry and explainable AI in one workspace.</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="brand-mark"><i className="bi bi-crosshair2" /></div>
            <div>
              <div className="brand-name">ToolWear.AI</div>
              <div className="brand-sub">CNC PHM Suite</div>
            </div>
          </div>

          <h1 className="auth-title">{step === "otp" ? "Verify access" : mode === "signin" ? "Welcome back" : "Create operator access"}</h1>
          <p className="auth-subtitle">
            {step === "otp" ? `Enter the 6-digit code sent to ${form.email}.` : "Secure access to tool health and predictive maintenance."}
          </p>

          {step === "credentials" ? (
            <>
              <div className="auth-tabs">
                <button className={`auth-tab ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")}>Sign in</button>
                <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Sign up</button>
              </div>

              {message && <div className="auth-message">{message}</div>}

              <form onSubmit={requestOtp}>
                {mode === "signup" && (
                  <div className="auth-field">
                    <label className="auth-label">Name</label>
                    <input className="form-control form-control-clean" value={form.name} onChange={(e) => update("name", e.target.value)} required />
                  </div>
                )}

                <div className="auth-field">
                  <label className="auth-label">Email</label>
                  <input type="email" className="form-control form-control-clean" value={form.email} onChange={(e) => update("email", e.target.value)} required />
                </div>

                <div className="auth-field">
                  <label className="auth-label">Password</label>
                  <input type="password" className="form-control form-control-clean" value={form.password} onChange={(e) => update("password", e.target.value)} required />
                </div>

                {mode === "signup" && (
                  <div className="auth-field">
                    <label className="auth-label">Role</label>
                    <select className="form-select form-select-clean" value={form.role} onChange={(e) => update("role", e.target.value)}>
                      <option>Operator</option>
                      <option>Engineer</option>
                      <option>Supervisor</option>
                    </select>
                  </div>
                )}

                <button className="btn-main w-100 mt-2" disabled={busy}>
                  {busy ? "Please wait…" : "Continue"}
                </button>
              </form>

              <div className="auth-demo">
                Demo account: <b>operator@cnc.com</b> · password <b>password123</b>
              </div>
            </>
          ) : (
            <>
              {message && <div className="auth-message">{message}</div>}
              <form onSubmit={verify}>
                <div className="auth-field">
                  <label className="auth-label">Verification code</label>
                  <input
                    className="form-control form-control-clean text-center font-mono"
                    style={{ fontSize: 20, letterSpacing: 6 }}
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <button className="btn-main w-100" disabled={busy || otp.length !== 6}>
                  {busy ? "Verifying…" : "Verify & enter"}
                </button>
              </form>
              <button className="btn btn-link w-100 mt-2 text-secondary" onClick={() => setStep("credentials")}>
                Use a different account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
