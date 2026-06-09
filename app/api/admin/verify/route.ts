import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/verify — { password }
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correct = process.env.ADMIN_PASSWORD;

  if (!correct) {
    return NextResponse.json({ error: "관리자 비밀번호가 서버에 설정되지 않았습니다." }, { status: 500 });
  }

  if (password !== correct) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
