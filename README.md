# ClaimIQ

### Medicare Part B Drug Spend Intelligence Platform

---

## Executive Summary

ClaimIQ is a healthcare financial analytics platform built to demonstrate how real government claims data can be transformed into decision-grade intelligence for health plan executives and pharmacy directors.

The platform ingests publicly available CMS Medicare Part B drug spending data covering 1,759 drug records across 2024 and 2025, and applies machine learning, statistical modelling, and a conversational AI layer on top of it. The result is a dashboard that surfaces spend trends, flags financial anomalies, projects future drug costs, and answers plain-English questions about the portfolio in real time.

The core thesis of this project is straightforward: the analysis that currently takes a healthcare analytics team days to produce manually can be delivered in seconds with the right architecture. ClaimIQ is that architecture, built end to end and grounded in real data.

---

## The Problem

Medicare Part B covers physician-administered drugs such as infusions and injections given in clinical settings. These drugs tend to be high-cost specialty biologics, and a small number of them account for the majority of total program spend. Health plans and pharmacy benefit managers need to monitor this spend closely, but the raw CMS data is a flat CSV file. Without an analytical layer on top of it, it answers nothing.

Typical quarterly analysis workflows involve manually building spreadsheets to identify which drugs are growing fastest, which ones look financially unusual, and where full-year 2025 costs are heading. This process is slow, inconsistent, and difficult to share with non-technical stakeholders.

ClaimIQ replaces that workflow.

---

## What the Platform Does

**Executive Dashboard**

The dashboard presents portfolio-level financial metrics at a glance: total 2024 spend, 2025 year-to-date spend, year-over-year change, and a breakdown of how spend is concentrated across the portfolio. Supporting charts show the top 10 drugs by gross spend, a year-over-year comparison for the top drugs, variance flag distribution across all drugs, and a market discount analysis built on published MedPAC benchmarks.

An auto-generated Key Insights panel derives plain-English findings directly from the data, including the fastest growing drug, the highest absolute spend increase, the highest cost-per-claim drug, and the total estimated market discount opportunity across the portfolio.

**Variance Analysis**

Every drug in the dataset is evaluated on two dimensions. First, a rule-based flag identifies drugs with year-over-year spend changes exceeding 20 percent in either direction. Second, a linear regression model predicts where each drug's 2025 spend should fall based on its 2024 financial profile, and drugs that deviate significantly from that prediction are surfaced separately as above or below model expectation. This two-layer approach catches both simple percentage outliers and subtler cost behaviour that percentage change alone would miss.

**Spend Forecasting**

A Prophet time series model projects full-year 2025 spend for the top 20 drugs by 2024 spend. Each forecast includes a projected spend figure, a growth rate compared to 2024, and a confidence interval band that quantifies forecast uncertainty. An interactive chart allows users to select any of the top 20 drugs and view its actual versus projected spend trajectory. A ranked table shows all 20 drugs sorted by projected 2025 spend.

**Anomaly Detection**

An Isolation Forest model scores every drug in the dataset on financial anomaly likelihood using five features: total spend, total claims, total beneficiaries, average cost per claim, and average cost per beneficiary. The top 5 percent of drugs by anomaly score are flagged with plain-English explanations of why they were flagged, such as extreme cost per claim, unusually high claims per patient, or high spend concentrated in very few patients. A score threshold slider allows users to dynamically filter which drugs appear in the view.

**AI Drug Spend Analyst**

The AI Insights module provides a full-width conversational interface powered by LLaMA 3.3 70B running on Groq. The assistant has access to the complete dataset through a keyword retrieval system: when a question mentions a specific drug name or billing code, the exact rows for that drug are pulled from the full CSV and injected into the AI context. For general portfolio questions, the top 50 drugs by spend are used as the base context, alongside full anomaly scores, forecast projections, and variance flags.

The assistant answers questions about any drug in the portfolio, including cost per claim, beneficiary counts, spend trends, anomaly scores, and forecast projections. It refuses questions unrelated to drug spending or financial analysis.

