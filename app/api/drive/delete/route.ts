import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { trashDriveFile } from "@/lib/google-drive";

// drive_url 에서 파일 ID 추출
// "https://drive.google.com/file/d/FILE_ID/view?usp=..." → "FILE_ID"
function extractFileId(driveUrl: string | null): string | null {
  if (!driveUrl) return null;
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

// POST /api/drive/delete — { photo_ids: string[] }
export async function POST(req: NextRequest) {
  const body     = await req.json();
  const photoIds: string[] = body.photo_ids ?? [];
  if (photoIds.length === 0) {
    return NextResponse.json({ error: "photo_ids 필요" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // DB에서 해당 사진 조회 (sent 상태여야 함)
  const { data: photos, error: fetchErr } = await supabase
    .from("photos")
    .select("photo_id, drive_url, saved_name")
    .in("photo_id", photoIds)
    .eq("status", "sent");

  if (fetchErr || !photos) {
    return NextResponse.json({ error: "사진 조회 실패" }, { status: 500 });
  }

  let successCount = 0;
  let failCount    = 0;
  const results: { photo_id: string; ok: boolean; error?: string }[] = [];

  for (const photo of photos) {
    const fileId = extractFileId(photo.drive_url);

    // Drive 삭제는 베스트에포트 (실패해도 DB는 항상 업데이트)
    let driveError: string | undefined;
    if (fileId) {
      try {
        await trashDriveFile(fileId);
      } catch (err) {
        driveError = err instanceof Error ? err.message : String(err);
        console.warn(`[drive/delete] Drive 삭제 실패 (계속 진행): ${photo.photo_id} — ${driveError}`);
      }
    }

    // DB 상태는 Drive 성공 여부와 무관하게 항상 "deleted"로
    const { error: dbErr } = await supabase
      .from("photos")
      .update({ status: "deleted", drive_url: null, saved_name: null })
      .eq("photo_id", photo.photo_id);

    if (dbErr) {
      console.error(`[drive/delete] DB 업데이트 실패: ${photo.photo_id} — ${dbErr.message}`);
      failCount++;
      results.push({ photo_id: photo.photo_id, ok: false, error: dbErr.message });
    } else {
      successCount++;
      results.push({ photo_id: photo.photo_id, ok: true, ...(driveError ? { driveError } : {}) });
    }
  }

  return NextResponse.json({ success_count: successCount, fail_count: failCount, results });
}
