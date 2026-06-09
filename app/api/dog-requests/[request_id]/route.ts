import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { renameDriveFolder, ensureDogFolder } from "@/lib/google-drive";

type Params = { params: Promise<{ request_id: string }> };

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_PASSWORD;
}

// GET /api/dog-requests/[request_id] — 누구나 status 조회 가능 (봉사자 폴링용)
export async function GET(_req: NextRequest, { params }: Params) {
  const { request_id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("dog_requests")
    .select("request_id, status, requested_name, type")
    .eq("request_id", request_id)
    .single();

  if (error || !data) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({ request: data });
}

// PATCH /api/dog-requests/[request_id] — { action: 'approve' | 'reject' }
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isAdmin(req)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { request_id } = await params;
  const { action } = await req.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action은 approve 또는 reject" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 요청 조회
  const { data: reqRow, error: fetchErr } = await supabase
    .from("dog_requests")
    .select("*")
    .eq("request_id", request_id)
    .single();

  if (fetchErr || !reqRow) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (reqRow.status !== "pending") return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 409 });

  // 거절
  if (action === "reject") {
    await supabase.from("dog_requests").update({ status: "rejected" }).eq("request_id", request_id);
    return NextResponse.json({ ok: true });
  }

  // 승인
  try {
    if (reqRow.type === "rename" && reqRow.dog_id) {
      // 1. DB 이름 변경
      const { data: dog } = await supabase
        .from("dogs")
        .select("drive_folder_id")
        .eq("dog_id", reqRow.dog_id)
        .single();

      await supabase
        .from("dogs")
        .update({ dog_name: reqRow.requested_name })
        .eq("dog_id", reqRow.dog_id);

      // 2. Drive 폴더명 변경
      if (dog?.drive_folder_id) {
        await renameDriveFolder(dog.drive_folder_id, reqRow.requested_name);
      }
    } else if (reqRow.type === "add") {
      // 새 아이 추가
      const { data: newDog } = await supabase
        .from("dogs")
        .insert({ dog_name: reqRow.requested_name })
        .select()
        .single();

      if (newDog) {
        try {
          const folderId = await ensureDogFolder(newDog.dog_name);
          await supabase
            .from("dogs")
            .update({ drive_folder_id: folderId })
            .eq("dog_id", newDog.dog_id);
        } catch {
          // 폴더 생성 실패해도 아이 등록은 유지
        }
      }
    }

    await supabase.from("dog_requests").update({ status: "approved" }).eq("request_id", request_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `승인 처리 실패: ${msg}` }, { status: 500 });
  }
}
