"use client";

import { useState, useEffect, useRef } from "react";
import type { Dog } from "@/types";

export type DogDrawerProps = {
  open: boolean;
  dogs: Dog[];
  subtitle: string;
  busy: boolean;
  onClose: () => void;
  onAssign: (dogIds: string[], dogs: Dog[]) => void;
  onDogApproved?: (dog: Dog) => void; // 승인된 아이를 부모 목록에 추가
  onSkip?: () => void;               // 승인 대기 중 "지금은 넘기기" → needs_name으로 저장
};

export function DogDrawer({
  open,
  dogs,
  subtitle,
  busy,
  onClose,
  onAssign,
  onDogApproved,
  onSkip,
}: DogDrawerProps) {
  const [search,       setSearch]       = useState("");
  const [newName,      setNewName]      = useState("");
  const [pickedIds,    setPickedIds]    = useState<Set<string>>(new Set());

  // 요청 대기 상태
  const [pendingName,      setPendingName]      = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [rejected,         setRejected]         = useState(false);
  const [addError,         setAddError]         = useState<string | null>(null);
  const [requesting,       setRequesting]       = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setNewName("");
      setPickedIds(new Set());
      setAddError(null);
      setPendingName(null);
      setPendingRequestId(null);
      setRejected(false);
      setRequesting(false);
    } else {
      // 드로어 닫힐 때 폴링 중단
      stopPolling();
    }
  }, [open]);

  // 폴링: 승인 대기 중인 아이가 dogs 목록에 나타나면 자동 선택
  useEffect(() => {
    if (!pendingName) return;
    const found = dogs.find(
      (d) => d.dog_name.trim().toLowerCase() === pendingName.trim().toLowerCase()
    );
    if (found) {
      stopPolling();
      setPendingName(null);
      setPickedIds((prev) => new Set(Array.from(prev).concat(found.dog_id)));
      if (onDogApproved) onDogApproved(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dogs, pendingName]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // 요청 취소 — DB에서도 삭제
  async function cancelRequest() {
    stopPolling();
    const rid = pendingRequestId;
    setPendingName(null);
    setPendingRequestId(null);
    if (rid) {
      try {
        await fetch(`/api/dog-requests/${rid}`, { method: "DELETE" });
      } catch { /* 무시 */ }
    }
  }

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

  // 새 아이 추가 → 요청 제출 + 폴링 시작
  async function handleRequestNewDog() {
    if (!newName.trim() || requesting) return;
    setRequesting(true);
    setAddError(null);
    setRejected(false);
    const nameSnapshot = newName.trim();
    try {
      const res = await fetch("/api/dog-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "add",
          requester: "봉사자",
          requested_name: nameSnapshot,
        }),
      });
      if (!res.ok) throw new Error("요청 실패");
      const resData = await res.json();
      const requestId: string = resData.request?.request_id ?? null;

      setPendingName(nameSnapshot);
      setPendingRequestId(requestId);
      setNewName("");

      // 3초마다 승인/거절 여부 확인
      pollRef.current = setInterval(async () => {
        try {
          // 1. 거절 여부 확인 (request_id로 직접 조회)
          if (requestId) {
            const rr = await fetch(`/api/dog-requests/${requestId}`);
            if (rr.ok) {
              const rd = await rr.json();
              if (rd.request?.status === "rejected") {
                stopPolling();
                setPendingName(null);
                setPendingRequestId(null);
                setRejected(true);
                setNewName(nameSnapshot); // 이름 복원해서 재시도 가능하게
                return;
              }
            }
          }

          // 2. 승인 여부 확인 (dogs 목록에 나타나면 승인된 것)
          const r    = await fetch("/api/dogs");
          const data = await r.json();
          const allDogs: Dog[] = data.dogs ?? [];
          const found = allDogs.find(
            (d) => d.dog_name.trim().toLowerCase() === nameSnapshot.toLowerCase()
          );
          if (found) {
            stopPolling();
            setPendingName(null);
            setPendingRequestId(null);
            setPickedIds((prev) => new Set(Array.from(prev).concat(found.dog_id)));
            if (onDogApproved) onDogApproved(found);
          }
        } catch { /* 무시 */ }
      }, 3000);

    } catch {
      setAddError("요청에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setRequesting(false);
    }
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
                       focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
          />
        </div>

        {/* 선택된 아이 태그 */}
        {pickedDogs.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {pickedDogs.map((d) => (
              <span
                key={d.dog_id}
                onClick={() => toggleDog(d.dog_id)}
                className="inline-flex items-center gap-1 bg-[#EBF3FF] text-[#3182F6] text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer hover:bg-blue-100"
              >
                🐾 {d.dog_name}
                <span className="text-[#3182F6] font-bold">✕</span>
              </span>
            ))}
          </div>
        )}

        {/* 강아지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-center text-gray-400 py-8">
              {search ? `"${search}"에 해당하는 아이가 없어요` : "등록된 아이가 없어요. 아래에서 추가를 요청하세요."}
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
                        ? "bg-[#EBF3FF] border-2 border-[#3182F6]"
                        : "border-2 border-transparent hover:bg-gray-50"
                      }`}
                  >
                    <span className="text-xl">🐾</span>
                    <span className={`font-medium ${picked ? "text-[#3182F6]" : "text-gray-800"}`}>
                      {dog.dog_name}
                    </span>
                    <div className={`ml-auto w-5 h-5 rounded flex items-center justify-center border-2 transition
                      ${picked ? "bg-[#3182F6] border-[#3182F6]" : "border-gray-300"}`}>
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

        {/* 새 아이 추가 요청 */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          {rejected ? (
            /* 거절됨 */
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base shrink-0">❌</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700">관리자가 요청을 거절했어요</p>
                  <p className="text-xs text-red-400 mt-0.5">이름을 수정하거나 다른 아이를 선택해 주세요</p>
                </div>
              </div>
              <button
                onClick={() => setRejected(false)}
                className="w-full text-sm text-red-700 font-medium bg-red-100 hover:bg-red-200 py-2 rounded-xl transition active:scale-95"
              >
                다시 요청하기
              </button>
            </div>
          ) : pendingName ? (
            /* 승인 대기 중 */
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700">"{pendingName}" 승인 대기 중...</p>
                  <p className="text-xs text-amber-500 mt-0.5">관리자가 승인하면 자동으로 선택돼요</p>
                </div>
                <button
                  onClick={cancelRequest}
                  className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                >
                  취소
                </button>
              </div>
              {onSkip && (
                <button
                  onClick={async () => { await cancelRequest(); onSkip(); }}
                  className="w-full text-sm text-amber-700 font-medium bg-amber-100 hover:bg-amber-200 py-2 rounded-xl transition active:scale-95"
                >
                  지금은 넘기고 나중에 이름 지정하기 →
                </button>
              )}
            </div>
          ) : (
            /* 요청 입력 */
            <>
              <p className="text-xs font-medium text-gray-500 mb-2">+ 새 아이 추가 요청</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRequestNewDog()}
                  placeholder="이름 입력 (예: 두부)"
                  maxLength={20}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
                />
                <button
                  onClick={handleRequestNewDog}
                  disabled={!newName.trim() || requesting}
                  className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl
                             disabled:opacity-40 hover:bg-gray-700 active:scale-95 transition"
                >
                  {requesting ? "..." : "요청"}
                </button>
              </div>
              {addError && <p className="text-xs text-red-500 mt-1.5">{addError}</p>}
              <p className="text-xs text-gray-400 mt-1.5">관리자 승인 후 자동으로 선택됩니다</p>
            </>
          )}
        </div>

        {/* 지정하기 버튼 */}
        <div className="px-4 pb-8 pt-2 shrink-0">
          <button
            onClick={handleConfirm}
            disabled={pickedIds.size === 0 || busy}
            className="w-full bg-[#3182F6] text-white font-semibold py-4 rounded-2xl
                       disabled:opacity-40 active:scale-95 transition"
          >
            {busy ? "지정 중..." : pickedLabel}
          </button>
        </div>

      </div>
    </>
  );
}
