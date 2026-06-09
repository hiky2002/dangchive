import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
// GET /api/batches?status=needs_name
//
// needs_name 사진을 가진 배치 목록 반환
// 각 배치에 photos[], photo_count, thumbnail_path 포함
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "needs_name";
  const supabase = createServiceClient();

  // photos + batch 를 한 번에 조회 (2쿼리 → 1쿼리)
  // 필요한 컬럼만 select, batch 정보는 FK embed로 인라인 처리
  const { data: photos, error } = await supabase
    .from("photos")
    .select(
      "photo_id, batch_id, storage_path, file_name, status, created_at, batch:batches(batch_id, upload_user, status, created_at)"
    )
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!photos || photos.length === 0) {
    return NextResponse.json({ batches: [] });
  }

  // batch_id별 그루핑 (Map으로 O(n))
  const batchMap = new Map<string, any>();
  for (const photo of photos as any[]) {
    if (!batchMap.has(photo.batch_id)) {
      batchMap.set(photo.batch_id, {
        ...photo.batch,
        photos:         [],
        photo_count:    0,
        thumbnail_path: null,
      });
    }
    const entry = batchMap.get(photo.batch_id);
    const { batch: _, ...photoFields } = photo;
    entry.photos.push(photoFields);
    entry.photo_count++;
    if (!entry.thumbnail_path) entry.thumbnail_path = photo.storage_path;
  }

  // 배치 생성일 내림차순
  const batches = Array.from(batchMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ batches });
}
