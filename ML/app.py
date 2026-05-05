import os
import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd


def load_model() -> object:
  root = os.path.dirname(__file__)
  model_path = os.environ.get("MODEL_PATH", os.path.join(root, "loan_model.pkl"))
  if not os.path.exists(model_path):
    raise FileNotFoundError(
      f"Model file not found at {model_path}. Run `python train.py` to generate it first."
    )
  return joblib.load(model_path)


app = Flask(__name__)
CORS(app)
MODEL = load_model()


@app.get("/health")
def health():
  return jsonify({ "status": "ok" })


@app.post("/predict")
def predict():
  payload = request.get_json(silent=True)
  if not payload:
    return jsonify({ "error": "Invalid or missing JSON body" }), 400

  # Required inputs per specification
  required = ["credit_score", "income", "age", "loan_amount", "loan_term"]
  missing = [k for k in required if k not in payload]
  if missing:
    return jsonify({ "error": f"Missing fields: {', '.join(missing)}" }), 400

  # Optional input (your backend currently sends this; training includes it)
  employment_status = payload.get("employment_status", "employed")

  VALID_EMPLOYMENT = {"employed", "self_employed", "unemployed", "retired"}

  try:
    row = {
      "credit_score": float(payload["credit_score"]),
      "income": float(payload["income"]),
      "age": float(payload["age"]),
      "loan_amount": float(payload["loan_amount"]),
      "loan_term": float(payload["loan_term"]),
      "employment_status": str(employment_status),
    }
  except (TypeError, ValueError):
    return jsonify({ "error": "Invalid numeric input types" }), 400

  # Range validation
  errors = []
  if not (300 <= row["credit_score"] <= 850):
    errors.append("credit_score must be between 300 and 850")
  if row["income"] < 0:
    errors.append("income must be non-negative")
  if not (18 <= row["age"] <= 120):
    errors.append("age must be between 18 and 120")
  if row["loan_amount"] <= 0:
    errors.append("loan_amount must be greater than 0")
  if row["loan_term"] <= 0:
    errors.append("loan_term must be greater than 0")
  if row["employment_status"] not in VALID_EMPLOYMENT:
    errors.append(f"employment_status must be one of: {', '.join(sorted(VALID_EMPLOYMENT))}")
  if errors:
    return jsonify({ "error": "Validation failed", "details": errors }), 400

  X = pd.DataFrame([row])

  pred = int(MODEL.predict(X)[0])
  proba = float(MODEL.predict_proba(X)[0][1])

  return jsonify({ "prediction": pred, "probability": proba })


if __name__ == "__main__":
  port = int(os.environ.get("PORT", "5001"))
  # NOTE: For production, run behind a proper WSGI server (gunicorn/uwsgi) and enable HTTPS.
  app.run(host="0.0.0.0", port=port)

