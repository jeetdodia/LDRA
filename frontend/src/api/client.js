// In development, Vite proxy handles /api → localhost:5000
// In production, set VITE_API_URL to the deployed backend URL
const BASE_URL = import.meta.env.VITE_API_URL || "";

function getToken() {
  return localStorage.getItem("lendingToken");
}

/**
 * Check if a JWT is expired by decoding the payload.
 * Returns true if the token is expired or invalid.
 */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // exp is in seconds, Date.now() is in ms
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function clearAuthAndRedirect() {
  localStorage.removeItem("lendingToken");
  localStorage.removeItem("lendingUserName");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

async function request(method, path, body = null) {
  const token = getToken();

  // Pre-flight: check if token is expired before making the request
  if (token && isTokenExpired(token)) {
    clearAuthAndRedirect();
    throw new Error("Session expired. Please log in again.");
  }

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}/api${path}`, options);

  // Intercept 401 — token rejected by server (expired, revoked, etc.)
  if (response.status === 401) {
    clearAuthAndRedirect();
    throw new Error("Session expired. Please log in again.");
  }

  if (response.status === 204) return null;

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};