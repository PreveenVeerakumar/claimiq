import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from backend.data_pipeline import get_2024_data


def run_anomaly_detection():
    df = get_2024_data().copy()

    features = ["Tot_Spndng", "Tot_Clms", "Tot_Benes", "Avg_Spnd_Per_Clm", "Avg_Spnd_Per_Bene"]
    df_feat = df.dropna(subset=features).copy()

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df_feat[features])

    iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    iso.fit(X_scaled)

    scores = iso.decision_function(X_scaled)
    inverted = -scores
    min_s, max_s = inverted.min(), inverted.max()
    if max_s > min_s:
        normalised = (inverted - min_s) / (max_s - min_s)
    else:
        normalised = np.zeros_like(inverted)

    df_feat = df_feat.copy()
    df_feat["anomaly_score"] = normalised
    df_feat["is_anomaly"] = normalised >= 0.5

    p99_cost = df_feat["Avg_Spnd_Per_Clm"].quantile(0.99)
    p95_spend = df_feat["Tot_Spndng"].quantile(0.95)
    p25_benes = df_feat["Tot_Benes"].quantile(0.25)
    df_feat["claims_per_bene"] = df_feat["Tot_Clms"] / df_feat["Tot_Benes"].replace(0, np.nan)
    p95_cpb = df_feat["claims_per_bene"].quantile(0.95)

    def build_reason(row):
        reasons = []
        if row["Avg_Spnd_Per_Clm"] > p99_cost:
            reasons.append("extreme cost per claim")
        cpb = row["claims_per_bene"] if not np.isnan(row["claims_per_bene"]) else 0
        if cpb > p95_cpb:
            reasons.append("unusually high claims per patient")
        if row["Tot_Spndng"] > p95_spend and row["Tot_Benes"] < p25_benes:
            reasons.append("high spend concentrated in few patients")
        return " · ".join(reasons) if reasons else "multivariate outlier"

    df_feat["anomaly_reason"] = df_feat.apply(build_reason, axis=1)

    return df_feat.sort_values("anomaly_score", ascending=False).reset_index(drop=True)
