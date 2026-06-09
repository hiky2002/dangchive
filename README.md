# 🐾 댕카이브 (Dangchive)

LCKD 유기견 보호소 봉사자가 현장에서 찍은 사진을 아이별로 정리하고 구글 드라이브로 자동 전송하는 모바일 웹앱입니다.

🌐 **접속 주소**: [[앱 주소 비공개]](https://[앱 주소 비공개])

---

## 만들게 된 이유

LCKD 보호소 봉사자들은 현장에서 찍은 사진을 카카오톡 단체 채팅방으로 공유하고 있었습니다. 그런데 봉사자마다 공유 방식이 제각각이라 누군가는 아이 이름과 함께 올리고, 누군가는 사진만 올리는 식이었습니다. 그러다 보니 어떤 사진이 어떤 아이의 것인지 알 수 없어 아이별 사진 정리가 전혀 이루어지지 않고 있었습니다.

또한 카카오톡은 일정 기간이 지나면 사진을 다시 내려받을 수 없어, 소중한 사진들이 그냥 사라지는 문제도 있었습니다. 사진을 구글 드라이브에 옮겨 보관하려 해도, 파일이 많은 드라이브에서 아이별로 직접 분류하는 작업이 모바일에서 매우 번거로웠습니다.

이런 불편함을 해결하기 위해 댕카이브를 만들었습니다. 봉사자가 현장에서 사진을 올리면 아이 이름을 바로 지정할 수 있고, 이름을 모르는 사진은 다른 봉사자가 나중에 채워줄 수 있도록 했습니다. 이름이 지정된 사진은 구글 드라이브의 아이별 폴더로 자동 전송되어, 따로 정리 작업 없이도 깔끔하게 아카이브가 쌓입니다.

---

## 주요 기능

- **📸 사진 업로드** — 최대 50장, 자동 압축 후 업로드
- **🗂️ 아이별 사진 정리** — 사진에 강아지 이름 지정 (한 장에 여러 아이 지정 가능)
- **🚀 구글 드라이브 자동 전송** — 아이별 폴더 자동 생성, `YYMMDD_아이이름_001.jpg` 형식으로 저장
- **✅ 이름 확인** — 이름을 모르는 사진을 다른 봉사자가 도움을 줄 수 있는 페이지
- **➕ 아이 추가/이름 변경 요청** — 봉사자가 요청 → 관리자 승인 후 반영
- **🔄 드라이브 동기화** — 드라이브 기존 폴더와 DB 자동 동기화
- **💬 의견 보내기** — 앱 내 피드백 전송 (이메일 알림)
- **🔑 관리자 모드** — 요청 승인/거절, 아이 직접 추가/수정/삭제

---

## 사용 방법


### ⚡ 빠른 요약

| 기능 | 누르는 순서 |
|------|------------|
| 📸 사진 업로드 | 홈 `사진 업로드` 또는 하단 `올리기` → 사진 선택 → `올리기 (N장)` |
| ✅ 이름 지정 | `정리하기` → 사진 선택 → `이름 지정하기` → 아이 선택 → `지정하기` |
| ➕ 새 아이 추가 요청 | `이름 지정하기` 열기 → 하단 이름 입력 → `요청` |
| ✏️ 이름 변경 요청 | `아이 관리` → 해당 아이 옆 `이름 변경 요청` → 새 이름 입력 → `요청` |
| 🚀 드라이브 전송 | 전송 준비 완료 섹션 사진 선택 → `🚀 드라이브로 보내기` |
| ⏭️ 이름 모를 때 넘기기 | 사진 선택 → `이 아이 누구예요?` → `지금은 넘기고 나중에 이름 지정하기 →` |
| 💬 의견 보내기 | 홈 → `💬 의견 보내기` → 내용 입력 → `보내기` |
| 🔑 관리자 로그인 | 홈 → `🔑 관리자 로그인` → 비밀번호 입력 → `확인` |
| 📋 요청 승인/거절 | `아이 관리` → 대기 중인 요청 → `✓ 승인` 또는 `✗ 거절` |

---

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Database / Storage | Supabase (PostgreSQL + Storage) |
| 구글 드라이브 연동 | Google Drive API v3 (서비스 계정) |
| 이미지 압축 | browser-image-compression |
| 이메일 알림 | Resend |
| 배포 | Vercel |

---

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

---

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
GOOGLE_SHARED_DRIVE_ID=your-shared-drive-id  # 공유 드라이브 사용 시

# 관리자
ADMIN_PASSWORD=your-admin-password

# 의견 이메일 알림 (선택)
RESEND_API_KEY=your-resend-api-key
```

### 서비스 계정 설정 방법

1. [Google Cloud Console](https://console.cloud.google.com) → IAM 및 관리자 → 서비스 계정 → 새 서비스 계정 생성
2. Google Drive API 활성화
3. 서비스 계정 키(JSON) 발급 후 `client_email`과 `private_key` 값을 환경변수에 입력
4. Google Drive에서 업로드할 폴더를 서비스 계정 이메일과 **편집자** 이상으로 공유

---

## DB 스키마

```sql
-- 아이 목록
CREATE TABLE dogs (
  dog_id   TEXT PRIMARY KEY,
  dog_name TEXT NOT NULL,
  drive_folder_id TEXT
);

-- 업로드된 사진
CREATE TABLE photos (
  photo_id     TEXT PRIMARY KEY,
  batch_id     TEXT,
  file_name    TEXT,
  saved_name   TEXT,
  upload_user  TEXT,
  storage_path TEXT,
  status       TEXT, -- temp | named | needs_name | sent | failed
  drive_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 사진-아이 다대다 관계
CREATE TABLE photo_dogs (
  photo_id TEXT REFERENCES photos(photo_id),
  dog_id   TEXT REFERENCES dogs(dog_id),
  PRIMARY KEY (photo_id, dog_id)
);

-- 업로드 배치
CREATE TABLE batches (
  batch_id    TEXT PRIMARY KEY,
  upload_user TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 아이 추가/이름 변경 요청
CREATE TABLE dog_requests (
  request_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL, -- add | rename
  dog_name    TEXT NOT NULL,
  new_name    TEXT,
  dog_id      TEXT,
  requester   TEXT,
  status      TEXT DEFAULT 'pending', -- pending | approved | rejected
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 의견/피드백
CREATE TABLE feedback (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL,
  sender      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 배포 (Vercel)

```bash
vercel --prod
```

Vercel 프로젝트 환경변수에 위 `.env.local` 값들을 동일하게 설정해 주세요.
