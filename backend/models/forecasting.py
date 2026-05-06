import pandas as pd
import numpy as np
from prophet import Prophet
from backend.data_pipeline import get_clean_data


def run_forecast():
    df = get_clean_data()

    top20 = df.nlargest(20, "Tot_Spndng_2024").copy()

    results = []
    for _, row in top20.iterrows():
        drug_name = str(row.get("Brnd_Name_2024", row.get("drug_key", "Unknown")))
        spend_2024 = float(row["Tot_Spndng_2024"])
        spend_2025_actual = float(row["Tot_Spndng_2025"])

        try:
            prophet_df = pd.DataFrame(
                {
                    "ds": pd.to_datetime(["2024-12-31", "2025-09-30"]),
                    "y": [spend_2024, spend_2025_actual],
                }
            )

            model = Prophet(
                yearly_seasonality=False,
                weekly_seasonality=False,
                daily_seasonality=False,
                uncertainty_samples=500,
            )
            model.fit(prophet_df)

            future = model.make_future_dataframe(periods=3, freq="QE")
            forecast = model.predict(future)

            eoy_row = forecast[forecast["ds"] >= "2025-12-01"].iloc[0]
            projected = float(eoy_row["yhat"])
            lower = float(eoy_row["yhat_lower"])
            upper = float(eoy_row["yhat_upper"])

            growth_rate = ((projected - spend_2024) / spend_2024) * 100

            results.append(
                {
                    "drug_name": drug_name,
                    "drug_key": str(row["drug_key"]),
                    "generic_name": str(row.get("Gnrc_Name_2024", "")),
                    "spend_2024": spend_2024,
                    "spend_2025_actual": spend_2025_actual,
                    "spend_2025_projected": projected,
                    "lower_bound": lower,
                    "upper_bound": upper,
                    "growth_rate_pct": float(growth_rate),
                }
            )
        except Exception as e:
            print(f"Prophet failed for {drug_name}: {e}")
            annualised = spend_2025_actual * (12 / 9)
            growth_rate = ((annualised - spend_2024) / spend_2024) * 100
            results.append(
                {
                    "drug_name": drug_name,
                    "drug_key": str(row["drug_key"]),
                    "generic_name": str(row.get("Gnrc_Name_2024", "")),
                    "spend_2024": spend_2024,
                    "spend_2025_actual": spend_2025_actual,
                    "spend_2025_projected": annualised,
                    "lower_bound": annualised * 0.9,
                    "upper_bound": annualised * 1.1,
                    "growth_rate_pct": float(growth_rate),
                }
            )

    results.sort(key=lambda x: x["spend_2025_projected"], reverse=True)
    return results
