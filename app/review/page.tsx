"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Batch, Dog, Photo } from "@/types";
import { DogDrawer }         from "@/components/DogDrawer";
import { FailedPhotoBanner } from "@/components/FailedPhotoBanner";

// ─── 타입 ────────────────────────────────────────────────────
type BatchGroup = Batch & {
  photos: Photo[];
  photo_count: number;
  thumbnail_path: string | null;
};

// ─── 헬퍼 ────────────────────────────────────────────────────
function getPhotoUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dangchive/${storagePath}`;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  return `${d}일 전`;
}

// ─── 페이지 진입점 ────────────────────────────────────────────
export default function ReviewPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReviewInner />
    </Suspense>
  );
}

function Spinner({ text = "불러오는 중..." }: { text?: string }) {
  return (
    <main className="max-w-md mx-auto px-4 py-10 text-center text-gray-400">
      {text}
    </main>
  );
}

// ─── 메인 로직 ───────────────────────────────────────────────
function ReviewInner() {
  const [batches,  setBatches]  = useState<BatchGroup[]>([]);
  const [dogs,     setDogs]     = useState<Dog[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<BatchGroup | null>(null); // 상세 뷰

  useEffect(() => {
    async function load() {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/batches?status=needs_name"),
          fetch("/api/dogs"),
        ]);
        const [bData, dData] = await Promise.all([bRes.json(), dRes.json()]);
        setBatches(bData.batches ?? []);
        setDogs(dData.dogs ?? []);
      } catch {
        setError("데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 새 아이 추가 (DogDrawer → API → dogs 상태 갱신)
  async function handleAddDog(name: string): Promise<Dog | null> {
    const res = await fetch("/api/dogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dog_name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    setDogs((prev) =>
      [...prev, data.dog].sort((a, b) => a.dog_name.localeCompare(b.dog_name, "ko"))
    );
    return data.dog;
  }

  // 배치 확정 완료 → 목록에서 제거
  function handleBatchDone(batchId: string) {
    setBatches((prev) => prev.filter((b) => b.batch_id !== batchId));
    setSelected(null);
  }

  if (loading) return <Spinner />;

  return (
    <main className="max-w-md mx-auto pb-8">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-5 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 border-b border-gray-100">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">
          ←
        </Link>
        <h1 className="text-base font-bold text-gray-900">이름 확인 필요</h1>
        {batches.length > 0 && (
          <span className="ml-auto text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {batches.length}건
          </span>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-3 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      {/* 드라이브 전송 실패 배너 */}
      <FailedPhotoBanner />

      {/* 빈 상태 */}
      {batches.length === 0 ? (
        <div className="text-center mt-24 px-4">
          <p className="text-5xl mb-4">🎉</p>
          <p className="font-semibold text-gray-700">이름 확인이 필요한 사진이 없어요</p>
          <p className="text-sm text-gray-400 mt-1">모든 사진이 정리되었습니다!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 mt-4">
          {batches.map((batch) => (
            <BatchCard
              key={batch.batch_id}
              batch={batch}
              onClick={() => setSelected(batch)}
            />
          ))}
        </div>
      )}

      {/* 배치 상세 모달 */}
      {selected && (
        <BatchDetailModal
          batch={selected}
          dogs={dogs}
          onClose={() => setSelected(null)}
          onDone={() => handleBatchDone(selected.batch_id)}
          onAddDog={handleAddDog}
        />
      )}

    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// BatchCard
// ─────────────────────────────────────────────────────────────
function BatchCard({
  batch,
  onClick,
}: {
  batch: BatchGroup;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md active:scale-[0.98] transition"
    >
      {/* 대표 썸네일 */}
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        {batch.thumbnail_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPhotoUrl(batch.thumbnail_path)}
            alt="대표 사진"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">
            🖼
          </div>
        )}
      </div>

      {/* 배치 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900 truncate">{batch.upload_user}</span>
          <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
            {batch.batch_id}
          </span>
        </div>
        <p className="text-sm text-gray-500">{batch.photo_count}장</p>
        <p className="text-xs text-gray-400 mt-0.5">{relativeTime(batch.created_at)}</p>
      </div>

      {/* 화살표 */}
      <span className="text-gray-300 text-xl shrink-0">›</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// BatchDetailModal (풀스크린 오버레이)
// ─────────────────────────────────────────────────────────────
function BatchDetailModal({
  batch,
  dogs,
  onClose,
  onDone,
  onAddDog,
}: {
  batch: BatchGroup;
  dogs: Dog[];
  onClose: () => void;
  onDone: () => void;
  onAddDog: (name: string) => Promise<Dog | null>;
}) {
  const [pickedDog,  setPickedDog]  = useState<Dog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending,    setSending]    = useState(false);
  const [sendError,  setSendError]  = useState<string | null>(null);

  // 드로어 확정 → 미리보기 상태 저장 (API 호출 없음)
  function handleDrawerAssign(dogId: string, dogName: string) {
    const found = dogs.find((d) => d.dog_id === dogId);
    setPickedDog(
      found ?? { dog_id: dogId, dog_name: dogName, drive_folder_id: null, created_at: "" }
    );
    setDrawerOpen(false);
  }

  // 확정 + 드라이브 전송
  async function handleConfirm() {
    if (!pickedDog || sending) return;
    setSending(true);
    setSendError(null);

    try {
      // 1. 모든 사진에 dog_id 일괄 적용
      await Promise.all(
        batch.photos.map((photo) =>
          fetch("/api/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId: photo.photo_id, dogId: pickedDog.dog_id }),
          })
        )
      );

      // 2. 사진별 드라이브 전송 (순차 — 드라이브 API 부하 고려)
      let failCount = 0;
      for (const photo of batch.photos) {
        const res = await fetch("/api/drive/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId: photo.photo_id }),
        });
        if (!res.ok) failCount++;
      }

      if (failCount > 0) {
        setSendError(`${failCount}장 드라이브 전송에 실패했습니다. 나머지는 완료되었어요.`);
        // 일부 실패해도 목록에서 제거 (재시도는 sent 상태 제외 후 별도 처리)
      }
      onDone();
    } catch {
      setSendError("처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setSending(false);
    }
  }

  return (
    <>
      {/* 풀스크린 배경 */}
      <div className="fixed inset-0 z-40 bg-black flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0">
          <div>
            <p className="font-bold text-white">{batch.upload_user}</p>
            <p className="text-xs text-gray-400">
              {batch.photo_count}장 · {relativeTime(batch.created_at)} · {batch.batch_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* 사진 슬라이더 */}
        <div className="flex-1 min-h-0">
          <PhotoSwiper photos={batch.photos} />
        </div>

        {/* 하단 액션 */}
        <div className="shrink-0 px-4 pb-10 pt-4 bg-gradient-to-t from-black via-black/80 to-transparent">

          {sendError && (
            <p className="text-xs text-red-400 mb-3 text-center">{sendError}</p>
          )}

          {/* 선택된 아이 미리보기 */}
          {pickedDog && (
            <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-white/10 rounded-2xl">
              <span className="text-xl">🐾</span>
              <span className="text-white font-semibold">{pickedDog.dog_name}</span>
              <button
                onClick={() => setPickedDog(null)}
                className="ml-auto text-xs text-gray-400 hover:text-white transition"
              >
                변경
              </button>
            </div>
          )}

          {pickedDog ? (
            /* 확정 버튼 */
            <button
              onClick={handleConfirm}
              disabled={sending}
              className="w-full bg-orange-500 text-white font-semibold py-4 rounded-2xl
                         disabled:opacity-50 active:scale-95 transition"
            >
              {sending
                ? "드라이브에 전송 중..."
                : `"${pickedDog.dog_name}"로 확정 + 드라이브 전송`}
            </button>
          ) : (
            /* 이름 지정 버튼 */
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full bg-white text-gray-900 font-semibold py-4 rounded-2xl
                         active:scale-95 transition"
            >
              어떤 아이예요? 이름 지정하기
            </button>
          )}
        </div>

      </div>

      {/* DogDrawer — z-index는 컴포넌트 내부에서 z-[50]/z-[60] 사용 */}
      <DogDrawer
        open={drawerOpen}
        dogs={dogs}
        subtitle={`배치 전체 ${batch.photo_count}장에 적용됩니다`}
        busy={false}
        onClose={() => setDrawerOpen(false)}
        onAssign={handleDrawerAssign}
        onAddDog={onAddDog}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PhotoSwiper (CSS 스크롤 스냅 기반 슬라이더)
// ─────────────────────────────────────────────────────────────
function PhotoSwiper({ photos }: { photos: Photo[] }) {
  const [idx,    setIdx]    = useState(0);
  const scrollRef           = useRef<HTMLDivElement>(null);

  function onScroll() {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth > 0) setIdx(Math.round(scrollLeft / clientWidth));
  }

  return (
    <div className="relative w-full h-full flex flex-col">

      {/* 슬라이드 트랙 */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex flex-1 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {photos.map((photo) => (
          <div
            key={photo.photo_id}
            className="flex-shrink-0 snap-start flex items-center justify-center bg-black"
            style={{ minWidth: "100%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPhotoUrl(photo.storage_path)}
              alt={photo.file_name}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {/* 카운터 */}
      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full">
        {idx + 1} / {photos.length}
      </div>

      {/* 하단 파일명 */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
        <span className="text-[11px] text-white/60 px-2 py-0.5 rounded bg-black/30 truncate max-w-[60%]">
          {photos[idx]?.file_name}
        </span>
      </div>

      {/* 점 인디케이터 (10장 이하일 때만) */}
      {photos.length > 1 && photos.length <= 10 && (
        <div className="absolute bottom-8 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
          {photos.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === idx ? "bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      )}

    </div>
  );
}
