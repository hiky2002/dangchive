import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/dogs
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("dogs")
    .select("*")
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

  return NextResponse.json({ dog: data }, { status: 201 });
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
