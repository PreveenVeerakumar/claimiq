import math
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.data_pipeline import get_clean_data, get_summary_stats, get_raw_csv
from backend.models.forecasting import run_forecast
from backend.models.anomaly import run_anomaly_detection
from backend.models.variance import run_variance_analysis
from backend.ai_layer import answer_question, generate_executive_brief
from backend.utils import clean_for_json

_cache = {}


def _safe_float(v):
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None


def _df_to_records(df):
    records = []
    for row in df.to_dict("records"):
        clean = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean[k] = None
            else:
                clean[k] = v
        records.append(clean)
    return records


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting ClaimIQ backend — loading models...")
    try:
        _cache["summary"] = get_summary_stats()
        print("  ✓ Summary stats loaded")

        df_merged = get_clean_data()
        _cache["df_merged"] = df_merged

        df_raw = get_raw_csv()
        _cache["df_raw"] = df_raw
        print("  ✓ Data pipeline ready")

        df_var = run_variance_analysis()
        _cache["variance"] = df_var
        print("  ✓ Variance analysis complete")

        df_anom = run_anomaly_detection()
        _cache["anomalies"] = df_anom
        print("  ✓ Anomaly detection complete")

        print("  Running Prophet forecasts (this may take a minute)...")
        _cache["forecast"] = run_forecast()
        print("  ✓ Forecasting complete")

        print("ClaimIQ backend ready.")
    except Exception as e:
        print(f"Startup error: {e}")
        raise
    yield


