import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

interface ApiResponse<T> {
  status: 'ok' | 'error' | 'validation-error';
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json: ApiResponse<T> = await response.json();

  if (json.status !== 'ok') {
    throw new Error(json.message || `API error: ${response.status}`);
  }

  return json.data as T;
}

export async function uploadFile(
  baseUrl: string,
  fileUri: string,
  token?: string
): Promise<{ id: number }> {
  const filename = fileUri.split('/').pop() ?? 'photo.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const result = await uploadAsync(
    `${baseUrl}/api/image`,
    fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      headers,
      parameters: {
        type: 'cemetery',
      },
    }
  );

  const json = JSON.parse(result.body);

  if (json.status !== 'ok') {
    throw new Error(json.message || `Upload error: ${result.status}`);
  }

  return json.data;
}
