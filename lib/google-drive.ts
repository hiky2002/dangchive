import { google } from "googleapis";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:4000"
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

export async function ensureDogFolder(dogName: string): Promise<string> {
  const drive        = createDriveClient();
  const rootFolderId = getRootFolderId();

  const res = await drive.files.list({
    q: `'${rootFolderId}' in parents and name = '${dogName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 10,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: dogName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    },
    fields: "id",
  });

  return folder.data.id!;
}

export async function listRootFolders(): Promise<{ id: string; name: string }[]> {
  const drive        = createDriveClient();
  const rootFolderId = getRootFolderId();
  const all: { id: string; name: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 1000,
      orderBy: "name",
      ...(pageToken ? { pageToken } : {}),
    });
    all.push(...((res.data.files ?? []) as { id: string; name: string }[]));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return all;
}

export async function countFilesInFolder(folderId: string): Promise<number> {
  const drive = createDriveClient();
  const res   = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1000,
  });
  return res.data.files?.length ?? 0;
}