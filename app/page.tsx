import Link from "next/link";
import { AdminHomeSection } from "@/components/AdminHomeSection";
import { FeedbackButton }   from "@/components/FeedbackButton";

const tabs = [
  {
    href: "/upload",
    label: "사진 업로드",
    emoji: "📸",
    description: "오늘 찍은 사진을 올려주세요",
    iconBg: "#FFF0E6",
  },
  {
    href: "/sort",
    label: "사진 정리",
    emoji: "🗂️",
    description: "올린 사진에 아이 이름을 지정해요",
    iconBg: "#EEF0F5",
  },
  {
    href: "/review",
    label: "이름 확인",
    emoji: "✅",
    description: "이름이 필요한 사진을 도와주세요",
    iconBg: "#EDF6EE",
  },
];

export default function HomePage() {
  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-8">

      {/* 헤더 */}
      <div className="mb-7">
        <p className="text-3xl mb-1">🐾</p>
        <h1 className="text-2xl font-bold text-[#191F28] tracking-tight">댕카이브</h1>
        <p className="mt-1 text-[#8B95A1] text-sm">LCKD 아이들 사진 아카이브</p>
      </div>

      {/* 메뉴 카드 */}
      <div className="flex flex-col gap-2.5">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center gap-4 bg-white rounded-2xl px-4 py-4 active:scale-[0.98] transition-transform"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: tab.iconBg }}
            >
              {tab.emoji}
            </div>
            <div>
              <p className="font-semibold text-[#191F28] text-[15px]">{tab.label}</p>
              <p className="text-[#8B95A1] text-[13px] mt-0.5">{tab.description}</p>
            </div>
            <span className="ml-auto text-[#C2C8D0] text-xl">›</span>
          </Link>
        ))}

        {/* 이용 가이드 */}
        <Link
          href="/guide"
          className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 active:scale-[0.98] transition"
        >
          <div className="w-9 h-9 rounded-xl bg-[#F0F4FF] flex items-center justify-center text-lg shrink-0">📖</div>
          <span className="flex-1 text-left font-medium text-[#8B95A1] text-sm">이용 가이드</span>
          <span className="text-[#C2C8D0] font-bold text-lg">›</span>
        </Link>

        {/* 관리자 로그인 */}
        <AdminHomeSection />

        {/* 의견 보내기 */}
        <FeedbackButton />
      </div>

    </main>
  );
}
