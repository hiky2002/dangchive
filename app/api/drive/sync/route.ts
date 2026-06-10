import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { listRootFolders } from "@/lib/google-drive";

// POST /api/drive/sync — 드라이브 폴더 → dogs 테이블 동기화
export async function POST() {
  try {
    const supabase = createServiceClient();

    const { data: existingDogs, error: dbErr } = await supabase
      .from("dogs")
      .select("dog_id, dog_name, drive_folder_id");

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    const existing = existingDogs ?? [];
    const nameToId    = new Map(existing.map((d) => [d.dog_name, d.dog_id]));
    const folderIdSet = new Set(existing.map((d) => d.drive_folder_id).filter(Boolean));

    const driveFolders = await listRootFolders();
    console.log(`[sync] 드라이브 폴더 ${driveFolders.length}개, DB 아이 ${existing.length}마리`);

    const toInsert: { dog_name: string; drive_folder_id: string }[] = [];
    const toUpdate: { dog_id: string; drive_folder_id: string }[]   = [];

    for (const folder of driveFolders) {
      if (folderIdSet.has(folder.id)) continue;

      const existingId = nameToId.get(folder.name);

      if (existingId) {
        toUpdate.push({ dog_id: existingId, drive_folder_id: folder.id });
      } else {
        toInsert.push({ dog_name: folder.name, drive_folder_id: folder.id });
      }
    }

    let inserted: any[] = [];
    let updated = 0;

    if (toInsert.length > 0) {
      const { data, error: insertErr } = await supabase
        .from("dogs")
        .insert(toInsert)
        .select();
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      inserted = data ?? [];
    }

    for (const { dog_id, drive_folder_id } of toUpdate) {
      const { error: updateErr } = await supabase
        .from("dogs")
        .update({ drive_folder_id })
        .eq("dog_id", dog_id);
      if (!updateErr) updated++;
    }

    // ── Drive에 없는 아이 DB에서 제거
    // drive_folder_id가 있는데 Drive 폴더 목록에 없으면 삭제
    const driveFolderIds = new Set(driveFolders.map((f) => f.id));
    const toRemove = existing.filter(
      (d) => d.drive_folder_id && !driveFolderIds.has(d.drive_folder_id)
    );

    let removed = 0;
    if (toRemove.length > 0) {
      const removeIds = toRemove.map((d) => d.dog_id);
      const { error: removeErr } = await supabase
        .from("dogs")
        .delete()
        .in("dog_id", removeIds);
      if (!removeErr) {
        removed = toRemove.length;
        console.log(`[sync] Drive에 없는 아이 ${removed}마리 제거:`, toRemove.map((d) => d.dog_name));
      }
    }

    return NextResponse.json({ added: inserted.length, updated, removed, dogs: inserted });
  } catch (err) {
    const message    = err instanceof Error ? err.message : String(err);
    const httpStatus = (err as any)?.response?.status;
    const apiError   = (err as any)?.response?.data?.error;
    console.error("[sync] 오류:", message, httpStatus ? `HTTP ${httpStatus}` : "", apiError ? JSON.stringify(apiError) : "");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
