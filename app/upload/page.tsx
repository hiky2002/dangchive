"use client";

import { useState, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnline } from "@/hooks/useOnline";

// ─── 타입 ────────────────────────────────────────────────────
type CompressState = "pending" | "compressing" | "done" | "error";
type UploadState   = "idle" | "done" | "error";
type Phase         = "idle" | "compressing" | "ready" | "uploading" | "done";

type FileItem = {
  id: string;
  original: File;
  compressed: File | null;
  previewUrl: string | null;
  compressState: CompressState;
  uploadState: UploadState;
};

// ─── 상수 ────────────────────────────────────────────────────
const MAX_FILES = 50;
const COMPRESS_OPTIONS = {
  maxWidthOrHeight: 1600,
  initialQuality: 0.75,
  maxSizeMB: 0.8,
  useWebWorker: true,
} as const;

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function UploadPage() {
  const router   = useRouter();
  const online   = useOnline();
  const inputRef        = useRef<HTMLInputElement>(null);
  const previewUrlsRef  = useRef<string[]>([]);

  const nickname = "봉사자";
  const [batchId, setBatchId] = useState<string | null>(null);
  const [items,        setItems]        = useState<FileItem[]>([]);
  const [phase,        setPhase]        = useState<Phase>("idle");
  const [compressProg, setCompressProg] = useState({ done: 0, total: 0 });
  const [uploadProg,   setUploadProg]   = useState({ done: 0, total: 0 });
  const [error,        setError]        = useState<string | null>(null);


  // 언마운트 시 ObjectURL 해제
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);


  // ── 파일 선택 → 순차 압축
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_FILES);
    if (selected.length === 0) return;

    // 이전 미리보기 URL 해제
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];

    setError(null);
    setPhase("compressing");
    setCompressProg({ done: 0, total: selected.length });

    const list: FileItem[] = selected.map((f, i) => ({
      id: `${Date.now()}_${i}`,
      original: f,
      compressed: null,
      previewUrl: null,
      compressState: "pending",
      uploadState: "idle",
    }));
    setItems([...list]);

    // 3개씩 병렬 압축
    const COMPRESS_CONCURRENCY = 3;
    let compressDone = 0;
    for (let i = 0; i < list.length; i += COMPRESS_CONCURRENCY) {
      const chunk = list.slice(i, i + COMPRESS_CONCURRENCY);
      chunk.forEach((item) => { item.compressState = "compressing"; });
      setItems([...list]);

      await Promise.all(
        chunk.map(async (item) => {
          try {
            const compressed = await imageCompression(item.original, COMPRESS_OPTIONS);
            const previewUrl  = URL.createObjectURL(compressed);
            previewUrlsRef.current.push(previewUrl);
            item.compressed    = compressed;
            item.previewUrl    = previewUrl;
            item.compressState = "done";
          } catch {
            item.compressState = "error";
          }
          compressDone++;
          setCompressProg({ done: compressDone, total: list.length });
          setItems([...list]);
        })
      );
    }

    setPhase("ready");
  }

  // ── 올리기: 첫 번째 파일로 배치 생성 → 이후 batch_id 재사용
  async function handleUpload() {

    const ready = items.filter((it) => it.compressState === "done" && it.compressed);
    if (ready.length === 0) return;

    setPhase("uploading");
    setUploadProg({ done: 0, total: ready.length });
    setError(null);

    let localBatchId: string | null = null;
    let failCount = 0;
    let uploadDone = 0;

    // 첫 장으로 배치 ID 먼저 생성
    const firstItem = ready[0];
    const firstFd = new FormData();
    firstFd.append("file",        firstItem.compressed!);
    firstFd.append("file_name",   firstItem.original.name);
    firstFd.append("upload_user", nickname.trim());
    try {
      const res = await fetch("/api/upload", { method: "POST", body: firstFd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      localBatchId = data.batch_id;
      setBatchId(data.batch_id);
      setItems((prev) => prev.map((p) => p.id === firstItem.id ? { ...p, uploadState: "done" } : p));
    } catch {
      failCount++;
      setItems((prev) => prev.map((p) => p.id === firstItem.id ? { ...p, uploadState: "error" } : p));
    }
    uploadDone++;
    setUploadProg({ done: uploadDone, total: ready.length });

    // 나머지 4개씩 병렬 업로드
    const UPLOAD_CONCURRENCY = 4;
    const rest = ready.slice(1);
    for (let i = 0; i < rest.length; i += UPLOAD_CONCURRENCY) {
      const chunk = rest.slice(i, i + UPLOAD_CONCURRENCY);
      await Promise.all(
        chunk.map(async (item) => {
          const fd = new FormData();
          fd.append("file",        item.compressed!);
          fd.append("file_name",   item.original.name);
          fd.append("upload_user", nickname.trim());
          if (localBatchId) fd.append("batch_id", localBatchId);
          try {
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            if (!res.ok) throw new Error();
            setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, uploadState: "done" } : p));
          } catch {
            failCount++;
            setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, uploadState: "error" } : p));
          }
          uploadDone++;
          setUploadProg({ done: uploadDone, total: ready.length });
        })
      );
    }

    if (failCount === ready.length) {
      setError("모든 사진 업로드에 실패했습니다. 다시 시도해 주세요.");
      setPhase("ready");
    } else {
      // 내 배치 ID를 localStorage에 저장해 사진 정리 페이지에서 재사용
      if (localBatchId) {
        localStorage.setItem("dangchive_my_batch_id", localBatchId);
      }
      setPhase("done");
    }
  }

  // ── 파생값
  const doneCount     = items.filter((i) => i.compressState === "done").length;
  const isCompressing = phase === "compressing";
  const isUploading   = phase === "uploading";
  const isDone        = phase === "done";

  // ──────────────────────────────────────────────────────────────
  return (
    <main className="max-w-md mx-auto px-4 pb-44">

      {/* 헤더 */}
      <div className="flex items-center gap-3 py-5">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-xl leading-none">
          ←
        </Link>
        <h1 className="text-base font-bold text-gray-900">
          오늘 찍은 사진 올리기 (최대 50장)
        </h1>
      </div>


      {/* 사진 선택 드롭존 (idle 상태에서만) */}
      {phase === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-2xl bg-white
                     py-12 text-center hover:border-[#191F28] transition-colors"
        >
          <p className="text-5xl mb-3">📷</p>
          <p className="font-medium text-gray-700">사진을 선택하거나 촬영하세요</p>
          <p className="text-sm text-gray-400 mt-1">최대 50장 · 자동 압축됩니다</p>
        </button>
      )}

      {/* 숨겨진 파일 input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={isCompressing || isUploading || isDone}
      />

      {/* 배너: 압축 중 */}
      {isCompressing && (
        <StatusBanner color="orange">
          <p className="font-medium text-sm">
            사진을 압축하며 안전하게 올리고 있어요...
          </p>
          <p className="text-xs mt-0.5 opacity-75">
            {compressProg.done} / {compressProg.total}장 압축 완료
          </p>
          <ProgressBar pct={(compressProg.done / compressProg.total) * 100} />
        </StatusBanner>
      )}

      {/* 배너: 업로드 중 */}
      {isUploading && (
        <StatusBanner color="orange">
          <p className="font-medium text-sm">
            {uploadProg.done} / {uploadProg.total}장 처리 중...
          </p>
          <ProgressBar pct={(uploadProg.done / uploadProg.total) * 100} />
        </StatusBanner>
      )}

      {/* 배너: 완료 */}
      {isDone && (
        <StatusBanner color="green">
          <p className="font-medium text-sm">
            ✅ 업로드 완료! 이제 아이 이름을 정리해 주세요.
          </p>
        </StatusBanner>
      )}

      {/* 에러 */}
      {error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}

      {/* 재선택 버튼 */}
      {phase === "ready" && items.length > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 mb-2 w-full text-sm text-[#8B95A1] font-medium
                     border border-gray-200 rounded-xl py-2 bg-white
                     hover:bg-gray-50 active:scale-95 transition"
        >
          + 다시 선택
        </button>
      )}

      {/* 썸네일 그리드 */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {items.map((item) => (
            <ThumbnailCell key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* ── 하단 고정 버튼 */}
      <div className="fixed bottom-16 inset-x-0 px-4 py-4 bg-white border-t border-gray-100 z-[35]">
        <div className="max-w-md mx-auto">
          {!online && (
            <p className="text-xs text-center text-gray-400 mb-2">
              📶 인터넷 연결을 확인해 주세요
            </p>
          )}
          {isDone ? (
            <button
              onClick={() => router.push(`/sort?batch_id=${batchId}`)}
              className="w-full bg-[#3182F6] text-white font-semibold py-4 rounded-2xl
                         active:scale-95 transition"
            >
              이름 정리하러 가기 →
            </button>
          ) : (
            <button
              onClick={handleUpload}
              disabled={phase !== "ready" || doneCount === 0 || !online}
              className="w-full bg-[#3182F6] text-white font-semibold py-4 rounded-2xl
                         disabled:opacity-40 active:scale-95 transition"
            >
              {isUploading
                ? `${uploadProg.done} / ${uploadProg.total}장 처리 중...`
                : `올리기 (${doneCount}장)`}
            </button>
          )}
        </div>
      </div>

    </main>
  );
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────

function ThumbnailCell({ item }: { item: FileItem }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
      {item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {item.compressState === "compressing" ? (
            <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-2xl text-gray-300">🖼</span>
          )}
        </div>
      )}

      {/* 업로드 완료 */}
      {item.uploadState === "done" && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <span className="text-white text-xl font-bold">✓</span>
        </div>
      )}

      {/* 업로드 실패 */}
      {item.uploadState === "error" && (
        <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
          <span className="text-white text-sm font-bold">실패</span>
        </div>
      )}

      {/* 압축 실패 */}
      {item.compressState === "error" && item.uploadState === "idle" && (
        <div className="absolute inset-0 bg-red-400/50 flex items-center justify-center">
          <span className="text-white text-xs font-bold">압축실패</span>
        </div>
      )}
    </div>
  );
}

function StatusBanner({
  color,
  children,
}: {
  color: "orange" | "green";
  children: React.ReactNode;
}) {
  const cls = {
    orange: "bg-white border-gray-100 text-[#191F28]",
    green:  "bg-white border-gray-100 text-[#191F28]",
  }[color as "orange" | "green"];
  return (
    <div className={`mt-4 rounded-2xl border p-4 ${cls}`}>{children}</div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-gray-200">
      <div
        className="h-full rounded-full transition-all duration-300 bg-[#3182F6]"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}
