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

  // 해당 status 사진 전체 조회
  const { data: photos, error: photosErr } = await supabase
    .from("photos")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (photosErr) {
    return NextResponse.json({ error: photosErr.message }, { status: 500 });
  }
  if (!photos || photos.length === 0) {
    return NextResponse.json({ batches: [] });
  }

  // 고유 batch_id 추출
  const batchIds = Array.from(new Set(photos.map((p) => p.batch_id)));

  // 배치 레코드 조회
  const { data: batchRecords, error: batchErr } = await supabase
    .from("batches")
    .select("*")
    .in("batch_id", batchIds)
    .order("created_at", { ascending: false });

  if (batchErr) {
    return NextResponse.json({ error: batchErr.message }, { status: 500 });
  }

  // photo를 batch_id별로 그루핑
  const byBatch = new Map<string, typeof photos>();
  for (const photo of photos) {
    const arr = byBatch.get(photo.batch_id) ?? [];
    arr.push(photo);
    byBatch.set(photo.batch_id, arr);
  }

  // 최종 응답: 배치 + 사진 목록 + 썸네일
  const batches = (batchRecords ?? [])
    .filter((b) => byBatch.has(b.batch_id))
    .map((b) => {
      const batchPhotos = byBatch.get(b.batch_id) ?? [];
      return {
        ...b,
        photos:         batchPhotos,
        photo_count:    batchPhotos.length,
        thumbnail_path: batchPhotos[0]?.storage_path ?? null,
      };
    });

  return NextResponse.json({ batches });
}
