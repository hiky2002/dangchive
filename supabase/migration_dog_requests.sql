-- 아이 이름 변경/추가 요청 테이블
CREATE TABLE IF NOT EXISTS dog_requests (
  request_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL CHECK (type IN ('rename', 'add')),
  requester   TEXT        NOT NULL DEFAULT '봉사자',
  dog_id      TEXT        REFERENCES dogs(dog_id) ON DELETE SET NULL,
  current_name TEXT,
  requested_name TEXT     NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
