"use client";

import { Suspense, useState, useEffect } from "react";
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const qs = (status: string) => {
          const p = new URLSearchParams({ status });
          if (batchId) p.set("batch_id", batchId);
          return p.toString();
        };
        const [r1, r2, r3] = await Promise.all([
          fetch(`/api/upload?${qs("temp")}`),
          fetch(`/api/upload?${qs("named")}`),
          fetch("/api/dogs"),
        ]);
        if (!r1.ok || !r2.ok) {
          const errBody = await (!r1.ok ? r1 : r2).json().catch(() => ({}));
          throw new Error(errBody.error ?? "사진 조회 API 오류");
        }
        const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
        setPhotos([...(d1.photos ?? []), ...(d2.photos ?? [])]);
        setDogs(d3.dogs ?? []);
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
      await Promise.all(
        Array.from(selectedIds).map((photoId) =>
          fetch("/api/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId, dogIds }),
          })
        )
      );
      setPhotos((prev) =>
        prev.map((p) =>
          selectedIds.has(p.photo_id)
            ? { ...p, dog_id: dogIds[0], dog: dogsArr[0], dogs: dogsArr, status: "named" }
            : p
        )
      );
      clearSelect();
      setDrawerOpen(false);
    } catch {
      setError("이름 지정에 실패했습니다.");
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
    for (const photo of targets) {
      try {
        const res = await fetch("/api/drive/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId: photo.photo_id }),
        });
        if (!res.ok) throw new Error();
        setPhotos((prev) =>
          prev.map((p) => (p.photo_id === photo.photo_id ? { ...p, status: "sent" } : p))
        );
      } catch {
        fail++;
      }
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
          className="inline-block bg-orange-500 text-white font-semibold px-6 py-3 rounded-2xl text-sm active:scale-95 transition"
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
      <div className="flex items-center justify-between px-4 py-4 sticky top-0 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100 z-10">
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
            className="text-sm text-orange-500 font-medium"
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
        <div className="mx-4 mt-3 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700">
            {selectedIds.size}장 선택됨
          </span>
          <button onClick={clearSelect} className="text-xs text-blue-400 hover:text-blue-600">
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
            />
          ))}
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

      <DogDrawer
        open={drawerOpen}
        dogs={dogs}
        subtitle={`${selectedIds.size}장에 적용됩니다`}
        busy={actionLoading === "naming"}
        onClose={() => setDrawerOpen(false)}
        onAssign={handleAssignDogs}
        onDogApproved={handleDogApproved}
      />

    </main>
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
}: {
  photo: Photo;
  selected: boolean;
  onToggle: () => void;
}) {
  const badge = STATUS_BADGE[photo.status];
  const dogLabel =
    (photo.dogs?.length ?? 0) > 0
      ? photo.dogs!.map((d) => d.dog_name).join(", ")
      : photo.dog?.dog_name ?? null;

  return (
    <div
      className={`relative aspect-square bg-gray-100 overflow-hidden cursor-pointer select-none
        ${selected ? "ring-[3px] ring-inset ring-blue-500" : ""}`}
      onClick={onToggle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getPhotoUrl(photo.storage_path)}
        alt={photo.file_name}
        loading="lazy"
        className="w-full h-full object-cover"
      />

      {selected && (
        <div className="absolute inset-0 bg-blue-500/20">
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 shadow flex items-center justify-center">
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
            className="w-full bg-blue-500 text-white font-semibold py-3.5 rounded-2xl text-sm
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
            className="flex-1 bg-orange-500 text-white font-semibold py-3.5 rounded-2xl text-sm
                       disabled:opacity-40 active:scale-95 transition"
          >
            이름 지정하기
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
