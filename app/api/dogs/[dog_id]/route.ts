import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

type Params = { params: Promise<{ dog_id: string }> };

// PATCH /api/dogs/[dog_id] — { dog_name }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { dog_id } = await params;
  const { dog_name } = await req.json();

  if (!dog_name?.trim()) {
    return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("dogs")
    .update({ dog_name: dog_name.trim() })
    .eq("dog_id", dog_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dog: data });
}

// DELETE /api/dogs/[dog_id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { dog_id } = await params;

  const supabase = createServiceClient();
  const { error } = await supabase.from("dogs").delete().eq("dog_id", dog_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
