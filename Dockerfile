# 베이스 이미지
FROM node:20-alpine

# 작업 디렉토리 생성
WORKDIR /usr/src/app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm install --production

# 앱 소스 복사
COPY . .

# 컨테이너 외부에 노출할 포트
EXPOSE 8080

# 서버 실행
CMD ["npm", "start"]
