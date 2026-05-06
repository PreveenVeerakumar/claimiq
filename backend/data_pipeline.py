import pandas as pd
import numpy as np
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "Medicare_Quarterly_Part_B_Spending_by_Drug_Q3_2025.csv"

_df_merged = None
_df_2024 = None


def _load_data():
    global _df_merged, _df_2024

    if _df_merged is not None:
        return _df_merged, _df_2024

    if not _DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {_DATA_PATH}")

    df = pd.read_csv(_DATA_PATH)

    str_cols = df.select_dtypes(include="object").columns
    for col in str_cols:
        df[col] = df[col].str.strip()

    df["drug_key"] = df["HCPCS_Cd"].astype(str)

    df_2024 = df[df["Year"] == "2024 (Q1-Q4)"].copy().reset_index(drop=True)
    df_2025 = df[df["Year"] == "2025 (Q1-Q3)"].copy().reset_index(drop=True)

    _df_2024 = df_2024

    df_merged = df_2024.merge(df_2025, on="drug_key", suffixes=("_2024", "_2025"))

    df_merged["spend_change_abs"] = df_merged["Tot_Spndng_2025"] - df_merged["Tot_Spndng_2024"]
    df_merged["spend_change_pct"] = (
        df_merged["spend_change_abs"] / df_merged["Tot_Spndng_2024"]
    ) * 100

    df_merged["cost_per_claim_change_pct"] = (
        (df_merged["Avg_Spnd_Per_Clm_2025"] - df_merged["Avg_Spnd_Per_Clm_2024"])
        / df_merged["Avg_Spnd_Per_Clm_2024"]
    ) * 100

    df_merged["cost_per_bene_change_pct"] = (
        (df_merged["Avg_Spnd_Per_Bene_2025"] - df_merged["Avg_Spnd_Per_Bene_2024"])
        / df_merged["Avg_Spnd_Per_Bene_2024"]
    ) * 100

    df_merged["variance_flag"] = df_merged["spend_change_pct"].apply(
        lambda x: "high_increase" if x > 20 else ("high_decrease" if x < -20 else "stable")
    )

    # Estimated WAC-to-ASP market discount (not a formulary rebate).
    #
    # Medicare Part B reimburses at ASP + 6%. The CMS dataset reflects ASP-based
    # spending — actual rebate data is not disclosed. What we can estimate is the
    # WAC-to-ASP differential, which represents the market discount embedded in the
    # ASP calculation before CMS pays.
    #
    # Rates sourced from MedPAC March 2023 Report to Congress (Chapter 5) and
    # OIG "Comparing Medicare Part B and Part D Drug Spending" (OEI-12-21-00310):
    #
    #   Specialty biologics (Avg_Spnd_Per_Clm > $10,000):
    #     MedPAC reports WAC-to-ASP discounts averaging 22–28% for high-cost
    #     biologics (e.g. immunotherapy, monoclonal antibodies). We use 25%.
    #
    #   Brand drugs ($1,000–$10,000/claim):
    #     MedPAC reports brand drug WAC-to-ASP discounts averaging 18–23%.
    #     We use 20%.
    #
    #   Generics / low-cost drugs (< $1,000/claim):
    #     ASP for generics is already highly competitive; MedPAC notes
    #     discounts of 2–5%. We use 3%.
    #
    # These represent the estimated gross discount from WAC to ASP, not
    # additional rebates on top of ASP. Label accordingly in all UI.

    def get_discount_rate(avg_cost_per_claim):
        if avg_cost_per_claim > 10_000:
            return 0.25   # specialty biologic — MedPAC 2023 avg ~22–28%
        elif avg_cost_per_claim > 1_000:
            return 0.20   # brand drug — MedPAC 2023 avg ~18–23%
        return 0.03       # generic/low-cost — MedPAC 2023 avg ~2–5%

    def get_drug_tier(avg_cost_per_claim):
        if avg_cost_per_claim > 10_000:
            return "Specialty Biologic"
        elif avg_cost_per_claim > 1_000:
            return "Brand Drug"
        return "Generic / Low-Cost"

    df_merged["discount_rate_2024"] = df_merged["Avg_Spnd_Per_Clm_2024"].apply(get_discount_rate)
    df_merged["drug_tier_2024"] = df_merged["Avg_Spnd_Per_Clm_2024"].apply(get_drug_tier)
    df_merged["estimated_market_discount_2024"] = (
        df_merged["Tot_Spndng_2024"] * df_merged["discount_rate_2024"]
    )
    df_merged["estimated_net_asp_cost_2024"] = (
        df_merged["Tot_Spndng_2024"] - df_merged["estimated_market_discount_2024"]
    )

    # Keep legacy column names so existing endpoints don't break,
    # but point them at the corrected values.
    df_merged["rebate_rate_2024"] = df_merged["discount_rate_2024"]
    df_merged["estimated_rebate_2024"] = df_merged["estimated_market_discount_2024"]
    df_merged["estimated_net_cost_2024"] = df_merged["estimated_net_asp_cost_2024"]
    df_merged["rebate_capture_rate_2024"] = df_merged["discount_rate_2024"]

    _df_merged = df_merged
    return _df_merged, _df_2024


def get_clean_data():
    df_merged, _ = _load_data()
    return df_merged


def get_2024_data():
    _, df_2024 = _load_data()
    return df_2024


def get_raw_csv():
    """All 1,759 rows from the CSV exactly as loaded — both years, unmerged."""
    if not _DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {_DATA_PATH}")
    df = pd.read_csv(_DATA_PATH)
    str_cols = df.select_dtypes(include="object").columns
    for col in str_cols:
        df[col] = df[col].str.strip()
    return df


def get_summary_stats():
    df, _ = _load_data()

    total_spend_2024 = df["Tot_Spndng_2024"].sum()
    total_spend_2025 = df["Tot_Spndng_2025"].sum()
    spend_change_pct = ((total_spend_2025 - total_spend_2024) / total_spend_2024) * 100
    total_drugs = len(df)
    total_claims_2024 = int(df["Tot_Clms_2024"].sum())
    avg_cost_per_claim_2024 = float(df["Avg_Spnd_Per_Clm_2024"].mean())
    top_10_spend = df.nlargest(10, "Tot_Spndng_2024")["Tot_Spndng_2024"].sum()
    top_10_spend_concentration_pct = (top_10_spend / total_spend_2024) * 100

    return {
        "total_spend_2024": float(total_spend_2024),
        "total_spend_2025": float(total_spend_2025),
        "spend_change_pct": float(spend_change_pct),
        "total_drugs": total_drugs,
        "total_claims_2024": total_claims_2024,
        "avg_cost_per_claim_2024": avg_cost_per_claim_2024,
        "top_10_spend_concentration_pct": float(top_10_spend_concentration_pct),
    }
