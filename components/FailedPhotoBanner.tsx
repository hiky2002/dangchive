"use client";

import { useState, useEffect, useCallback } from "react";
import type { Photo } from "@/types";

function getPhotoUrl(path: string, width = 300) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/dangchive/${path}?width=${width}&quality=75`;
}

export function FailedPhotoBanner() {
  const [photos,    setPhotos]    = useState<Photo[]>([]);
  const [expanded,  setExpanded]  = useState(false);
  const [retrying,  setRetrying]  = useState(false);
  const [retryMsg,  setRetryMsg]  = useState<string | null>(null);

  const fetchFailed = useCallback(async () => {
    try {
      const res  = await fetch("/api/upload?status=failed");
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchFailed(); }, [fetchFailed]);

  if (photos.length === 0) return null;

  async function handleRetry() {
    setRetrying(true);
    setRetryMsg(null);
    try {
      const res  = await fetch("/api/drive/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ photo_ids: photos.map((p) => p.photo_id) }),
      });
      const data = await res.json();
      if (data.success_count > 0 && data.fail_count === 0) {
        setRetryMsg(`✅ ${data.success_count}장 전송 완료!`);
      } else if (data.success_count > 0) {
        setRetryMsg(`${data.success_count}장 성공 / ${data.fail_count}장 이름 확인 페이지로 이동됨`);
      } else {
        // 모두 아이 미지정 → needs_name으로 바뀌었으므로 이름 확인 페이지에서 처리
        setRetryMsg("아이 이름이 없는 사진은 이름 확인 페이지에서 다시 지정해 주세요 →");
      }
    } catch {
      setRetryMsg("전송 중 오류가 발생했습니다.");
    } finally {
      setRetrying(false);
      await fetchFailed(); // 상태 갱신
    }
  }

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-red-100 bg-red-50 overflow-hidden">

      {/* 배너 헤더 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-red-100 transition-colors"
      >
        <span className="text-base shrink-0">⚠️</span>
        <span className="flex-1 text-sm font-semibold text-red-700">
          전송 실패 사진 {photos.length}장
        </span>
        <span className="text-[11px] text-red-400 shrink-0">
          {expanded ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>

      {/* 확장 패널 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-red-100">

          {/* 썸네일 그리드 */}
          <div className="grid grid-cols-4 gap-1.5 mt-3 mb-3">
            {photos.slice(0, 8).map((photo) => (
              <div
                key={photo.photo_id}
                className="relative aspect-square rounded-lg overflow-hidden bg-red-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPhotoUrl(photo.storage_path)}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-red-400/20" />
              </div>
            ))}
            {photos.length > 8 && (
              <div className="aspect-square rounded-lg bg-red-100 flex items-center justify-center">
                <span className="text-xs font-semibold text-red-500">+{photos.length - 8}</span>
              </div>
            )}
          </div>

          {/* 재시도 결과 */}
          {retryMsg && (
            <p className="text-xs text-center text-red-600 mb-2 font-medium">{retryMsg}</p>
          )}

          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full bg-red-500 text-white text-sm font-semibold py-3 rounded-xl
                       disabled:opacity-50 active:scale-95 transition"
          >
            {retrying ? "전송 중..." : `🔄 다시 시도 (${photos.length}장)`}
          </button>
        </div>
      )}

    </div>
  );
}
