-- 피드백 테이블
create table if not exists feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  message     text        not null,
  sender      text,                         -- 보낸 사람 이름 (선택)
  created_at  timestamptz default now()
);
