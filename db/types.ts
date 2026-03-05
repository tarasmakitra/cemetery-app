export type SyncStatus = 'pending' | 'synced' | 'modified' | 'deleted';
export type UploadStatus = 'pending' | 'uploaded' | 'error' | 'store_only';
export type ImageProcessingMode = 'store_only' | 'store_and_send';
export type GraveType = 'REGULAR' | 'SMALL' | 'DOUBLE' | 'TRIPLE' | 'TREE' | 'OTHER';
export type GraveStatus = 'VISIBLE' | 'HIDDEN';

export interface LocalGrave {
  local_id: string;
  server_id: number | null;
  uid: string;
  location: string;
  latitude: number;
  longitude: number;
  rotation: number;
  type: GraveType;
  status: GraveStatus;
  notes: string;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface GraveListItem extends LocalGrave {
  persons_summary: string;
  first_photo_uri: string | null;
  photo_count: number;
}

export interface LocalGravePerson {
  local_id: string;
  grave_local_id: string;
  server_id: number | null;
  name: string;
  birth_day: string;
  birth_month: string;
  birth_year: string;
  death_day: string;
  death_month: string;
  death_year: string;
  notes: string;
  created_at: string;
}

export interface LocalGraveImage {
  local_id: string;
  grave_local_id: string;
  server_id: number | null;
  file_uri: string;
  full_uri: string;
  upload_status: UploadStatus;
  created_at: string;
}

export interface GraveWithRelations extends LocalGrave {
  persons: LocalGravePerson[];
  images: LocalGraveImage[];
}
