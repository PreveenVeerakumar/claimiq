import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from backend.data_pipeline import get_clean_data


def run_variance_analysis():
    df = get_clean_data().copy()

    feature_cols = ["Tot_Clms_2024", "Avg_Spnd_Per_Clm_2024", "Tot_Benes_2024"]
    target_col = "Tot_Spndng_2025"

    df_model = df.dropna(subset=feature_cols + [target_col]).copy()

    X = df_model[feature_cols].values
    y = df_model[target_col].values

    model = LinearRegression()
    model.fit(X, y)

    y_pred = model.predict(X)
    residuals = y - y_pred

    std_resid = residuals.std()
    z_scores = residuals / std_resid if std_resid > 0 else residuals

    df_model = df_model.copy()
    df_model["predicted_spend_2025"] = y_pred
    df_model["model_residual"] = residuals
    df_model["residual_zscore"] = z_scores
    df_model["model_flag"] = df_model["residual_zscore"].apply(
        lambda z: "Above expectation" if z > 2 else ("Below expectation" if z < -2 else "As expected")
    )

    return df_model
