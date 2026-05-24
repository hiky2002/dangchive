"use client";

import { useEffect, useState } from "react";

export function KakaoInAppBanner() {
  const [isKakao,    setIsKakao]    = useState(false);
  const [isIOS,      setIsIOS]      = useState(false);
  const [dismissed,  setDismissed]  = useState(false);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsKakao(/KAKAOTALK/i.test(ua));
    setIsIOS(/iPhone|iPad|iPod/i.test(ua));
  }, []);

  if (!isKakao || dismissed) return null;

  function handleOpen() {
    if (isIOS) {
      // iOS: 클립보드에 URL 복사 → 사용자가 Safari에서 직접 열도록 안내
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {
        // clipboard API 실패 시 무시
      });
    } else {
      // Android: Chrome intent URL
      const { host, pathname, search, hash } = window.location;
      window.location.href =
        `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;end;`;
    }
  }

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-3 pt-3 pointer-events-none">
      <div className="w-full max-w-md pointer-events-auto bg-amber-50 border border-amber-200 rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3">

        <span className="text-xl shrink-0 mt-0.5">💬</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            외부 브라우저에서 열어주세요
          </p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            {isIOS
              ? "하단 메뉴에서 '외부 브라우저로 열기'를 탭하거나, URL을 복사해 Safari에 붙여넣으세요."
              : "원활한 사용을 위해 Chrome에서 열어주세요."}
          </p>
          <button
            onClick={handleOpen}
            className="mt-2 text-xs font-semibold bg-amber-400 text-amber-900
                       px-3 py-1.5 rounded-lg active:scale-95 transition"
          >
            {copied
              ? "URL 복사 완료 ✓"
              : isIOS
              ? "URL 복사하기"
              : "Chrome으로 열기"}
          </button>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 text-lg leading-none shrink-0 mt-0.5 transition"
          aria-label="닫기"
        >
          ✕
        </button>

      </div>
    </div>
  );
}
