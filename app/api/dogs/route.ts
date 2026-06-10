import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { ensureDogFolder } from "@/lib/google-drive";

// GET /api/dogs
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("dogs")
    .select("dog_id, dog_name, drive_folder_id, created_at")
    .order("dog_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dogs: data });
}

// POST /api/dogs — { dog_name }
export async function POST(req: NextRequest) {
  const { dog_name } = await req.json();
  if (!dog_name?.trim()) {
    return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("dogs")
    .insert({ dog_name: dog_name.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 드라이브 폴더 생성 후 drive_folder_id 저장 (실패해도 dog 등록은 유지)
  try {
    const folderId = await ensureDogFolder(data.dog_name);
    const { data: updated } = await supabase
      .from("dogs")
      .update({ drive_folder_id: folderId })
      .eq("dog_id", data.dog_id)
      .select()
      .single();
    return NextResponse.json({ dog: updated ?? data }, { status: 201 });
  } catch {
    return NextResponse.json({ dog: data }, { status: 201 });
  }
}

// DELETE /api/dogs — { dog_id }
export async function DELETE(req: NextRequest) {
  const { dog_id } = await req.json();
  if (!dog_id) return NextResponse.json({ error: "dog_id 필요" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("dogs").delete().eq("dog_id", dog_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
