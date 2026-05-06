# ClaimIQ — Medicare Part B Drug Spend Intelligence Platform

A full-stack healthcare analytics platform that transforms raw CMS Medicare Part B drug spending data into decision-grade financial intelligence using machine learning, statistical modelling, and an AI-powered conversational interface.

---

## What It Does

ClaimIQ ingests the publicly available CMS Medicare Part B Quarterly Drug Spending dataset (1,759 records, 2024–2025) and runs three analytical layers on top of it:

- **Forecasting** — Prophet time series model projects full-year 2025 spend for top 20 drugs with confidence intervals
- **Anomaly Detection** — Isolation Forest scores every drug on financial irregularity and surfaces flagged drugs with plain-English reasons
- **Variance Analysis** — Linear regression establishes a baseline expected 2025 spend per drug; deviations are z-scored and flagged
- **AI Q&A** — LLaMA 3.3 70B via Groq answers any question about the dataset using keyword retrieval from the full CSV

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10 · FastAPI · Uvicorn |
| Data | Pandas · NumPy |
| ML Models | Prophet · scikit-learn (Isolation Forest, Linear Regression, StandardScaler) |
| AI | Groq API · LLaMA 3.3 70B |
| Frontend | React 18 · Vite · Recharts · Axios |
| Styling | Tailwind CSS · Custom CSS variables |

---

## Project Structure

```
claimiq/
├── backend/
│   ├── main.py                  # FastAPI app, endpoints, startup cache
│   ├── data_pipeline.py         # CSV load, clean, merge, derive metrics
│   ├── ai_layer.py              # Groq integration, context builder, prompts
│   ├── utils.py                 # JSON serialisation helpers
│   ├── models/
│   │   ├── forecasting.py       # Prophet — 2025 spend projections
│   │   ├── anomaly.py           # Isolation Forest — anomaly scoring
│   │   └── variance.py          # Linear regression — variance analysis
│   └── data/
│       └── Medicare_Quarterly_Part_B_Spending_by_Drug_Q3_2025.csv
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Sidebar shell and navigation
│   │   │   ├── Dashboard.jsx    # BI dashboard — KPIs, charts, insights
│   │   │   ├── VarianceAnalysis.jsx
│   │   │   ├── Forecasting.jsx
│   │   │   ├── AnomalyTracker.jsx
│   │   │   └── AIInsights.jsx   # Chat interface + executive brief
│   │   ├── api/client.js        # Axios base config
│   │   ├── App.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── docs/
│   └── ClaimIQ_Project_Summary.html   # Full stakeholder documentation
├── requirements.txt
├── .env                               # NOT committed — see setup
├── .gitignore
└── README.md
```

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd claimiq
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv

# Windows (Git Bash)
source venv/Scripts/activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up environment variables

Create a `.env` file in the `claimiq/` directory:

```
GROQ_API_KEY=your_groq_api_key_here
```

**Never commit this file.** It is listed in `.gitignore`.

### 5. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Running the Project

Open two terminals from the `claimiq/` directory.

**Terminal 1 — Backend:**
```bash
uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Groq connectivity test | http://localhost:8000/api/test-groq |

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/summary` | GET | Portfolio KPIs — total spend, YoY change, drug count |
| `/api/top-drugs` | GET | Top 20 drugs by 2024 spend with all metrics |
| `/api/variance` | GET | All drugs with variance flags and model residuals |
| `/api/forecast` | GET | Prophet projections for top 20 drugs |
| `/api/anomalies` | GET | Top 50 drugs by anomaly score |
| `/api/ask` | POST | `{ "question": string }` — AI Q&A |
| `/api/brief` | POST | Generates executive brief |
| `/api/test-groq` | GET | Groq API connectivity check |

---

## Dataset

**Source:** Centers for Medicare & Medicaid Services (CMS)  
**File:** `Medicare_Quarterly_Part_B_Spending_by_Drug_Q3_2025.csv`  
**Coverage:** 2024 Q1–Q4 (full year) and 2025 Q1–Q3 (partial year)  
**Rows:** 1,759 · **Columns:** 10

The dataset covers physician-administered drugs reimbursed under Medicare Part B at ASP + 6%. It does not contain rebate data. Market discount estimates shown in the platform are based on published MedPAC 2023 WAC-to-ASP benchmarks.

---

## Methodology Notes

### Rebate / Discount Figures
The platform shows **estimated WAC-to-ASP market discounts**, not actual rebates. Rates are sourced from MedPAC March 2023 Report to Congress, Chapter 5:
- Specialty biologics (>$10,000/claim): 25%
- Brand drugs ($1,000–$10,000/claim): 20%
- Generics (<$1,000/claim): 3%

### Prophet Forecasting
With only two annual data points, all seasonality components are disabled. The model fits a linear trend and extrapolates 3 quarterly periods forward. Confidence intervals reflect model uncertainty, not actuary-grade ranges.

### Isolation Forest
Contamination parameter set to 0.05 (5% of drugs expected anomalous). All 5 features are StandardScaler-normalised before fitting.

---

## Documentation

Full project documentation including executive summary, business requirements, model explanations, and results summary is available as a print-ready HTML file:

```
docs/ClaimIQ_Project_Summary.html
```

Open in any browser and use **File → Print → Save as PDF** to export.

---

## License

This project is built for portfolio demonstration purposes using publicly available CMS data. Not intended for clinical or financial decision-making without validation against actual contract data.
