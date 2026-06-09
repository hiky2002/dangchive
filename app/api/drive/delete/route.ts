import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createDriveClient } from "@/lib/google-drive";

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
  const drive    = createDriveClient();

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
    try {
      if (fileId) {
        // Drive에서 파일 삭제 (휴지통으로 이동)
        await drive.files.update({
          fileId,
          requestBody: { trashed: true },
          supportsAllDrives: true,
        });
      }
      // DB 상태를 "deleted"로 변경
      await supabase
        .from("photos")
        .update({ status: "deleted", drive_url: null, saved_name: null })
        .eq("photo_id", photo.photo_id);

      successCount++;
      results.push({ photo_id: photo.photo_id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[drive/delete] ❌ ${photo.photo_id}: ${message}`);
      failCount++;
      results.push({ photo_id: photo.photo_id, ok: false, error: message });
    }
  }

  return NextResponse.json({ success_count: successCount, fail_count: failCount, results });
}
