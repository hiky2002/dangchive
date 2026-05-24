"use client";

import { useEffect, useState } from "react";

export function OfflineToast() {
  const [offline, setOffline] = useState(false);
  const [fading,  setFading]  = useState(false); // 연결 복구 시 페이드아웃

  useEffect(() => {
    if (!navigator.onLine) setOffline(true);

    function handleOffline() {
      setFading(false);
      setOffline(true);
    }
    function handleOnline() {
      setFading(true);
      setTimeout(() => { setOffline(false); setFading(false); }, 400);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className={`fixed bottom-20 inset-x-0 z-50 flex justify-center px-4 pointer-events-none
                  transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="pointer-events-auto flex items-center gap-2.5 bg-gray-900 text-white
                      text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
        <span className="text-base">📶</span>
        <span>인터넷 연결을 확인해 주세요</span>
      </div>
    </div>
  );
}
