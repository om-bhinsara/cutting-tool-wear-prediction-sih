import io
import os
import sys
import json
import numpy as np
import torch
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
    if wear_um < 80.0:
        return {"status": "Normal / Sharp", "color": "#00ff87", "badge": "success"}
    elif wear_um < 160.0:
        return {"status": "Moderate Wear (Active)", "color": "#ffb703", "badge": "warning"}
    else:
        return {"status": "Severe Flank Wear / Replace Tool", "color": "#ff416c", "badge": "danger"}

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "Backend Active",
        "checkpoint_loaded": model is not None,
        "active_checkpoint": CHECKPOINT_PATH,
        "device": str(DEVICE),
        "frontend_ui": "http://localhost:5173"
    })

@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({
            "error": f"Model checkpoint is not loaded. Checked paths: {POSSIBLE_PATHS}"
        }), 500
    
    try:
        if "image" not in request.files:
            return jsonify({"error": "Edge crop image file ('image') is required."}), 400
        
        image_file = request.files["image"]
        filename = image_file.filename
        stem = os.path.splitext(filename)[0]

        # 1. Process Tool Edge Image
        pil_img = Image.open(image_file.stream).convert("RGB")
        pil_img = pil_img.resize((224, 224))
        img_np = np.asarray(pil_img, dtype=np.float32).transpose(2, 0, 1) / 255.0
        img_tensor = torch.from_numpy(img_np).unsqueeze(0).to(DEVICE)

        # 2. Sensor Preprocessing
        sen_np = None
        if "sensor" in request.files:
            sensor_file = request.files["sensor"]
            sen_np = np.load(io.BytesIO(sensor_file.read())).astype(np.float32)
        elif "sensor_json" in request.form:
            sen_np = np.array(json.loads(request.form["sensor_json"]), dtype=np.float32)
        else:
            search_dirs = ["sensors", os.path.join("dataset", "sensors"), os.path.join("data", "sensors")]
            for s_dir in search_dirs:
                candidate = os.path.join(s_dir, f"{stem}.npy")
                if os.path.exists(candidate):
                    sen_np = np.load(candidate).astype(np.float32)
                    print(f"Auto-paired sensor file: {candidate}")
                    break
        
        if sen_np is None:
            sen_np = np.zeros((5, 512), dtype=np.float32)

        if sen_np.shape[0] != 5:
            return jsonify({
                "error": f"Sensor input must have 5 channels, received shape: {sen_np.shape}"
            }), 400
        
        sen_tensor = torch.from_numpy(sen_np).unsqueeze(0).to(DEVICE)

        # 3. Multimodal Inference
        dummy_meta = torch.zeros((1, 7), dtype=torch.float32).to(DEVICE)
        with torch.no_grad():
            pred_norm = model(img_tensor, sen_tensor, dummy_meta).cpu().numpy()[0]
        
        wear_um = float(pred_norm * y_sd + y_mu)
        wear_um = max(0.0, wear_um)
        condition = get_wear_condition(wear_um)

        # 4. Downsample 512 points to ~100 time points for frontend charting
        step = max(1, sen_np.shape[1] // 100)
        time_series = []
        for i in range(0, sen_np.shape[1], step):
            time_series.append({
                "t": int(i),
                "accel": round(float(sen_np[0, i]), 4),
                "acoustic": round(float(sen_np[1, i]), 4),
                "Fx": round(float(sen_np[2, i]), 4),
                "Fy": round(float(sen_np[3, i]), 4),
                "Fz": round(float(sen_np[4, i]), 4),
            })

        return jsonify({
            "wear_um": round(wear_um, 2),
            "status": condition["status"],
            "badge_color": condition["badge"],
            "model_used": "image_sensor.pt",
            "metrics": {
                "test_mae_um": 3.09,
                "test_rmse_um": 4.29,
                "test_r2": 0.9938
            },
            "sensor_waveforms": time_series
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)