app = FastAPI(title="ClaimIQ API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/summary")
def summary():
    try:
        return _cache["summary"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/top-drugs")
def top_drugs():
    try:
        df = _cache["df_merged"]
        top = df.nlargest(20, "Tot_Spndng_2024").copy()
        records = []
        for _, row in top.iterrows():
            records.append(
                {
                    "drug_key": str(row["drug_key"]),
                    "brand_name": str(row.get("Brnd_Name_2024", "")),
                    "generic_name": str(row.get("Gnrc_Name_2024", "")),
                    "hcpcs_code": str(row.get("HCPCS_Cd_2024", row.get("drug_key", ""))),
                    "spend_2024": _safe_float(row["Tot_Spndng_2024"]),
                    "spend_2025": _safe_float(row["Tot_Spndng_2025"]),
                    "claims_2024": _safe_float(row["Tot_Clms_2024"]),
                    "benes_2024": _safe_float(row["Tot_Benes_2024"]),
                    "avg_cost_per_claim_2024": _safe_float(row["Avg_Spnd_Per_Clm_2024"]),
                    "avg_cost_per_bene_2024": _safe_float(row["Avg_Spnd_Per_Bene_2024"]),
                    "estimated_rebate_2024": _safe_float(row.get("estimated_rebate_2024")),
                    "estimated_net_cost_2024": _safe_float(row.get("estimated_net_cost_2024")),
                    "rebate_capture_rate_2024": _safe_float(row.get("rebate_capture_rate_2024")),
                    "spend_change_pct": _safe_float(row.get("spend_change_pct")),
                    "variance_flag": str(row.get("variance_flag", "stable")),
                }
            )
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/variance")
def variance():
    try:
        df = _cache["variance"]
        records = []
        for _, row in df.iterrows():
            records.append(
                {
                    "drug_key": str(row["drug_key"]),
                    "brand_name": str(row.get("Brnd_Name_2024", "")),
                    "generic_name": str(row.get("Gnrc_Name_2024", "")),
                    "hcpcs_code": str(row.get("HCPCS_Cd_2024", row.get("drug_key", ""))),
                    "spend_2024": _safe_float(row["Tot_Spndng_2024"]),
                    "spend_2025": _safe_float(row["Tot_Spndng_2025"]),
                    "spend_change_abs": _safe_float(row.get("spend_change_abs")),
                    "spend_change_pct": _safe_float(row.get("spend_change_pct")),
                    "variance_flag": str(row.get("variance_flag", "stable")),
                    "predicted_spend_2025": _safe_float(row.get("predicted_spend_2025")),
                    "model_residual": _safe_float(row.get("model_residual")),
                    "residual_zscore": _safe_float(row.get("residual_zscore")),
                    "model_flag": str(row.get("model_flag", "As expected")),
                }
            )
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast")
def forecast():
    try:
        return clean_for_json(_cache["forecast"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/anomalies")
def anomalies():
    try:
        df = _cache["anomalies"].head(50)
        records = []
        for _, row in df.iterrows():
            records.append(
                {
                    "drug_key": str(row.get("drug_key", "")),
                    "brand_name": str(row.get("Brnd_Name", "")),
                    "generic_name": str(row.get("Gnrc_Name", "")),
                    "hcpcs_code": str(row.get("HCPCS_Cd", "")),
                    "anomaly_score": _safe_float(row.get("anomaly_score")),
                    "is_anomaly": bool(row.get("is_anomaly", False)),
                    "anomaly_reason": str(row.get("anomaly_reason", "")),
                    "total_spend": _safe_float(row.get("Tot_Spndng")),
                    "total_claims": _safe_float(row.get("Tot_Clms")),
                    "total_benes": _safe_float(row.get("Tot_Benes")),
                    "avg_cost_per_claim": _safe_float(row.get("Avg_Spnd_Per_Clm")),
                    "avg_cost_per_bene": _safe_float(row.get("Avg_Spnd_Per_Bene")),
                }
            )
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QuestionRequest(BaseModel):
    question: str


@app.get("/api/test-groq")
def test_groq():
    try:
        from backend.ai_layer import _get_client
        client = _get_client()
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Say hello in one word."}],
            max_tokens=10,
        )
        return {"status": "ok", "response": resp.choices[0].message.content}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ask")
def ask(req: QuestionRequest):
    try:
        summary = _cache["summary"]
        df = _cache["df_merged"]
        anom_df = _cache["anomalies"]
        forecasts = _cache["forecast"]

        # Keyword retrieval from the full 1,759-row CSV.
        # If the question names a specific drug or HCPCS code, pull its exact rows.
        # Otherwise fall back to top 50 by spend for general questions.
        df_raw = _cache["df_raw"]
        q_lower = req.question.lower()

        def row_matches(r):
            brand = str(r.get("Brnd_Name", "")).lower()
            generic = str(r.get("Gnrc_Name", "")).lower()
            hcpcs = str(r.get("HCPCS_Cd", "")).lower()
            return (
                (len(brand) > 3 and brand in q_lower) or
                (len(generic) > 4 and generic in q_lower) or
                (hcpcs and hcpcs in q_lower)
            )

        matched_raw = df_raw[df_raw.apply(row_matches, axis=1)]

        specific_drugs = [
            {
                "brand_name": str(r["Brnd_Name"]),
                "generic_name": str(r["Gnrc_Name"]),
                "hcpcs_code": str(r["HCPCS_Cd"]),
                "hcpcs_desc": str(r.get("HCPCS_Desc", "")),
                "year": str(r["Year"]),
                "total_spend": float(r["Tot_Spndng"]),
                "total_claims": int(r["Tot_Clms"]),
                "total_benes": float(r["Tot_Benes"]) if str(r["Tot_Benes"]) not in ("nan", "") else None,
                "avg_cost_per_claim": float(r["Avg_Spnd_Per_Clm"]),
                "avg_cost_per_bene": float(r["Avg_Spnd_Per_Bene"]),
            }
            for _, r in matched_raw.iterrows()
        ]

        # Top 50 by 2024 spend for general portfolio context
        top50 = df.nlargest(50, "Tot_Spndng_2024")
        all_drugs = [
            {
                "brand_name": str(r["Brnd_Name_2024"]),
                "generic_name": str(r.get("Gnrc_Name_2024", "")),
                "hcpcs_code": str(r.get("drug_key", "")),
                "spend_2024": float(r["Tot_Spndng_2024"]),
                "spend_2025": float(r["Tot_Spndng_2025"]),
                "spend_change_pct": float(r.get("spend_change_pct", 0)),
                "spend_change_abs": float(r.get("spend_change_abs", 0)),
                "avg_cost_per_claim_2024": float(r.get("Avg_Spnd_Per_Clm_2024", 0)),
                "avg_cost_per_claim_2025": float(r.get("Avg_Spnd_Per_Clm_2025", 0)),
                "avg_cost_per_bene_2024": float(r.get("Avg_Spnd_Per_Bene_2024", 0)),
                "total_claims_2024": int(r.get("Tot_Clms_2024", 0)),
                "total_benes_2024": float(r.get("Tot_Benes_2024", 0) or 0),
                "variance_flag": str(r.get("variance_flag", "stable")),
                "estimated_rebate_2024": float(r.get("estimated_rebate_2024", 0)),
                "estimated_net_cost_2024": float(r.get("estimated_net_cost_2024", 0)),
                "rebate_rate_2024": float(r.get("rebate_rate_2024", 0)),
            }
            for _, r in top50.iterrows()
        ]

        high_inc = df[df["variance_flag"] == "high_increase"].nlargest(10, "spend_change_pct")
        high_increase_drugs = [
            {
                "brand_name": str(r["Brnd_Name_2024"]),
                "spend_change_pct": float(r["spend_change_pct"]),
                "spend_change_abs": float(r["spend_change_abs"]),
            }
            for _, r in high_inc.iterrows()
        ]

        high_dec = df[df["variance_flag"] == "high_decrease"].nlargest(5, "spend_change_pct")
        high_decrease_drugs = [
            {
                "brand_name": str(r["Brnd_Name_2024"]),
                "spend_change_pct": float(r["spend_change_pct"]),
                "spend_change_abs": float(r["spend_change_abs"]),
            }
            for _, r in high_dec.iterrows()
        ]

        top_anomalies = [
            {
                "brand_name": str(r["Brnd_Name"]),
                "score": float(r["anomaly_score"]),
                "reason": str(r["anomaly_reason"]),
                "spend": float(r.get("Tot_Spndng", 0)),
            }
            for _, r in anom_df.head(15).iterrows()
        ]

        context = {
            **summary,
            "specific_drugs": specific_drugs,
            "all_drugs": all_drugs,
            "high_increase_drugs": high_increase_drugs,
            "high_decrease_drugs": high_decrease_drugs,
            "top_anomalies": top_anomalies,
            "forecasts": forecasts,
        }
        answer = answer_question(req.question, context)
        return {"answer": answer}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/brief")
def brief():
    try:
        summary = _cache["summary"]
        df = _cache["df_merged"]

        top_drugs = df.nlargest(5, "Tot_Spndng_2024")
        top_list = [
            {
                "brand_name": str(r["Brnd_Name_2024"]),
                "spend_2024": float(r["Tot_Spndng_2024"]),
                "spend_2025": float(r["Tot_Spndng_2025"]),
            }
            for _, r in top_drugs.iterrows()
        ]

        anom_df = _cache["anomalies"].head(3)
        anom_list = [
            {
                "brand_name": str(r["Brnd_Name"]),
                "score": float(r["anomaly_score"]),
                "reason": str(r["anomaly_reason"]),
            }
            for _, r in anom_df.iterrows()
        ]

        forecasts = _cache["forecast"][:3]

        brief_data = {
            **summary,
            "top_drugs": top_list,
            "top_anomalies": anom_list,
            "forecasts": forecasts,
        }

        text = generate_executive_brief(brief_data)
        return {"brief": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
