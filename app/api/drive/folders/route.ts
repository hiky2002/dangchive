import { NextResponse } from "next/server";
import { listRootFolders } from "@/lib/google-drive";

// GET /api/drive/folders
export async function GET() {
  try {
    const raw = await listRootFolders();
    const folders = raw.map((f) => ({
      folder_id:   f.id,
      folder_name: f.name,
    }));
    return NextResponse.json({ folders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
