"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_KEY = "dangchive_admin_key";

export function PendingRequestsBadge() {
  const [count,   setCount]   = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 관리자 여부 확인
    const key = sessionStorage.getItem(ADMIN_KEY);
    if (!key) return;
    setIsAdmin(true);

    async function fetchCount() {
      try {
        const res = await fetch("/api/dog-requests/count");
        if (!res.ok) return;
        const data = await res.json();
        setCount(data.count ?? 0);
      } catch { /* 무시 */ }
    }
    fetchCount();
  }, []);

  // 관리자가 아니거나 대기 건수 없으면 표시 안 함
  if (!isAdmin || !count) return null;

  return (
    <Link
      href="/dogs"
      className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition active:scale-95"
    >
      <span className="text-lg">🔔</span>
      <span className="flex-1 font-medium">아이 추가 승인 요청 {count}건 대기 중</span>
      <span className="text-amber-500 font-bold">→</span>
    </Link>
  );
}
