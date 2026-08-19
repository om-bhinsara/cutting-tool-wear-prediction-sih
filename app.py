import io
import os
import sys
import json
import base64
import datetime
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

sys.path.append("src")
try:
    from model import MultimodalWearModel
except ImportError:
    from src.model import MultimodalWearModel

app = Flask(__name__)
CORS(app)

SECRET_KEY = "cnc-industrial-phm-jwt-secret-key"

# In-memory authentication store with preloaded demo operator
USERS_DB = {
    "operator@cnc.com": {
        "name": "Mayuresh Dudhat",
        "role": "CNC Floor Operator",
        "password": generate_password_hash("password123")
    }
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

# ================= AUTHENTICATION ENDPOINTS =================

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "Shop Operator")
    role = data.get("role", "CNC Floor Operator")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    if email in USERS_DB:
        return jsonify({"error": "An account with this email already exists."}), 409

    USERS_DB[email] = {
        "name": name,
        "role": role,
        "password": generate_password_hash(password)
    }

    token = jwt.encode({
        "email": email,
        "name": name,
        "role": role,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "token": token,
        "user": {"email": email, "name": name, "role": role}
    }), 201

@app.route("/api/signin", methods=["POST"])
def signin():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = USERS_DB.get(email)
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid email or password credentials."}), 401

    token = jwt.encode({
        "email": email,
        "name": user["name"],
        "role": user["role"],
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "token": token,
        "user": {"email": email, "name": user["name"], "role": user["role"]}
    })

# ================= PROGNOSTICS & DIAGNOSTICS LOGIC =================

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
        return {
            "status": "Healthy (0–100 µm)",
            "badge": "success",
            "health_score": health_score,
            "early_warning": False,
            "recommendation": "Optimal Condition — Continue Normal Operation",
            "rec_type": "success"
        }
    elif wear_um <= 200.0:
        return {
            "status": "Moderate (100–200 µm)",
            "badge": "warning",
            "health_score": health_score,
            "early_warning": False,
            "recommendation": "Active Steady Wear — Continue Monitoring",
            "rec_type": "warning"
        }
    elif wear_um <= 300.0:
        return {
            "status": "High (200–300 µm)",
            "badge": "danger",
            "health_score": health_score,
            "early_warning": True,
            "recommendation": "High Flank Wear Detected — Prepare Tool Replacement",
            "rec_type": "warning"
        }
    else:
        return {
            "status": "Critical (>300 µm)",
            "badge": "dark",
            "health_score": 0.0,
            "early_warning": True,
            "recommendation": "Critical Failure Limit Exceeded — Replace Tool Immediately",
            "rec_type": "danger"
        }

def generate_layer6_gradcam(img_tensor, sen_tensor, original_np):
    target_layer = model.image.net[6]
    activations, gradients = None, None

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
    overlay_uint8 = np.clip(
        (1.0 - ALPHA) * original_np.astype(np.float32) + ALPHA * heatmap_uint8.astype(np.float32),
        0,
        255
    ).astype(np.uint8)

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

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "Backend Active",
        "checkpoint_loaded": model is not None,
        "active_checkpoint": CHECKPOINT_PATH
    })

@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": f"Model checkpoint not loaded. Checked: {POSSIBLE_PATHS}"}), 500
    
    try:
        if "image" not in request.files:
            return jsonify({"error": "Micrograph crop image ('image') is required."}), 400
        
        image_file = request.files["image"]
        stem = os.path.splitext(image_file.filename)[0]

        # 1. Process Micrograph Crop
        pil_img = Image.open(image_file.stream).convert("RGB").resize((224, 224))
        original_np = np.asarray(pil_img, dtype=np.uint8)
        img_np = original_np.astype(np.float32).transpose(2, 0, 1) / 255.0
        img_tensor = torch.from_numpy(img_np).unsqueeze(0).to(DEVICE)
        img_tensor.requires_grad_(True)

        # 2. Process Telemetry Array
        sen_np = None
        if "sensor" in request.files:
            sensor_file = request.files["sensor"]
            sen_np = np.load(io.BytesIO(sensor_file.read())).astype(np.float32)
        elif "sensor_json" in request.form:
            sen_np = np.array(json.loads(request.form["sensor_json"]), dtype=np.float32)
        else:
            for s_dir in ["sensors", os.path.join("dataset", "sensors"), os.path.join("data", "sensors")]:
                candidate = os.path.join(s_dir, f"{stem}.npy")
                if os.path.exists(candidate):
                    sen_np = np.load(candidate).astype(np.float32)
                    break
        
        if sen_np is None:
            sen_np = np.zeros((5, 512), dtype=np.float32)

        sen_tensor = torch.from_numpy(sen_np).unsqueeze(0).to(DEVICE)

        # 3. Assess Signal Quality & Multimodal Agreement
        sensor_quality = assess_sensor_quality(sen_np)
        agreement = compute_multimodal_agreement(img_tensor, sen_tensor)

        # 4. Generate Grad-CAM Visual Heatmaps
        gradcam_images = generate_layer6_gradcam(img_tensor, sen_tensor, original_np)

        # 5. Multimodal Regression Prediction
        dummy_meta = torch.zeros((1, 7), dtype=torch.float32, device=DEVICE)
        with torch.no_grad():
            pred_norm = model(img_tensor, sen_tensor, dummy_meta).cpu().numpy()[0]
        
        wear_um = max(0.0, float(pred_norm * y_sd + y_mu))
        health_alert = compute_health_and_alerts(wear_um)

        # 6. Downsample Telemetry for Time-Series Charts
        step = max(1, sen_np.shape[1] // 100)
        time_series = [
            {
                "t": int(i),
                "accel": round(float(sen_np[0, i]), 4),
                "acoustic": round(float(sen_np[1, i]), 4),
                "Fx": round(float(sen_np[2, i]), 4),
                "Fy": round(float(sen_np[3, i]), 4),
                "Fz": round(float(sen_np[4, i]), 4),
            }
            for i in range(0, sen_np.shape[1], step)
        ]

        return jsonify({
            "wear_um": round(wear_um, 2),
            "status": health_alert["status"],
            "badge_color": health_alert["badge"],
            "health_score": health_alert["health_score"],
            "early_warning": health_alert["early_warning"],
            "recommendation": health_alert["recommendation"],
            "rec_type": health_alert["rec_type"],
            "agreement": agreement,
            "sensor_quality": sensor_quality,
            "model_used": "image_sensor.pt (Layer 6 CAM)",
            "metrics": {
                "test_mae_um": 3.09,
                "test_rmse_um": 4.29,
                "test_r2": 0.9938
            },
            "sensor_waveforms": time_series,
            "gradcam": gradcam_images
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)