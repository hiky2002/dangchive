"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Dog, Photo } from "@/types";
import { DogDrawer }          from "@/components/DogDrawer";
import { FailedPhotoBanner }  from "@/components/FailedPhotoBanner";

// ─── 상수 ────────────────────────────────────────────────────
const SESSION_BATCH_KEY = "dangchive_batch_id";

function getPhotoUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dangchive/${storagePath}`;
}

// ─── 페이지 진입점 (Suspense 경계 필요) ──────────────────────
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

// ─── 실제 클라이언트 로직 ────────────────────────────────────
function SortInner() {
  const params  = useSearchParams();
  const batchId =
    params.get("batch_id") ??
    (typeof window !== "undefined" ? sessionStorage.getItem(SESSION_BATCH_KEY) : null);

  const [photos,       setPhotos]       = useState<Photo[]>([]);
  const [dogs,         setDogs]         = useState<Dog[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [actionLoading, setActionLoading] =
    useState<"needs_name" | "naming" | "drive" | null>(null);

  // ── 초기 데이터 로드
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

  // ── 선택 토글
  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const selectAll   = () => setSelectedIds(new Set(photos.map((p) => p.photo_id)));
  const clearSelect = () => setSelectedIds(new Set());

  // ── "이 아이 누구예요?" → needs_name
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

  // ── 이름 지정 (Drawer 확정 콜백)
  async function handleAssignDog(dogId: string, dogName: string) {
    setActionLoading("naming");
    setError(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((photoId) =>
          fetch("/api/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId, dogId }),
          })
        )
      );
      const dogObj: Dog = {
        dog_id: dogId,
        dog_name: dogName,
        drive_folder_id: null,
        created_at: "",
      };
      setPhotos((prev) =>
        prev.map((p) =>
          selectedIds.has(p.photo_id)
            ? { ...p, dog_id: dogId, dog: dogObj, status: "named" }
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

  // ── 구글 드라이브 전송
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

  // ── 새 아이 추가 (Drawer에서 호출)
  async function handleAddDog(name: string): Promise<Dog | null> {
    const res = await fetch("/api/dogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dog_name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    setDogs((prev) =>
      [...prev, data.dog].sort((a, b) =>
        a.dog_name.localeCompare(b.dog_name, "ko")
      )
    );
    return data.dog;
  }

  // ── 파생 상태
  const hasNamedSelected = photos.some(
    (p) => selectedIds.has(p.photo_id) && p.status === "named"
  );
  const allSelected = photos.length > 0 && selectedIds.size === photos.length;

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

      {/* 에러 */}
      {error && (
        <p className="mx-4 mt-3 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      {/* 드라이브 전송 실패 배너 */}
      <FailedPhotoBanner />

      {/* 선택 카운트 */}
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

      {/* 사진 그리드 */}
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

      {/* 하단 액션 바 */}
      <BottomBar
        selectedCount={selectedIds.size}
        hasNamedSelected={hasNamedSelected}
        actionLoading={actionLoading}
        onNeedsName={handleNeedsName}
        onOpenDrawer={() => setDrawerOpen(true)}
        onSendToDrive={handleSendToDrive}
      />

      {/* 이름 지정 드로어 */}
      <DogDrawer
        open={drawerOpen}
        dogs={dogs}
        subtitle={`${selectedIds.size}장에 적용됩니다`}
        busy={actionLoading === "naming"}
        onClose={() => setDrawerOpen(false)}
        onAssign={handleAssignDog}
        onAddDog={handleAddDog}
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

      {/* 선택 오버레이 */}
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

      {/* 하단 배지 행 */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-1 py-1 gap-0.5">
        {badge && (
          <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {photo.dog?.dog_name && (
          <span className="text-[9px] font-medium text-white px-1.5 py-0.5 rounded bg-black/50 truncate max-w-[4.5rem]">
            {photo.dog.dog_name}
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
  actionLoading,
  onNeedsName,
  onOpenDrawer,
  onSendToDrive,
}: {
  selectedCount: number;
  hasNamedSelected: boolean;
  actionLoading: string | null;
  onNeedsName: () => void;
  onOpenDrawer: () => void;
  onSendToDrive: () => void;
}) {
  const busy     = actionLoading !== null;
  const inactive = selectedCount === 0 || busy;

  return (
    <div className="fixed bottom-16 inset-x-0 z-[35] bg-white border-t border-gray-100 px-4 py-4">
      <div className="max-w-md mx-auto flex flex-col gap-2">

        {/* 드라이브 전송 (named 사진 선택 시) */}
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

        {/* 이름 지정 / 누구예요 */}
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

      </div>
    </div>
  );
}
