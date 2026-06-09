# 댕카이브 (Dangchive)

유기견 보호소 봉사자가 현장에서 찍은 사진을 아이별로 정리하고 구글 드라이브로 자동 전송하는 모바일 웹앱입니다.

## 주요 기능

- **사진 업로드** — 봉사자가 현장에서 사진을 선택해 자동 압축 후 업로드 (최대 50장)
- **아이별 사진 정리** — 업로드한 사진에 강아지 이름을 지정해 분류 (한 장에 여러 아이 지정 가능)
- **구글 드라이브 자동 전송** — 아이별 폴더를 자동 생성하고 날짜+이름 형식으로 사진 전송
- **드라이브 동기화** — 드라이브의 기존 폴더 목록을 불러와 DB와 자동 동기화
- **공유 드라이브 지원** — Google Workspace 공유 드라이브(Shared Drive) 연동 가능

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Database / Storage | Supabase (PostgreSQL + Storage) |
| 구글 드라이브 연동 | Google Drive API v3 (서비스 계정) |
| 이미지 압축 | browser-image-compression |
| 배포 | Vercel |

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 환경변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 값을 채워 넣으세요.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Drive (서비스 계정)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"

# Google Drive 폴더
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-root-folder-id
# 공유 드라이브 사용 시 (일반 드라이브면 생략)
GOOGLE_SHARED_DRIVE_ID=your-shared-drive-id
```

### 서비스 계정 설정 방법

1. [Google Cloud Console](https://console.cloud.google.com) → IAM 및 관리자 → 서비스 계정 → 새 서비스 계정 생성
2. Google Drive API 활성화
3. 서비스 계정 키(JSON) 발급 후 `client_email`과 `private_key` 값을 환경변수에 입력
4. Google Drive에서 업로드할 폴더를 서비스 계정 이메일과 **편집자** 이상으로 공유

## DB 스키마

```sql
-- 아이 목록
CREATE TABLE dogs (
  dog_id TEXT PRIMARY KEY,
  dog_name TEXT NOT NULL,
  drive_folder_id TEXT
);

-- 업로드된 사진
CREATE TABLE photos (
  photo_id TEXT PRIMARY KEY,
  batch_id TEXT,
  file_name TEXT,
  saved_name TEXT,
  upload_user TEXT,
  storage_path TEXT,
  status TEXT, -- temp | named | needs_name | sent | failed
  drive_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사진-아이 다대다 관계 (한 장에 여러 아이 지정 가능)
CREATE TABLE photo_dogs (
  photo_id TEXT REFERENCES photos(photo_id),
  dog_id TEXT REFERENCES dogs(dog_id),
  PRIMARY KEY (photo_id, dog_id)
);

-- 업로드 배치
CREATE TABLE batches (
  batch_id TEXT PRIMARY KEY,
  upload_user TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 배포 (Vercel)

```bash
vercel --prod
```

Vercel 프로젝트 환경변수에 위 `.env.local` 값들을 동일하게 설정해 주세요.
