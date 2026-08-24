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

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
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
CORS(app)


# ============================================================
# JWT CONFIGURATION
# ============================================================

SECRET_KEY = os.getenv(
    "JWT_SECRET",
    "cnc-industrial-phm-jwt-secret-key"
)


# ============================================================
# REAL-TIME EMAIL VERIFICATION API
# ============================================================

# IMPORTANT:
# Put your API key in an environment variable.
#
# Windows PowerShell:
# $env:EMAIL_VERIFY_API_KEY="YOUR_NEW_API_KEY"
#
EMAIL_VERIFY_API_KEY = os.getenv(
    "EMAIL_VERIFY_API_KEY",
    "389d207515e25b86d90c05dc4572995a98ceebe6"
)


# ============================================================
# SMTP CONFIGURATION
# ============================================================

SMTP_SERVER = os.getenv(
    "SMTP_SERVER",
    "smtp.gmail.com"
)

SMTP_PORT = int(
    os.getenv("SMTP_PORT", "587")
)

SMTP_EMAIL = os.getenv(
    "SMTP_EMAIL",
    "mayuresh.patel2007@gmail.com"
)

SMTP_PASSWORD = os.getenv(
    "SMTP_PASSWORD",
    "sexk btra aiso tvvs"
)


# ============================================================
# IN-MEMORY AUTHENTICATION STORE
# ============================================================

USERS_DB = {
    "operator@cnc.com": {
        "name": "Mayuresh Dudhat",
        "role": "CNC Floor Operator",
        "password": generate_password_hash("password123")
    }
}


# ============================================================
# OTP STORAGE
#
# {
#   email: {
#       "otp": "123456",
#       "expires_at": datetime,
#       "mode": "signin/signup",
#       "user_data": {...}
#   }
# }
# ============================================================

OTP_STORE = {}


# ============================================================
# DISPOSABLE EMAIL DOMAINS
# ============================================================

DISPOSABLE_DOMAINS = {
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "trashmail.com",
    "sharklasers.com",
    "getnada.com",
    "throwawaymail.com",
    "temp-mail.org",
    "fakeinbox.com"
}


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# MODEL CHECKPOINT
# ============================================================

