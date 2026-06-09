import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
// GET /api/upload?status=...&batch_id=...&upload_user=...
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status     = searchParams.get("status") ?? "needs_name";
  const batchId    = searchParams.get("batch_id");
  const uploadUser = searchParams.get("upload_user");

  const supabase = createServiceClient();

  // photos + photo_dogs → dogs 를 한 번에 조회
  // photo_dogs 내부 dogs join은 dog_id FK 하나뿐이라 모호성 없음
  let query = supabase
    .from("photos")
    .select(
      "photo_id, batch_id, dog_id, file_name, saved_name, upload_user, storage_path, status, drive_url, created_at, photo_dogs(dog:dogs(dog_id, dog_name, drive_folder_id, created_at))"
    )
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (batchId)    query = query.eq("batch_id", batchId);
  if (uploadUser) query = query.eq("upload_user", uploadUser);

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/upload] query failed:", {
      message: error.message,
      code:    (error as any).code,
    });
    return NextResponse.json(
      { error: error.message, code: (error as any).code },
      { status: 500 }
    );
  }

  const photos = (data ?? []).map((p: any) => {
    const { photo_dogs: pdRows, ...rest } = p;
    const dogs = (pdRows ?? []).map((pd: any) => pd.dog).filter(Boolean);
    return { ...rest, dog: dogs[0] ?? null, dogs };
  });

  return NextResponse.json({ photos });
}

// ─────────────────────────────────────────────────────────────
// POST /api/upload
// FormData:
//   file        — 파일 1장 (File)
//   file_name   — 원본 파일명 (한글 보존용)
//   upload_user — 닉네임
//   batch_id    — (선택) 기존 배치 ID. 없으면 새 배치 생성
//
// 프론트엔드는 파일을 1장씩 순차 전송하며,
// 첫 응답의 batch_id를 이후 요청에 재사용함.
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const formData       = await req.formData();
  const file           = formData.get("file") as File | null;
  const fileName       = (formData.get("file_name") as string | null) ?? file?.name ?? "unknown";
  const uploadUser     = (formData.get("upload_user") as string | null)?.trim() ?? "anonymous";
  const existingBatchId = (formData.get("batch_id") as string | null)?.trim() || null;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── 1. 배치 확보 (기존 ID 재사용 또는 신규 생성)
  let batchId: string;

  if (existingBatchId) {
    batchId = existingBatchId;
  } else {
    const { data: batch, error: batchErr } = await supabase
      .from("batches")
      .insert({ upload_user: uploadUser, status: "pending" })
      .select("batch_id")
      .single();

    if (batchErr || !batch) {
      return NextResponse.json(
        { error: batchErr?.message ?? "배치 생성 실패" },
        { status: 500 }
      );
    }
    batchId = batch.batch_id;
  }

  // ── 2. Storage 업로드
  const timestamp = Date.now();
  // encodeURIComponent 사용 금지 — Supabase JS 클라이언트가 HTTP 요청 시
  // 경로를 한 번 더 인코딩하므로 미리 인코딩하면 이중 인코딩(400 invalid key)이 발생함
  const safeName    = fileName.replace(/[/\\]/g, "_"); // 경로 구분자만 치환
  const storagePath = `photos/${batchId}/${timestamp}_${safeName}`;

  const { error: storageErr } = await supabase.storage
    .from("dangchive")
    .upload(
      storagePath,
      file, // arrayBuffer() 변환 없이 File 객체 직접 전달 — 스트림 안정성 확보
      { contentType: file.type || "image/jpeg" } // type 누락 시 fallback
    );

  if (storageErr) {
    console.error("[upload] storage error:", storageErr.message);
    await supabase.from("photos").insert({
      batch_id:     batchId,
      file_name:    fileName,
      upload_user:  uploadUser,
      storage_path: storagePath,
      status:       "failed",
    });
    return NextResponse.json(
      { error: `Storage 업로드 실패: ${storageErr.message}`, batch_id: batchId },
      { status: 500 }
    );
  }

  // ── 3. photos 레코드 생성
  const { data: photo, error: dbErr } = await supabase
    .from("photos")
    .insert({
      batch_id:     batchId,
      file_name:    fileName,
      upload_user:  uploadUser,
      storage_path: storagePath,
      status:       "temp",
    })
    .select("photo_id")
    .single();

  if (dbErr || !photo) {
    await supabase.storage.from("dangchive").remove([storagePath]);
    return NextResponse.json(
      { error: dbErr?.message ?? "DB 오류", batch_id: batchId },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { batch_id: batchId, photo_id: photo.photo_id },
    { status: 201 }
  );
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/upload
//   이름 지정: { photoId, dogIds: string[] }     → status: 'named'
//   (하위호환) { photoId, dogId: string }        → status: 'named'
//   누구예요:  { photoId, status: 'needs_name' } → status: 'needs_name'
// ─────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { photoId, dogId, dogIds, status } = await req.json();
  if (!photoId) {
    return NextResponse.json({ error: "photoId 필요" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 이름 지정
  const ids: string[] = dogIds ?? (dogId ? [dogId] : []);
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("photos")
      .update({ dog_id: ids[0], status: "named" })
      .eq("photo_id", photoId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // photo_dogs 갱신 (삭제 후 재삽입)
    await supabase.from("photo_dogs").delete().eq("photo_id", photoId);
    const { error: pdErr } = await supabase.from("photo_dogs").insert(
      ids.map((did) => ({ photo_id: photoId, dog_id: did }))
    );
    if (pdErr) return NextResponse.json({ error: pdErr.message }, { status: 500 });

    return NextResponse.json({ photo: data });
  }

  // needs_name
  if (status === "needs_name") {
    const { data, error } = await supabase
      .from("photos")
      .update({ status: "needs_name" })
      .eq("photo_id", photoId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ photo: data });
  }

  return NextResponse.json(
    { error: "dogIds 또는 status:'needs_name' 중 하나가 필요합니다." },
    { status: 400 }
  );
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/upload — { photo_ids: string[] }
// temp 상태 사진만 삭제 가능 (Storage + photo_dogs + photos)
// ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { photo_ids } = await req.json();
  if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
    return NextResponse.json({ error: "photo_ids 필요" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // temp 상태인 사진만 조회
  const { data: photos, error: fetchErr } = await supabase
    .from("photos")
    .select("photo_id, storage_path, status")
    .in("photo_id", photo_ids)
    .eq("status", "temp");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: "삭제 가능한 사진이 없습니다 (temp 상태만 삭제 가능)" }, { status: 400 });
  }

  const ids = photos.map((p) => p.photo_id);

  // 1. Storage 삭제
  const storagePaths = photos.map((p) => p.storage_path);
  await supabase.storage.from("dangchive").remove(storagePaths);

  // 2. photo_dogs 삭제
  await supabase.from("photo_dogs").delete().in("photo_id", ids);

  // 3. photos 삭제
  const { error: delErr } = await supabase.from("photos").delete().in("photo_id", ids);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ deleted: ids.length });
}
