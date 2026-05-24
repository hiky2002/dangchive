"use client";

import { useState, useEffect } from "react";
import type { Dog } from "@/types";

export type DogDrawerProps = {
  open: boolean;
  dogs: Dog[];
  subtitle: string;
  busy: boolean;
  onClose: () => void;
  onAssign: (dogIds: string[], dogs: Dog[]) => void;
  onAddDog: (name: string) => Promise<Dog | null>;
};

export function DogDrawer({
  open,
  dogs,
  subtitle,
  busy,
  onClose,
  onAssign,
  onAddDog,
}: DogDrawerProps) {
  const [search,      setSearch]      = useState("");
  const [newName,     setNewName]     = useState("");
  const [pickedIds,   setPickedIds]   = useState<Set<string>>(new Set());
  const [addingDog,   setAddingDog]   = useState(false);
  const [addError,    setAddError]    = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setNewName("");
      setPickedIds(new Set());
      setAddError(null);
    }
  }, [open]);

  const filtered = dogs.filter((d) =>
    d.dog_name.toLowerCase().includes(search.toLowerCase())
  );

  function toggleDog(dogId: string) {
    setPickedIds((prev) => {
      const next = new Set(prev);
      next.has(dogId) ? next.delete(dogId) : next.add(dogId);
      return next;
    });
  }

  async function handleAdd() {
    if (!newName.trim() || addingDog) return;
    setAddingDog(true);
    setAddError(null);
    const dog = await onAddDog(newName.trim());
    if (dog) {
      setNewName("");
      setPickedIds((prev) => new Set(Array.from(prev).concat(dog.dog_id)));
    } else {
      setAddError("추가에 실패했습니다. 이미 존재하는 이름일 수 있어요.");
    }
    setAddingDog(false);
  }

  function handleConfirm() {
    if (pickedIds.size === 0 || busy) return;
    const ids    = Array.from(pickedIds);
    const picked = dogs.filter((d) => pickedIds.has(d.dog_id));
    onAssign(ids, picked);
  }

  const pickedDogs = dogs.filter((d) => pickedIds.has(d.dog_id));
  const pickedLabel =
    pickedDogs.length === 0
      ? "아이를 선택해 주세요"
      : pickedDogs.length === 1
        ? `"${pickedDogs[0].dog_name}"(으)로 지정하기`
        : `${pickedDogs.map((d) => d.dog_name).join(", ")} (${pickedDogs.length}마리) 지정하기`;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[50]" onClick={onClose} />

      <div className="fixed bottom-0 inset-x-0 z-[60] flex flex-col bg-white rounded-t-3xl shadow-2xl max-h-[88vh]">

        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">아이 이름 지정</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle} · 복수 선택 가능</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg"
          >
            ✕
          </button>
        </div>

        {/* 검색 */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름으로 검색 (예: 콩이)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* 선택된 아이 태그 */}
        {pickedDogs.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {pickedDogs.map((d) => (
              <span
                key={d.dog_id}
                onClick={() => toggleDog(d.dog_id)}
                className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer hover:bg-orange-200"
              >
                🐾 {d.dog_name}
                <span className="text-orange-400 font-bold">✕</span>
              </span>
            ))}
          </div>
        )}

        {/* 강아지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-center text-gray-400 py-8">
              {search
                ? `"${search}"에 해당하는 아이가 없어요`
                : "등록된 아이가 없어요. 아래에서 추가하세요."}
            </p>
          ) : (
            <div className="flex flex-col gap-1 py-1">
              {filtered.map((dog) => {
                const picked = pickedIds.has(dog.dog_id);
                return (
                  <button
                    key={dog.dog_id}
                    onClick={() => toggleDog(dog.dog_id)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition
                      ${picked
                        ? "bg-orange-50 border-2 border-orange-400"
                        : "border-2 border-transparent hover:bg-gray-50"
                      }`}
                  >
                    <span className="text-xl">🐾</span>
                    <span className={`font-medium ${picked ? "text-orange-700" : "text-gray-800"}`}>
                      {dog.dog_name}
                    </span>
                    <div className={`ml-auto w-5 h-5 rounded flex items-center justify-center border-2 transition
                      ${picked ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                      {picked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 새 아이 추가 */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <p className="text-xs font-medium text-gray-500 mb-2">+ 새 아이 추가</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="이름 입력 (예: 두부)"
              maxLength={20}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || addingDog}
              className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl
                         disabled:opacity-40 hover:bg-gray-700 active:scale-95 transition"
            >
              {addingDog ? "..." : "추가"}
            </button>
          </div>
          {addError && <p className="text-xs text-red-500 mt-1.5">{addError}</p>}
        </div>

        {/* 지정하기 버튼 */}
        <div className="px-4 pb-8 pt-2 shrink-0">
          <button
            onClick={handleConfirm}
            disabled={pickedIds.size === 0 || busy}
            className="w-full bg-orange-500 text-white font-semibold py-4 rounded-2xl
                       disabled:opacity-40 active:scale-95 transition"
          >
            {busy ? "지정 중..." : pickedLabel}
          </button>
        </div>

      </div>
    </>
  );
}
