import { NextResponse } from "next/server";
import { listRootFolders } from "@/lib/google-drive";

// "26_0075 순대" → "순대" (공백 기준 마지막 단어)
function parseDogName(folderName: string): string {
  const parts = folderName.trim().split(" ");
  return parts[parts.length - 1];
}

// GET /api/drive/folders
export async function GET() {
  try {
    const raw = await listRootFolders();
    const folders = raw.map((f) => ({
      folder_id:   f.id,
      folder_name: f.name,
      dog_name:    parseDogName(f.name),
    }));
    return NextResponse.json({ folders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
