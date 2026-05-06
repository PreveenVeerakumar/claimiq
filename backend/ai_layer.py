import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set in environment")
        _client = Groq(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are a healthcare financial analyst for ClaimIQ, a Medicare Part B drug spend intelligence platform built on real CMS data.

You have access to the complete Medicare Part B drug spending dataset: every tracked drug with 2024 full-year and 2025 Q1-Q3 spend, cost per claim, beneficiary counts, variance flags, anomaly scores, Prophet forecasts, and rebate estimates.

Answer any question about this dataset — drug costs, trends, anomalies, forecasts, comparisons, rankings, financial risks, rebates, or beneficiary patterns. Be specific: always cite drug names, dollar figures, and percentages from the data provided.

If a question is genuinely unrelated to healthcare, drugs, or financial analysis (e.g. sports scores, weather, personal life advice), respond with:
"I'm focused on Medicare Part B drug spend analysis. Please ask about drug costs, trends, anomalies, or forecasts in the dataset."

Write concisely, as if presenting to a health plan CFO."""


def _build_context_text(data_context: dict) -> str:
    lines = [
        "=== PORTFOLIO OVERVIEW ===",
        f"Drugs tracked (both years): {data_context.get('total_drugs', 0)}",
        f"Total 2024 spend (Q1-Q4 full year): ${data_context.get('total_spend_2024', 0) / 1e9:.3f}B",
        f"Total 2025 spend (Q1-Q3 partial): ${data_context.get('total_spend_2025', 0) / 1e9:.3f}B",
        f"YoY change: {data_context.get('spend_change_pct', 0):.2f}%",
        f"Total claims 2024: {data_context.get('total_claims_2024', 0):,}",
        f"Avg cost per claim 2024: ${data_context.get('avg_cost_per_claim_2024', 0):,.2f}",
        f"Top 10 spend concentration: {data_context.get('top_10_spend_concentration_pct', 0):.1f}% of total",
    ]

    specific = data_context.get("specific_drugs", [])
    if specific:
        lines.append(
            f"\n=== EXACT CSV ROWS FOR DRUGS MATCHING THIS QUESTION ({len(specific)} rows) ==="
            "\nThis is raw data from the CSV — each drug appears once per year."
            "\nBrand|Generic|HCPCS|Description|Year|TotalSpend|Claims|Benes|CostPerClaim|CostPerBene"
        )
        for d in specific:
            benes = f"{d['total_benes']:,.0f}" if d.get("total_benes") is not None else "N/A"
            lines.append(
                f"{d['brand_name']}|{d['generic_name']}|{d['hcpcs_code']}|"
                f"{d.get('hcpcs_desc', '')}|{d['year']}|"
                f"${d['total_spend']/1e6:.3f}M|{d['total_claims']:,}|{benes}|"
                f"${d['avg_cost_per_claim']:,.2f}|${d['avg_cost_per_bene']:,.2f}"
            )

    drugs = data_context.get("all_drugs", [])
    if drugs:
        lines.append(
            f"\n=== TOP {len(drugs)} DRUGS BY 2024 SPEND (general portfolio context) ==="
            "\nBrand|Generic|HCPCS|Spend2024($M)|Spend2025($M)|YoY%|CostPerClaim2024|CostPerClaim2025|"
            "CostPerBene2024|Claims2024|Benes2024|Flag|Rebate($M)|NetCost($M)|RebateRate"
        )
        for d in sorted(drugs, key=lambda x: x.get("spend_2024", 0), reverse=True):
            benes = d.get("total_benes_2024", 0) or 0
            lines.append(
                f"{d['brand_name']}|{d['generic_name']}|{d['hcpcs_code']}|"
                f"{d['spend_2024']/1e6:.2f}|{d['spend_2025']/1e6:.2f}|"
                f"{d.get('spend_change_pct', 0):+.1f}|"
                f"{d.get('avg_cost_per_claim_2024', 0):,.0f}|{d.get('avg_cost_per_claim_2025', 0):,.0f}|"
                f"{d.get('avg_cost_per_bene_2024', 0):,.0f}|"
                f"{d.get('total_claims_2024', 0)}|{benes:.0f}|"
                f"{d.get('variance_flag', 'stable')}|"
                f"{d.get('estimated_rebate_2024', 0)/1e6:.2f}|"
                f"{d.get('estimated_net_cost_2024', 0)/1e6:.2f}|"
                f"{d.get('rebate_rate_2024', 0):.0%}"
            )

    high = data_context.get("high_increase_drugs", [])
    if high:
        lines.append("\n=== HIGH INCREASE FLAGS (>20% YoY spend increase) ===")
        for d in high:
            lines.append(
                f"• {d['brand_name']}: {d['spend_change_pct']:+.1f}% "
                f"(+${d['spend_change_abs']/1e6:.1f}M)"
            )

    dec = data_context.get("high_decrease_drugs", [])
    if dec:
        lines.append("\n=== HIGH DECREASE FLAGS (>20% YoY spend decrease) ===")
        for d in dec:
            lines.append(
                f"• {d['brand_name']}: {d['spend_change_pct']:+.1f}% "
                f"(${d['spend_change_abs']/1e6:.1f}M)"
            )

    anomalies = data_context.get("top_anomalies", [])
    if anomalies:
        lines.append("\n=== TOP ANOMALIES (Isolation Forest, score 0–1, higher=more anomalous) ===")
        for a in anomalies:
            lines.append(
                f"• {a['brand_name']}: score={a['score']:.3f} | "
                f"reason: {a['reason']} | spend=${a['spend']/1e6:.1f}M"
            )

    forecasts = data_context.get("forecasts", [])
    if forecasts:
        lines.append("\n=== 2025 FULL-YEAR FORECASTS (Prophet model) ===")
        for f in forecasts:
            lines.append(
                f"• {f['drug_name']}: projected ${f['spend_2025_projected']/1e6:.1f}M "
                f"({f['growth_rate_pct']:+.1f}% vs 2024) | "
                f"CI: ${f.get('lower_bound', 0)/1e6:.0f}M – ${f.get('upper_bound', 0)/1e6:.0f}M"
            )

    return "\n".join(lines)


def answer_question(question: str, data_context: dict) -> str:
    client = _get_client()
    context_text = _build_context_text(data_context)
    user_message = f"{context_text}\n\n=== QUESTION ===\n{question}"

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=600,
        temperature=0.3,
    )

    return response.choices[0].message.content


def generate_executive_brief(summary_data: dict) -> str:
    client = _get_client()

    top_drugs_text = ""
    if summary_data.get("top_drugs"):
        lines = []
        for i, d in enumerate(summary_data["top_drugs"][:5], 1):
            lines.append(
                f"{i}. {d.get('brand_name', 'Unknown')} — "
                f"${d.get('spend_2024', 0) / 1e6:.0f}M (2024), "
                f"${d.get('spend_2025', 0) / 1e6:.0f}M (2025 YTD)"
            )
        top_drugs_text = "\n".join(lines)

    anomaly_text = ""
    if summary_data.get("top_anomalies"):
        lines = []
        for d in summary_data["top_anomalies"][:3]:
            lines.append(
                f"- {d.get('brand_name', 'Unknown')}: score {d.get('score', 0):.2f} — {d.get('reason', '')}"
            )
        anomaly_text = "\n".join(lines)

    forecast_text = ""
    if summary_data.get("forecasts"):
        lines = []
        for d in summary_data["forecasts"][:3]:
            lines.append(
                f"- {d.get('drug_name', 'Unknown')}: projected ${d.get('spend_2025_projected', 0) / 1e6:.0f}M "
                f"({d.get('growth_rate_pct', 0):+.1f}% vs 2024)"
            )
        forecast_text = "\n".join(lines)

    prompt = f"""Generate a professional executive brief for a health plan CFO based on this Medicare Part B drug spend data.

DATASET SUMMARY:
- Total 2024 spend: ${summary_data.get('total_spend_2024', 0) / 1e9:.2f}B
- Total 2025 YTD spend: ${summary_data.get('total_spend_2025', 0) / 1e9:.2f}B
- YoY change: {summary_data.get('spend_change_pct', 0):.1f}%
- Drugs tracked: {summary_data.get('total_drugs', 0)}
- Top 10 concentration: {summary_data.get('top_10_spend_concentration_pct', 0):.1f}%

TOP SPEND DRIVERS:
{top_drugs_text}

ANOMALIES FLAGGED:
{anomaly_text}

FORECAST HIGHLIGHTS:
{forecast_text}

Write the brief with EXACTLY these section headers (use ## for each):
## Executive Summary
## Top Spend Drivers
## Key Financial Risks
## 2025 Forecast Highlights
## Recommended Actions

Be specific with drug names and dollar figures. Keep each section to 3-5 bullet points. Write for a CFO who needs to act on this."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1200,
        temperature=0.4,
    )

    return response.choices[0].message.content
