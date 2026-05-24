export type Dog = {
  dog_id: string;        // D0001
  dog_name: string;
  drive_folder_id: string | null;
  created_at: string;
};

export type Batch = {
  batch_id: string;      // B0001
  upload_user: string;
  status: "pending" | "named" | "sent";
  created_at: string;
};

export type PhotoStatus = "temp" | "needs_name" | "named" | "sent" | "failed";

export type Photo = {
  photo_id: string;      // P0001
  batch_id: string;
  dog_id: string | null;
  file_name: string;
  saved_name: string | null;
  upload_user: string;
  storage_path: string;
  status: PhotoStatus;
  drive_url: string | null;
  created_at: string;
  // join
  dog?: Dog;
  dogs?: Dog[];   // photo_dogs 다대다
  batch?: Batch;
};
