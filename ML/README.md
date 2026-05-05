# Machine Learning Service (Flask + Random Forest)

This folder contains:
- `train.py`: trains a **RandomForestClassifier** using real loan data from MongoDB Atlas and saves it as `loan_model.pkl`
- `app.py`: Flask prediction API exposing `POST /predict` and `GET /health`

## Training the Model

The training script connects to MongoDB Atlas (using the `MONGO_URI` from `backend/.env`) and retrieves historically approved/rejected loan applications. It requires at least **10 records with mixed outcomes** (both approved and rejected) to produce a valid model.

```bash
pip install -r requirements.txt
python train.py
```

This generates `loan_model.pkl` in this folder.

## Run the ML API

```bash
python app.py
```

Default port is `5001`. Override with the `PORT` environment variable.

## Prediction API

### `GET /health`

Returns `{ "status": "ok" }`.

### `POST /predict`

Request body (minimum required):
```json
{
  "credit_score": 650,
  "income": 60000,
  "age": 30,
  "loan_amount": 100000,
  "loan_term": 36
}
```

Optional:
```json
{ "employment_status": "unemployed" }
```

Response:
```json
{ "prediction": 0, "probability": 0.12 }
```

### Input Validation

| Field | Type | Range |
|-------|------|-------|
| `credit_score` | float | 300–850 |
| `income` | float | ≥ 0 |
| `age` | float | 18–120 |
| `loan_amount` | float | > 0 |
| `loan_term` | float | > 0 |
| `employment_status` | string | employed, self_employed, unemployed, retired |

## Notes

- If `loan_model.pkl` does not exist, the Flask app will fail to start. Run `python train.py` first.
- For production, run behind a WSGI server (gunicorn/uwsgi) and enable HTTPS.
