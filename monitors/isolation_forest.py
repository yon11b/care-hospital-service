import sys
import os
import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy import create_engine
import numpy as np

# ---------- 경로 설정 ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")

# ---------- DB 연결 ----------
engine = create_engine(
    "postgresql://postgres:capstone123!!@capstone.cv0om8moa4j0.ap-northeast-2.rds.amazonaws.com:5432/postgres"
)

# ---------- JSON 안전 읽기 함수 ----------
def safe_read_json(filename):
    path = os.path.join(LOG_DIR, filename)
    try:
        if not os.path.exists(path):
            print(f"⚠️ {filename} 파일이 존재하지 않음.")
            return pd.DataFrame()
        df = pd.read_json(path)
        if df.empty:
            print(f"⚠️ {filename} 파일이 비어 있음.")
        return df
    except Exception as e:
        print(f"⚠️ {filename} 읽기 실패: {e}")
        return pd.DataFrame()

# ---------- 파일 읽기 ----------
review_df = safe_read_json("reviews.json")
login_df = safe_read_json("logins.json")

# ---------- 이상치 스코어 계산 함수 ----------
def compute_failed_login_anomaly(df, score_col_name):
    if df.empty or "user_id" not in df.columns:
        return pd.DataFrame()
    X = df[["failed_logins"]].copy()
    X["failed_logins"] = pd.to_numeric(X["failed_logins"], errors='coerce').fillna(0)
    X["failed_logins_processed"] = X["failed_logins"] ** 2  # 극단값 강조
    model = IsolationForest(contamination=0.05)
    model.fit(X[["failed_logins_processed"]])
    df[score_col_name] = -model.decision_function(X[["failed_logins_processed"]])
    df[score_col_name] = df[score_col_name].round(5)
    # ✅ 이상치 여부 판단
    df["status"] = np.where(df[score_col_name] >= -0.05, "bad", "good")
    return df[["user_id", score_col_name, "status"]]

def compute_review_anomaly(df, score_col_name):
    if df.empty or "user_id" not in df.columns:
        return pd.DataFrame()
    X = df[["reviews_last_5m"]].copy()
    X["reviews_last_5m"] = pd.to_numeric(X["reviews_last_5m"], errors='coerce').fillna(0)
    X["reviews_processed"] = X["reviews_last_5m"] ** 2  # 극단값 강조
    model = IsolationForest(contamination=0.02)
    model.fit(X[["reviews_processed"]])
    df[score_col_name] = -model.decision_function(X[["reviews_processed"]])
    df[score_col_name] = df[score_col_name].round(5)
    # ✅ 이상치 여부 판단
    df["status"] = np.where(df[score_col_name] >= -0.05, "bad", "good")
    return df[["user_id", score_col_name, "status"]]

# ---------- 이상치 점수 계산 ----------
login_scores = compute_failed_login_anomaly(login_df, "login_anomaly_score")
review_scores = compute_review_anomaly(review_df, "review_anomaly_score")

# ---------- 병합 ----------
dfs = [df for df in [login_scores, review_scores] if not df.empty]
if dfs:
    alerts = dfs[0]
    for df in dfs[1:]:
        alerts = pd.merge(alerts, df, on="user_id", how="outer")
else:
    alerts = pd.DataFrame()

# ---------- DB 저장 ----------
if not alerts.empty:
    alerts.to_sql("anomaly_alerts", engine, if_exists="append", index=False)
    print(f"✅ {len(alerts)}건 이상치 저장 완료")
else:
    print("⚠️ 저장할 이상치 데이터가 없음.")
