import pandas as pd
import json
from sklearn.ensemble import IsolationForest
import psycopg2

# ---------- 리뷰 데이터 불러오기 ----------
with open('./logs/normal_reviews.json', 'r', encoding='utf-8') as f:
    review_data = json.load(f)
df_review = pd.DataFrame(review_data)
df_review['reviews_last_5m'] = df_review['reviews_last_5m'].astype(int)
X_train = df_review[['reviews_last_5m']]

# ---------- Isolation Forest 학습 ----------
model = IsolationForest(n_estimators=100, contamination=0.02, random_state=42)
model.fit(X_train)

# ---------- 새로운 로그인 데이터 판별 ----------
with open('./logs/recent_reviews.json', 'r', encoding='utf-8') as f:
    recent_data = json.load(f)
df_recent = pd.DataFrame(recent_data)
df_recent['reviews_last_5m'] = df_recent['reviews_last_5m'].astype(int)
X_test = df_recent[['reviews_last_5m']]

df_recent['anomaly'] =model.predict(X_test)  # -1 → 이상치, 1 → 정상

# ---------- anomaly == -1 (비정상) 데이터만 필터 ----------
df_to_insert = df_recent[df_recent['anomaly'] == -1].copy()

# ---------- DB 저장 ----------
conn = psycopg2.connect(
    host="capstone.cv0om8moa4j0.ap-northeast-2.rds.amazonaws.com",
    database="postgres",
    user="postgres",
    password="capstone123!!"
)
cur = conn.cursor()

df_to_insert['user_id'] = df_to_insert['user_id'].fillna(0).astype(int)
df_to_insert['reviews_last_5m'] = df_to_insert['reviews_last_5m'].astype(int)
for idx, row in df_to_insert.iterrows():
    cur.execute(
        """
        INSERT INTO anomaly_alerts (user_id, reviews_last_5m)
        VALUES (%s, %s)
        """,
        (
            int(row['user_id']),
            int(row['reviews_last_5m']),
        )
    )

conn.commit()
cur.close()
conn.close()
print(df_recent['anomaly'].value_counts())
print(f"{len(df_to_insert)}건 비정상 리뷰 데이터 DB 저장 완료 (정상: {len(df_to_insert[df_to_insert['anomaly']==1])}, 이상치: {len(df_to_insert[df_to_insert['anomaly']==-1])})")
