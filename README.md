# 댕카이브 (Dangchive)

유기견 보호소 봉사자가 현장에서 찍은 사진을 아이별로 정리하고 구글 드라이브로 자동 전송하는 모바일 웹앱입니다.

## 주요 기능

- **사진 업로드** — 봉사자가 현장에서 사진을 촬영하거나 선택해 업로드
- **아이별 사진 정리** — 업로드한 사진에 강아지 이름을 지정해 분류
- **구글 드라이브 자동 전송** — 아이별 폴더를 자동 생성하고 사진을 전송
- **드라이브 동기화** — 드라이브의 기존 폴더 목록을 불러와 DB와 자동 동기화
- **배치 관리** — 사진 업로드 세션을 배치 단위로 관리

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Database / Storage | Supabase (PostgreSQL + Storage) |
| 구글 드라이브 연동 | Google Drive API v3 (OAuth2) |
| 이미지 압축 | browser-image-compression |
| 배포 | Vercel |

## 환경변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 값을 채워 넣으세요.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth2
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:4000

# Google Drive
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-root-folder-id
# 공유 드라이브(Shared Drive) 사용 시 드라이브 ID 추가 (일반 드라이브면 생략)
GOOGLE_SHARED_DRIVE_ID=your-shared-drive-id
```

### Google Refresh Token 발급 방법

1. [Google Cloud Console](https://console.cloud.google.com)에서 OAuth 2.0 클라이언트 ID 생성
2. 승인된 리디렉션 URI에 `http://localhost:4000` 추가
3. `.env.local`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 입력 후 `get-token.mjs` 실행:

```bash
node get-token.mjs
```

4. 출력된 `GOOGLE_REFRESH_TOKEN` 값을 `.env.local`에 추가

## 로컬 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 빌드

```bash
npm run build
npm run start
```
