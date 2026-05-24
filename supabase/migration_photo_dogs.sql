-- ============================================================
-- 마이그레이션: photo_dogs 다대다 관계 테이블 추가
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. photo_dogs 테이블 생성
CREATE TABLE IF NOT EXISTS photo_dogs (
  photo_id text REFERENCES photos(photo_id) ON DELETE CASCADE,
  dog_id   text REFERENCES dogs(dog_id)   ON DELETE CASCADE,
  PRIMARY KEY (photo_id, dog_id)
);

-- 2. RLS 활성화
ALTER TABLE photo_dogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read photo_dogs"  ON photo_dogs FOR SELECT USING (true);
CREATE POLICY "anon insert photo_dogs"  ON photo_dogs FOR INSERT WITH CHECK (true);
CREATE POLICY "anon delete photo_dogs"  ON photo_dogs FOR DELETE USING (true);

-- 3. 기존 photos.dog_id 데이터를 photo_dogs로 마이그레이션
INSERT INTO photo_dogs (photo_id, dog_id)
SELECT photo_id, dog_id
FROM   photos
WHERE  dog_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. dogs 테이블 삭제 정책 추가 (기존에 없는 경우)
DROP POLICY IF EXISTS "anon delete dogs" ON dogs;
CREATE POLICY "anon delete dogs" ON dogs FOR DELETE USING (true);
