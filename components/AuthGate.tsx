"use client";

import { useEffect, useState } from "react";

const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE ?? "";
const SESSION_KEY = "dangchive_auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  // ACCESS_CODE가 설정되지 않으면 인증 스킵
  if (!ACCESS_CODE) return <>{children}</>;

  return <AuthGateInner>{children}</AuthGateInner>;
}

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const [authed,  setAuthed]  = useState<boolean | null>(null); // null = 세션 확인 중
  const [input,   setInput]   = useState("");
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(SESSION_KEY) === "true");
  }, []);

  function pressDigit(digit: string) {
    if (input.length >= 4 || shaking) return;
    const next = input + digit;
    setInput(next);

    if (next.length === 4) {
      if (next === ACCESS_CODE) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setAuthed(true);
      } else {
        setShaking(true);
        setTimeout(() => { setInput(""); setShaking(false); }, 600);
      }
    }
  }

  function pressBack() {
    if (shaking) return;
    setInput((p) => p.slice(0, -1));
  }

  // 세션 확인 전 — 흰 배경만 표시 (레이아웃 깜빡임 방지)
  if (authed === null) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (authed) return <>{children}</>;

  const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <main className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-8 gap-10 bg-gray-50">

      {/* 헤더 */}
      <div className="text-center">
        <p className="text-5xl mb-4">🐾</p>
        <h1 className="text-2xl font-bold text-gray-900">댕카이브</h1>
        <p className="text-sm text-gray-500 mt-2">접근 코드 4자리를 입력하세요</p>
      </div>

      {/* 입력 점 인디케이터 */}
      <div className={`flex gap-5 transition-transform ${shaking ? "animate-shake" : ""}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < input.length
                ? shaking ? "bg-red-500 border-red-500" : "bg-blue-600 border-blue-600"
                : "border-gray-300 bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* 숫자 패드 */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {KEYS.map((key, idx) => (
          <button
            key={idx}
            disabled={key === "" || shaking}
            onClick={() => key === "⌫" ? pressBack() : pressDigit(key)}
            className={`h-14 rounded-2xl text-xl font-semibold transition-all active:scale-90 ${
              key === ""
                ? "invisible"
                : key === "⌫"
                ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                : "bg-white border border-gray-200 text-gray-900 shadow-sm hover:bg-gray-50 active:shadow-none"
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </main>
  );
}