An Executive Brief can be generated directly from the chat interface. When triggered, the AI produces a structured one-page brief covering spend drivers, financial risks, forecast highlights, and recommended actions, formatted for immediate CFO consumption and available to download as a PDF.

---

## The Data

The platform is built on the CMS Medicare Part B Quarterly Drug Spending dataset, a publicly available government dataset published by the Centers for Medicare and Medicaid Services. The version used here covers 2024 full year (Q1 through Q4) and 2025 partial year (Q1 through Q3), with 1,759 records across 10 columns including brand name, generic name, HCPCS billing code, total spend, total claims, total beneficiaries, and average spend per claim and per beneficiary.

The dataset reflects ASP-based spending, meaning the figures represent what Medicare actually paid rather than list prices. Market discount estimates shown in the platform are derived from published MedPAC 2023 aggregate benchmarks and are clearly labelled as estimates rather than actual rebate data.

---

## Analytical Models

Three models run on startup and their outputs are cached in memory so that all dashboard endpoints respond instantly.

**Prophet** is used for forecasting. It projects full-year 2025 spend for the top 20 drugs by extrapolating a trend from two annual data points. Confidence intervals are included to communicate the range of plausible outcomes rather than presenting a single number as fact.

**Isolation Forest** is used for anomaly detection. It is an unsupervised machine learning algorithm that identifies drugs whose combination of financial metrics is statistically unusual compared to the rest of the portfolio. It is well-suited to the highly skewed distribution of drug spend data, where standard deviation thresholds would fail to capture the right signals.

**Linear Regression** is used for variance analysis. It predicts where each drug's 2025 spend should land based on its 2024 claims volume, cost per claim, and beneficiary count. Drugs that deviate significantly from their predicted spend are flagged for review, providing a model-based signal that complements the simpler percentage-change flag.

---

## Market Discount Methodology

The platform displays estimated WAC-to-ASP market discounts using tiered rates sourced from the MedPAC March 2023 Report to Congress. These represent the estimated gap between a drug's wholesale list price and the average sales price that CMS uses for reimbursement calculation.

Specialty biologics with a cost per claim above $10,000 are assigned a 25 percent discount rate, reflecting MedPAC's published range of 22 to 28 percent for this tier. Brand drugs between $1,000 and $10,000 per claim are assigned 20 percent, based on MedPAC's reported 18 to 23 percent range. Generics and low-cost drugs below $1,000 per claim are assigned 3 percent, consistent with MedPAC's 2 to 5 percent range for this category.

These figures represent the discount already embedded in ASP-based spending. They are not additional rebates on top of what CMS paid.

---

## Why This Project

This platform was built as a portfolio demonstration of how a complete analytics stack can be applied to a real-world healthcare finance problem. The architecture follows the order of priority used in professional healthcare intelligence products: clean data foundation first, deterministic models second, AI layer third.

The AI layer is built on top of model outputs rather than in place of them. Forecasts, anomaly scores, and variance flags are computed before the language model ever sees the data. The AI assistant answers questions by referencing those pre-computed results alongside the raw dataset, not by guessing or hallucinating.

Every metric in the platform has a documented calculation methodology. Discount rates cite MedPAC. Anomaly scores cite the Isolation Forest contamination parameter. Forecasts display confidence intervals. This transparency is intentional: a CFO-facing tool should be auditable, not a black box.

---

## Setup

**Requirements:** Python 3.10 or higher, Node.js 18 or higher, a Groq API key from console.groq.com (free tier).

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..
```

Create a `.env` file in the `claimiq/` directory with your Groq API key:

```
GROQ_API_KEY=your_key_here
```

**Run the backend:**
```bash
uvicorn backend.main:app --reload --port 8000
```

**Run the frontend:**
```bash
cd frontend && npm run dev
```

The dashboard is available at `http://localhost:5173`. The backend API runs at `http://localhost:8000`.

---

## Documentation

A full stakeholder document covering executive summary, business requirements, model explanations, system architecture, and results summary is available in `docs/ClaimIQ_Project_Summary.html`. Open the file in any browser and print to PDF.

---

*Built on publicly available CMS Medicare Part B data. Not intended for clinical or financial decision-making without validation against actual contract terms.*
