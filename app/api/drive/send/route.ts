import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createDriveClient, ensureDogFolder, countFilesInFolder } from "@/lib/google-drive";
import { Readable } from "stream";

// POST /api/drive/send — { photo_ids: string[] }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const photoIds: string[] = body.photo_ids ?? (body.photoId ? [body.photoId] : []);

  console.log(`[drive/send] ▶ 요청 수신: ${photoIds.length}장`, photoIds);

  if (photoIds.length === 0) {
    return NextResponse.json({ error: "photo_ids 필요" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 사진 + 아이 정보 일괄 조회
  const { data: photos, error: fetchErr } = await supabase
    .from("photos")
    .select("*, dog:dogs(dog_id, dog_name, drive_folder_id)")
    .in("photo_id", photoIds);

  if (fetchErr || !photos) {
    console.error("[drive/send] DB 조회 실패:", fetchErr?.message);
    return NextResponse.json({ error: "사진 조회 실패" }, { status: 500 });
  }

  console.log(`[drive/send] DB 조회 성공: ${photos.length}장`);

  // JWT 인증 환경변수 확인 (키 전체는 출력하지 않음)
  console.log("[drive/send] 환경변수 체크:", {
    email:     process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "❌ 없음",
    keyLength: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.length ?? 0,
    rootFolder: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "❌ 없음",
  });

  const drive = createDriveClient();

  // 아이별 { folderId, nextSeq } 캐시 (요청 내 중복 드라이브 API 호출 방지)
  const dogCache = new Map<string, { folderId: string; nextSeq: number }>();

  let successCount = 0;
  let failCount = 0;
  const results: { photo_id: string; saved_name?: string; drive_url?: string; error?: string }[] = [];

  for (const photo of photos) {
    const dog = photo.dog as { dog_id: string; dog_name: string; drive_folder_id: string | null } | null;

    console.log(`\n[drive/send] --- photo_id=${photo.photo_id} ---`);
    console.log(`  dog: ${dog ? `${dog.dog_name} (${dog.dog_id}), folder=${dog.drive_folder_id ?? "없음"}` : "❌ 미지정"}`);

    if (!dog) {
      await supabase.from("photos").update({ status: "failed" }).eq("photo_id", photo.photo_id);
      failCount++;
      results.push({ photo_id: photo.photo_id, error: "dog_id 미지정" });
      continue;
    }

    try {
      // ── 1. 폴더 확인/생성 ──────────────────────────────────────
      let cached = dogCache.get(dog.dog_id);

      if (!cached) {
        let folderId = dog.drive_folder_id ?? null;

        if (!folderId) {
          console.log(`  [1] 폴더 없음 → ensureDogFolder("${dog.dog_name}") 호출`);
          folderId = await ensureDogFolder(dog.dog_name);
          console.log(`  [1] 폴더 생성/확인 완료: ${folderId}`);

          await supabase
            .from("dogs")
            .update({ drive_folder_id: folderId })
            .eq("dog_id", dog.dog_id);
        } else {
          console.log(`  [1] 기존 폴더 사용: ${folderId}`);
        }

        const existingCount = await countFilesInFolder(folderId);
        console.log(`  [1] 폴더 내 기존 파일 수: ${existingCount}`);
        cached = { folderId, nextSeq: existingCount + 1 };
        dogCache.set(dog.dog_id, cached);
      }

      const { folderId, nextSeq } = cached;

      // ── 2. 파일명 생성 ─────────────────────────────────────────
      const date      = new Date(photo.created_at);
      const yy        = String(date.getFullYear()).slice(2);
      const mm        = String(date.getMonth() + 1).padStart(2, "0");
      const dd        = String(date.getDate()).padStart(2, "0");
      const seqStr    = String(nextSeq).padStart(3, "0");
      const savedName = `${yy}${mm}${dd}_${dog.dog_name}_${photo.upload_user}_${seqStr}.jpg`;
      cached.nextSeq++;
      console.log(`  [2] 저장명: ${savedName}`);

      // ── 3. Supabase Storage 다운로드 ───────────────────────────
      console.log(`  [3] Storage 다운로드: ${photo.storage_path}`);
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("dangchive")
        .download(photo.storage_path);

      if (dlErr || !fileData) {
        throw new Error(`Storage 다운로드 실패: ${dlErr?.message ?? "fileData null"}`);
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      console.log(`  [3] 다운로드 완료: ${buffer.byteLength} bytes`);
      const stream = Readable.from(buffer);

      // ── 4. 구글 드라이브 업로드 ────────────────────────────────
      console.log(`  [4] Drive 업로드 시작 → folder: ${folderId}, name: ${savedName}`);
      const driveRes = await drive.files.create({
        requestBody: { name: savedName, parents: [folderId] },
        media:       { mimeType: "image/jpeg", body: stream },
        fields:      "id, webViewLink",
      });

      const driveUrl = driveRes.data.webViewLink ?? null;
      console.log(`  [4] Drive 업로드 성공 → id=${driveRes.data.id}, url=${driveUrl}`);

      // ── 5. DB 업데이트 ─────────────────────────────────────────
      await supabase
        .from("photos")
        .update({ status: "sent", saved_name: savedName, drive_url: driveUrl })
        .eq("photo_id", photo.photo_id);

      successCount++;
      results.push({ photo_id: photo.photo_id, saved_name: savedName, drive_url: driveUrl ?? undefined });

    } catch (err) {
      // GaxiosError (googleapis) 상세 분해
      const message    = err instanceof Error ? err.message : String(err);
      const httpStatus = (err as any)?.response?.status;
      const apiErrors  = (err as any)?.response?.data?.error;

      console.error(`  ❌ 실패 - photo_id=${photo.photo_id}`);
      console.error(`     message:    ${message}`);
      if (httpStatus)  console.error(`     HTTP:       ${httpStatus}`);
      if (apiErrors)   console.error(`     API error:  ${JSON.stringify(apiErrors)}`);

      await supabase
        .from("photos")
        .update({ status: "failed" })
        .eq("photo_id", photo.photo_id);

      failCount++;
      const detail = apiErrors?.message ?? message;
      results.push({ photo_id: photo.photo_id, error: detail });
    }
  }

  console.log(`\n[drive/send] ✅ 완료: 성공 ${successCount}장 / 실패 ${failCount}장`);
  return NextResponse.json({ success_count: successCount, fail_count: failCount, results });
}
