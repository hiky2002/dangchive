"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/",       label: "홈",       icon: "🏠" },
  { href: "/upload", label: "올리기",   icon: "📷" },
  { href: "/sort",   label: "정리하기", icon: "🗂️" },
  { href: "/review", label: "이름 확인", icon: "❓" },
  { href: "/dogs",   label: "아이 관리", icon: "🐾" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    async function fetchBadge() {
      try {
        const res  = await fetch("/api/batches?status=needs_name");
        const data = await res.json();
        setBadge(data.batches?.length ?? 0);
      } catch {
        // 네트워크 오류는 무시
      }
    }

    fetchBadge();
    const id = setInterval(fetchBadge, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200">
      <div className="max-w-md mx-auto flex">
        {TABS.map((tab) => {
          const active    = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const isReview  = tab.href === "/review";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[11px] font-medium transition-colors ${
                active ? "text-[#3182F6]" : "text-[#C2C8D0] hover:text-[#8B95A1]"
              }`}
            >
              {/* 아이콘 + 뱃지 래퍼 */}
              <span className="relative inline-flex items-center justify-center">
                <span className="text-[22px] leading-none">{tab.icon}</span>
                {isReview && badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 leading-none">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
