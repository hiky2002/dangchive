import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_PASSWORD;
}

// GET /api/dog-requests?status=pending  (관리자 전용)
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("dog_requests")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data });
}

// POST /api/dog-requests — { type, requester, dog_id?, current_name?, requested_name }
export async function POST(req: NextRequest) {
  const { type, requester, dog_id, current_name, requested_name } = await req.json();

  if (!type || !requested_name?.trim()) {
    return NextResponse.json({ error: "필수 값 누락" }, { status: 400 });
  }
  if (type === "rename" && !dog_id) {
    return NextResponse.json({ error: "rename 요청에는 dog_id가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("dog_requests")
    .insert({
      type,
      requester: requester?.trim() || "봉사자",
      dog_id: dog_id ?? null,
      current_name: current_name ?? null,
      requested_name: requested_name.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ request: data }, { status: 201 });
}
