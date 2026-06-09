import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { listRootFolders } from "@/lib/google-drive";

// "26_0075 순대" → "순대" (공백 기준 마지막 단어)
function parseDogName(folderName: string): string {
  const parts = folderName.trim().split(" ");
  return parts[parts.length - 1];
}

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

    const toInsert: { dog_name: string; drive_folder_id: string }[] = [];
    const toUpdate: { dog_id: string; drive_folder_id: string }[]   = [];

    for (const folder of driveFolders) {
      if (folderIdSet.has(folder.id)) continue;

      const dogName = parseDogName(folder.name);
      const existingId = nameToId.get(dogName);

      if (existingId) {
        toUpdate.push({ dog_id: existingId, drive_folder_id: folder.id });
      } else {
        toInsert.push({ dog_name: dogName, drive_folder_id: folder.id });
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

    return NextResponse.json({ added: inserted.length, updated, dogs: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
