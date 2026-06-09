# 🐾 댕카이브 (Dangchive)

> LCKD 유기견 보호소 봉사자를 위한 사진 아카이브 모바일 웹앱

<br>

## 프로젝트 개요

### 배경 및 목적

LCKD 보호소 봉사자들은 현장에서 찍은 사진을 카카오톡 단체 채팅방으로 공유 후 가끔씩 구글 드라이브로 넘기는 작업으로 진행하여 아래와 같은 세 가지의 문제가 있었습니다.

| 문제 | 상황 |
|------|------|
| 📵 사진이 사라진다 | 카카오톡은 일정 기간 후 사진 다운로드 불가 |
| 🗂️ 정리가 안 된다 | 봉사자마다 공유 방식이 달라 아이별 분류 불가 |
| 📱 수동 정리가 번거롭다 | 구글드라이브에서 모바일로 아이별 분류하는 작업이 불편 |

이 세 가지를 해결하기 위해 만들었습니다.

### 개발 방식

1인 개발 프로젝트로, 실제 봉사자들의 피드백을 반영하며 기능을 점진적으로 개선했습니다.

<br>

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (서버리스) |
| Database / Storage | Supabase (PostgreSQL + Object Storage) |
| 외부 연동 | Google Drive API v3 (서비스 계정) |
| 이미지 처리 | browser-image-compression |
| 이메일 알림 | Resend |
| 배포 | Vercel |

<br>

## 아키텍처

```
[봉사자 모바일 브라우저]
        │
        │ 사진 업로드 (압축 후)
        ▼
[Next.js API Routes]
        │
        ├──▶ [Supabase Storage]   사진 원본 임시 저장
        ├──▶ [Supabase DB]        사진 메타데이터, 아이 정보, 요청 관리
        └──▶ [Google Drive API]   아이별 폴더 자동 생성 + 사진 전송
                                  전송 완료 후 Supabase Storage 원본 삭제
```

<br>

## 주요 기능

#### 📸 사진 업로드
- 최대 50장 다중 선택, 자동 압축 후 업로드
- 업로드 완료 시 정리하기 화면으로 자동 이동

#### 🗂️ 아이별 사진 정리
- 3열 그리드 + 멀티셀렉트로 여러 장 한 번에 이름 지정
- 한 장에 여러 아이 동시 지정 가능

#### 🚀 구글 드라이브 자동 전송
- 아이별 폴더 자동 생성
- `YYMMDD_아이이름_001.jpg` 형식으로 저장
- 전송 완료 후 Supabase Storage 원본 자동 삭제

#### ✅ 이름 확인
- 이름을 모르는 사진을 별도 탭으로 분류
- 다른 봉사자가 나중에 이름을 채워줄 수 있는 협업 구조

#### ➕ 아이 추가 / 이름 변경 요청
- 봉사자가 요청 → 관리자 승인 후 반영
- 유사 이름 중복 경고, 요청 취소 기능

#### 🔑 관리자 모드
- 요청 승인/거절, 아이 직접 추가/수정/삭제
- 드라이브 폴더와 DB 자동 동기화

<br>

## 기술적 문제 해결

**드라이브 전송 진행률 표시 문제**
- 기존: 사진 N장을 한 번의 API 호출로 일괄 전송 → 진행률이 0%에서 100%로 순간 점프
- 해결: 사진 1장씩 개별 API 호출 + 동시 3개 병렬 처리(concurrency worker 패턴) → 진행률 실시간 갱신

**관리자 홈 화면 카운트 불일치 문제**
- 기존: 페이지 마운트 시 1회만 fetch → 다른 탭에서 요청 처리 후 돌아와도 숫자가 갱신 안 됨
- 해결: `visibilitychange` 이벤트 + 30초 폴링으로 자동 갱신, API 라우트에 `force-dynamic` 추가로 캐시 방지

<br>

## 결과 및 성과

- 실제 LCKD 보호소 봉사자들이 현장에서 사용 중
- 카카오톡 채팅방 사진 공유 → 구글 드라이브 아이별 아카이브로 전환
- 봉사자별 정리 방식이 달라 쌓이지 않던 사진들이 자동으로 분류되어 보관

<br>

## 향후 개선 계획

- 사진에서 아이를 자동으로 인식하는 AI 기반 이름 추천 기능
- 봉사 일지와 연동한 아이별 성장 기록 페이지

<br>

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

<br>

## 환경변수 설정

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Drive (서비스 계정)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_SHARED_DRIVE_ID=

# 관리자
ADMIN_PASSWORD=

# 이메일 알림 (선택)
RESEND_API_KEY=
```
