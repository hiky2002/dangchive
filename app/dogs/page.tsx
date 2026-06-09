"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Dog } from "@/types";

const ADMIN_KEY = "dangchive_admin_key";

type DogRequest = {
  request_id: string;
  type: "rename" | "add";
  requester: string;
  dog_id: string | null;
  current_name: string | null;
  requested_name: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function DogsPage() {
  const [dogs,      setDogs]      = useState<Dog[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [adminKey,  setAdminKey]  = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_KEY);
    if (stored) setAdminKey(stored);
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

  function handleAdminLogin(key: string) {
    setAdminKey(key);
    sessionStorage.setItem(ADMIN_KEY, key);
    setShowLogin(false);
  }

  function handleAdminLogout() {
    setAdminKey(null);
    sessionStorage.removeItem(ADMIN_KEY);
  }

  const isAdmin = !!adminKey;

  return (
    <main className="max-w-md mx-auto pb-24">

      {/* 헤더 */}
      <div className="flex items-center gap-2.5 px-4 py-4 sticky top-0 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">←</Link>
        <h1 className="text-base font-bold text-gray-900">아이 관리</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{dogs.length}마리</span>
        <div className="ml-auto flex gap-2 items-center">
          {isAdmin ? (
            <>
              <SyncButton adminKey={adminKey!} onSync={load} />
              <button
                onClick={handleAdminLogout}
                className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition"
            >
              관리자 모드
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mx-4 mt-3 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
      )}

      {/* 관리자: 대기 중인 요청 */}
      {isAdmin && <PendingRequests adminKey={adminKey!} onApproved={load} />}

      {/* 관리자: 새 아이 추가 */}
      {isAdmin && <AdminAddDog adminKey={adminKey!} onAdded={load} />}

      {/* 봉사자: 아이 추가 요청 */}
      {!isAdmin && <UserAddRequest />}

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
          {dogs.map((dog) =>
            isAdmin
              ? <AdminDogCard key={dog.dog_id} dog={dog} adminKey={adminKey!} onUpdated={load} />
              : <UserDogCard  key={dog.dog_id} dog={dog} />
          )}
        </div>
      )}

      {/* 관리자 로그인 모달 */}
      {showLogin && (
        <AdminLoginModal onClose={() => setShowLogin(false)} onLogin={handleAdminLogin} />
      )}

    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// AdminLoginModal
// ─────────────────────────────────────────────────────────────
function AdminLoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (key: string) => void }) {
  const [pw,      setPw]      = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit() {
    if (!pw.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) { setError("비밀번호가 올바르지 않습니다."); return; }
      onLogin(pw);
    } catch {
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[50]" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/3 z-[60] bg-white rounded-2xl p-6 shadow-2xl max-w-sm mx-auto">
        <h2 className="font-bold text-gray-900 mb-1">관리자 모드</h2>
        <p className="text-xs text-gray-400 mb-4">관리자 비밀번호를 입력하세요</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="비밀번호"
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3
                     focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!pw.trim() || loading}
            className="flex-1 bg-orange-500 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-40 active:scale-95 transition"
          >
            {loading ? "확인 중..." : "입력"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 text-sm font-medium py-3 rounded-xl active:scale-95 transition"
          >
            취소
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PendingRequests
// ─────────────────────────────────────────────────────────────
// 받침 여부로 '이라는' / '라는' 결정
function iRaneun(s: string): string {
  const last = s[s.length - 1];
  const code = last?.charCodeAt(0) ?? 0;
  if (code < 0xAC00 || code > 0xD7A3) return "이라는";
  return (code - 0xAC00) % 28 === 0 ? "라는" : "이라는";
}

// 유사 이름 찾기: 한글 토큰 기준으로 겹치는 부분이 있으면 유사로 판단
function findSimilarDogs(requestedName: string, dogs: Dog[]): Dog[] {
  const normalize = (s: string) => s.trim().toLowerCase();

  // 숫자·언더스코어·공백·괄호를 제거하고 한글 토큰만 추출
  // 예: "(임보)떡국이 23_701" → ["임보", "떡국이"]
  //     "23_0701_떡국이"      → ["떡국이"]
  const koreanTokens = (s: string): string[] =>
    normalize(s)
      .replace(/[0-9_\s()[\]]/g, " ")
      .split(" ")
      .filter((t) => t.length > 0);

  const reqNorm   = normalize(requestedName);
  const reqTokens = koreanTokens(requestedName);

  return dogs.filter((d) => {
    const dNorm   = normalize(d.dog_name);
    if (dNorm === reqNorm) return false; // 완전히 같은 이름은 제외

    const dTokens = koreanTokens(d.dog_name);

    // 2글자 이상인 토큰끼리 하나라도 겹치면 유사
    return reqTokens.some(
      (rt) =>
        rt.length > 1 &&
        dTokens.some((dt) => dt.length > 1 && (rt.includes(dt) || dt.includes(rt)))
    );
  });
}

function PendingRequests({ adminKey, onApproved }: { adminKey: string; onApproved: () => void }) {
  const [requests,   setRequests]   = useState<DogRequest[]>([]);
  const [dogs,       setDogs]       = useState<Dog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting,     setActing]     = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 마운트 시 + 5초마다 자동 갱신
  useEffect(() => {
    loadRequests();
    const timer = setInterval(loadRequests, 5000);
    return () => clearInterval(timer);
  }, [adminKey]); // eslint-disable-line

  // dogs 목록 별도 로드 (유사 이름 비교용)
  useEffect(() => {
    fetch("/api/dogs")
      .then(r => r.json())
      .then(d => setDogs(d.dogs ?? []))
      .catch(() => {});
  }, []); // eslint-disable-line

  async function loadRequests(manual = false) {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/dog-requests?status=pending", { headers: { "x-admin-key": adminKey } });
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try { const d = await res.json(); if (d.error) errMsg += ` — ${d.error}`; } catch {}
        setFetchError(errMsg);
        return;
      }
      setFetchError(null);
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {
      setFetchError("네트워크 오류");
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }

  async function handleAction(requestId: string, action: "approve" | "reject") {
    setActing(requestId);
    try {
      const res = await fetch(`/api/dog-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
        if (action === "approve") onApproved();
      }
    } finally {
      setActing(null);
    }
  }

  if (loading) return null;

  return (
    <div className="mx-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-orange-600">
          📋 대기 중인 요청 {requests.length > 0 ? `(${requests.length}건)` : ""}
        </p>
        <button
          onClick={() => loadRequests(true)}
          disabled={refreshing}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 disabled:opacity-40 transition"
        >
          <span className={refreshing ? "animate-spin inline-block" : ""}>↻</span>
          {refreshing ? "확인 중..." : "새로고침"}
        </button>
      </div>
      {fetchError ? (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
          <p className="text-xs font-semibold text-red-600">요청 목록을 불러오지 못했습니다</p>
          <p className="text-xs text-red-400 mt-0.5">{fetchError}</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="px-4 py-3 bg-gray-50 rounded-2xl">
          <p className="text-xs text-gray-400">대기 중인 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((req) => {
            const similar = req.type === "add" ? findSimilarDogs(req.requested_name, dogs) : [];
            return (
              <div key={req.request_id} className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
                <p className="text-sm font-medium text-gray-800 mb-1">
                  {req.type === "rename"
                    ? `"${req.current_name}" → "${req.requested_name}" 이름 변경`
                    : `"${req.requested_name}" 새 아이 추가`}
                </p>
                <p className="text-xs text-gray-400 mb-2">요청자: {req.requester}</p>

                {/* 유사 이름 경고 */}
                {similar.length > 0 && (
                  <div className="mb-3">
                    {similar.map((d) => (
                      <p key={d.dog_id} className="text-xs font-medium text-red-500">
                        &apos;{d.dog_name}&apos;{iRaneun(d.dog_name)} 파일이 현재 존재합니다
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(req.request_id, "approve")}
                    disabled={acting === req.request_id}
                    className="flex-1 bg-green-500 text-white text-xs font-semibold py-2 rounded-xl disabled:opacity-40 active:scale-95 transition"
                  >
                    {acting === req.request_id ? "처리 중..." : "✓ 승인"}
                  </button>
                  <button
                    onClick={() => handleAction(req.request_id, "reject")}
                    disabled={acting === req.request_id}
                    className="flex-1 bg-gray-200 text-gray-600 text-xs font-semibold py-2 rounded-xl disabled:opacity-40 active:scale-95 transition"
                  >
                    ✕ 거절
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AdminAddDog
// ─────────────────────────────────────────────────────────────
function AdminAddDog({ adminKey, onAdded }: { adminKey: string; onAdded: () => void }) {
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dog_name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추가 실패");
      setName("");
      onAdded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-4 mt-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
      <p className="text-xs font-semibold text-orange-600 mb-2">+ 새 아이 직접 추가</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="이름 입력 (예: 콩이)"
          maxLength={20}
          className="flex-1 border border-orange-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim() || loading}
          className="px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-orange-600 active:scale-95 transition"
        >
          {loading ? "..." : "추가"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UserAddRequest
// ─────────────────────────────────────────────────────────────
function UserAddRequest() {
  const [name,      setName]      = useState("");
  const [requester, setRequester] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleRequest() {
    if (!name.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dog-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "add", requester: requester || "봉사자", requested_name: name.trim() }),
      });
      if (!res.ok) throw new Error("요청 실패");
      setName("");
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      setError("요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-4 mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
      <p className="text-xs font-semibold text-blue-600 mb-1">새 아이 추가 요청</p>
      <p className="text-xs text-gray-400 mb-3">관리자 승인 후 등록됩니다</p>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={requester}
          onChange={(e) => setRequester(e.target.value)}
          placeholder="내 이름"
          maxLength={10}
          className="w-20 border border-blue-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRequest()}
          placeholder="추가할 아이 이름"
          maxLength={20}
          className="flex-1 border border-blue-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleRequest}
          disabled={!name.trim() || loading}
          className="px-4 py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 active:scale-95 transition"
        >
          {loading ? "..." : "요청"}
        </button>
      </div>
      {done  && <p className="text-xs text-green-600">✅ 요청이 전달되었습니다!</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AdminDogCard
// ─────────────────────────────────────────────────────────────
function AdminDogCard({ dog, adminKey, onUpdated }: { dog: Dog; adminKey: string; onUpdated: () => void }) {
  const [mode,        setMode]        = useState<"view" | "edit" | "delete">("view");
  const [editName,    setEditName]    = useState(dog.dog_name);
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState<string | null>(null);

  async function saveEdit() {
    if (!editName.trim() || editLoading) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res  = await fetch(`/api/dogs/${dog.dog_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ dog_name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수정 실패");
      setMode("view");
      onUpdated();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  }

  async function confirmDelete() {
    try {
      await fetch(`/api/dogs/${dog.dog_id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      onUpdated();
    } catch {
      setMode("view");
    }
  }

  if (mode === "edit") return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-2">
      <input
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setMode("view"); }}
        maxLength={20}
        autoFocus
        className="w-full border border-orange-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
      <p className="text-[11px] text-gray-400">저장 시 드라이브 폴더명도 함께 변경됩니다</p>
      {editError && <p className="text-xs text-red-500">{editError}</p>}
      <div className="flex gap-2">
        <button onClick={saveEdit} disabled={!editName.trim() || editLoading}
          className="flex-1 bg-orange-500 text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-40 active:scale-95 transition">
          {editLoading ? "저장 중..." : "저장"}
        </button>
        <button onClick={() => setMode("view")}
          className="flex-1 bg-gray-100 text-gray-600 text-sm font-medium py-2 rounded-xl active:scale-95 transition">
          취소
        </button>
      </div>
    </div>
  );

  if (mode === "delete") return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-sm font-medium text-gray-800 mb-1">"{dog.dog_name}"를 삭제할까요?</p>
      <p className="text-xs text-gray-400 mb-3">드라이브 폴더는 삭제되지 않습니다.</p>
      <div className="flex gap-2">
        <button onClick={confirmDelete}
          className="flex-1 bg-red-500 text-white text-sm font-semibold py-2 rounded-xl active:scale-95 transition">
          삭제
        </button>
        <button onClick={() => setMode("view")}
          className="flex-1 bg-gray-100 text-gray-600 text-sm font-medium py-2 rounded-xl active:scale-95 transition">
          취소
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center px-4 py-3.5 gap-3">
        <span className="text-xl">🐾</span>
        <span className="flex-1 font-medium text-gray-800">{dog.dog_name}</span>
        <span className="text-[11px] text-gray-400 font-mono mr-1">{dog.dog_id}</span>
        <button onClick={() => { setEditName(dog.dog_name); setMode("edit"); }}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-orange-50 hover:text-orange-500 transition">
          ✏️
        </button>
        <button onClick={() => setMode("delete")}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UserDogCard
// ─────────────────────────────────────────────────────────────
function UserDogCard({ dog }: { dog: Dog }) {
  const [open,      setOpen]      = useState(false);
  const [newName,   setNewName]   = useState("");
  const [requester, setRequester] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  async function handleRequest() {
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      await fetch("/api/dog-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rename",
          requester: requester || "봉사자",
          dog_id: dog.dog_id,
          current_name: dog.dog_name,
          requested_name: newName.trim(),
        }),
      });
      setDone(true);
      setOpen(false);
      setNewName("");
      setTimeout(() => setDone(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center px-4 py-3.5 gap-3">
        <span className="text-xl">🐾</span>
        <span className="flex-1 font-medium text-gray-800">{dog.dog_name}</span>
        {done
          ? <span className="text-xs text-green-600 font-medium">✅ 요청됨</span>
          : <button onClick={() => setOpen(!open)}
              className="text-xs text-gray-400 hover:text-orange-500 transition px-2 py-1 rounded-lg hover:bg-orange-50">
              이름 변경 요청
            </button>
        }
      </div>
      {open && (
        <div className="px-4 pb-3 border-t border-gray-50 pt-2 flex flex-col gap-2">
          <p className="text-xs text-gray-400">"{dog.dog_name}"의 새 이름을 입력하세요</p>
          <input type="text" value={requester} onChange={(e) => setRequester(e.target.value)}
            placeholder="내 이름 (예: 홍길동)" maxLength={10}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <div className="flex gap-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRequest()}
              placeholder="새 이름" maxLength={20} autoFocus
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <button onClick={handleRequest} disabled={!newName.trim() || loading}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 active:scale-95 transition">
              {loading ? "..." : "요청"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SyncButton
// ─────────────────────────────────────────────────────────────
function SyncButton({ adminKey, onSync }: { adminKey: string; onSync: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);

  async function handleSync() {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch("/api/drive/sync", { method: "POST" });
      const data = await res.json();
      const parts: string[] = [];
      if (data.added > 0)   parts.push(`${data.added}마리 등록`);
      if (data.updated > 0) parts.push(`${data.updated}마리 연결`);
      setResult(parts.length > 0 ? parts.join(", ") : "변경 없음");
      if (data.added > 0 || data.updated > 0) onSync();
      setTimeout(() => setResult(null), 4000);
    } catch {
      setResult("오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {result && <span className="text-[11px] text-blue-500">{result}</span>}
      <button onClick={handleSync} disabled={loading}
        className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full disabled:opacity-40 transition">
        {loading ? "동기화 중..." : "드라이브 동기화"}
      </button>
    </div>
  );
}
