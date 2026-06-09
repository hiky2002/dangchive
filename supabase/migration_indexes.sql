-- ============================================================
-- 마이그레이션: 성능 인덱스 추가
-- Supabase SQL Editor에서 실행
-- ============================================================

-- photo_dogs.dog_id 단독 인덱스
-- PK는 (photo_id, dog_id) 복합키라 dog_id 단독 조회에는 별도 인덱스 필요
CREATE INDEX IF NOT EXISTS idx_photo_dogs_dog_id ON photo_dogs(dog_id);

-- photos.status 인덱스
-- GET /api/upload, GET /api/batches 모두 status로 필터링
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);

-- photos.batch_id 인덱스
-- FK 컬럼은 PostgreSQL이 자동 인덱스를 만들지 않음
CREATE INDEX IF NOT EXISTS idx_photos_batch_id ON photos(batch_id);
