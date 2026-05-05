# LDRA — Lending Default Risk Assessment

A full-stack ML-powered platform for financial institutions to assess loan default risk in real time.

## Architecture

```
┌─────────────────┐     REST API      ┌─────────────────┐    POST /predict   ┌─────────────────┐
│   React + Vite  │ ──────────────►   │  Express + JWT  │ ──────────────►    │  Flask + sklearn │
│   Frontend      │   :5173           │  Backend        │   :5000            │  ML Service      │
│                 │ ◄──────────────   │                 │ ◄──────────────    │                  │
└─────────────────┘                   └────────┬────────┘   :5001            └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  MongoDB Atlas   │
                                      └─────────────────┘
```

## Tech Stack

| Layer       | Technology                                         |
| ----------- | -------------------------------------------------- |
| Frontend    | React 18, Vite 5, Recharts, Wouter, TanStack Query |
| Backend     | Node.js, Express 4, Mongoose 8, JWT, Helmet        |
| ML Service  | Python 3, Flask, scikit-learn (RandomForest)        |
| Database    | MongoDB Atlas                                       |

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **MongoDB Atlas** account (or local MongoDB)

## Getting Started

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd LDRA
```

Copy the example env files and fill in your values:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI, JWT secret, etc.
```

### 2. Start the ML Service

```bash
cd ML
pip install -r requirements.txt

# Train the model (requires MongoDB data)
python train.py

# Start the prediction API
python app.py
# → Runs on http://localhost:5001
```

### 3. Start the Backend

```bash
cd backend
npm install
npm run dev
# → Runs on http://localhost:5000
```

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# → Runs on http://localhost:5173
```

### 5. Open the app

Visit **http://localhost:5173** and register a new account.

## Project Structure

```
LDRA/
├── ML/                     # Python ML microservice
│   ├── app.py              # Flask prediction API
│   ├── train.py            # Model training script
│   ├── requirements.txt    # Python dependencies
│   └── README.md           # ML service docs
├── backend/                # Node.js REST API
│   ├── src/
│   │   ├── app.js          # Express server entry
│   │   ├── routes/         # auth, loan, analytics
│   │   ├── models/         # Mongoose schemas
│   │   ├── middleware/     # JWT auth + RBAC
│   │   └── lib/            # ML prediction client
│   ├── .env.example        # Environment template
│   └── package.json
├── frontend/               # React SPA
│   ├── src/
│   │   ├── App.jsx         # Router + auth guards
│   │   ├── pages/          # Dashboard, Apply, Loans, etc.
│   │   ├── components/     # Layout, shared UI
│   │   ├── api/            # HTTP client
│   │   └── index.css       # Design system
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md               # ← You are here
```

## API Endpoints

### Auth
| Method | Endpoint             | Description          |
| ------ | -------------------- | -------------------- |
| POST   | `/api/auth/register` | Register new analyst |
| POST   | `/api/auth/login`    | Login, returns JWT   |

### Loans
| Method | Endpoint                  | Description               |
| ------ | ------------------------- | ------------------------- |
| GET    | `/api/loans`              | List all loans (filtered) |
| POST   | `/api/loans/apply`        | Submit new application    |
| GET    | `/api/loans/:id`          | Get loan details          |
| PATCH  | `/api/loans/:id/status`   | Approve / reject (admin)  |
| DELETE | `/api/loans/:id`          | Delete loan (admin)       |

### Analytics
| Method | Endpoint                 | Description              |
| ------ | ------------------------ | ------------------------ |
| GET    | `/api/analytics/summary` | Portfolio summary stats  |
| GET    | `/api/analytics/charts`  | Chart data for dashboard |
| GET    | `/api/analytics/loan/:id`| Per-loan risk analytics  |

### ML Service
| Method | Endpoint    | Description             |
| ------ | ----------- | ----------------------- |
| GET    | `/health`   | Health check            |
| POST   | `/predict`  | Run risk prediction     |

## License

ISC
