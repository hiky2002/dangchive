import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { renameDriveFolder } from "@/lib/google-drive";

type Params = { params: Promise<{ dog_id: string }> };

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_PASSWORD;
}

// PATCH /api/dogs/[dog_id] — { dog_name } (관리자 전용)
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isAdmin(req)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { dog_id } = await params;
  const { dog_name } = await req.json();

  if (!dog_name?.trim()) {
    return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 기존 폴더 ID 조회
  const { data: existing } = await supabase
    .from("dogs")
    .select("drive_folder_id")
    .eq("dog_id", dog_id)
    .single();

  // DB 이름 업데이트
  const { data, error } = await supabase
    .from("dogs")
    .update({ dog_name: dog_name.trim() })
    .eq("dog_id", dog_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Drive 폴더명 변경
  if (existing?.drive_folder_id) {
    try {
      await renameDriveFolder(existing.drive_folder_id, dog_name.trim());
    } catch (e) {
      console.error("[PATCH dogs] Drive 폴더명 변경 실패:", e);
    }
  }

  return NextResponse.json({ dog: data });
}

// DELETE /api/dogs/[dog_id] (관리자 전용)
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!isAdmin(req)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { dog_id } = await params;

  const supabase = createServiceClient();
  const { error } = await supabase.from("dogs").delete().eq("dog_id", dog_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
