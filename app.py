import io
import os
import sys
import json
import base64
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

sys.path.append("src")
try:
    from model import MultimodalWearModel
except ImportError:
    from src.model import MultimodalWearModel

app = Flask(__name__)
CORS(app)

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
        raise FileNotFoundError(
            f"Checkpoint 'image_sensor.pt' not found in any of these paths: {POSSIBLE_PATHS}"
        )
    
    ckpt = torch.load(CHECKPOINT_PATH, map_location=DEVICE)
    flags = ckpt.get("flags", (True, True, False))
    y_mu = float(ckpt.get("y_mu", y_mu))
    y_sd = float(ckpt.get("y_sd", y_sd))
    
    model = MultimodalWearModel(image=flags[0], sensor=flags[1], metadata=flags[2])
    model.load_state_dict(ckpt["model"])
    model.to(DEVICE)
    model.eval()
    print(f"Loaded image_sensor model successfully from '{CHECKPOINT_PATH}' (mu={y_mu:.2f}, sd={y_sd:.2f})")

try:
    load_inference_model()
except Exception as e:
    print(f"Error loading checkpoint: {e}")

def get_wear_condition(wear_um):
    if wear_um <= 100.0:
        return {
            "status": "Healthy",
            "badge": "success",
            "recommendation": "Optimal Condition — Continue Normal Operation",
            "rec_type": "success"
        }
    elif wear_um <= 200.0:
        return {
            "status": "Moderate",
            "badge": "warning",
            "recommendation": "Active Steady Wear — Continue Monitoring",
            "rec_type": "warning"
        }
    elif wear_um <= 300.0:
        return {
            "status": "High",
            "badge": "danger",
            "recommendation": "High Flank Wear Detected — Prepare Tool Replacement",
            "rec_type": "warning"
        }
    else:
        return {
            "status": "Critical",
            "badge": "dark",
            "recommendation": "Critical Failure Limit Exceeded — Replace Tool Immediately",
            "rec_type": "danger"
        }

def generate_layer6_gradcam(img_tensor, sen_tensor, original_np):
    """
    Executes Grad-CAM targeting model.image.net[6] (Layer 6 Conv2d)
    with 0.8 power gamma scaling and alpha 0.35 blending.
    """
    target_layer = model.image.net[6]
    activations = None
    gradients = None

    def forward_hook(module, inp, out):
        nonlocal activations
        activations = out

    def backward_hook(module, grad_in, grad_out):
        nonlocal gradients
        gradients = grad_out[0]

    f_handle = target_layer.register_forward_hook(forward_hook)
    b_handle = target_layer.register_full_backward_hook(backward_hook)

    model.zero_grad(set_to_none=True)
    dummy_meta = torch.zeros((1, 7), dtype=torch.float32, device=DEVICE)
    pred_scaled = model(img_tensor, sen_tensor, dummy_meta)
    pred_scaled.backward()

    if activations is None or gradients is None:
        f_handle.remove()
        b_handle.remove()
        raise RuntimeError("Grad-CAM activations/gradients were not captured.")

    # Channel-wise global average pooling of gradients
    weights = gradients.mean(dim=(2, 3), keepdim=True)
    cam = (weights * activations).sum(dim=1, keepdim=True)
    cam = F.relu(cam)
    cam = F.interpolate(cam, size=(img_tensor.shape[2], img_tensor.shape[3]), mode="bilinear", align_corners=False)
    cam = cam.squeeze().detach().cpu().numpy()

    cam -= cam.min()
    max_val = cam.max()
    if max_val > 1e-8:
        cam /= max_val
    cam = np.power(cam, 0.8)

    # 3-Channel Heatmap formulation
    heatmap = np.zeros((cam.shape[0], cam.shape[1], 3), dtype=np.float32)
    heatmap[..., 0] = np.clip(2.0 * cam, 0, 1)
    heatmap[..., 1] = np.clip(2.0 * (1.0 - np.abs(cam - 0.5) * 2.0), 0, 1)
    heatmap[..., 2] = np.clip(2.0 * (1.0 - cam), 0, 1)
    heatmap_uint8 = (heatmap * 255).astype(np.uint8)

    # Blend overlay with ALPHA = 0.35
    ALPHA = 0.35
    overlay_uint8 = np.clip(
        (1.0 - ALPHA) * original_np.astype(np.float32) + ALPHA * heatmap_uint8.astype(np.float32),
        0,
        255
    ).astype(np.uint8)

    f_handle.remove()
    b_handle.remove()

    # Encode all 3 images to Base64 data URLs
    def to_b64(arr):
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    return {
        "heatmap": to_b64(heatmap_uint8),
        "overlay": to_b64(overlay_uint8),
        "original": to_b64(original_np)
    }

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "Backend Active",
        "checkpoint_loaded": model is not None,
        "active_checkpoint": CHECKPOINT_PATH,
        "gradcam_target_layer": "model.image.net[6]"
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

        # 1. Process Tool Image
        pil_img = Image.open(image_file.stream).convert("RGB").resize((224, 224))
        original_np = np.asarray(pil_img, dtype=np.uint8)
        img_np = original_np.astype(np.float32).transpose(2, 0, 1) / 255.0
        img_tensor = torch.from_numpy(img_np).unsqueeze(0).to(DEVICE)
        img_tensor.requires_grad_(True)

        # 2. Process Sensor Data
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

        # 3. Real Grad-CAM Generation on Layer 6
        gradcam_images = generate_layer6_gradcam(img_tensor, sen_tensor, original_np)

        # 4. Final Inference
        dummy_meta = torch.zeros((1, 7), dtype=torch.float32, device=DEVICE)
        with torch.no_grad():
            pred_norm = model(img_tensor, sen_tensor, dummy_meta).cpu().numpy()[0]
        
        wear_um = max(0.0, float(pred_norm * y_sd + y_mu))
        condition = get_wear_condition(wear_um)

        # 5. Downsample Sensor Signal Waveforms
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
            "status": condition["status"],
            "badge_color": condition["badge"],
            "recommendation": condition["recommendation"],
            "rec_type": condition["rec_type"],
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