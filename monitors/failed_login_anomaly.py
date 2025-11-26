import pandas as pd
import json
from sklearn.ensemble import IsolationForest
import psycopg2  # PostgreSQL 기준

# ---------- 정상 데이터 불러오기 ----------
with open('./logs/normal_logins_250.json', 'r', encoding='utf-8') as f:
    normal_data = json.load(f)
df_normal = pd.DataFrame(normal_data)
df_normal['failed_logins'] = df_normal['failed_logins'].astype(int)
X_train = df_normal[['failed_logins']]

# ---------- 모델 학습 ----------
model = IsolationForest(n_estimators=100, contamination=0.02, random_state=42)
model.fit(X_train)

# ---------- 새로운 로그인 데이터 판별 ----------
with open('./logs/recent_logins.json', 'r', encoding='utf-8') as f:
    recent_data = json.load(f)
df_recent = pd.DataFrame(recent_data)
df_recent['failed_logins'] = df_recent['failed_logins'].astype(int)
X_test = df_recent[['failed_logins']]

df_recent['anomaly'] = model.predict(X_test)  # -1 → 이상치, 1 → 정상

# ---------- anomaly == -1 (비정상) 데이터만 필터 ----------
df_to_insert = df_recent[df_recent['anomaly'] == -1].copy()

# ---------- DB 저장 예시 ----------
conn = psycopg2.connect(
    host="capstone.cv0om8moa4j0.ap-northeast-2.rds.amazonaws.com",
    database="postgres",
    user="postgres",
    password="capstone123!!"
)
cur = conn.cursor()

df_to_insert['failed_logins'] = df_to_insert['failed_logins'].astype(int)
df_to_insert['user_id'] = df_to_insert['user_id'].fillna(0).astype(int)
for idx, row in df_to_insert.iterrows():
    cur.execute(
        "INSERT INTO anomaly_alerts (user_id, failed_logins) VALUES (%s, %s)",
        (int(row['user_id']), int(row['failed_logins']))
    )
conn.commit()
cur.close()
conn.close()

print(f"{len(df_to_insert)}건 비정상 로그인 데이터를 DB에 저장 완료")
