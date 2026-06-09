import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/dog-requests/count — 누구나 접근 가능, pending 건수만 반환
export async function GET() {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from("dog_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) return NextResponse.json({ count: 0 });

  return NextResponse.json({ count: count ?? 0 });
}
