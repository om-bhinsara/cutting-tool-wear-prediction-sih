import axios from "axios";

/* ============================================================
   AXIOS API CLIENT
============================================================ */

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000",

  timeout: 120000,
});

/* ============================================================
   AUTH
============================================================ */

export const sendOtp = async (payload) => {
  const response = await API.post(
    "/api/auth/send-otp",
    payload
  );

  return response.data;
};

export const verifyOtp = async (payload) => {
  const response = await API.post(
    "/api/auth/verify-otp",
    payload
  );

  /* ----------------------------------------------------------
     SAVE JWT
  ---------------------------------------------------------- */

  if (response.data?.token) {
    localStorage.setItem(
      "phm_jwt_token",
      response.data.token
    );
  }

  return response.data;
};

/* ============================================================
   WEAR PREDICTION
============================================================ */

export const runWearPrediction = async (formData) => {
  try {
    const token =
      localStorage.getItem(
        "phm_jwt_token"
      );

    const config = {
      headers: {},
    };

    /* --------------------------------------------------------
       JWT
    -------------------------------------------------------- */

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    console.log(
      "======================================"
    );

    console.log(
      "[API] Sending prediction request..."
    );

    console.log(
      "[API] POST:",
      `${
        import.meta.env.VITE_API_URL ||
        "http://localhost:5000"
      }/predict`
    );

    console.log(
      "======================================"
    );

    /* --------------------------------------------------------
       SEND FORM DATA

       Do NOT manually set Content-Type.
       Axios/browser creates multipart boundary.
    -------------------------------------------------------- */

    const response = await API.post(
      "/predict",
      formData,
      config
    );

    /* --------------------------------------------------------
       LOG RESPONSE
    -------------------------------------------------------- */

    console.log(
      "======================================"
    );

    console.log(
      "[API] Prediction HTTP status:",
      response.status
    );

    console.log(
      "[API] Prediction response:"
    );

    console.log(
      response.data
    );

    console.log(
      "======================================"
    );

    return response.data;

  } catch (error) {

    /* --------------------------------------------------------
       API ERROR
    -------------------------------------------------------- */

    console.error(
      "======================================"
    );

    console.error(
      "[API] Prediction request failed"
    );

    console.error(
      "[API] Error:",
      error
    );

    if (error.response) {
      console.error(
        "[API] HTTP status:",
        error.response.status
      );

      console.error(
        "[API] Server response:",
        error.response.data
      );
    } else if (error.request) {
      console.error(
        "[API] No response received from server."
      );
    } else {
      console.error(
        "[API] Request setup error:",
        error.message
      );
    }

    console.error(
      "======================================"
    );

    throw error;
  }
};

/* ============================================================
   DEFAULT API
============================================================ */

export default API;