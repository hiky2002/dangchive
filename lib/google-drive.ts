import { google } from "googleapis";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:4000"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

export function createDriveClient() {
  const auth = getOAuthClient();
  return google.drive({ version: "v3", auth });
}

function getRootFolderId(): string {
  return (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "").split("?")[0];
}

function getSharedDriveId(): string | undefined {
  return process.env.GOOGLE_SHARED_DRIVE_ID || undefined;
}

export function sharedDriveParams() {
  const driveId = getSharedDriveId();
  const params = {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: "drive" as const } : {}),
  };
  console.log("[google-drive] sharedDriveParams:", JSON.stringify(params));
  return params;
}

export async function ensureDogFolder(dogName: string): Promise<string> {
  const drive        = createDriveClient();
  const rootFolderId = getRootFolderId();

  console.log(`[ensureDogFolder] dogName="${dogName}", rootFolderId="${rootFolderId}", sharedDriveId="${getSharedDriveId() ?? "없음"}"`);

  const res = await drive.files.list({
    q: `'${rootFolderId}' in parents and name = '${dogName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 10,
    ...sharedDriveParams(),
  });

  console.log(`[ensureDogFolder] 기존 폴더 검색 결과: ${res.data.files?.length ?? 0}개`);

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  console.log(`[ensureDogFolder] 폴더 생성 시도: "${dogName}" in "${rootFolderId}"`);
  const folder = await drive.files.create({
    requestBody: {
      name: dogName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  console.log(`[ensureDogFolder] 폴더 생성 완료: id="${folder.data.id}"`);
  return folder.data.id!;
}

export async function listRootFolders(): Promise<{ id: string; name: string }[]> {
  const drive        = createDriveClient();
  const rootFolderId = getRootFolderId();
  const all: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  let page = 0;

  console.log(`[listRootFolders] rootFolderId="${rootFolderId}", sharedDriveId="${getSharedDriveId() ?? "없음"}"`);

  do {
    page++;
    const res = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 1000,
      orderBy: "name",
      ...(pageToken ? { pageToken } : {}),
      ...sharedDriveParams(),
    });
    const batch = (res.data.files ?? []) as { id: string; name: string }[];
    console.log(`[listRootFolders] page ${page}: ${batch.length}개 (nextPageToken: ${res.data.nextPageToken ? "있음" : "없음"})`);
    all.push(...batch);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`[listRootFolders] 총 ${all.length}개 폴더 수집`);
  return all;
}

export async function countFilesInFolder(folderId: string): Promise<number> {
  const drive = createDriveClient();
  const res   = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1000,
    ...sharedDriveParams(),
  });
  return res.data.files?.length ?? 0;
}