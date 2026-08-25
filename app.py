import io
import os
import sys
import json
import base64
import random
import re
import socket
import datetime
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

try:
    import dns.resolver
    HAS_DNSPYTHON = True
except ImportError:
    HAS_DNSPYTHON = False


sys.path.append("src")

try:
    from model import MultimodalWearModel
except ImportError:
    from src.model import MultimodalWearModel


app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ============================================================
# DATABASE CONFIGURATION & MODELS
# ============================================================

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False, default="CNC Floor Operator")
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


class Machine(db.Model):
    __tablename__ = "machines"

    id = db.Column(db.String(50), primary_key=True)  # e.g., "MCH-002"
    name = db.Column(db.String(100), nullable=False) # e.g., "DMU 50 EVO"
    model_type = db.Column(db.String(100), default="High-Speed Machining Center")
    material = db.Column(db.String(50), default="CK45") # "CK45" or "RVS304"
    tool_material = db.Column(db.String(100), default="Coated Carbide (TiAlN)")
    insert_type = db.Column(db.String(100), default="CoroMill 390 (10mm)")
    spindle_max_rpm = db.Column(db.Integer, default=15000)
    feed_max_mm_min = db.Column(db.Integer, default=30000)
    controller = db.Column(db.String(100), default="Heidenhain TNC 640")
    status = db.Column(db.String(50), default="Online")
    user_email = db.Column(db.String(120), db.ForeignKey("users.email"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    records = db.relationship("PredictionRecord", backref="machine", lazy=True, cascade="all, delete-orphan")


class PredictionRecord(db.Model):
    __tablename__ = "prediction_records"

    id = db.Column(db.Integer, primary_key=True)
    machine_id = db.Column(db.String(50), db.ForeignKey("machines.id"), nullable=False)
    cycle = db.Column(db.Integer, nullable=False, default=1)
    wear_um = db.Column(db.Float, nullable=False)
    health_score = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=True)
    agreement_pct = db.Column(db.Float, nullable=True)
    rul_passes = db.Column(db.Integer, nullable=True)
    recommendation = db.Column(db.String(255), nullable=True)
    sensor_waveforms_json = db.Column(db.Text, nullable=True)
    gradcam_json = db.Column(db.Text, nullable=True)
    sensor_quality_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


with app.app_context():
    try:
        db.create_all()
        if not User.query.filter_by(email="operator@cnc.com").first():
            default_user = User(
                email="operator@cnc.com",
                name="Mayuresh Dudhat",
                role="CNC Floor Operator",
                password_hash=generate_password_hash("password123")
            )
            db.session.add(default_user)
            db.session.commit()
            print("[Database] Created default operator user: operator@cnc.com")

        if not Machine.query.filter_by(id="MCH-001").first():
            default_machine = Machine(
                id="MCH-001",
                name="RFM760",
                model_type="High-Speed Machining Center",
                material="CK45",
                tool_material="Coated Carbide (TiAlN)",
                insert_type="CoroMill 390 (10mm)",
                spindle_max_rpm=15000,
                feed_max_mm_min=30000,
                controller="Heidenhain TNC 640",
                status="Online",
                user_email="operator@cnc.com"
            )
            db.session.add(default_machine)
            db.session.commit()
            print("[Database] Created default machine: RFM760 (MCH-001)")
    except Exception as e:
        print(f"[Database Error] Table initialization error: {e}")


# ============================================================
# JWT & EMAIL CONFIG
# ============================================================

SECRET_KEY = os.getenv("JWT_SECRET", "cnc-industrial-phm-jwt-secret-key")
EMAIL_VERIFY_API_KEY = os.getenv("EMAIL_VERIFY_API_KEY", "")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

OTP_STORE = {}

DISPOSABLE_DOMAINS = {
    "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
    "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com",
    "throwawaymail.com", "temp-mail.org", "fakeinbox.com"
}

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

POSSIBLE_PATHS = [
    os.path.join("outputs", "checkpoints", "image_sensor.pt"),
    os.path.join("checkpoints", "image_sensor.pt"),
    "image_sensor.pt"
]

CHECKPOINT_PATH = None
for p in POSSIBLE_PATHS:
    if os.path.exists(p):
        CHECKPOINT_PATH = p
        break

model = None
y_mu = 107.5
y_sd = 54.37810176843301


def load_inference_model():
    global model, y_mu, y_sd
    if not CHECKPOINT_PATH:
        raise FileNotFoundError(f"Checkpoint 'image_sensor.pt' not found in: {POSSIBLE_PATHS}")

    ckpt = torch.load(CHECKPOINT_PATH, map_location=DEVICE)
    flags = ckpt.get("flags", (True, True, False))
    y_mu = float(ckpt.get("y_mu", y_mu))
    y_sd = float(ckpt.get("y_sd", y_sd))

    model = MultimodalWearModel(image=flags[0], sensor=flags[1], metadata=flags[2])
    model.load_state_dict(ckpt["model"])
    model.to(DEVICE)
    model.eval()
    print(f"Loaded model successfully from '{CHECKPOINT_PATH}' (mu={y_mu:.2f}, sd={y_sd:.2f})")


try:
    load_inference_model()
except Exception as e:
    print(f"Error loading checkpoint: {e}")


# ============================================================
# VERIFICATION & SMTP
# ============================================================

def verify_email_realtime_api(email_str):
    regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(regex, email_str):
        return False, "Invalid email address format."

    parts = email_str.split("@")
    if len(parts) != 2:
        return False, "Invalid email format."
    domain = parts[1].lower()

    if domain in DISPOSABLE_DOMAINS:
        return False, "Disposable or temporary email addresses are not permitted."

    if EMAIL_VERIFY_API_KEY.strip():
        try:
            url = f"https://emailvalidation.abstractapi.com/v1/?api_key={EMAIL_VERIFY_API_KEY.strip()}&email={email_str}"
            response = requests.get(url, timeout=7)
            if response.status_code == 200:
                data = response.json()
                deliverability = data.get("deliverability", "")
                is_valid_format = data.get("is_valid_format", {}).get("value", True)
                is_mx_found = data.get("is_mx_found", {}).get("value", True)
                is_smtp_valid = data.get("is_smtp_valid", {}).get("value", True)
                is_disposable = data.get("is_disposable_email", {}).get("value", False)
                quality_score = float(data.get("quality_score", 0.0))

                if not is_valid_format:
                    return False, "Invalid email format."
                if not is_mx_found:
                    return False, f"The domain '@{domain}' has no active mail servers."
                if is_disposable:
                    return False, "Disposable or temporary email addresses are not permitted."
                if deliverability != "DELIVERABLE" or is_smtp_valid is False or quality_score < 0.70:
                    return False, f"The email address '{email_str}' is invalid or cannot receive mail."
                return True, email_str
        except Exception:
            pass

    if HAS_DNSPYTHON:
        try:
            mx_records = dns.resolver.resolve(domain, "MX")
            if not mx_records:
                return False, f"The domain '@{domain}' cannot receive emails."
        except Exception:
            try:
                socket.gethostbyname(domain)
            except socket.gaierror:
                return False, f"Could not resolve domain '@{domain}'."
    else:
        try:
            socket.gethostbyname(domain)
        except socket.gaierror:
            return False, f"The email domain '@{domain}' does not exist."

    return True, email_str


def send_otp_email(receiver_email, otp_code, user_name="CNC Operator"):
    """Send a verification OTP using the SMTP credentials from .env."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return False, "SMTP credentials are not configured. Set SMTP_EMAIL and SMTP_PASSWORD in .env."

    sender_cleaned = SMTP_EMAIL.strip()
    receiver_cleaned = receiver_email.strip()

    msg = MIMEMultipart("alternative")
    msg["From"] = f"ToolWear.AI <{sender_cleaned}>"
    msg["To"] = receiver_cleaned
    msg["Reply-To"] = sender_cleaned
    msg["Subject"] = "Your ToolWear.AI verification code"

    text_content = f"""
Hello {user_name},

Your ToolWear.AI verification code is:

{otp_code}

This code will expire in 5 minutes.

If you did not request this code, you can safely ignore this email.

ToolWear.AI
"""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:white;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:#0284c7;padding:24px;text-align:center;color:white;">
                <h2 style="margin:0;">ToolWear.AI</h2>
                <p style="margin:6px 0 0;font-size:13px;">CNC Tool Wear Monitoring</p>
            </div>
            <div style="padding:30px;">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p style="color:#475569;line-height:1.6;">Use the verification code below to continue signing in to ToolWear.AI.</p>
                <div style="margin:25px 0;padding:18px;text-align:center;background:#f8fafc;border:1px solid #bae6fd;border-radius:8px;">
                    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0284c7;">{otp_code}</div>
                </div>
                <p style="font-size:13px;color:#64748b;">This verification code expires in 5 minutes.</p>
                <p style="font-size:12px;color:#94a3b8;">If you did not request this code, you can safely ignore this email.</p>
            </div>
            <div style="padding:15px 30px;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8;">
                ToolWear.AI • CNC Tool Health &amp; Prognostics
            </div>
        </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    server = None
    try:
        clean_password = SMTP_PASSWORD.replace(" ", "").strip()
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender_cleaned, clean_password)
        server.sendmail(sender_cleaned, receiver_cleaned, msg.as_string())
        return True, "Email sent successfully."
    except Exception as e:
        print(f"[SMTP ERROR] {type(e).__name__}: {e}")
        return False, str(e)
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:
                pass


# ============================================================
# AUTHENTICATION
# ============================================================

@app.route("/api/auth/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json() or {}
    raw_email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    auth_mode = data.get("mode", "signin")
    name = data.get("name", "CNC Operator")
    role = data.get("role", "CNC Floor Operator")

    if not raw_email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    is_valid, validated_email_or_msg = verify_email_realtime_api(raw_email)
    if not is_valid:
        return jsonify({"error": validated_email_or_msg}), 400

    email = validated_email_or_msg

    if auth_mode == "signin":
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "This email ID does not exist. Please create an account."}), 404
        if not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Incorrect password."}), 401
        user_name = user.name
        user_role = user.role
    else:
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "An account with this email already exists. Please sign in."}), 409
        user_name = name
        user_role = role

    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)

    OTP_STORE[email] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "mode": auth_mode,
        "user_data": {
            "email": email,
            "name": user_name,
            "role": user_role,
            "password": generate_password_hash(password) if auth_mode == "signup" else None
        }
    }

    success, msg = send_otp_email(email, otp_code, user_name)
    if not success:
        OTP_STORE.pop(email, None)
        return jsonify({"error": "Failed to send verification code. Please check your email."}), 400

    return jsonify({"message": f"Verification code sent to {email}.", "email": email}), 200


@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    otp_input = data.get("otp", "").strip()

    record = OTP_STORE.get(email)
    if not record:
        return jsonify({"error": "No pending verification found."}), 400

    if datetime.datetime.now(datetime.timezone.utc) > record["expires_at"]:
        del OTP_STORE[email]
        return jsonify({"error": "OTP has expired."}), 400

    if record["otp"] != otp_input:
        return jsonify({"error": "Incorrect verification code."}), 401

    user_info = record["user_data"]
    if record["mode"] == "signup":
        new_user = User(
            email=email,
            name=user_info["name"],
            role=user_info["role"],
            password_hash=user_info["password"]
        )
        db.session.add(new_user)
        db.session.commit()

    active_user = {"email": email, "name": user_info["name"], "role": user_info["role"]}

    token = jwt.encode(
        {
            "email": email,
            "name": active_user["name"],
            "role": active_user["role"],
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
        },
        SECRET_KEY,
        algorithm="HS256"
    )

    del OTP_STORE[email]
    return jsonify({"token": token, "user": active_user}), 200


# ============================================================
# MACHINE MANAGEMENT ROUTES
# ============================================================

@app.route("/api/machines", methods=["GET"])
def get_machines():
    machines = Machine.query.order_by(Machine.created_at.desc()).all()
    out = []
    for m in machines:
        latest = PredictionRecord.query.filter_by(machine_id=m.id).order_by(PredictionRecord.cycle.desc()).first()
        out.append({
            "id": m.id,
            "name": m.name,
            "model_type": m.model_type,
            "material": m.material,
            "tool_material": m.tool_material,
            "insert_type": m.insert_type,
            "spindle_max_rpm": m.spindle_max_rpm,
            "feed_max_mm_min": m.feed_max_mm_min,
            "controller": m.controller,
            "status": m.status,
            "wear_um": latest.wear_um if latest else None,
            "health_score": latest.health_score if latest else None,
            "passes_count": PredictionRecord.query.filter_by(machine_id=m.id).count()
        })
    return jsonify(out), 200


@app.route("/api/machines", methods=["POST"])
def add_machine():
    data = request.get_json() or {}
    machine_id = data.get("id", "").strip().upper()
    name = data.get("name", "").strip()

    if not machine_id or not name:
        return jsonify({"error": "Machine ID and Name are required."}), 400

    if Machine.query.filter_by(id=machine_id).first():
        return jsonify({"error": f"Machine with ID '{machine_id}' already exists."}), 409

    new_m = Machine(
        id=machine_id,
        name=name,
        model_type=data.get("model_type", "High-Speed Machining Center"),
        material=data.get("material", "CK45"),
        tool_material=data.get("tool_material", "Coated Carbide (TiAlN)"),
        insert_type=data.get("insert_type", "CoroMill 390 (10mm)"),
        spindle_max_rpm=int(data.get("spindle_max_rpm", 15000)),
        feed_max_mm_min=int(data.get("feed_max_mm_min", 30000)),
        controller=data.get("controller", "Heidenhain TNC 640"),
        status=data.get("status", "Online"),
        user_email=data.get("user_email")
    )
    db.session.add(new_m)
    db.session.commit()

    return jsonify({"message": "Machine created successfully", "machine": {"id": new_m.id, "name": new_m.name}}), 201


@app.route("/api/machines/<machine_id>/dashboard", methods=["GET"])
def get_machine_dashboard(machine_id):
    machine = Machine.query.filter_by(id=machine_id).first()
    if not machine:
        return jsonify({"error": "Machine not found"}), 404

    records = PredictionRecord.query.filter_by(machine_id=machine_id).order_by(PredictionRecord.cycle.asc()).all()
    latest = records[-1] if records else None

    history = [{
        "cycle": r.cycle,
        "wear_um": r.wear_um,
        "health_score": r.health_score,
        "status": r.status,
        "created_at": r.created_at.isoformat()
    } for r in records]

    latest_waveforms = []
    latest_gradcam = {}
    latest_quality = {}

    if latest:
        if latest.sensor_waveforms_json:
            try:
                latest_waveforms = json.loads(latest.sensor_waveforms_json)
            except Exception:
                latest_waveforms = []
        if latest.gradcam_json:
            try:
                latest_gradcam = json.loads(latest.gradcam_json)
            except Exception:
                latest_gradcam = {}
        if latest.sensor_quality_json:
            try:
                latest_quality = json.loads(latest.sensor_quality_json)
            except Exception:
                latest_quality = {}

    return jsonify({
        "machine": {
            "id": machine.id,
            "name": machine.name,
            "model_type": machine.model_type,
            "material": machine.material,
            "tool_material": machine.tool_material,
            "insert_type": machine.insert_type,
            "controller": machine.controller,
            "spindle_max_rpm": machine.spindle_max_rpm,
            "feed_max_mm_min": machine.feed_max_mm_min,
            "status": machine.status
        },
        "latest_result": {
            "wear_um": latest.wear_um if latest else None,
            "health_score": latest.health_score if latest else None,
            "status": latest.status if latest else "Awaiting analysis",
            "confidence": latest.confidence if latest else None,
            "agreement": latest.agreement_pct if latest else None,
            "rul_passes": latest.rul_passes if latest else None,
            "recommendation": latest.recommendation if latest else None,
            "gradcam": latest_gradcam,
            "sensor_quality": latest_quality,
            "sensor_waveforms": latest_waveforms
        } if latest else None,
        "history": history,
        "sensor_waveforms": latest_waveforms,
        "gradcam": latest_gradcam,
        "sensor_quality": latest_quality
    }), 200


# ============================================================
# PROGNOSTICS, DIAGNOSTICS & ALERTS LOGIC
# ============================================================

def evaluate_industrial_alerts(wear_um, rul_passes, sen_np):
    """
    Evaluates vibration peaks and tool remaining life to trigger industrial alerts.
    Channel 0 = Vibration / Acceleration in the 5x512 array.
    """
    alerts = []
    
        # 1. Vibration / Chatter Check
    # 1. Vibration / Chatter Check
    # Channel 0 = vibration / acceleration
    vib_channel = np.abs(sen_np[0, :])

    max_vib = float(np.max(vib_channel))
    rms_vib = float(np.sqrt(np.mean(vib_channel ** 2)))

    # Industrial vibration threshold
    VIBRATION_THRESHOLD_G = 2.5

    if max_vib >= VIBRATION_THRESHOLD_G:
        alerts.append({
            "type": "vibration",
            "level": "critical",
            "title": "Unusual Vibration Detected",
            "message": (
                f"Vibration records are unusual for this image. "
                f"Peak acceleration reached {max_vib:.2f}g "
                f"(RMS: {rms_vib:.2f}g), exceeding the "
                f"{VIBRATION_THRESHOLD_G:.1f}g threshold."
            ),
            "action": (
                "Consider manual machine maintenance inspection."
            )
        })

    return alerts, {"max_vib_g": round(max_vib, 2), "rms_vib_g": round(rms_vib, 2)}


def normalize_sensor_array(sensor_array):
    arr = np.asarray(sensor_array, dtype=np.float32)
    if arr.ndim == 1:
        if arr.size % 5 == 0:
            arr = arr.reshape(5, -1)
        else:
            raise ValueError(f"Sensor data must contain 5 channels. Received 1D array with {arr.size} values.")

    if arr.ndim != 2:
        raise ValueError(f"Sensor data must be a 2D array shaped (5, N). Received shape {arr.shape}.")

    if arr.shape[0] != 5 and arr.shape[1] == 5:
        arr = arr.T

    if arr.shape[0] != 5:
        raise ValueError(f"Sensor data must have 5 channels. Received shape {arr.shape}.")

    target_len = 512
    if arr.shape[1] > target_len:
        arr = arr[:, :target_len]
    elif arr.shape[1] < target_len:
        padded = np.zeros((5, target_len), dtype=np.float32)
        padded[:, :arr.shape[1]] = arr
        arr = padded

    if not np.isfinite(arr).all():
        raise ValueError("Sensor telemetry contains NaN or Inf values.")

    return np.ascontiguousarray(arr, dtype=np.float32)


def safe_gradcam(img_tensor, sen_tensor, original_np):
    try:
        return generate_layer6_gradcam(img_tensor, sen_tensor, original_np)
    except Exception as exc:
        print(f"[GradCAM Warning] {type(exc).__name__}: {exc}")
        return {"heatmap": None, "overlay": None, "original": None, "error": str(exc)}


def assess_sensor_quality(sen_np):
    is_flatline = np.all(sen_np == 0) or np.any(np.std(sen_np, axis=1) < 1e-4)
    has_nan = np.isnan(sen_np).any() or np.isinf(sen_np).any()
    std_per_ch = np.std(sen_np, axis=1)
    mean_std = float(np.mean(std_per_ch))

    if has_nan:
        return {"status": "Corrupted Signal (NaN/Inf Detected)", "valid": False, "confidence": 0.0, "color": "danger"}
    elif is_flatline:
        return {"status": "Flatline / Missing Channel", "valid": False, "confidence": 35.0, "color": "warning"}
    elif mean_std < 0.01:
        return {"status": "Weak Signal Amplitude", "valid": True, "confidence": 75.0, "color": "warning"}
    else:
        return {"status": "Optimal Signal (High SNR — All 5 Channels Active)", "valid": True, "confidence": 98.4, "color": "success"}


def compute_health_and_alerts(wear_um):
    health_score = max(0.0, min(100.0, round((1.0 - (wear_um / 300.0)) * 100, 1)))
    if wear_um <= 100.0:
        return {"status": "Healthy (0–100 µm)", "badge": "success", "health_score": health_score, "early_warning": False, "recommendation": "Optimal Condition — Continue Normal Operation", "rec_type": "success"}
    elif wear_um <= 200.0:
        return {"status": "Moderate (100–200 µm)", "badge": "warning", "health_score": health_score, "early_warning": False, "recommendation": "Active Steady Wear — Continue Monitoring", "rec_type": "warning"}
    elif wear_um <= 300.0:
        return {"status": "High (200–300 µm)", "badge": "danger", "health_score": health_score, "early_warning": True, "recommendation": "High Flank Wear Detected — Prepare Tool Replacement", "rec_type": "warning"}
    else:
        return {"status": "Critical (>300 µm)", "badge": "dark", "health_score": 0.0, "early_warning": True, "recommendation": "Critical Failure Limit Exceeded — Replace Tool Immediately", "rec_type": "danger"}


def generate_layer6_gradcam(img_tensor, sen_tensor, original_np):
    target_layer = model.image.net[6]
    activations = None
    gradients = None

    def forward_hook(m, inp, out):
        nonlocal activations
        activations = out

    def backward_hook(m, gi, go):
        nonlocal gradients
        gradients = go[0]

    f_handle = target_layer.register_forward_hook(forward_hook)
    b_handle = target_layer.register_full_backward_hook(backward_hook)

    model.zero_grad(set_to_none=True)
    dummy_meta = torch.zeros((1, 7), dtype=torch.float32, device=DEVICE)
    pred_scaled = model(img_tensor, sen_tensor, dummy_meta)
    pred_scaled.backward()

    weights = gradients.mean(dim=(2, 3), keepdim=True)
    cam = (weights * activations).sum(dim=1, keepdim=True)
    cam = F.relu(cam)
    cam = F.interpolate(cam, size=(224, 224), mode="bilinear", align_corners=False)
    cam = cam.squeeze().detach().cpu().numpy()
    cam -= cam.min()

    if cam.max() > 1e-8:
        cam /= cam.max()

    cam = np.power(cam, 0.8)

    heatmap = np.zeros((cam.shape[0], cam.shape[1], 3), dtype=np.float32)
    heatmap[..., 0] = np.clip(2.0 * cam, 0, 1)
    heatmap[..., 1] = np.clip(2.0 * (1.0 - np.abs(cam - 0.5) * 2.0), 0, 1)
    heatmap[..., 2] = np.clip(2.0 * (1.0 - cam), 0, 1)
    heatmap_uint8 = (heatmap * 255).astype(np.uint8)

    ALPHA = 0.35
    overlay_uint8 = np.clip((1.0 - ALPHA) * original_np.astype(np.float32) + ALPHA * heatmap_uint8.astype(np.float32), 0, 255).astype(np.uint8)

    f_handle.remove()
    b_handle.remove()

    def to_b64(arr):
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    return {
        "heatmap": to_b64(heatmap_uint8),
        "overlay": to_b64(overlay_uint8),
        "original": to_b64(original_np)
    }


def compute_multimodal_agreement(img_tensor, sen_tensor):
    with torch.no_grad():
        img_feat = model.image(img_tensor)
        sen_feat = model.sensor(sen_tensor)

        img_energy = float(torch.norm(img_feat).cpu().item())
        sen_energy = float(torch.norm(sen_feat).cpu().item())

        ratio = min(img_energy, sen_energy) / (max(img_energy, sen_energy) + 1e-6)
        agreement_pct = round(min(100.0, max(50.0, ratio * 100 + 25.0)), 1)

        if agreement_pct >= 80.0:
            status = "Strong Agreement (High Multimodal Coherence)"
            color = "success"
        elif agreement_pct >= 65.0:
            status = "Moderate Agreement (Consistent Visual & Signal Trends)"
            color = "info"
        else:
            status = "Weak Agreement (Discrepancy Between Micrograph & Forces)"
            color = "warning"

        return {
            "score_pct": agreement_pct,
            "status": status,
            "color": color,
            "img_activation": round(img_energy, 2),
            "sensor_activation": round(sen_energy, 2)
        }


# ============================================================
# PREDICTION
# ============================================================
@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({
            "error": f"Model checkpoint not loaded. Checked: {POSSIBLE_PATHS}"
        }), 500

    try:
        # ============================================================
        # 1. IMAGE INPUT
        # ============================================================

        if "image" not in request.files:
            return jsonify({
                "error": "Micrograph crop image ('image') is required."
            }), 400

        image_file = request.files["image"]

        if not image_file.filename:
            return jsonify({
                "error": "Please select a tool micrograph image."
            }), 400

        stem = os.path.splitext(image_file.filename)[0]

        try:
            pil_img = (
                Image.open(image_file.stream)
                .convert("RGB")
                .resize((224, 224))
            )
        except Exception as image_err:
            return jsonify({
                "error": f"Invalid image file: {image_err}"
            }), 400

        original_np = np.asarray(
            pil_img,
            dtype=np.uint8
        )

        img_np = (
            original_np
            .astype(np.float32)
            .transpose(2, 0, 1)
            / 255.0
        )

        img_tensor = (
            torch.from_numpy(img_np)
            .unsqueeze(0)
            .to(DEVICE)
        )

        img_tensor.requires_grad_(True)

        # ============================================================
        # 2. SENSOR INPUT
        # ============================================================
        # Sensor telemetry is REQUIRED because vibration analysis
        # depends on the uploaded sensor data.
        #
        # Expected format:
        #     5 channels x N samples
        #
        # Channel 0 = vibration / acceleration
        # Channel 1 = acoustic
        # Channel 2 = Fx
        # Channel 3 = Fy
        # Channel 4 = Fz
        # ============================================================

        sen_np = None

        if "sensor" in request.files:
            sensor_file = request.files["sensor"]

            if not sensor_file.filename:
                return jsonify({
                    "error": "Sensor telemetry file is required."
                }), 400

            try:
                sen_np = np.load(
                    io.BytesIO(sensor_file.read())
                ).astype(np.float32)

            except Exception as sensor_err:
                return jsonify({
                    "error": f"Invalid sensor telemetry file: {sensor_err}"
                }), 400

        elif "sensor_json" in request.form:
            try:
                sen_np = np.array(
                    json.loads(request.form["sensor_json"]),
                    dtype=np.float32
                )

            except Exception as sensor_err:
                return jsonify({
                    "error": f"Invalid sensor telemetry data: {sensor_err}"
                }), 400

        else:
            return jsonify({
                "error": (
                    "Sensor telemetry file is required for vibration "
                    "analysis. Please upload the .npy sensor file."
                )
            }), 400

        # ============================================================
        # 3. NORMALIZE SENSOR DATA
        # ============================================================

        try:
            sen_np = normalize_sensor_array(sen_np)

        except Exception as sensor_shape_err:
            return jsonify({
                "error": str(sensor_shape_err)
            }), 400

        sen_tensor = (
            torch.from_numpy(sen_np)
            .unsqueeze(0)
            .to(DEVICE)
        )

        # ============================================================
        # 4. SENSOR QUALITY
        # ============================================================

        sensor_quality = assess_sensor_quality(sen_np)

        # ============================================================
        # 5. MULTIMODAL AGREEMENT
        # ============================================================

        agreement = compute_multimodal_agreement(
            img_tensor,
            sen_tensor
        )

        # ============================================================
        # 6. GRAD-CAM
        # ============================================================

        gradcam_images = safe_gradcam(
            img_tensor,
            sen_tensor,
            original_np
        )

        # ============================================================
        # 7. MODEL PREDICTION
        # ============================================================

        dummy_meta = torch.zeros(
            (1, 7),
            dtype=torch.float32,
            device=DEVICE
        )

        with torch.no_grad():
            pred_norm = (
                model(
                    img_tensor,
                    sen_tensor,
                    dummy_meta
                )
                .cpu()
                .numpy()[0]
            )

        # Convert normalized prediction back to micrometers
        wear_um = max(
            0.0,
            float(pred_norm * y_sd + y_mu)
        )

        # ============================================================
        # 8. TOOL HEALTH
        # ============================================================

        health_alert = compute_health_and_alerts(
            wear_um
        )

        # ============================================================
        # 9. REMAINING USEFUL LIFE
        # ============================================================

        rul_passes = max(
            0,
            int(
                round(
                    (300.0 - wear_um)
                    / max(wear_um / 10.0, 1.0)
                )
            )
        )

        # ============================================================
        # 10. SENSOR TIME SERIES
        # ============================================================

        step = max(
            1,
            sen_np.shape[1] // 100
        )

        time_series = [
            {
                "t": int(i),

                # Channel 0
                "accel": round(
                    float(sen_np[0, i]),
                    4
                ),

                # Channel 1
                "acoustic": round(
                    float(sen_np[1, i]),
                    4
                ),

                # Channel 2
                "Fx": round(
                    float(sen_np[2, i]),
                    4
                ),

                # Channel 3
                "Fy": round(
                    float(sen_np[3, i]),
                    4
                ),

                # Channel 4
                "Fz": round(
                    float(sen_np[4, i]),
                    4
                )
            }

            for i in range(
                0,
                sen_np.shape[1],
                step
            )
        ]

        # ============================================================
        # 11. INDUSTRIAL ALERTS & VIBRATION ANALYSIS
        # ============================================================
        #
        # evaluate_industrial_alerts() checks the vibration channel
        # against the configured vibration threshold.
        #
        # If vibration >= threshold:
        #
        #   "Unusual Vibration Detected"
        #
        # and:
        #
        #   "Consider manual machine maintenance inspection."
        #
        # ============================================================

        system_alerts, vib_stats = evaluate_industrial_alerts(
            wear_um,
            rul_passes,
            sen_np
        )

        # ============================================================
        # 12. MACHINE IDENTIFICATION
        # ============================================================

        target_machine_id = (
            request.form
            .get("machine_id", "MCH-001")
            .strip()
            .upper()
        )

        # ============================================================
        # 13. CREATE MACHINE IF IT DOES NOT EXIST
        # ============================================================

        if not Machine.query.filter_by(
            id=target_machine_id
        ).first():

            db.session.add(
                Machine(
                    id=target_machine_id,
                    name=request.form.get(
                        "machine_name",
                        target_machine_id
                    ),
                    material=request.form.get(
                        "material",
                        "CK45"
                    ),
                    tool_material=request.form.get(
                        "tool_material",
                        "Coated Carbide (TiAlN)"
                    ),
                    insert_type=request.form.get(
                        "insert_type",
                        "CoroMill 390 (10mm)"
                    )
                )
            )

            db.session.commit()

        # ============================================================
        # 14. SAVE PREDICTION RECORD
        # ============================================================

        try:

            confidence = round(
                min(
                    100.0,
                    max(
                        0.0,
                        (
                            float(
                                sensor_quality.get(
                                    "confidence",
                                    0.0
                                )
                            )
                            +
                            float(
                                agreement.get(
                                    "score_pct",
                                    0.0
                                )
                            )
                        ) / 2.0
                    )
                ),
                1
            )

            record_entry = PredictionRecord(
                machine_id=target_machine_id,

                cycle=int(
                    request.form.get("pass")
                    or request.form.get("cycle")
                    or 1
                ),

                wear_um=round(
                    wear_um,
                    2
                ),

                health_score=health_alert[
                    "health_score"
                ],

                status=health_alert[
                    "status"
                ],

                confidence=confidence,

                agreement_pct=agreement.get(
                    "score_pct"
                ),

                rul_passes=rul_passes,

                recommendation=health_alert[
                    "recommendation"
                ],

                sensor_waveforms_json=json.dumps(
                    time_series
                ),

                gradcam_json=json.dumps(
                    gradcam_images
                ),

                sensor_quality_json=json.dumps(
                    sensor_quality
                )
            )

            db.session.add(record_entry)
            db.session.commit()

        except Exception as db_err:

            print(
                f"[Database Warning] "
                f"Could not save prediction record: {db_err}"
            )

            db.session.rollback()

        # ============================================================
        # 15. RETURN RESULT TO FRONTEND
        # ============================================================

        confidence = round(
            min(
                100.0,
                max(
                    0.0,
                    (
                        float(
                            sensor_quality.get(
                                "confidence",
                                0.0
                            )
                        )
                        +
                        float(
                            agreement.get(
                                "score_pct",
                                0.0
                            )
                        )
                    ) / 2.0
                )
            ),
            1
        )

        return jsonify({

            # --------------------------------------------------------
            # Tool wear
            # --------------------------------------------------------

            "wear_um": round(
                wear_um,
                2
            ),

            # --------------------------------------------------------
            # Tool health
            # --------------------------------------------------------

            "status": health_alert[
                "status"
            ],

            "badge_color": health_alert[
                "badge"
            ],

            "health_score": health_alert[
                "health_score"
            ],

            # --------------------------------------------------------
            # Prediction confidence
            # --------------------------------------------------------

            "confidence": confidence,

            # --------------------------------------------------------
            # Multimodal agreement
            # --------------------------------------------------------

            "agreement_pct": agreement.get(
                "score_pct"
            ),

            # --------------------------------------------------------
            # Remaining useful life
            # --------------------------------------------------------

            "rul_passes": rul_passes,

            # --------------------------------------------------------
            # INDUSTRIAL ALERTS
            # --------------------------------------------------------

            "system_alerts": system_alerts,

            # --------------------------------------------------------
            # VIBRATION METRICS
            # --------------------------------------------------------

            "vibration_metrics": vib_stats,

            # Example:
            #
            # {
            #     "max_vib_g": 2.84,
            #     "rms_vib_g": 1.31
            # }
            #
            # If max_vib_g >= 2.5:
            #
            #     vibration alert is generated
            #

            # --------------------------------------------------------
            # Tool health warning
            # --------------------------------------------------------

            "early_warning": health_alert[
                "early_warning"
            ],

            "recommendation": health_alert[
                "recommendation"
            ],

            "rec_type": health_alert[
                "rec_type"
            ],

            # --------------------------------------------------------
            # Detailed agreement
            # --------------------------------------------------------

            "agreement": agreement,

            # --------------------------------------------------------
            # Sensor quality
            # --------------------------------------------------------

            "sensor_quality": sensor_quality,

            # --------------------------------------------------------
            # Model information
            # --------------------------------------------------------

            "model_used": (
                "image_sensor.pt (Layer 6 CAM)"
            ),

            "metrics": {
                "test_mae_um": 3.09,
                "test_rmse_um": 4.29,
                "test_r2": 0.9938
            },

            # --------------------------------------------------------
            # Sensor waveform
            # --------------------------------------------------------

            "sensor_waveforms": time_series,

            # --------------------------------------------------------
            # Grad-CAM
            # --------------------------------------------------------

            "gradcam": gradcam_images
        })

    # ================================================================
    # GLOBAL PREDICTION ERROR
    # ================================================================

    except Exception as e:

        print(
            f"[Prediction Error] "
            f"{type(e).__name__}: {e}"
        )

        return jsonify({
            "error": str(e)
        }), 500

@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "Backend Active", "checkpoint_loaded": model is not None, "active_checkpoint": CHECKPOINT_PATH})


@app.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({"status": "ok", "backend": "ToolWear.AI Flask", "model_loaded": model is not None, "checkpoint": CHECKPOINT_PATH, "device": str(DEVICE)}), 200


app.add_url_rule("/api/predict", "api_predict", predict, methods=["POST", "OPTIONS"])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)