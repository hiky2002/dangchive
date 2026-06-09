import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body    = await req.json();
  const message = (body.message ?? "").trim();
  const sender  = (body.sender  ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "내용을 입력해주세요" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── 1. DB 저장
  const { error: dbErr } = await supabase
    .from("feedback")
    .insert({ message, sender: sender || null });

  if (dbErr) {
    console.error("[feedback] DB 저장 실패:", dbErr.message);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  // ── 2. 이메일 알림 (RESEND_API_KEY 있을 때만)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — resend는 `npm install resend` 후 사용 가능
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);

      await resend.emails.send({
        from:    "댕카이브 <onboarding@resend.dev>",
        to:      ["hiky2002@gmail.com"],
        subject: "💌 댕카이브 새 의견이 도착했어요",
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; padding: 24px; color: #191F28;">
            <h2 style="margin: 0 0 16px; font-size: 18px;">🐾 댕카이브 피드백</h2>
            ${sender ? `<p style="margin: 0 0 8px; color: #8B95A1; font-size: 13px;">보낸 사람: <strong style="color: #191F28;">${sender}</strong></p>` : ""}
            <div style="background: #F5F5F5; border-radius: 12px; padding: 16px; margin: 12px 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
            <p style="color: #C2C8D0; font-size: 12px; margin: 12px 0 0;">${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
          </div>
        `,
      });
    } catch (e) {
      // 이메일 실패해도 DB 저장은 성공으로 처리
      console.warn("[feedback] 이메일 전송 실패 (DB 저장은 완료):", e);
    }
  }

  return NextResponse.json({ ok: true });
}
