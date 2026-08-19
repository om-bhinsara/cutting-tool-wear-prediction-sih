from pathlib import Path
import sys

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

sys.path.append(str(Path(__file__).resolve().parent))

from model import MultimodalWearModel
from dataset import WearDataset

ROOT = Path(__file__).resolve().parents[1]

CHECKPOINT = ROOT / "outputs" / "checkpoints" / "image_sensor.pt"

OUTPUT_DIR = ROOT / "outputs" / "gradcam"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("=" * 65)
print("MATWI GRAD-CAM - LAYER 6")
print("=" * 65)

print("Device     :", DEVICE)
print("Checkpoint :", CHECKPOINT)

dataset = WearDataset(ROOT, "test")

print("Test samples:", len(dataset))

SAMPLE_INDEX = 0

img, sensor, metadata, target = dataset[SAMPLE_INDEX]

img = img.unsqueeze(0).to(DEVICE)
sensor = sensor.unsqueeze(0).to(DEVICE)

target_um = (
    target.item() * dataset.y_sd
    + dataset.y_mu
)

model = MultimodalWearModel(
    image=True,
    sensor=True,
    metadata=False
).to(DEVICE)

checkpoint = torch.load(
    CHECKPOINT,
    map_location=DEVICE
)

model.load_state_dict(
    checkpoint["model"]
)

model.eval()

print("Model loaded successfully.")

dummy_metadata = torch.zeros(
    (1, 7),
    dtype=torch.float32,
    device=DEVICE
)

TARGET_LAYER = model.image.net[6]

activations = None
gradients = None


def forward_hook(module, inputs, output):
    global activations
    activations = output


def backward_hook(module, grad_input, grad_output):
    global gradients
    gradients = grad_output[0]


forward_handle = TARGET_LAYER.register_forward_hook(
    forward_hook
)

backward_handle = TARGET_LAYER.register_full_backward_hook(
    backward_hook
)

model.zero_grad(set_to_none=True)

prediction_scaled = model(
    img,
    sensor,
    dummy_metadata
)

prediction_um = (
    prediction_scaled.item()
    * dataset.y_sd
    + dataset.y_mu
)

print()
print("Actual wear    :", f"{target_um:.2f} µm")
print("Predicted wear :", f"{prediction_um:.2f} µm")

prediction_scaled.backward()

if activations is None:
    raise RuntimeError(
        "Grad-CAM activation was not captured."
    )

if gradients is None:
    raise RuntimeError(
        "Grad-CAM gradients were not captured."
    )

weights = gradients.mean(
    dim=(2, 3),
    keepdim=True
)

cam = (
    weights * activations
).sum(
    dim=1,
    keepdim=True
)

cam = F.relu(cam)

cam = F.interpolate(
    cam,
    size=(img.shape[2], img.shape[3]),
    mode="bilinear",
    align_corners=False
)

cam = (
    cam.squeeze()
    .detach()
    .cpu()
    .numpy()
)

cam -= cam.min()

max_value = cam.max()

if max_value > 1e-8:
    cam /= max_value

cam = np.power(cam, 0.8)

original = (
    img.squeeze(0)
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

heatmap = np.zeros(
    (
        cam.shape[0],
        cam.shape[1],
        3
    ),
    dtype=np.float32
)

heatmap[..., 0] = np.clip(
    2.0 * cam,
    0,
    1
)

heatmap[..., 1] = np.clip(
    2.0 * (
        1.0 - np.abs(cam - 0.5) * 2.0
    ),
    0,
    1
)

heatmap[..., 2] = np.clip(
    2.0 * (1.0 - cam),
    0,
    1
)

heatmap = (
    heatmap * 255
).astype(np.uint8)

ALPHA = 0.35

overlay = (
    (1.0 - ALPHA)
    * original.astype(np.float32)
    +
    ALPHA
    * heatmap.astype(np.float32)
)

overlay = np.clip(
    overlay,
    0,
    255
).astype(np.uint8)

original_path = OUTPUT_DIR / "original.png"
heatmap_path = OUTPUT_DIR / "gradcam_heatmap.png"
overlay_path = OUTPUT_DIR / "gradcam_overlay.png"

Image.fromarray(original).save(
    original_path
)

Image.fromarray(heatmap).save(
    heatmap_path
)

Image.fromarray(overlay).save(
    overlay_path
)

forward_handle.remove()
backward_handle.remove()

print()
print("=" * 65)
print("GRAD-CAM COMPLETED")
print("=" * 65)

print()
print("Target layer  : model.image.net[6]")
print("Actual wear   :", f"{target_um:.2f} µm")
print("Prediction    :", f"{prediction_um:.2f} µm")

print()
print("Saved:")
print("Original :", original_path)
print("Heatmap  :", heatmap_path)
print("Overlay  :", overlay_path)

print()
print("Main frontend visualization:")
print(overlay_path)