import { GoogleAuth } from "google-auth-library";

// ─────────────────────────────────────────────────────────────
// 인증
// ─────────────────────────────────────────────────────────────
function getAuth() {
  const email      = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  return new GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

// 액세스 토큰 획득 (google-auth-library가 자체적으로 캐싱/갱신 처리)
let _client: Awaited<ReturnType<GoogleAuth["getClient"]>> | null = null;
async function getAccessToken(): Promise<string> {
  if (!_client) _client = await getAuth().getClient();
  const { token } = await _client.getAccessToken();
  if (!token) throw new Error("Google 액세스 토큰 발급 실패");
  return token;
}

// ─────────────────────────────────────────────────────────────
// Drive REST API 헬퍼
// ─────────────────────────────────────────────────────────────
const BASE = "https://www.googleapis.com/drive/v3";

async function driveGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const token = await getAccessToken();
  const url   = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function drivePost(path: string, params: Record<string, string>, body: unknown): Promise<any> {
  const token = await getAccessToken();
  const url   = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Drive POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function drivePatch(path: string, params: Record<string, string>, body: unknown): Promise<any> {
  const token = await getAccessToken();
  const url   = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method:  "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Drive PATCH ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// multipart/related 업로드 (파일 + 메타데이터 동시 전송)
async function driveUpload(
  params: Record<string, string>,
  metadata: object,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<any> {
  const token    = await getAccessToken();
  const url      = new URL("https://www.googleapis.com/upload/drive/v3/files");
  url.searchParams.set("uploadType", "multipart");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const boundary = `boundary_${Date.now().toString(36)}`;
  const metaJson = JSON.stringify(metadata);

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(url.toString(), {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// 공용 파라미터
// ─────────────────────────────────────────────────────────────
function getRootFolderId(): string {
  return (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "").split("?")[0];
}

function getSharedDriveId(): string | undefined {
  return process.env.GOOGLE_SHARED_DRIVE_ID || undefined;
}

export function sharedDriveParams(): Record<string, string> {
  const driveId = getSharedDriveId();
  const params: Record<string, string> = {
    supportsAllDrives:         "true",
    includeItemsFromAllDrives: "true",
  };
  if (driveId) {
    params.driveId = driveId;
    params.corpora  = "drive";
  }
  return params;
}

// ─────────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────────

export async function ensureDogFolder(dogName: string): Promise<string> {
  const rootFolderId = getRootFolderId();
  const sdp          = sharedDriveParams();

  console.log(`[ensureDogFolder] dogName="${dogName}", rootFolderId="${rootFolderId}"`);

  const list = await driveGet("/files", {
    q:        `'${rootFolderId}' in parents and name = '${dogName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields:   "files(id, name)",
    pageSize: "10",
    ...sdp,
  });

  if (list.files?.length > 0) return list.files[0].id as string;

  const folder = await drivePost("/files", { supportsAllDrives: "true" }, {
    name:     dogName,
    mimeType: "application/vnd.google-apps.folder",
    parents:  [rootFolderId],
  });
  console.log(`[ensureDogFolder] 폴더 생성 완료: id="${folder.id}"`);
  return folder.id as string;
}

export async function listRootFolders(): Promise<{ id: string; name: string }[]> {
  const rootFolderId = getRootFolderId();
  const sdp          = sharedDriveParams();
  const all: { id: string; name: string }[] = [];
  let   pageToken: string | undefined;

  do {
    const res = await driveGet("/files", {
      q:        `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields:   "nextPageToken, files(id, name)",
      pageSize: "1000",
      orderBy:  "name",
      ...(pageToken ? { pageToken } : {}),
      ...sdp,
    });
    all.push(...(res.files ?? []));
    pageToken = res.nextPageToken;
  } while (pageToken);

  console.log(`[listRootFolders] 총 ${all.length}개 폴더`);
  return all;
}

export async function renameDriveFolder(folderId: string, newName: string): Promise<void> {
  await drivePatch(`/files/${folderId}`, { supportsAllDrives: "true" }, { name: newName });
  console.log(`[renameDriveFolder] "${folderId}" → "${newName}"`);
}

export async function countFilesInFolder(folderId: string): Promise<number> {
  const res = await driveGet("/files", {
    q:        `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields:   "files(id)",
    pageSize: "1000",
    ...sharedDriveParams(),
  });
  return res.files?.length ?? 0;
}

/** 파일을 Drive 폴더에 업로드 — drive/send 라우트용 */
export async function uploadFileToDrive(
  folderId:   string,
  fileName:   string,
  fileBuffer: Buffer,
  mimeType  = "image/jpeg",
): Promise<{ id: string; webViewLink: string }> {
  const result = await driveUpload(
    { supportsAllDrives: "true", fields: "id,webViewLink" },
    { name: fileName, parents: [folderId] },
    fileBuffer,
    mimeType,
  );
  return { id: result.id, webViewLink: result.webViewLink ?? "" };
}

/** 파일을 휴지통으로 이동 — drive/delete 라우트용 */
export async function trashDriveFile(fileId: string): Promise<void> {
  await drivePatch(`/files/${fileId}`, { supportsAllDrives: "true" }, { trashed: true });
}

// ─────────────────────────────────────────────────────────────
// 하위 호환 (기존 createDriveClient 호출부 대응 — 점진적 마이그레이션용)
// ─────────────────────────────────────────────────────────────
/** @deprecated uploadFileToDrive / trashDriveFile 을 직접 사용하세요 */
export function createDriveClient() {
  return {
    files: {
      create: async (opts: any) => {
        // opts.requestBody.name, opts.requestBody.parents[0], opts.media.body(Buffer)
        const buf    = opts.media?.body;
        const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(await streamToBuffer(buf));
        const result = await driveUpload(
          { supportsAllDrives: "true", fields: opts.fields ?? "id,webViewLink" },
          opts.requestBody,
          buffer,
          opts.media?.mimeType ?? "image/jpeg",
        );
        return { data: result };
      },
      update: async (opts: any) => {
        const result = await drivePatch(
          `/files/${opts.fileId}`,
          { supportsAllDrives: "true" },
          opts.requestBody,
        );
        return { data: result };
      },
    },
  };
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