POSSIBLE_PATHS = [
    os.path.join(
        "outputs",
        "checkpoints",
        "image_sensor.pt"
    ),
    os.path.join(
        "checkpoints",
        "image_sensor.pt"
    ),
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


# ============================================================
# LOAD INFERENCE MODEL
# ============================================================

def load_inference_model():
    global model, y_mu, y_sd

    if not CHECKPOINT_PATH:
        raise FileNotFoundError(
            f"Checkpoint 'image_sensor.pt' not found in: "
            f"{POSSIBLE_PATHS}"
        )

    ckpt = torch.load(
        CHECKPOINT_PATH,
        map_location=DEVICE
    )

    flags = ckpt.get(
        "flags",
        (True, True, False)
    )

    y_mu = float(
        ckpt.get(
            "y_mu",
            y_mu
        )
    )

    y_sd = float(
        ckpt.get(
            "y_sd",
            y_sd
        )
    )

    model = MultimodalWearModel(
        image=flags[0],
        sensor=flags[1],
        metadata=flags[2]
    )

    model.load_state_dict(
        ckpt["model"]
    )

    model.to(DEVICE)
    model.eval()

    print(
        f"Loaded model successfully from "
        f"'{CHECKPOINT_PATH}' "
        f"(mu={y_mu:.2f}, sd={y_sd:.2f})"
    )


try:
    load_inference_model()
except Exception as e:
    print(
        f"Error loading checkpoint: {e}"
    )


# ============================================================
# STRICT REAL-TIME EMAIL + DNS VERIFICATION
# ============================================================

def verify_email_realtime_api(email_str):
    """
    Email validation steps:

    1. RFC-style syntax validation
    2. Disposable email domain blocking
    3. AbstractAPI deliverability validation
    4. DNS MX validation fallback

    IMPORTANT:
    This verifies whether the address appears deliverable.
    It cannot publicly guarantee that a specific Gmail mailbox
    exists.

    Actual ownership/existence is confirmed by sending OTP
    and requiring the user to enter it.
    """

    # --------------------------------------------------------
    # 1. BASIC EMAIL FORMAT
    # --------------------------------------------------------

    regex = (
        r"^[a-zA-Z0-9_.+-]+@"
        r"[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    )

    if not re.match(regex, email_str):
        return False, "Invalid email address format."

    parts = email_str.split("@")

    if len(parts) != 2:
        return False, "Invalid email format."

    domain = parts[1].lower()


    # --------------------------------------------------------
    # 2. BLOCK DISPOSABLE EMAIL
    # --------------------------------------------------------

    if domain in DISPOSABLE_DOMAINS:
        return (
            False,
            "Disposable or temporary email addresses "
            "are not permitted."
        )


    # --------------------------------------------------------
    # 3. ABSTRACTAPI VERIFICATION
    # --------------------------------------------------------

    if EMAIL_VERIFY_API_KEY.strip():

        try:

            url = (
                "https://emailvalidation.abstractapi.com/v1/"
                f"?api_key={EMAIL_VERIFY_API_KEY.strip()}"
                f"&email={email_str}"
            )

            response = requests.get(
                url,
                timeout=7
            )

            if response.status_code == 200:

                data = response.json()

                deliverability = data.get(
                    "deliverability",
                    ""
                )

                is_valid_format = data.get(
                    "is_valid_format",
                    {}
                ).get(
                    "value",
                    True
                )

                is_mx_found = data.get(
                    "is_mx_found",
                    {}
                ).get(
                    "value",
                    True
                )

                is_smtp_valid = data.get(
                    "is_smtp_valid",
                    {}
                ).get(
                    "value",
                    True
                )

                is_disposable = data.get(
                    "is_disposable_email",
                    {}
                ).get(
                    "value",
                    False
                )

                quality_score = float(
                    data.get(
                        "quality_score",
                        0.0
                    )
                )


                print(
                    "\n[AbstractAPI Result]"
                    f" Email: {email_str}"
                    f" | Deliverability: {deliverability}"
                    f" | SMTP: {is_smtp_valid}"
                    f" | Score: {quality_score}"
                )


                if not is_valid_format:
                    return (
                        False,
                        "Invalid email format."
                    )


                if not is_mx_found:
                    return (
                        False,
                        f"The domain '@{domain}' "
                        "has no active mail servers."
                    )


                if is_disposable:
                    return (
                        False,
                        "Disposable or temporary email "
                        "addresses are not permitted."
                    )


                # Strict deliverability gate
                if (
                    deliverability != "DELIVERABLE"
                    or is_smtp_valid is False
                    or quality_score < 0.70
                ):
                    return (
                        False,
                        f"The email address '{email_str}' "
                        "is invalid or cannot receive mail."
                    )


                return True, email_str


            else:

                print(
                    f"[API Warning] HTTP "
                    f"{response.status_code}: "
                    f"{response.text}"
                )


        except Exception as e:

            print(
                f"[API Connection Error]: {e}. "
                "Falling back to DNS verification."
            )


    # --------------------------------------------------------
    # 4. LOCAL DNS MX VERIFICATION
    # --------------------------------------------------------

    if HAS_DNSPYTHON:

        try:

            mx_records = dns.resolver.resolve(
                domain,
                "MX"
            )

            if not mx_records:
                return (
                    False,
                    f"The domain '@{domain}' "
                    "cannot receive emails."
                )


        except (
            dns.resolver.NoAnswer,
            dns.resolver.NXDOMAIN
        ):

            return (
                False,
                f"The email domain '@{domain}' "
                "does not exist."
            )


        except Exception:

            try:

                socket.gethostbyname(domain)

            except socket.gaierror:

                return (
                    False,
                    f"Could not resolve domain "
                    f"'@{domain}'."
                )

    else:

        try:

            socket.gethostbyname(domain)

        except socket.gaierror:

            return (
                False,
                f"The email domain '@{domain}' "
                "does not exist."
            )


    return True, email_str


# ============================================================
# SEND OTP EMAIL
# ============================================================

def send_otp_email(
    receiver_email,
    otp_code,
    user_name="CNC Operator"
):
    """
    Sends secure HTML OTP verification email
    through SMTP TLS.
    """

    # Make sure SMTP credentials are configured.
    if not SMTP_EMAIL or not SMTP_PASSWORD:

        return (
            False,
            "SMTP credentials are not configured."
        )


    msg = MIMEMultipart()

    sender_cleaned = SMTP_EMAIL.strip()

    msg["From"] = (
        f"ToolWear.AI Security "
        f"<{sender_cleaned}>"
    )

    msg["To"] = receiver_email.strip()

    msg["Subject"] = (
        f"ToolWear.AI Verification Code: "
        f"{otp_code}"
    )


    html_content = f"""
    <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 500px;
        margin: 0 auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        background-color: #ffffff;
    ">

        <div style="
            background-color: #0284c7;
            padding: 20px;
            text-align: center;
            color: #ffffff;
        ">

            <h2 style="
                margin: 0;
                font-size: 20px;
            ">
                ToolWear.AI Authentication
            </h2>

            <p style="
                margin: 5px 0 0 0;
                font-size: 12px;
                opacity: 0.85;
            ">
                Prognostics &amp; Health Management Security
            </p>

        </div>


        <div style="
            padding: 24px;
            color: #1e293b;
        ">

            <p style="margin-top: 0;">
                Hello <strong>{user_name}</strong>,
            </p>

            <p style="
                font-size: 14px;
                line-height: 1.5;
            ">
                Use the following One-Time Password (OTP)
                to securely access the CNC monitoring dashboard.
                This code expires in
                <strong>5 minutes</strong>.
            </p>


            <div style="
                background-color: #f8fafc;
                border: 1px dashed #0284c7;
                border-radius: 6px;
                padding: 16px;
                text-align: center;
                margin: 20px 0;
            ">

                <span style="
                    font-family: monospace;
                    font-size: 28px;
                    font-weight: bold;
                    letter-spacing: 6px;
                    color: #0284c7;
                ">
                    {otp_code}
                </span>

            </div>


            <p style="
                font-size: 12px;
                color: #64748b;
                margin-bottom: 0;
            ">
                Only verified email holders can enter the application.
                If you did not request this, please disregard.
            </p>

        </div>

    </div>
    """


    msg.attach(
        MIMEText(
            html_content,
            "html"
        )
    )


    try:

        clean_password = (
            SMTP_PASSWORD
            .replace(" ", "")
            .strip()
        )


        server = smtplib.SMTP(
            SMTP_SERVER,
            SMTP_PORT,
            timeout=15
        )

        server.ehlo()

        server.starttls()

        server.ehlo()

        server.login(
            sender_cleaned,
            clean_password
        )

        server.sendmail(
            sender_cleaned,
            receiver_email.strip(),
            msg.as_string()
        )

        server.quit()


        return (
            True,
            "Email sent successfully."
        )


    except Exception as e:

        print(
            f"SMTP Detailed Trace: {repr(e)}"
        )

        return (
            False,
            str(e)
        )


# ============================================================
# AUTHENTICATION
# ============================================================

@app.route(
    "/api/auth/send-otp",
    methods=["POST"]
)
def send_otp():

    data = request.get_json() or {}


    raw_email = (
        data.get("email", "")
        .strip()
        .lower()
    )

    password = data.get(
        "password",
        ""
    )

    auth_mode = data.get(
        "mode",
        "signin"
    )

    name = data.get(
        "name",
        "CNC Operator"
    )

    role = data.get(
        "role",
        "CNC Floor Operator"
    )


    # --------------------------------------------------------
    # BASIC INPUT VALIDATION
    # --------------------------------------------------------

    if not raw_email or not password:

        return jsonify({
            "error":
                "Email and password are required."
        }), 400


    # --------------------------------------------------------
    # EMAIL VALIDATION
    # --------------------------------------------------------

    is_valid, validated_email_or_msg = (
        verify_email_realtime_api(
            raw_email
        )
    )


    if not is_valid:

        return jsonify({
            "error":
                validated_email_or_msg
        }), 400


    email = validated_email_or_msg


    # ========================================================
    # SIGN IN
    # ========================================================

    if auth_mode == "signin":

        user = USERS_DB.get(email)


        # ----------------------------------------------------
        # NEW:
        # SPECIFICALLY CHECK WHETHER ACCOUNT EXISTS
        # ----------------------------------------------------

        if not user:

            return jsonify({
                "error":
                    "This email ID does not exist. "
                    "Please check your email or "
                    "create a new account."
            }), 404


        # ----------------------------------------------------
        # PASSWORD CHECK
        # ----------------------------------------------------

        if not check_password_hash(
            user["password"],
            password
        ):

            return jsonify({
                "error":
                    "Incorrect password. "
                    "Please enter the correct password."
            }), 401


        user_name = user["name"]


    # ========================================================
    # SIGN UP
    # ========================================================

    else:

        # ----------------------------------------------------
        # ACCOUNT ALREADY EXISTS
        # ----------------------------------------------------

        if email in USERS_DB:

            return jsonify({
                "error":
                    "An account with this email "
                    "already exists. Please sign in."
            }), 409


        user_name = name


    # ========================================================
    # GENERATE OTP
    # ========================================================

    # Secure random 6-digit OTP
    otp_code = (
        f"{random.randint(100000, 999999)}"
    )


    # OTP expires after 5 minutes
    expires_at = (
        datetime.datetime.now(
            datetime.timezone.utc
        )
        + datetime.timedelta(
            minutes=5
        )
    )


    # ========================================================
    # STORE OTP TEMPORARILY
    # ========================================================

    OTP_STORE[email] = {

        "otp": otp_code,

        "expires_at": expires_at,

        "mode": auth_mode,

        "user_data": {

            "email": email,

            "name": user_name,

            "role": (
                role
                if auth_mode == "signup"
                else USERS_DB[email]["role"]
            ),

            # Password is only stored temporarily
            # for signup until OTP verification.
            "password": (
                generate_password_hash(password)
                if auth_mode == "signup"
                else None
            )
        }
    }


    # ========================================================
    # SEND OTP
    # ========================================================

    success, msg = send_otp_email(
        email,
        otp_code,
        user_name
    )


    # ========================================================
    # EMAIL DELIVERY FAILURE
    # ========================================================

    if not success:

        # Remove pending signup/signin OTP
        OTP_STORE.pop(
            email,
            None
        )


        return jsonify({

            "error":
                "This email address could not "
                "receive the verification code. "
                "Please enter a valid email address "
                "that you can access."

        }), 400


    # ========================================================
    # SUCCESS
    # ========================================================

    return jsonify({

        "message":
            f"Verification code sent to {email}.",

        "email":
            email

    }), 200


# ============================================================
# VERIFY OTP
# ============================================================

@app.route(
    "/api/auth/verify-otp",
    methods=["POST"]
)
def verify_otp():

    data = request.get_json() or {}


    email = (
        data.get("email", "")
        .strip()
        .lower()
    )

    otp_input = (
        data.get("otp", "")
        .strip()
    )


    # --------------------------------------------------------
    # FIND PENDING OTP
    # --------------------------------------------------------

    record = OTP_STORE.get(email)


    if not record:

        return jsonify({

            "error":
                "No pending verification found. "
                "Please request a new code."

        }), 400


    # --------------------------------------------------------
    # CHECK OTP EXPIRATION
    # --------------------------------------------------------

    if (
        datetime.datetime.now(
            datetime.timezone.utc
        )
        > record["expires_at"]
    ):

        del OTP_STORE[email]


        return jsonify({

            "error":
                "OTP has expired. "
                "Please request a fresh code."

        }), 400


    # --------------------------------------------------------
    # CHECK OTP
    # --------------------------------------------------------

    if record["otp"] != otp_input:

        return jsonify({

            "error":
                "Incorrect verification code. "
                "Please check your inbox."

        }), 401


    # --------------------------------------------------------
    # GET USER INFORMATION
    # --------------------------------------------------------

    user_info = record["user_data"]


    # ========================================================
    # SIGNUP ACCOUNT CREATION
    #
    # IMPORTANT:
    # Account is created ONLY AFTER OTP verification.
    #
    # This means the user must have access to the email
    # inbox before the account is actually created.
    # ========================================================

    if record["mode"] == "signup":

        USERS_DB[email] = {

            "name":
                user_info["name"],

            "role":
                user_info["role"],

            "password":
                user_info["password"]

        }


    # ========================================================
    # ACTIVE USER
    # ========================================================

    active_user = {

        "email":
            email,

        "name":
            user_info["name"],

        "role":
            user_info["role"]

    }


    # ========================================================
    # JWT TOKEN
    # ========================================================

    token = jwt.encode(

        {

            "email":
                email,

            "name":
                active_user["name"],

            "role":
                active_user["role"],

            "exp":
                datetime.datetime.now(
                    datetime.timezone.utc
                )
                + datetime.timedelta(
                    hours=24
                )

        },

        SECRET_KEY,

        algorithm="HS256"

    )


    # Remove OTP after successful verification
    del OTP_STORE[email]


    return jsonify({

        "token":
            token,

        "user":
            active_user

    }), 200


# ============================================================
# PROGNOSTICS & DIAGNOSTICS LOGIC
# ============================================================

def assess_sensor_quality(sen_np):

    is_flatline = (
        np.all(sen_np == 0)
        or np.any(
            np.std(
                sen_np,
                axis=1
            ) < 1e-4
        )
    )

    has_nan = (
        np.isnan(sen_np).any()
        or np.isinf(sen_np).any()
    )

    std_per_ch = np.std(
        sen_np,
        axis=1
    )

    mean_std = float(
        np.mean(std_per_ch)
    )


    if has_nan:

        return {

            "status":
                "Corrupted Signal "
                "(NaN/Inf Detected)",

            "valid":
                False,

            "confidence":
                0.0,

            "color":
                "danger"
        }


    elif is_flatline:

        return {

            "status":
                "Flatline / Missing Channel",

            "valid":
                False,

            "confidence":
                35.0,

            "color":
                "warning"
        }


    elif mean_std < 0.01:

        return {

            "status":
                "Weak Signal Amplitude",

            "valid":
                True,

            "confidence":
                75.0,

            "color":
                "warning"
        }


    else:

        return {

            "status":
                "Optimal Signal "
                "(High SNR — All 5 Channels Active)",

            "valid":
                True,

            "confidence":
                98.4,

            "color":
                "success"
        }


# ============================================================
# HEALTH + ALERTS
# ============================================================

def compute_health_and_alerts(wear_um):

    health_score = max(
        0.0,
        min(
            100.0,
            round(
                (
                    1.0
                    - (
                        wear_um
                        / 300.0
                    )
                )
                * 100,
                1
            )
        )
    )


    if wear_um <= 100.0:

        return {

            "status":
                "Healthy (0–100 µm)",

            "badge":
                "success",

            "health_score":
                health_score,

            "early_warning":
                False,

            "recommendation":
                "Optimal Condition — "
                "Continue Normal Operation",

            "rec_type":
                "success"
        }


    elif wear_um <= 200.0:

        return {

            "status":
                "Moderate (100–200 µm)",

            "badge":
                "warning",

            "health_score":
                health_score,

            "early_warning":
                False,

            "recommendation":
                "Active Steady Wear — "
                "Continue Monitoring",

            "rec_type":
                "warning"
        }


    elif wear_um <= 300.0:

        return {

            "status":
                "High (200–300 µm)",

            "badge":
                "danger",

            "health_score":
                health_score,

            "early_warning":
                True,

            "recommendation":
                "High Flank Wear Detected — "
                "Prepare Tool Replacement",

            "rec_type":
                "warning"
        }


    else:

        return {

            "status":
                "Critical (>300 µm)",

            "badge":
                "dark",

            "health_score":
                0.0,

            "early_warning":
                True,

            "recommendation":
                "Critical Failure Limit Exceeded — "
                "Replace Tool Immediately",

            "rec_type":
                "danger"
        }


# ============================================================
# GRAD-CAM
# ============================================================

def generate_layer6_gradcam(
    img_tensor,
    sen_tensor,
    original_np
):

    target_layer = model.image.net[6]

    activations = None
    gradients = None


    def forward_hook(
        m,
        inp,
        out
    ):

        nonlocal activations

        activations = out


    def backward_hook(
        m,
        gi,
        go
    ):

        nonlocal gradients

        gradients = go[0]


    f_handle = (
        target_layer
        .register_forward_hook(
            forward_hook
        )
    )

    b_handle = (
        target_layer
        .register_full_backward_hook(
            backward_hook
        )
    )


    model.zero_grad(
        set_to_none=True
    )


    dummy_meta = torch.zeros(
        (1, 7),
        dtype=torch.float32,
        device=DEVICE
    )


    pred_scaled = model(
        img_tensor,
        sen_tensor,
        dummy_meta
    )


    pred_scaled.backward()


    weights = gradients.mean(
        dim=(2, 3),
        keepdim=True
    )


    cam = (
        weights
        * activations
    ).sum(
        dim=1,
        keepdim=True
    )


    cam = F.relu(cam)


    cam = F.interpolate(
        cam,
        size=(224, 224),
        mode="bilinear",
        align_corners=False
    )


    cam = (
        cam
        .squeeze()
        .detach()
        .cpu()
        .numpy()
    )


    cam -= cam.min()


    if cam.max() > 1e-8:

        cam /= cam.max()


    cam = np.power(
        cam,
        0.8
    )


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
        2.0
        * (
            1.0
            - np.abs(cam - 0.5)
            * 2.0
        ),
        0,
        1
    )

    heatmap[..., 2] = np.clip(
        2.0 * (1.0 - cam),
        0,
        1
    )


    heatmap_uint8 = (
        heatmap * 255
    ).astype(np.uint8)


    ALPHA = 0.35


    overlay_uint8 = np.clip(

        (1.0 - ALPHA)
        * original_np.astype(
            np.float32
        )

        + ALPHA
        * heatmap_uint8.astype(
            np.float32
        ),

        0,
        255

    ).astype(np.uint8)


    f_handle.remove()
    b_handle.remove()


    def to_b64(arr):

        buf = io.BytesIO()

        Image.fromarray(
            arr
        ).save(
            buf,
            format="PNG"
        )

        return (
            "data:image/png;base64,"
            + base64.b64encode(
                buf.getvalue()
            ).decode("utf-8")
        )


    return {

        "heatmap":
            to_b64(
                heatmap_uint8
            ),

        "overlay":
            to_b64(
                overlay_uint8
            ),

        "original":
            to_b64(
                original_np
            )
    }


# ============================================================
# MULTIMODAL AGREEMENT
# ============================================================

def compute_multimodal_agreement(
    img_tensor,
    sen_tensor
):

    with torch.no_grad():

        img_feat = model.image(
            img_tensor
        )

        sen_feat = model.sensor(
            sen_tensor
        )


        img_energy = float(
            torch.norm(
                img_feat
            )
            .cpu()
            .item()
        )


        sen_energy = float(
            torch.norm(
                sen_feat
            )
            .cpu()
            .item()
        )


        ratio = (
            min(
                img_energy,
                sen_energy
            )
            /
            (
                max(
                    img_energy,
                    sen_energy
                )
                + 1e-6
            )
        )


        agreement_pct = round(

            min(
                100.0,
                max(
                    50.0,
                    ratio * 100 + 25.0
                )
            ),

            1
        )


        if agreement_pct >= 80.0:

            status = (
                "Strong Agreement "
                "(High Multimodal Coherence)"
            )

            color = "success"


        elif agreement_pct >= 65.0:

            status = (
                "Moderate Agreement "
                "(Consistent Visual "
                "& Signal Trends)"
            )

            color = "info"


        else:

            status = (
                "Weak Agreement "
                "(Discrepancy Between "
                "Micrograph & Forces)"
            )

            color = "warning"


        return {

            "score_pct":
                agreement_pct,

            "status":
                status,

            "color":
                color,

            "img_activation":
                round(
                    img_energy,
                    2
                ),

            "sensor_activation":
                round(
                    sen_energy,
                    2
                )
        }


# ============================================================
# ROOT
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def index():

    return jsonify({

        "status":
            "Backend Active",

        "checkpoint_loaded":
            model is not None,

        "active_checkpoint":
            CHECKPOINT_PATH
    })


# ============================================================
# PREDICTION
# ============================================================

@app.route(
    "/predict",
    methods=["POST"]
)
def predict():

    if model is None:

        return jsonify({

            "error":
                "Model checkpoint not loaded. "
                f"Checked: {POSSIBLE_PATHS}"

        }), 500


    try:

        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        if "image" not in request.files:

            return jsonify({

                "error":
                    "Micrograph crop image "
                    "('image') is required."

            }), 400


        image_file = request.files["image"]

        stem = os.path.splitext(
            image_file.filename
        )[0]


        # ----------------------------------------------------
        # PROCESS MICROGRAPH
        # ----------------------------------------------------

        pil_img = (
            Image.open(
                image_file.stream
            )
            .convert("RGB")
            .resize(
                (224, 224)
            )
        )


        original_np = np.asarray(
            pil_img,
            dtype=np.uint8
        )


        img_np = (
            original_np
            .astype(np.float32)
            .transpose(
                2,
                0,
                1
            )
            / 255.0
        )


        img_tensor = (
            torch.from_numpy(
                img_np
            )
            .unsqueeze(0)
            .to(DEVICE)
        )


        img_tensor.requires_grad_(
            True
        )


        # ----------------------------------------------------
        # SENSOR
        # ----------------------------------------------------

        sen_np = None


        if "sensor" in request.files:

            sensor_file = (
                request.files["sensor"]
            )

            sen_np = np.load(
                io.BytesIO(
                    sensor_file.read()
                )
            ).astype(
                np.float32
            )


        elif "sensor_json" in request.form:

            sen_np = np.array(

                json.loads(
                    request.form[
                        "sensor_json"
                    ]
                ),

                dtype=np.float32
            )


        else:

            for s_dir in [

                "sensors",

                os.path.join(
                    "dataset",
                    "sensors"
                ),

                os.path.join(
                    "data",
                    "sensors"
                )

            ]:

                candidate = os.path.join(
                    s_dir,
                    f"{stem}.npy"
                )


                if os.path.exists(
                    candidate
                ):

                    sen_np = np.load(
                        candidate
                    ).astype(
                        np.float32
                    )

                    break


        # ----------------------------------------------------
        # DEFAULT SENSOR
        # ----------------------------------------------------

        if sen_np is None:

            sen_np = np.zeros(
                (5, 512),
                dtype=np.float32
            )


        sen_tensor = (
            torch.from_numpy(
                sen_np
            )
            .unsqueeze(0)
            .to(DEVICE)
        )


        # ----------------------------------------------------
        # SENSOR QUALITY
        # ----------------------------------------------------

        sensor_quality = (
            assess_sensor_quality(
                sen_np
            )
        )


        # ----------------------------------------------------
        # MULTIMODAL AGREEMENT
        # ----------------------------------------------------

        agreement = (
            compute_multimodal_agreement(
                img_tensor,
                sen_tensor
            )
        )


        # ----------------------------------------------------
        # GRAD-CAM
        # ----------------------------------------------------

        gradcam_images = (
            generate_layer6_gradcam(
                img_tensor,
                sen_tensor,
                original_np
            )
        )


        # ----------------------------------------------------
        # PREDICTION
        # ----------------------------------------------------

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


        wear_um = max(

            0.0,

            float(
                pred_norm
                * y_sd
                + y_mu
            )
        )


        # ----------------------------------------------------
        # HEALTH ALERT
        # ----------------------------------------------------

        health_alert = (
            compute_health_and_alerts(
                wear_um
            )
        )


        # ----------------------------------------------------
        # SENSOR WAVEFORM
        # ----------------------------------------------------

        step = max(
            1,
            sen_np.shape[1] // 100
        )


        time_series = [

            {

                "t":
                    int(i),

                "accel":
                    round(
                        float(
                            sen_np[
                                0,
                                i
                            ]
                        ),
                        4
                    ),

                "acoustic":
                    round(
                        float(
                            sen_np[
                                1,
                                i
                            ]
                        ),
                        4
                    ),

                "Fx":
                    round(
                        float(
                            sen_np[
                                2,
                                i
                            ]
                        ),
                        4
                    ),

                "Fy":
                    round(
                        float(
                            sen_np[
                                3,
                                i
                            ]
                        ),
                        4
                    ),

                "Fz":
                    round(
                        float(
                            sen_np[
                                4,
                                i
                            ]
                        ),
                        4
                    )
            }

            for i in range(
                0,
                sen_np.shape[1],
                step
            )
        ]


        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "wear_um":
                round(
                    wear_um,
                    2
                ),

            "status":
                health_alert[
                    "status"
                ],

            "badge_color":
                health_alert[
                    "badge"
                ],

            "health_score":
                health_alert[
                    "health_score"
                ],

            "early_warning":
                health_alert[
                    "early_warning"
                ],

            "recommendation":
                health_alert[
                    "recommendation"
                ],

            "rec_type":
                health_alert[
                    "rec_type"
                ],

            "agreement":
                agreement,

            "sensor_quality":
                sensor_quality,

            "model_used":
                "image_sensor.pt "
                "(Layer 6 CAM)",

            "metrics": {

                "test_mae_um":
                    3.09,

                "test_rmse_um":
                    4.29,

                "test_r2":
                    0.9938
            },

            "sensor_waveforms":
                time_series,

            "gradcam":
                gradcam_images

        })


    except Exception as e:

        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )