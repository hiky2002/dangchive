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

  // 승인된 아이를 dogs 목록에 추가
  function handleDogApproved(dog: Dog) {
    setDogs((prev) =>
      prev.some((d) => d.dog_id === dog.dog_id)
        ? prev
        : [...prev, dog].sort((a, b) => a.dog_name.localeCompare(b.dog_name, "ko"))
    );
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
      <div className="flex items-center gap-3 px-4 py-5 sticky top-0 bg-[#F5F5F5]/95 backdrop-blur-sm z-10 border-b border-gray-100">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">
          ←
        </Link>
        <h1 className="text-base font-bold text-gray-900">이름 확인 필요</h1>
        {batches.length > 0 && (
          <span className="ml-auto text-xs font-medium bg-[#F0F0F0] text-[#191F28] px-2 py-0.5 rounded-full">
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
          onDogApproved={handleDogApproved}
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
// BatchDetailModal (풀스크린 오버레이) — 사진별 개별 이름 지정
// ─────────────────────────────────────────────────────────────
function BatchDetailModal({
  batch,
  dogs,
  onClose,
  onDone,
  onDogApproved,
}: {
  batch: BatchGroup;
  dogs: Dog[];
  onClose: () => void;
  onDone: () => void;
  onDogApproved: (dog: Dog) => void;
}) {
  // 사진별 지정된 아이: { photo_id → Dog[] }
  const [assignments,   setAssignments]   = useState<Record<string, Dog[]>>({});
  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [sending,       setSending]       = useState(false);
  const [sendError,     setSendError]     = useState<string | null>(null);
  const [driveProgress, setDriveProgress] = useState<{ done: number; total: number } | null>(null);

  const currentPhoto      = batch.photos[currentIdx];
  const currentAssignment = currentPhoto ? (assignments[currentPhoto.photo_id] ?? []) : [];
  const assignedCount     = Object.keys(assignments).length;

  // 드로어 확정 → 현재 사진에만 적용
  function handleDrawerAssign(dogIds: string[], dogsArr: Dog[]) {
    if (!currentPhoto || dogsArr.length === 0) return;
    setAssignments((prev) => ({ ...prev, [currentPhoto.photo_id]: dogsArr }));
    setDrawerOpen(false);
    // 다음 미지정 사진으로 자동 이동
    const nextIdx = batch.photos.findIndex(
      (p, i) => i > currentIdx && !assignments[p.photo_id]
    );
    if (nextIdx !== -1) setCurrentIdx(nextIdx);
  }

  // 확정 + 드라이브 전송 — 지정된 사진만
  async function handleConfirm() {
    if (assignedCount === 0 || sending) return;
    setSending(true);
    setSendError(null);

    const assignedPhotos = batch.photos.filter((p) => assignments[p.photo_id]);

    try {
      // 1. 사진별 이름 patch (병렬)
      const patchResults = await Promise.all(
        assignedPhotos.map((photo) =>
          fetch("/api/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photoId: photo.photo_id,
              dogIds:  assignments[photo.photo_id].map((d) => d.dog_id),
            }),
          }).then((r) => ({ photoId: photo.photo_id, ok: r.ok }))
        )
      );
      const failedPatches = patchResults.filter((r) => !r.ok);
      if (failedPatches.length > 0) {
        throw new Error(`이름 지정 저장 실패 (${failedPatches.length}장). 다시 시도해 주세요.`);
      }

      // 2. 드라이브 전송 — 1장씩 병렬 3개씩, 진행률 실시간 갱신
      const total = assignedPhotos.length;
      setDriveProgress({ done: 0, total });

      const CONCURRENCY = 3;
      let done = 0;
      let failCount = 0;
      let queueIdx = 0;

      type DriveResult = { photo_id: string; error?: string };

      async function worker() {
        while (true) {
          const myIdx = queueIdx++;
          if (myIdx >= assignedPhotos.length) break;
          const photo = assignedPhotos[myIdx];
          try {
            const res  = await fetch("/api/drive/send", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ photo_ids: [photo.photo_id] }),
            });
            const data   = await res.json().catch(() => ({ results: [] }));
            const result = ((data.results ?? []) as DriveResult[])[0];
            if (!result || result.error) failCount++;
          } catch {
            failCount++;
          }
          done++;
          setDriveProgress({ done, total });
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      setDriveProgress(null);
      if (failCount > 0) {
        setSendError(`${failCount}장 드라이브 전송에 실패했습니다. 나머지는 완료됐어요.`);
      }
      onDone();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.");
      setDriveProgress(null);
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
              {batch.photo_count}장 · {relativeTime(batch.created_at)}
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
        <div className="w-full h-64 shrink-0">
          <PhotoSwiper
            photos={batch.photos}
            currentIdx={currentIdx}
            onIndexChange={setCurrentIdx}
            assignments={assignments}
          />
        </div>

        {/* 하단 액션 */}
        <div className="shrink-0 px-4 pb-10 pt-4 bg-gradient-to-t from-black via-black/80 to-transparent">

          {sendError && (
            <p className="text-xs text-red-400 mb-3 text-center">{sendError}</p>
          )}

          {/* 진행 상황 */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">
              {assignedCount > 0
                ? `${assignedCount} / ${batch.photo_count}장 지정됨`
                : "사진을 넘기며 각 사진에 이름을 지정하세요"}
            </p>
            {currentAssignment.length > 0 && (
              <button
                onClick={() => {
                  setAssignments((prev) => {
                    const next = { ...prev };
                    delete next[currentPhoto.photo_id];
                    return next;
                  });
                }}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                지정 취소
              </button>
            )}
          </div>

          {/* 현재 사진 지정 상태 */}
          {currentAssignment.length > 0 ? (
            <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-white/10 rounded-2xl">
              <span className="text-xl">🐾</span>
              <span className="text-white font-semibold text-sm">
                {currentAssignment.map((d) => d.dog_name).join(", ")}
              </span>
              <button
                onClick={() => setDrawerOpen(true)}
                className="ml-auto text-xs text-[#3182F6] font-medium"
              >
                변경
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full bg-white text-gray-900 font-semibold py-3.5 rounded-2xl mb-3
                         active:scale-95 transition"
            >
              어떤 아이예요? 이름 지정하기
            </button>
          )}

          {/* 드라이브 전송 진행률 바 */}
          {driveProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>드라이브 전송 중...</span>
                <span>{driveProgress.done} / {driveProgress.total}장</span>
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3182F6] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(driveProgress.done / driveProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 확정 + 드라이브 전송 */}
          {assignedCount > 0 && (
            <button
              onClick={handleConfirm}
              disabled={sending}
              className="w-full bg-[#3182F6] text-white font-semibold py-3.5 rounded-2xl
                         disabled:opacity-50 active:scale-95 transition"
            >
              {sending
                ? `드라이브에 전송 중...`
                : `${assignedCount}장 확정 + 드라이브 전송`}
            </button>
          )}
        </div>

      </div>

      <DogDrawer
        open={drawerOpen}
        dogs={dogs}
        subtitle={`현재 사진 1장에 적용됩니다`}
        busy={false}
        onClose={() => setDrawerOpen(false)}
        onAssign={handleDrawerAssign}
        onDogApproved={onDogApproved}
        onSkip={() => setDrawerOpen(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PhotoSwiper — 사진별 지정 상태 표시 포함
// ─────────────────────────────────────────────────────────────
function PhotoSwiper({
  photos,
  currentIdx,
  onIndexChange,
  assignments,
}: {
  photos: Photo[];
  currentIdx: number;
  onIndexChange: (idx: number) => void;
  assignments: Record<string, Dog[]>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth > 0) onIndexChange(Math.round(scrollLeft / clientWidth));
  }

  return (
    <div className="relative w-full h-full">

      {/* 슬라이드 트랙 */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {photos.map((photo) => {
          const assigned = assignments[photo.photo_id] ?? [];
          return (
            <div
              key={photo.photo_id}
              className="flex-shrink-0 w-full h-full snap-start flex items-center justify-center bg-black relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoUrl(photo.storage_path)}
                alt={photo.file_name}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
              {/* 이름 지정 여부 배지 */}
              {assigned.length > 0 && (
                <div className="absolute top-2 left-2 bg-[#3182F6] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  🐾 {assigned.map((d) => d.dog_name).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 카운터 */}
      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full">
        {currentIdx + 1} / {photos.length}
      </div>

      {/* 하단 파일명 */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
        <span className="text-[11px] text-white/60 px-2 py-0.5 rounded bg-black/30 truncate max-w-[60%]">
          {photos[currentIdx]?.file_name}
        </span>
      </div>

      {/* 점 인디케이터 (10장 이하) */}
      {photos.length > 1 && photos.length <= 10 && (
        <div className="absolute bottom-8 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
          {photos.map((p, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                assignments[p.photo_id]
                  ? "bg-[#3182F6]"
                  : i === currentIdx
                    ? "bg-white"
                    : "bg-white/30"
              }`}
            />
          ))}
        </div>
      )}

    </div>
  );
}
