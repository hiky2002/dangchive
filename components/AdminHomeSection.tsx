"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_KEY = "dangchive_admin_key";

export function AdminHomeSection() {
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [showLogin,     setShowLogin]     = useState(false);
  const [password,      setPassword]      = useState("");
  const [loginError,    setLoginError]    = useState(false);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [checking,      setChecking]      = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY);
    if (key) {
      setIsAdmin(true);
      fetchPendingCount(key);
    }
  }, []);

  async function fetchPendingCount(key?: string) {
    try {
      const res = await fetch("/api/dog-requests/count");
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count ?? 0);
      }
    } catch { /* 무시 */ }
  }

  async function handleLogin() {
    if (!password.trim() || checking) return;
    setChecking(true);
    setLoginError(false);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(ADMIN_KEY, password);
        setIsAdmin(true);
        setShowLogin(false);
        setPassword("");
        fetchPendingCount();
      } else {
        setLoginError(true);
        setPassword("");
      }
    } catch {
      setLoginError(true);
    } finally {
      setChecking(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_KEY);
    setIsAdmin(false);
    setPendingCount(0);
  }

  // ── 관리자 로그인 상태
  if (isAdmin) {
    return (
      <div className="flex flex-col gap-2">
        {/* 승인 대기 배지 */}
        {pendingCount > 0 && (
          <Link
            href="/dogs"
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition active:scale-95"
          >
            <span className="text-lg">🔔</span>
            <span className="flex-1 font-medium">승인 요청 {pendingCount}건 대기 중</span>
            <span className="text-amber-500 font-bold">→</span>
          </Link>
        )}

        {/* 관리자 상태 표시 */}
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <span>🔑</span>
            <span className="font-medium">관리자 모드</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-blue-400 hover:text-blue-600 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  // ── 로그인 폼
  if (showLogin) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-700">관리자 로그인</p>
        <div className="flex gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setLoginError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="비밀번호 입력"
            className={`flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400
              ${loginError ? "border-red-300 bg-red-50" : "border-gray-200"}`}
          />
          <button
            onClick={handleLogin}
            disabled={!password.trim() || checking}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl disabled:opacity-40 active:scale-95 transition"
          >
            {checking ? "..." : "확인"}
          </button>
        </div>
        {loginError && (
          <p className="text-xs text-red-500">비밀번호가 틀렸습니다.</p>
        )}
        <button
          onClick={() => { setShowLogin(false); setPassword(""); setLoginError(false); }}
          className="text-xs text-gray-400 hover:text-gray-600 text-center"
        >
          취소
        </button>
      </div>
    );
  }

  // ── 기본 (봉사자 화면) — 관리자 로그인 버튼만 표시
  return (
    <button
      onClick={() => setShowLogin(true)}
      className="text-xs text-gray-400 hover:text-gray-600 text-center py-1 transition"
    >
      관리자 로그인
    </button>
  );
}
