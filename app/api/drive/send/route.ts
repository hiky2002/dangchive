import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createDriveClient, ensureDogFolder, countFilesInFolder, sharedDriveParams } from "@/lib/google-drive";
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

  // ── photos 조회 ──────────────────────────────────────────────
  const { data: photos, error: fetchErr } = await supabase
    .from("photos")
    .select("photo_id, storage_path, created_at")
    .in("photo_id", photoIds);

  if (fetchErr || !photos) {
    console.error("[drive/send] photos 조회 실패:", fetchErr?.message);
    return NextResponse.json({ error: "사진 조회 실패" }, { status: 500 });
  }

  // ── photo_dogs → dogs 별도 조회 (다대다 명시적 join) ─────────
  const { data: pdRows, error: pdErr } = await supabase
    .from("photo_dogs")
    .select("photo_id, dog_id, dogs(dog_id, dog_name, drive_folder_id)")
    .in("photo_id", photoIds);

  if (pdErr) {
    console.error("[drive/send] photo_dogs 조회 실패:", pdErr.message);
    return NextResponse.json({ error: "photo_dogs 조회 실패" }, { status: 500 });
  }

  console.log(`[drive/send] DB 조회 성공: photos=${photos.length}장, photo_dogs=${pdRows?.length ?? 0}건`);
  console.log("[drive/send] photo_dogs raw:", JSON.stringify(pdRows?.slice(0, 5)));

  type DogInfo = { dog_id: string; dog_name: string; drive_folder_id: string | null };

  // photo_id → DogInfo[] 맵 구성
  const dogsByPhoto = new Map<string, DogInfo[]>();
  for (const row of pdRows ?? []) {
    const dog = (row as any).dogs as DogInfo | null;
    if (!dog) continue;
    const arr = dogsByPhoto.get(row.photo_id) ?? [];
    arr.push(dog);
    dogsByPhoto.set(row.photo_id, arr);
  }

  console.log(`[drive/send] 아이 매핑: ${dogsByPhoto.size}장에 아이 지정됨`);

  console.log("[drive/send] 환경변수 체크:", {
    serviceEmail:  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "✅" : "❌ 없음",
    privateKey:    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? "✅" : "❌ 없음",
    rootFolder:    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "❌ 없음",
    sharedDriveId: process.env.GOOGLE_SHARED_DRIVE_ID ?? "❌ 없음",
  });

  const drive = createDriveClient();

  // 아이별 { folderId, nextSeq } 캐시 (요청 내 중복 드라이브 API 호출 방지)
  const dogCache = new Map<string, { folderId: string; nextSeq: number }>();

  let successCount = 0;
  let failCount = 0;
  const results: { photo_id: string; saved_name?: string; drive_url?: string; error?: string }[] = [];

  // 사진 3장씩 병렬 처리
  const CONCURRENCY = 3;
  for (let i = 0; i < photos.length; i += CONCURRENCY) {
    const chunk = photos.slice(i, i + CONCURRENCY);

    const chunkResults = await Promise.all(
      chunk.map(async (photo) => {
        const dogs: DogInfo[] = dogsByPhoto.get(photo.photo_id) ?? [];

        console.log(`[drive/send] photo_id=${photo.photo_id} dogs: ${dogs.map(d => d.dog_name).join(", ") || "❌ 미지정"}`);

        if (dogs.length === 0) {
          await supabase.from("photos").update({ status: "failed" }).eq("photo_id", photo.photo_id);
          return { ok: false, photo_id: photo.photo_id, error: "dog_id 미지정" };
        }

        try {
          // ── 1. Supabase Storage 다운로드
          const { data: fileData, error: dlErr } = await supabase.storage
            .from("dangchive")
            .download(photo.storage_path);
          if (dlErr || !fileData) throw new Error(`Storage 다운로드 실패: ${dlErr?.message ?? "fileData null"}`);
          const buffer = Buffer.from(await fileData.arrayBuffer());

          // ── 2. 파일명 생성
          const date     = new Date(photo.created_at);
          const yy       = String(date.getFullYear()).slice(2);
          const mm       = String(date.getMonth() + 1).padStart(2, "0");
          const dd       = String(date.getDate()).padStart(2, "0");
          const dogNames = dogs.map(d => d.dog_name).join("_");

          // ── 3. 각 아이 폴더에 업로드
          let firstDriveUrl: string | null = null;
          for (const dog of dogs) {
            let cached = dogCache.get(dog.dog_id);
            if (!cached) {
              let folderId = dog.drive_folder_id ?? null;
              if (!folderId) {
                folderId = await ensureDogFolder(dog.dog_name);
                await supabase.from("dogs").update({ drive_folder_id: folderId }).eq("dog_id", dog.dog_id);
              }
              const existingCount = await countFilesInFolder(folderId);
              cached = { folderId, nextSeq: existingCount + 1 };
              dogCache.set(dog.dog_id, cached);
            }
            const { folderId, nextSeq } = cached;
            const seqStr    = String(nextSeq).padStart(3, "0");
            const savedName = `${yy}${mm}${dd}_${dogNames}_${seqStr}.jpg`;
            cached.nextSeq++;

            const stream = Readable.from(buffer);
            const driveRes = await drive.files.create({
              requestBody: { name: savedName, parents: [folderId] },
              media:       { mimeType: "image/jpeg", body: stream },
              fields:      "id, webViewLink",
              supportsAllDrives: true,
            });
            if (!firstDriveUrl) firstDriveUrl = driveRes.data.webViewLink ?? null;
            console.log(`[drive/send] ✅ ${photo.photo_id} → ${driveRes.data.id}`);
          }

          // ── 4. DB 업데이트
          const finalName = `${yy}${mm}${dd}_${dogNames}_001.jpg`;
          await supabase
            .from("photos")
            .update({ status: "sent", saved_name: finalName, drive_url: firstDriveUrl })
            .eq("photo_id", photo.photo_id);

          return { ok: true, photo_id: photo.photo_id, saved_name: finalName, drive_url: firstDriveUrl ?? undefined };

        } catch (err) {
          const message   = err instanceof Error ? err.message : String(err);
          const apiErrors = (err as any)?.response?.data?.error;
          console.error(`[drive/send] ❌ ${photo.photo_id}: ${message}`);
          await supabase.from("photos").update({ status: "failed" }).eq("photo_id", photo.photo_id);
          return { ok: false, photo_id: photo.photo_id, error: (apiErrors as any)?.message ?? message };
        }
      })
    );

    for (const r of chunkResults) {
      if (r.ok) { successCount++; results.push({ photo_id: r.photo_id, saved_name: r.saved_name, drive_url: r.drive_url }); }
      else       { failCount++;    results.push({ photo_id: r.photo_id, error: r.error }); }
    }
  }

  console.log(`[drive/send] ✅ 완료: 성공 ${successCount}장 / 실패 ${failCount}장`);
  return NextResponse.json({ success_count: successCount, fail_count: failCount, results });
}
