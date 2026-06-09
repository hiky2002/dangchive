"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Dog, Photo } from "@/types";
import { DogDrawer }          from "@/components/DogDrawer";
import { FailedPhotoBanner }  from "@/components/FailedPhotoBanner";

const LS_BATCH_KEY = "dangchive_my_batch_id";

function getPhotoUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dangchive/${storagePath}`;
}

export default function SortPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <SortInner />
    </Suspense>
  );
}

function PageSpinner({ text = "불러오는 중..." }: { text?: string }) {
  return (
    <main className="max-w-md mx-auto px-4 py-10 text-center text-gray-400">
      {text}
    </main>
  );
}

function SortInner() {
  const params  = useSearchParams();
  const batchId = (() => {
    const fromUrl = params.get("batch_id");
    if (fromUrl) {
      // URL에 batch_id가 있으면 localStorage에도 저장 (새로고침 대비)
      if (typeof window !== "undefined") localStorage.setItem(LS_BATCH_KEY, fromUrl);
      return fromUrl;
    }
    return typeof window !== "undefined" ? localStorage.getItem(LS_BATCH_KEY) : null;
  })();

  const [photos,        setPhotos]        = useState<Photo[]>([]);
  const [dogs,          setDogs]          = useState<Dog[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [actionLoading, setActionLoading] =
    useState<"needs_name" | "naming" | "drive" | "delete" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [previewPhoto,  setPreviewPhoto]  = useState<Photo | null>(null);

  // 전송완료 사진 섹션
  const [sentPhotos,       setSentPhotos]       = useState<Photo[]>([]);
  const [sentOpen,         setSentOpen]         = useState(false);
  const [sentSelectedIds,  setSentSelectedIds]  = useState<Set<string>>(new Set());
  const [driveDeleteConfirm, setDriveDeleteConfirm] = useState(false);
  const [driveDeleting,    setDriveDeleting]    = useState(false);
  const [driveDeleteMsg,   setDriveDeleteMsg]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const qs = (status: string) => {
          const p = new URLSearchParams({ status });
          if (batchId) p.set("batch_id", batchId);
          return p.toString();
        };
        const [r1, r2, r3, r4] = await Promise.all([
          fetch(`/api/upload?${qs("temp")}`),
          fetch(`/api/upload?${qs("named")}`),
          fetch("/api/dogs"),
          fetch(`/api/upload?${qs("sent")}`),
        ]);
        if (!r1.ok || !r2.ok) {
          const errBody = await (!r1.ok ? r1 : r2).json().catch(() => ({}));
          throw new Error(errBody.error ?? "사진 조회 API 오류");
        }
        const [d1, d2, d3, d4] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()]);
        setPhotos([...(d1.photos ?? []), ...(d2.photos ?? [])]);
        setDogs(d3.dogs ?? []);
        setSentPhotos(d4.photos ?? []);
      } catch {
        setError("데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [batchId]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const selectAll   = () => setSelectedIds(new Set(photos.map((p) => p.photo_id)));
  const clearSelect = () => setSelectedIds(new Set());

  async function handleNeedsName() {
    if (!selectedIds.size) return;
    setActionLoading("needs_name");
    setError(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((photoId) =>
          fetch("/api/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId, status: "needs_name" }),
          })
        )
      );
      setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.photo_id)));
      clearSelect();
    } catch {
      setError("상태 변경에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  }

  // 멀티 아이 지정
  async function handleAssignDogs(dogIds: string[], dogsArr: Dog[]) {
    setActionLoading("naming");
    setError(null);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((photoId) =>
          fetch("/api/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId, dogIds }),
          }).then(r => ({ photoId, ok: r.ok }))
        )
      );
      const failedCount = results.filter(r => !r.ok).length;
      if (failedCount > 0) throw new Error(`${failedCount}장 이름 지정 저장에 실패했습니다`);
      setPhotos((prev) =>
        prev.map((p) =>
          selectedIds.has(p.photo_id)
            ? { ...p, dog_id: dogIds[0], dog: dogsArr[0], dogs: dogsArr, status: "named" }
            : p
        )
      );
      clearSelect();
      setDrawerOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "이름 지정에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendToDrive() {
    const targets = photos.filter(
      (p) => selectedIds.has(p.photo_id) && p.status === "named"
    );
    if (!targets.length) return;
    setActionLoading("drive");
    setError(null);
    let fail = 0;
    const justSent: typeof photos = [];
    for (const photo of targets) {
      try {
        const res = await fetch("/api/drive/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId: photo.photo_id }),
        });
        if (!res.ok) throw new Error();
        justSent.push({ ...photo, status: "sent" });
        setPhotos((prev) => prev.filter((p) => p.photo_id !== photo.photo_id));
      } catch {
        fail++;
      }
    }
    // 전송 성공한 사진을 sentPhotos에 즉시 추가하고 섹션 자동 펼치기
    if (justSent.length > 0) {
      setSentPhotos((prev) => [...justSent, ...prev]);
      setSentOpen(true);
    }
    if (fail) setError(`${fail}장 전송에 실패했습니다.`);
    clearSelect();
    setActionLoading(null);
  }

  // temp 사진 삭제
  async function handleDelete() {
    const tempIds = Array.from(selectedIds).filter(
      (id) => photos.find((p) => p.photo_id === id)?.status === "temp"
    );
    if (!tempIds.length) return;
    setDeleteConfirm(false);
    setActionLoading("delete");
    setError(null);
    try {
      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_ids: tempIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "삭제 실패");
      }
      setPhotos((prev) => prev.filter((p) => !tempIds.includes(p.photo_id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        tempIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch (e: any) {
      setError(e.message ?? "삭제 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  }

  // 승인 대기 중 "지금은 넘기기" → 선택된 사진을 needs_name으로 저장
  async function handleSkipToNeedsName() {
    if (!selectedIds.size) { setDrawerOpen(false); return; }
    setActionLoading("needs_name");
    setError(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((photoId) =>
          fetch("/api/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId, status: "needs_name" }),
          })
        )
      );
      setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.photo_id)));
      clearSelect();
    } catch {
      setError("상태 변경에 실패했습니다.");
    } finally {
      setActionLoading(null);
      setDrawerOpen(false);
    }
  }

  // 전송완료 사진 Drive 삭제
  async function handleDriveDelete() {
    if (!sentSelectedIds.size) return;
    setDriveDeleteConfirm(false);
    setDriveDeleting(true);
    setDriveDeleteMsg(null);
    try {
      const res  = await fetch("/api/drive/delete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ photo_ids: Array.from(sentSelectedIds) }),
      });
      const data = await res.json();
      setSentPhotos((prev) => prev.filter((p) => !sentSelectedIds.has(p.photo_id)));
      setSentSelectedIds(new Set());
      setDriveDeleteMsg(
        data.fail_count > 0
          ? `${data.success_count}장 삭제 완료 / ${data.fail_count}장 실패`
          : `✅ ${data.success_count}장 드라이브에서 삭제됐어요`
      );
      setTimeout(() => setDriveDeleteMsg(null), 4000);
    } catch {
      setDriveDeleteMsg("삭제 중 오류가 발생했습니다.");
    } finally {
      setDriveDeleting(false);
    }
  }

  function handleDogApproved(dog: Dog) {
    setDogs((prev) =>
      prev.some((d) => d.dog_id === dog.dog_id)
        ? prev
        : [...prev, dog].sort((a, b) => a.dog_name.localeCompare(b.dog_name, "ko"))
    );
  }

  const hasNamedSelected = photos.some(
    (p) => selectedIds.has(p.photo_id) && p.status === "named"
  );
  const hasTempSelected = photos.some(
    (p) => selectedIds.has(p.photo_id) && p.status === "temp"
  );
  const allSelected = photos.length > 0 && selectedIds.size === photos.length;
  const tempSelectedCount = Array.from(selectedIds).filter(
    (id) => photos.find((p) => p.photo_id === id)?.status === "temp"
  ).length;

  // batch_id 없이 접근하면 업로드 안내 표시
  if (!batchId) {
    return (
      <main className="max-w-md mx-auto px-4 py-10 text-center">
        <div className="flex items-center gap-2.5 mb-8">
          <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ←
          </Link>
          <h1 className="text-base font-bold text-gray-900">사진 정리</h1>
        </div>
        <p className="text-5xl mb-4">📭</p>
        <p className="font-semibold text-gray-700 mb-2">업로드한 사진이 없어요</p>
        <p className="text-sm text-gray-400 mb-6">
          먼저 사진을 올리면 여기서 아이 이름을 지정할 수 있어요.
        </p>
        <Link
          href="/upload"
          className="inline-block bg-[#3182F6] text-white font-semibold px-6 py-3 rounded-2xl text-sm active:scale-95 transition"
        >
          📸 사진 올리러 가기
        </Link>
      </main>
    );
  }

  if (loading) return <PageSpinner />;

  return (
    <main className="max-w-md mx-auto pb-56">

      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-4 sticky top-0 bg-[#F5F5F5]/95 backdrop-blur-sm border-b border-gray-100 z-10">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ←
          </Link>
          <h1 className="text-base font-bold text-gray-900">사진 정리</h1>
          {batchId && (
            <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded-full">
              {batchId}
            </span>
          )}
        </div>
        {photos.length > 0 && (
          <button
            onClick={allSelected ? clearSelect : selectAll}
            className="text-sm text-[#8B95A1] font-medium"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-3 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <FailedPhotoBanner />

      {selectedIds.size > 0 && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-white rounded-xl flex items-center justify-between">
          <span className="text-sm font-semibold text-[#191F28]">
            {selectedIds.size}장 선택됨
          </span>
          <button onClick={clearSelect} className="text-xs text-[#8B95A1] hover:text-[#191F28]">
            해제
          </button>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="text-center mt-24 text-gray-400">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-sm">정리할 사진이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-px mt-3 bg-gray-200">
          {photos.map((photo) => (
            <PhotoCell
              key={photo.photo_id}
              photo={photo}
              selected={selectedIds.has(photo.photo_id)}
              onToggle={() => toggle(photo.photo_id)}
              onLongPress={() => setPreviewPhoto(photo)}
            />
          ))}
        </div>
      )}

      {/* 전송완료 사진 섹션 */}
      {sentPhotos.length > 0 && (
        <div className="mx-4 mt-4 mb-2">
          <button
            onClick={() => setSentOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#191F28]">🚀 전송완료</span>
              <span className="text-xs bg-[#F0F0F0] text-[#8B95A1] px-2 py-0.5 rounded-full">
                {sentPhotos.length}장
              </span>
            </div>
            <span className="text-xs text-[#8B95A1]">{sentOpen ? "접기 ▲" : "펼치기 ▼"}</span>
          </button>

          {sentOpen && (
            <div className="mt-2">
              {/* 전체선택 / 해제 */}
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs text-[#8B95A1]">잘못 보낸 사진을 선택해 드라이브에서 삭제하세요</p>
                <button
                  onClick={() =>
                    sentSelectedIds.size === sentPhotos.length
                      ? setSentSelectedIds(new Set())
                      : setSentSelectedIds(new Set(sentPhotos.map((p) => p.photo_id)))
                  }
                  className="text-xs text-[#3182F6] shrink-0 ml-2"
                >
                  {sentSelectedIds.size === sentPhotos.length ? "전체 해제" : "전체 선택"}
                </button>
              </div>

              {/* 사진 그리드 */}
              <div className="grid grid-cols-3 gap-px bg-gray-200 rounded-xl overflow-hidden">
                {sentPhotos.map((photo) => {
                  const selected = sentSelectedIds.has(photo.photo_id);
                  return (
                    <div
                      key={photo.photo_id}
                      onClick={() =>
                        setSentSelectedIds((prev) => {
                          const next = new Set(prev);
                          next.has(photo.photo_id) ? next.delete(photo.photo_id) : next.add(photo.photo_id);
                          return next;
                        })
                      }
                      className={`relative aspect-square bg-gray-100 cursor-pointer
                        ${selected ? "ring-[3px] ring-inset ring-red-500" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getPhotoUrl(photo.storage_path)}
                        alt={photo.file_name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      {/* 전송완료 오버레이 */}
                      {!selected && (
                        <div className="absolute inset-0 bg-black/20 flex items-end p-1">
                          <span className="text-[9px] text-white/80 truncate">{photo.saved_name ?? photo.file_name}</span>
                        </div>
                      )}
                      {selected && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 삭제 결과 메시지 */}
              {driveDeleteMsg && (
                <p className="text-xs text-center mt-2 text-[#8B95A1]">{driveDeleteMsg}</p>
              )}

              {/* 삭제 버튼 */}
              {sentSelectedIds.size > 0 && (
                <button
                  onClick={() => setDriveDeleteConfirm(true)}
                  disabled={driveDeleting}
                  className="mt-3 w-full bg-red-50 text-red-500 border border-red-100 font-semibold py-3 rounded-2xl text-sm disabled:opacity-40 active:scale-95 transition"
                >
                  {driveDeleting
                    ? "드라이브에서 삭제 중..."
                    : `드라이브에서 삭제 (${sentSelectedIds.size}장)`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <BottomBar
        selectedCount={selectedIds.size}
        hasNamedSelected={hasNamedSelected}
        hasTempSelected={hasTempSelected}
        tempSelectedCount={tempSelectedCount}
        actionLoading={actionLoading}
        onNeedsName={handleNeedsName}
        onOpenDrawer={() => setDrawerOpen(true)}
        onSendToDrive={handleSendToDrive}
        onDelete={() => setDeleteConfirm(true)}
      />

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-xl text-center mb-1">🗑️</p>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">
              사진을 삭제할까요?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              이름이 지정되지 않은 사진 {tempSelectedCount}장이 영구 삭제됩니다.<br />
              이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-2xl text-sm active:scale-95 transition"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-2xl text-sm active:scale-95 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drive 삭제 확인 모달 */}
      {driveDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-xl text-center mb-1">🗑️</p>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">
              드라이브에서 삭제할까요?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              선택한 사진 {sentSelectedIds.size}장이 구글 드라이브 휴지통으로 이동됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDriveDeleteConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-2xl text-sm active:scale-95 transition"
              >
                취소
              </button>
              <button
                onClick={handleDriveDelete}
                className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-2xl text-sm active:scale-95 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <DogDrawer
        open={drawerOpen}
        dogs={dogs}
        subtitle={`${selectedIds.size}장에 적용됩니다`}
        busy={actionLoading === "naming"}
        onClose={() => setDrawerOpen(false)}
        onAssign={handleAssignDogs}
        onDogApproved={handleDogApproved}
        onSkip={handleSkipToNeedsName}
      />

      {/* 사진 크게 보기 모달 */}
      {previewPhoto && (
        <PhotoPreviewModal
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
        />
      )}

    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// PhotoPreviewModal
// ─────────────────────────────────────────────────────────────
function PhotoPreviewModal({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const dogLabel =
    (photo.dogs?.length ?? 0) > 0
      ? photo.dogs!.map((d) => d.dog_name).join(", ")
      : photo.dog?.dog_name ?? null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black flex flex-col"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2 shrink-0">
        <p className="text-white/60 text-xs truncate max-w-[70%]">{photo.file_name}</p>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white text-lg"
        >
          ✕
        </button>
      </div>

      {/* 사진 */}
      <div className="flex-1 flex items-center justify-center px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPhotoUrl(photo.storage_path)}
          alt={photo.file_name}
          className="max-w-full max-h-full object-contain rounded-xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* 하단 정보 */}
      <div className="shrink-0 px-4 pt-2 pb-8 flex items-center gap-2">
        {dogLabel && (
          <span className="text-sm font-medium text-white bg-white/15 px-3 py-1.5 rounded-full">
            🐾 {dogLabel}
          </span>
        )}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          photo.status === "named"      ? "bg-green-500 text-white" :
          photo.status === "sent"       ? "bg-blue-500 text-white"  :
          photo.status === "needs_name" ? "bg-amber-500 text-white" :
          "bg-gray-500 text-white"
        }`}>
          {photo.status === "named"      ? "이름지정" :
           photo.status === "sent"       ? "전송완료" :
           photo.status === "needs_name" ? "확인필요" :
           photo.status === "temp"       ? "미지정"   : photo.status}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PhotoCell
// ─────────────────────────────────────────────────────────────
type StatusBadge = { label: string; cls: string };
const STATUS_BADGE: Partial<Record<string, StatusBadge>> = {
  named:      { label: "이름지정", cls: "bg-green-500" },
  sent:       { label: "전송완료", cls: "bg-blue-500"  },
  needs_name: { label: "확인필요", cls: "bg-amber-500" },
  failed:     { label: "실패",     cls: "bg-red-500"   },
};

function PhotoCell({
  photo,
  selected,
  onToggle,
  onLongPress,
}: {
  photo: Photo;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const badge = STATUS_BADGE[photo.status];
  const dogLabel =
    (photo.dogs?.length ?? 0) > 0
      ? photo.dogs!.map((d) => d.dog_name).join(", ")
      : photo.dog?.dog_name ?? null;

  // 꾹 누르기 — 500ms 이상 누르면 미리보기
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

      {selected && (
        <div className="absolute inset-0 bg-[#3182F6]/20">
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#3182F6] shadow flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-1 py-1 gap-0.5">
        {badge && (
          <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {dogLabel && (
          <span className="text-[9px] font-medium text-white px-1.5 py-0.5 rounded bg-black/50 truncate max-w-[5rem]">
            {dogLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BottomBar
// ─────────────────────────────────────────────────────────────
function BottomBar({
  selectedCount,
  hasNamedSelected,
  hasTempSelected,
  tempSelectedCount,
  actionLoading,
  onNeedsName,
  onOpenDrawer,
  onSendToDrive,
  onDelete,
}: {
  selectedCount: number;
  hasNamedSelected: boolean;
  hasTempSelected: boolean;
  tempSelectedCount: number;
  actionLoading: string | null;
  onNeedsName: () => void;
  onOpenDrawer: () => void;
  onSendToDrive: () => void;
  onDelete: () => void;
}) {
  const busy     = actionLoading !== null;
  const inactive = selectedCount === 0 || busy;

  return (
    <div className="fixed bottom-16 inset-x-0 z-[35] bg-white border-t border-gray-100 px-4 py-4">
      <div className="max-w-md mx-auto flex flex-col gap-2">

        {hasNamedSelected && (
          <button
            onClick={onSendToDrive}
            disabled={busy}
            className="w-full bg-[#3182F6] text-white font-semibold py-3.5 rounded-2xl text-sm
                       disabled:opacity-40 active:scale-95 transition"
          >
            {actionLoading === "drive"
              ? "전송 중..."
              : `🚀 구글 드라이브로 보내기 (${selectedCount}장)`}
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={onNeedsName}
            disabled={inactive}
            className="flex-1 bg-gray-100 text-gray-700 font-medium py-3.5 rounded-2xl text-sm
                       disabled:opacity-40 active:scale-95 transition"
          >
            {actionLoading === "needs_name" ? "처리 중..." : "이 아이 누구예요?"}
          </button>
          <button
            onClick={onOpenDrawer}
            disabled={inactive}
            className="flex-1 bg-white border-2 border-[#3182F6] text-[#3182F6] font-semibold py-3.5 rounded-2xl text-sm
                       disabled:opacity-40 active:scale-95 transition"
          >
            🐾 이름 지정하기
          </button>
        </div>

        {hasTempSelected && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="w-full bg-red-50 text-red-500 font-medium py-3 rounded-2xl text-sm border border-red-100
                       disabled:opacity-40 active:scale-95 transition"
          >
            {actionLoading === "delete"
              ? "삭제 중..."
              : `🗑️ 잘못 올린 사진 삭제 (${tempSelectedCount}장)`}
          </button>
        )}

      </div>
    </div>
  );
}
