"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Dog } from "@/types";

export default function DogsPage() {
  const [dogs,    setDogs]    = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // 수정 상태
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editName,    setEditName]    = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState<string | null>(null);

  // 삭제 확인 상태
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 새 아이 추가
  const [newName,     setNewName]     = useState("");
  const [addLoading,  setAddLoading]  = useState(false);
  const [addError,    setAddError]    = useState<string | null>(null);

  // 드라이브 동기화
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult,  setSyncResult]  = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/dogs");
      const data = await res.json();
      setDogs(data.dogs ?? []);
    } catch {
      setError("불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(dog: Dog) {
    setEditingId(dog.dog_id);
    setEditName(dog.dog_name);
    setEditError(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(dogId: string) {
    if (!editName.trim() || editLoading) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/dogs/${dogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dog_name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수정 실패");
      setDogs((prev) =>
        prev
          .map((d) => (d.dog_id === dogId ? data.dog : d))
          .sort((a, b) => a.dog_name.localeCompare(b.dog_name, "ko"))
      );
      setEditingId(null);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  }

  async function confirmDelete(dogId: string) {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/dogs/${dogId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setDogs((prev) => prev.filter((d) => d.dog_id !== dogId));
      setDeletingId(null);
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleSync() {
    if (syncLoading) return;
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res  = await fetch("/api/drive/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "동기화 실패");
      const parts: string[] = [];
      if (data.added > 0) parts.push(`${data.added}마리 새로 등록: ${(data.dogs as any[]).map((d: any) => d.dog_name).join(", ")}`);
      if (data.updated > 0) parts.push(`${data.updated}마리 폴더 연결됨`);
      setSyncResult(parts.length > 0 ? parts.join(" / ") : "새로 추가하거나 연결할 아이가 없습니다.");
      if (data.added > 0 || data.updated > 0) await load();
    } catch (e: any) {
      setSyncResult(`오류: ${e.message}`);
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim() || addLoading) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dog_name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추가 실패");
      setDogs((prev) =>
        [...prev, data.dog].sort((a, b) => a.dog_name.localeCompare(b.dog_name, "ko"))
      );
      setNewName("");
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto pb-24">

      {/* 헤더 */}
      <div className="flex items-center gap-2.5 px-4 py-4 sticky top-0 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">
          ←
        </Link>
        <h1 className="text-base font-bold text-gray-900">아이 관리</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {dogs.length}마리
        </span>
        <button
          onClick={handleSync}
          disabled={syncLoading}
          className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100
                     px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition whitespace-nowrap"
        >
          {syncLoading ? "불러오는 중..." : "드라이브에서 불러오기"}
        </button>
      </div>

      {syncResult && (
        <p className="mx-4 mt-3 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-xl">
          {syncResult}
        </p>
      )}

      {error && (
        <p className="mx-4 mt-3 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      {/* 새 아이 추가 */}
      <div className="mx-4 mt-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
        <p className="text-xs font-semibold text-orange-600 mb-2">+ 새 아이 추가</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="이름 입력 (예: 콩이)"
            maxLength={20}
            className="flex-1 border border-orange-200 bg-white rounded-xl px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || addLoading}
            className="px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl
                       disabled:opacity-40 hover:bg-orange-600 active:scale-95 transition"
          >
            {addLoading ? "..." : "추가"}
          </button>
        </div>
        {addError && <p className="text-xs text-red-500 mt-1.5">{addError}</p>}
      </div>

      {/* 아이 목록 */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm mt-10">불러오는 중...</p>
      ) : dogs.length === 0 ? (
        <div className="text-center mt-20 text-gray-400">
          <p className="text-4xl mb-3">🐾</p>
          <p className="text-sm">등록된 아이가 없습니다.</p>
        </div>
      ) : (
        <div className="mx-4 mt-4 flex flex-col gap-2">
          {dogs.map((dog) => {
            const isEditing  = editingId  === dog.dog_id;
            const isDeleting = deletingId === dog.dog_id;

            return (
              <div
                key={dog.dog_id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* 수정 모드 */}
                {isEditing ? (
                  <div className="px-4 py-3 flex flex-col gap-2">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(dog.dog_id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      maxLength={20}
                      className="w-full border border-orange-300 rounded-xl px-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    {editError && (
                      <p className="text-xs text-red-500">{editError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(dog.dog_id)}
                        disabled={!editName.trim() || editLoading}
                        className="flex-1 bg-orange-500 text-white text-sm font-semibold py-2 rounded-xl
                                   disabled:opacity-40 active:scale-95 transition"
                      >
                        {editLoading ? "저장 중..." : "저장"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 bg-gray-100 text-gray-600 text-sm font-medium py-2 rounded-xl
                                   active:scale-95 transition"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : isDeleting ? (
                  /* 삭제 확인 모드 */
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 mb-1">
                      "{dog.dog_name}"를 삭제할까요?
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                      연결된 사진의 이름 지정이 해제됩니다.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmDelete(dog.dog_id)}
                        disabled={deleteLoading}
                        className="flex-1 bg-red-500 text-white text-sm font-semibold py-2 rounded-xl
                                   disabled:opacity-40 active:scale-95 transition"
                      >
                        {deleteLoading ? "삭제 중..." : "삭제"}
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="flex-1 bg-gray-100 text-gray-600 text-sm font-medium py-2 rounded-xl
                                   active:scale-95 transition"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 기본 모드 */
                  <div className="flex items-center px-4 py-3.5 gap-3">
                    <span className="text-xl">🐾</span>
                    <span className="flex-1 font-medium text-gray-800">{dog.dog_name}</span>
                    <span className="text-[11px] text-gray-400 font-mono mr-1">{dog.dog_id}</span>
                    <button
                      onClick={() => startEdit(dog)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400
                                 hover:bg-orange-50 hover:text-orange-500 transition"
                      aria-label="수정"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeletingId(dog.dog_id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400
                                 hover:bg-red-50 hover:text-red-500 transition"
                      aria-label="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </main>
  );
}
