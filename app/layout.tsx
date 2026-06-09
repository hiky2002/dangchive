import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthGate }         from "@/components/AuthGate";
import { BottomNav }         from "@/components/BottomNav";
import { KakaoInAppBanner } from "@/components/KakaoInAppBanner";
import { OfflineToast }     from "@/components/OfflineToast";

export const metadata: Metadata = {
  title: "댕카이브",
  description: "LCKD 아이들 사진 아카이브 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased bg-[#F5F5F5] min-h-screen">
        <AuthGate>
          <KakaoInAppBanner />
          {/* pb-20: 하단 탭 네비게이션 높이(~64px) 만큼 여백 확보 */}
          <div className="pb-20">{children}</div>
          <BottomNav />
          <OfflineToast />
        </AuthGate>
      </body>
    </html>
  );
}
