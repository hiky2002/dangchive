"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function PendingRequestsBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        // admin key 없이 호출하면 빈 배열 반환 (관리자만 실제 숫자 확인 가능)
        // 여기서는 public 엔드포인트로 count만 노출하는 방식 사용
        const res = await fetch("/api/dog-requests/count");
        if (!res.ok) return;
        const data = await res.json();
        setCount(data.count ?? 0);
      } catch { /* 무시 */ }
    }
    fetchCount();
  }, []);

  if (!count) return null;

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
