from pathlib import Path
import sys

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

# Allow importing model.py from src
sys.path.append(str(Path(__file__).resolve().parent))

from model import MultimodalWearModel
from dataset import WearDataset

# PATHS

ROOT = Path(__file__).resolve().parents[1]

CHECKPOINT = ROOT / "outputs" / "checkpoints" / "image_sensor.pt"

OUTPUT_DIR = ROOT / "outputs" / "gradcam"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# DEVICE

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Device:", DEVICE)
print("Checkpoint:", CHECKPOINT)

# LOAD DATASET

dataset = WearDataset(ROOT, "test")

print("Test samples:", len(dataset))

# SELECT SAMPLE

SAMPLE_INDEX = 0

img, sensor, metadata, target = dataset[SAMPLE_INDEX]

img = img.unsqueeze(0).to(DEVICE)
sensor = sensor.unsqueeze(0).to(DEVICE)

target_um = (
    target.item() * dataset.y_sd
    + dataset.y_mu
)

# LOAD MODEL

model = MultimodalWearModel(
    image=True,
    sensor=True,
    metadata=False
).to(DEVICE)

checkpoint = torch.load(
    CHECKPOINT,
    map_location=DEVICE
)

model.load_state_dict(checkpoint["model"])

model.eval()

print("Model loaded successfully.")

# GRAD-CAM TARGET LAYER

# ImageEncoder.net:
#
# 0 Conv2d
# 1 BatchNorm
# 2 ReLU
# 3 Conv2d
# 4 BatchNorm
# 5 ReLU
# 6 Conv2d
# 7 BatchNorm
# 8 ReLU
# 9 Conv2d
# 10 BatchNorm
# 11 ReLU
# 12 AdaptiveAvgPool
#
# We use the LAST CONVOLUTION:
#
# image.net[9]
#
# This is:
# Conv2d(96, 128, 3, 2, 1)

target_layer = model.image.net[9]


# STORAGE FOR ACTIVATIONS + GRADIENTS

activations = None
gradients = None


def forward_hook(module, input, output):
    global activations
    activations = output


def backward_hook(module, grad_input, grad_output):
    global gradients
    gradients = grad_output[0]


forward_handle = target_layer.register_forward_hook(
    forward_hook
)

backward_handle = target_layer.register_full_backward_hook(
    backward_hook
)


# FORWARD PASS

model.zero_grad(set_to_none=True)

prediction_scaled = model(
    img,
    sensor,
    torch.zeros(
        (1, 7),
        dtype=torch.float32,
        device=DEVICE
    )
)

# Convert prediction back to µm
prediction_um = (
    prediction_scaled.item()
    * dataset.y_sd
    + dataset.y_mu
)

print(f"Actual wear     : {target_um:.2f} µm")
print(f"Predicted wear  : {prediction_um:.2f} µm")


# BACKWARD PASS

# Regression output is a single scalar.
# We calculate gradients with respect to that prediction.

prediction_scaled.backward()


# GRAD-CAM

# activations:
# [1, 128, H, W]
#
# gradients:
# [1, 128, H, W]

weights = gradients.mean(
    dim=(2, 3),
    keepdim=True
)

cam = (
    weights * activations
).sum(dim=1, keepdim=True)

cam = F.relu(cam)

cam = F.interpolate(
    cam,
    size=(img.shape[2], img.shape[3]),
    mode="bilinear",
    align_corners=False
)

cam = cam.squeeze().detach().cpu().numpy()


# NORMALIZE CAM

cam -= cam.min()

if cam.max() > 0:
    cam /= cam.max()


# ORIGINAL IMAGE


original = (
    img.squeeze()
    .detach()
    .cpu()
    .numpy()
    .transpose(1, 2, 0)
)

original = np.clip(
    original * 255,
    0,
    255
).astype(np.uint8)


# CREATE HEATMAP

heatmap = np.zeros(
    (cam.shape[0], cam.shape[1], 3),
    dtype=np.uint8
)

# Blue → Red style heatmap
heatmap[..., 0] = (cam * 255).astype(np.uint8)
heatmap[..., 1] = ((1 - np.abs(cam - 0.5) * 2) * 255).clip(
    0, 255
).astype(np.uint8)
heatmap[..., 2] = ((1 - cam) * 255).astype(np.uint8)


# OVERLAY

alpha = 0.45

overlay = (
    (1 - alpha) * original
    + alpha * heatmap
)

overlay = np.clip(
    overlay,
    0,
    255
).astype(np.uint8)


# SAVE RESULTS

Image.fromarray(original).save(
    OUTPUT_DIR / "original.png"
)

Image.fromarray(heatmap).save(
    OUTPUT_DIR / "gradcam_heatmap.png"
)

Image.fromarray(overlay).save(
    OUTPUT_DIR / "gradcam_overlay.png"
)

# CLEANUP

forward_handle.remove()
backward_handle.remove()


print()
print("=" * 60)
print("Grad-CAM completed successfully")
print("=" * 60)
print("Original :", OUTPUT_DIR / "original.png")
print("Heatmap  :", OUTPUT_DIR / "gradcam_heatmap.png")
print("Overlay  :", OUTPUT_DIR / "gradcam_overlay.png")