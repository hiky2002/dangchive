"use client";

import { useState } from "react";

type Phase = "idle" | "sending" | "done" | "error";

export function FeedbackButton() {
  const [open,    setOpen]    = useState(false);
  const [message, setMessage] = useState("");
  const [sender,  setSender]  = useState("");
  const [phase,   setPhase]   = useState<Phase>("idle");

  async function handleSubmit() {
    if (!message.trim() || phase === "sending") return;
    setPhase("sending");
    try {
      const res = await fetch("/api/feedback", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: message.trim(), sender: sender.trim() }),
      });
      if (!res.ok) throw new Error();
      setPhase("done");
      setMessage("");
      setSender("");
      setTimeout(() => { setOpen(false); setPhase("idle"); }, 2000);
    } catch {
      setPhase("error");
      setTimeout(() => setPhase("idle"), 3000);
    }
  }

  return (
    <>
      {/* 홈화면 카드 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 active:scale-[0.98] transition"
      >
        <div className="w-9 h-9 rounded-xl bg-[#EDF6EE] flex items-center justify-center text-lg shrink-0">💬</div>
        <span className="flex-1 text-left font-medium text-[#8B95A1] text-sm">의견 보내기</span>
        <span className="text-[#C2C8D0] font-bold text-lg">›</span>
      </button>

      {/* 모달 */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[50]"
            onClick={() => { if (phase !== "sending") { setOpen(false); setPhase("idle"); } }}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] bg-white rounded-3xl p-6 shadow-2xl max-w-sm mx-auto">

            {phase === "done" ? (
              /* 전송 완료 */
              <div className="text-center py-4">
                <p className="text-4xl mb-3">🎉</p>
                <p className="font-bold text-[#191F28] text-lg">의견을 보냈어요!</p>
                <p className="text-sm text-[#8B95A1] mt-1">소중한 의견 감사해요 🐾</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-[#191F28] text-base">의견 보내기</h2>
                    <p className="text-xs text-[#8B95A1] mt-0.5">앱에 대한 의견이나 제안을 알려주세요</p>
                  </div>
                  <button
                    onClick={() => { setOpen(false); setPhase("idle"); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* 이름 (선택) */}
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="이름 (선택사항)"
                  maxLength={20}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3
                             focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
                />

                {/* 의견 내용 */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="앱을 사용하면서 불편한 점이나 추가됐으면 하는 기능을 적어주세요 😊"
                  rows={5}
                  maxLength={500}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
                />
                <p className="text-right text-xs text-[#C2C8D0] mt-1 mb-4">{message.length} / 500</p>

                {phase === "error" && (
                  <p className="text-xs text-red-500 mb-3 text-center">전송에 실패했습니다. 다시 시도해주세요.</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || phase === "sending"}
                  className="w-full bg-[#3182F6] text-white font-semibold py-3.5 rounded-2xl text-sm
                             disabled:opacity-40 active:scale-95 transition"
                >
                  {phase === "sending" ? "전송 중..." : "보내기"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
