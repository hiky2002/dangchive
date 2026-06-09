import Link from "next/link";
import { AdminHomeSection } from "@/components/AdminHomeSection";

const tabs = [
  {
    href: "/upload",
    label: "사진 업로드",
    emoji: "📸",
    description: "LCKD 아이들 사진을 찍어 업로드하세요",
  },
  {
    href: "/sort",
    label: "사진 정리",
    emoji: "🗂️",
    description: "내가 올린 사진에 아이 이름을 지정하세요",
  },
  {
    href: "/review",
    label: "이름 확인",
    emoji: "✅",
    description: "아직 이름 확인이 필요한 아이들이 있어요! 도와주세요!",
  },
];

export default function HomePage() {
  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">🐾 댕카이브</h1>
        <p className="mt-2 text-gray-500 text-sm">
          LCKD 아이들 사진 아카이브 서비스
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <AdminHomeSection />
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow active:scale-95"
          >
            <span className="text-4xl">{tab.emoji}</span>
            <div>
              <p className="font-semibold text-gray-800">{tab.label}</p>
              <p className="text-sm text-gray-400">{tab.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
