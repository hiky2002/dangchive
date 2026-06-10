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
function getPhotoUrl(storagePath: string, width = 600) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/dangchive/${storagePath}?width=${width}&quality=75`;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return "방금";
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
  const [selected, setSelected] = useState<BatchGroup | null>(null);

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

  function handleDogApproved(dog: Dog) {
    setDogs((prev) =>
      prev.some((d) => d.dog_id === dog.dog_id)
        ? prev
        : [...prev, dog].sort((a, b) => a.dog_name.localeCompare(b.dog_name, "ko"))
    );
  }

  function handleBatchDone(batchId: string) {
    setBatches((prev) => prev.filter((b) => b.batch_id !== batchId));
    setSelected(null);
  }

  if (loading) return <Spinner />;

  return (
    <main className="max-w-md mx-auto pb-8">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-5 sticky top-0 bg-[#F5F5F5]/95 backdrop-blur-sm z-10 border-b border-gray-100">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">←</Link>
        <h1 className="text-base font-bold text-gray-900">이름 확인 필요</h1>
        {batches.length > 0 && (
          <span className="ml-auto text-xs font-medium bg-[#F0F0F0] text-[#191F28] px-2 py-0.5 rounded-full">
            {batches.length}건
          </span>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-3 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
      )}

      <FailedPhotoBanner />

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
function BatchCard({ batch, onClick }: { batch: BatchGroup; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md active:scale-[0.98] transition"
    >
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
          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🖼</div>
        )}
      </div>
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
      <span className="text-gray-300 text-xl shrink-0">›</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// BatchDetailModal — 그리드 기반 다중 선택 방식
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
  const [assignments,   setAssignments]   = useState<Record<string, Dog[]>>({});
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [sending,       setSending]       = useState(false);
  const [sendError,     setSendError]     = useState<string | null>(null);
  const [driveProgress, setDriveProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewPhoto,  setPreviewPhoto]  = useState<Photo | null>(null);

  const photos        = batch.photos;
  const assignedCount = Object.keys(assignments).length;
  const allSelected   = photos.length > 0 && photos.every((p) => selectedIds.has(p.photo_id));

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(photos.map((p) => p.photo_id)));
  }

  // 드로어에서 확정 → 선택된 모든 사진에 일괄 적용
  function handleDrawerAssign(dogIds: string[], dogsArr: Dog[]) {
    if (dogsArr.length === 0) return;
    setAssignments((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => { next[id] = dogsArr; });
      return next;
    });
    setSelectedIds(new Set()); // 지정 후 선택 해제
    setDrawerOpen(false);
  }

  // 확정 + 드라이브 전송
  async function handleConfirm() {
    if (assignedCount === 0 || sending) return;
    setSending(true);
    setSendError(null);

    const assignedPhotos = photos.filter((p) => assignments[p.photo_id]);

    try {
      // 1. 사진별 이름 patch (병렬)
      const patchResults = await Promise.all(
        assignedPhotos.map((photo) =>
          fetch("/api/upload", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
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

      // 2. 드라이브 전송 — 1장씩, 병렬 3개, 진행률 실시간
      const total = assignedPhotos.length;
      setDriveProgress({ done: 0, total });
      const CONCURRENCY = 3;
      let done = 0; let failCount = 0; let queueIdx = 0;

      type DriveResult = { photo_id: string; error?: string };
      const worker = async () => {
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
          } catch { failCount++; }
          done++;
          setDriveProgress({ done, total });
        }
      };
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
      <div className="fixed inset-0 z-40 flex flex-col bg-[#F5F5F5]">

        {/* ── 헤더 ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#F5F5F5]/95 backdrop-blur-sm border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            >
              ←
            </button>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{batch.upload_user}</p>
              <p className="text-xs text-gray-400">{batch.photo_count}장 · {relativeTime(batch.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-[#8B95A1] font-medium"
              >
                선택 해제
              </button>
            )}
            <button
              onClick={toggleSelectAll}
              className="text-xs text-[#3182F6] font-semibold"
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </button>
          </div>
        </div>

        {/* ── 진행 현황 표시줄 ──────────────────────── */}
        {(assignedCount > 0 || selectedIds.size > 0) && (
          <div className="px-4 py-2 flex items-center gap-2 shrink-0">
            {assignedCount > 0 && (
              <span className="text-xs text-[#3182F6] font-medium bg-[#EBF3FF] px-2 py-0.5 rounded-full">
                ✅ {assignedCount}장 이름 지정됨
              </span>
            )}
            {selectedIds.size > 0 && (
              <span className="text-xs text-[#8B95A1]">
                {selectedIds.size}장 선택 중
              </span>
            )}
          </div>
        )}

        {/* ── 사진 그리드 ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-px bg-gray-200">
            {photos.map((photo) => (
              <ReviewPhotoCell
                key={photo.photo_id}
                photo={photo}
                assignment={assignments[photo.photo_id]}
                selected={selectedIds.has(photo.photo_id)}
                onToggle={() => toggle(photo.photo_id)}
                onLongPress={() => setPreviewPhoto(photo)}
              />
            ))}
          </div>
        </div>

        {/* ── 하단 액션 바 ──────────────────────────── */}
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-4 pb-8">

          {sendError && (
            <p className="text-xs text-red-500 mb-3 text-center">{sendError}</p>
          )}

          {/* 드라이브 전송 진행 바 */}
          {driveProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#3182F6] font-medium">🚀 드라이브 전송 중...</span>
                <span className="text-[#8B95A1]">{driveProgress.done} / {driveProgress.total}장</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3182F6] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(driveProgress.done / driveProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 이름 지정하기 버튼 (사진 선택 시) */}
          {selectedIds.size > 0 && !sending && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full bg-white border-2 border-[#3182F6] text-[#3182F6] font-semibold
                         py-3.5 rounded-2xl text-sm active:scale-95 transition mb-2"
            >
              🐾 이름 지정하기
            </button>
          )}

          {/* 확정 + 드라이브 전송 버튼 */}
          {assignedCount > 0 && (
            <button
              onClick={handleConfirm}
              disabled={sending}
              className="w-full bg-[#3182F6] text-white font-semibold py-3.5 rounded-2xl text-sm
                         disabled:opacity-50 active:scale-95 transition"
            >
              {sending
                ? "드라이브에 전송 중..."
                : `✅ ${assignedCount}장 확정 + 드라이브 전송`}
            </button>
          )}

          {/* 아무것도 선택/지정 안 됐을 때 안내 */}
          {selectedIds.size === 0 && assignedCount === 0 && !sending && (
            <p className="text-xs text-center text-[#C2C8D0] py-1">
              사진을 탭해서 선택하세요
            </p>
          )}

        </div>
      </div>

      {/* 이름 지정 드로어 */}
      <DogDrawer
        open={drawerOpen}
        dogs={dogs}
        subtitle={`${selectedIds.size}장에 적용됩니다`}
        busy={false}
        onClose={() => setDrawerOpen(false)}
        onAssign={handleDrawerAssign}
        onDogApproved={onDogApproved}
        onSkip={() => setDrawerOpen(false)}
      />

      {/* 사진 크게 보기 */}
      {previewPhoto && (
        <ReviewPhotoPreview
          photo={previewPhoto}
          assignment={assignments[previewPhoto.photo_id]}
          onClose={() => setPreviewPhoto(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// ReviewPhotoCell
// ─────────────────────────────────────────────────────────────
function ReviewPhotoCell({
  photo,
  assignment,
  selected,
  onToggle,
  onLongPress,
}: {
  photo: Photo;
  assignment: Dog[] | undefined;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  function startPress() {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress();
    }, 500);
  }
  function endPress() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }
  function handleClick() {
    if (!didLongPress.current) onToggle();
  }

  const hasAssignment = assignment && assignment.length > 0;

  return (
    <div
      className={`relative aspect-square bg-gray-100 overflow-hidden cursor-pointer select-none
        ${selected ? "ring-[3px] ring-inset ring-[#3182F6]" : ""}`}
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getPhotoUrl(photo.storage_path)}
        alt={photo.file_name}
        loading="lazy"
        className="w-full h-full object-cover"
      />

      {/* 선택 오버레이 + 체크 */}
      {selected && (
        <div className="absolute inset-0 bg-[#3182F6]/20">
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#3182F6] shadow
                          flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor"
                 strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      {/* 이름 지정됨 — 하단 이름 배지 */}
      {hasAssignment && !selected && (
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1
                        bg-gradient-to-t from-black/70 to-transparent">
          <span className="text-[9px] font-medium text-white truncate block">
            🐾 {assignment!.map((d) => d.dog_name).join(", ")}
          </span>
        </div>
      )}

      {/* 미지정 — 주황색 점 */}
      {!hasAssignment && !selected && (
        <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full
                        bg-amber-400 border border-white/60 shadow" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ReviewPhotoPreview — 꾹 누르면 크게 보기
// ─────────────────────────────────────────────────────────────
function ReviewPhotoPreview({
  photo,
  assignment,
  onClose,
}: {
  photo: Photo;
  assignment: Dog[] | undefined;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] bg-black flex flex-col"
      onClick={onClose}
    >
      <div className="flex justify-between items-center px-4 pt-4 pb-2 shrink-0">
        <p className="text-white/60 text-xs truncate max-w-[70%]">{photo.file_name}</p>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white text-lg"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPhotoUrl(photo.storage_path)}
          alt={photo.file_name}
          className="max-w-full max-h-full object-contain rounded-xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="shrink-0 px-4 pt-2 pb-8 flex items-center gap-2">
        {assignment && assignment.length > 0 ? (
          <span className="text-sm font-medium text-white bg-white/15 px-3 py-1.5 rounded-full">
            🐾 {assignment.map((d) => d.dog_name).join(", ")}
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500 text-white">
            이름 미지정
          </span>
        )}
      </div>
    </div>
  );
}
