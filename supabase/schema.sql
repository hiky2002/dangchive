-- ============================================================
-- 댕카이브 (Dangchive) — Supabase SQL Schema
-- Supabase SQL Editor에 전체 붙여넣기 후 실행
-- ============================================================


-- ============================================================
-- 0. 기존 테이블/트리거/시퀀스 초기화 (재실행 안전)
-- ============================================================
drop trigger if exists trg_dogs_id    on dogs    cascade;
drop trigger if exists trg_batches_id on batches cascade;
drop trigger if exists trg_photos_id  on photos  cascade;

drop function if exists fn_generate_dog_id()    cascade;
drop function if exists fn_generate_batch_id()  cascade;
drop function if exists fn_generate_photo_id()  cascade;

drop table if exists photos  cascade;
drop table if exists batches cascade;
drop table if exists dogs    cascade;

drop sequence if exists seq_dogs;
drop sequence if exists seq_batches;
drop sequence if exists seq_photos;


-- ============================================================
-- 1. 시퀀스 (자동 증분 번호 생성용)
-- ============================================================
create sequence seq_dogs    start 1 increment 1;
create sequence seq_batches start 1 increment 1;
create sequence seq_photos  start 1 increment 1;


-- ============================================================
-- 2. 테이블 생성
-- ============================================================

-- [dogs] 아이(유기견) 목록
create table dogs (
  dog_id         text        primary key,               -- D0001, D0002 ...
  dog_name       text        not null unique,            -- 콩이, 두부 ...
  drive_folder_id text,                                  -- 구글 드라이브 폴더 ID
  created_at     timestamptz not null default now()
);

-- [batches] 사진 묶음 단위
create table batches (
  batch_id    text        primary key,                   -- B0001, B0002 ...
  upload_user text        not null,                      -- 봉사자 닉네임
  status      text        not null default 'pending'
                check (status in ('pending', 'named', 'sent')),
  created_at  timestamptz not null default now()
);

-- [photos] 사진 데이터
create table photos (
  photo_id     text        primary key,                  -- P0001, P0002 ...
  batch_id     text        not null
                 references batches(batch_id) on delete cascade,
  dog_id       text                                      -- nullable → 이름 지정 전
                 references dogs(dog_id) on delete set null,
  file_name    text        not null,                     -- 원본 파일명  IMG_4829.jpg
  saved_name   text,                                     -- 변환 후 파일명  260524_콩이_희진_001.jpg
  upload_user  text        not null,
  storage_path text        not null,
  status       text        not null default 'temp'
                check (status in ('temp', 'needs_name', 'named', 'sent', 'failed')),
  drive_url    text,
  created_at   timestamptz not null default now()
);


-- ============================================================
-- 3. 자동 ID 트리거 함수
--    INSERT 시 photo_id / batch_id / dog_id 가 NULL이면 자동 채움
-- ============================================================

-- dogs: D0001 형식
create or replace function fn_generate_dog_id()
returns trigger language plpgsql as $$
begin
  if new.dog_id is null or new.dog_id = '' then
    new.dog_id := 'D' || lpad(nextval('seq_dogs')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_dogs_id
  before insert on dogs
  for each row execute function fn_generate_dog_id();


-- batches: B0001 형식
create or replace function fn_generate_batch_id()
returns trigger language plpgsql as $$
begin
  if new.batch_id is null or new.batch_id = '' then
    new.batch_id := 'B' || lpad(nextval('seq_batches')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_batches_id
  before insert on batches
  for each row execute function fn_generate_batch_id();


-- photos: P0001 형식
create or replace function fn_generate_photo_id()
returns trigger language plpgsql as $$
begin
  if new.photo_id is null or new.photo_id = '' then
    new.photo_id := 'P' || lpad(nextval('seq_photos')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_photos_id
  before insert on photos
  for each row execute function fn_generate_photo_id();


-- ============================================================
-- 4. Row Level Security
-- ============================================================
alter table dogs    enable row level security;
alter table batches enable row level security;
alter table photos  enable row level security;

-- 봉사자 앱 특성상 읽기는 전체 공개, 쓰기는 anon 허용
create policy "public read dogs"    on dogs    for select using (true);
create policy "public read batches" on batches for select using (true);
create policy "public read photos"  on photos  for select using (true);

create policy "anon insert dogs"    on dogs    for insert with check (true);
create policy "anon insert batches" on batches for insert with check (true);
create policy "anon insert photos"  on photos  for insert with check (true);

create policy "anon update dogs"    on dogs    for update using (true);
create policy "anon update batches" on batches for update using (true);
create policy "anon update photos"  on photos  for update using (true);


-- ============================================================
-- 5. 동작 확인용 샘플 INSERT (선택 실행)
-- ============================================================
-- insert into dogs (dog_name) values ('콩이'), ('두부'), ('보리');
-- insert into batches (upload_user) values ('희진');
-- insert into photos (batch_id, file_name, upload_user, storage_path)
--   values ('B0001', 'IMG_4829.jpg', '희진', 'photos/temp/IMG_4829.jpg');
--
-- select * from dogs;    -- D0001, D0002, D0003
-- select * from batches; -- B0001
-- select * from photos;  -- P0001


-- ============================================================
-- 주의: Supabase Storage 버킷은 대시보드에서 직접 생성
--   Storage → New bucket → Name: dangchive, Public: ON
-- ============================================================
