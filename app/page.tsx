import Link from "next/link";
import { AdminHomeSection } from "@/components/AdminHomeSection";

const tabs = [
  {
    href: "/upload",
    label: "사진 업로드",
    emoji: "📸",
    description: "오늘 찍은 사진을 올려주세요",
    color: "from-orange-400 to-orange-500",
  },
  {
    href: "/sort",
    label: "사진 정리",
    emoji: "🗂️",
    description: "올린 사진에 아이 이름을 지정해요",
    color: "from-orange-500 to-amber-500",
  },
  {
    href: "/review",
    label: "이름 확인",
    emoji: "✅",
    description: "이름이 필요한 사진을 도와주세요",
    color: "from-amber-400 to-orange-500",
  },
];

export default function HomePage() {
  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-8">

      {/* 헤더 */}
      <div className="text-center mb-8">
        <p className="text-5xl mb-3">🐾</p>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">댕카이브</h1>
        <p className="mt-1.5 text-gray-400 text-sm">LCKD 아이들 사진 아카이브</p>
      </div>

      {/* 관리자 영역 — 카드 위 */}
      <div className="mb-4">
        <AdminHomeSection />
      </div>

      {/* 메뉴 카드 */}
      <div className="flex flex-col gap-3">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-4 bg-gradient-to-r ${tab.color} rounded-2xl p-5 shadow-sm active:scale-95 transition-transform`}
          >
            <span className="text-3xl drop-shadow">{tab.emoji}</span>
            <div>
              <p className="font-bold text-white text-base">{tab.label}</p>
              <p className="text-white/75 text-sm mt-0.5">{tab.description}</p>
            </div>
            <span className="ml-auto text-white/60 text-xl">›</span>
          </Link>
        ))}
      </div>

    </main>
  );
}
