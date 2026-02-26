import * as MediaLibrary from 'expo-media-library';
import { Paths, Directory, File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ImageProcessingMode } from '@/db/types';

/**
 * Re-encode the image so EXIF orientation is baked into pixels.
 * This prevents rotation issues when servers strip EXIF metadata.
 */
async function normalizeOrientation(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [], {
    compress: 0.95,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

function getImagesDir(): Directory {
  const dir = new Directory(Paths.document, 'images');
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function generateMediaLibraryFilename(graveUid: string, ext: string): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const random = Math.random().toString(36).slice(2, 8);
  return `${graveUid}.${timestamp}.${random}.${ext}`;
}

function getAlbumName(mode: ImageProcessingMode): string {
  return mode === 'store_only' ? 'Cemetery/StoreOnly' : 'Cemetery/StoreAndSend';
}

async function saveToMediaLibrary(sourceUri: string, filename: string, albumName: string): Promise<void> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') return;

  const imagesDir = getImagesDir();
  const tempFile = new File(imagesDir, filename);
  const sourceFile = new File(sourceUri);
  sourceFile.copy(tempFile);

  const asset = await MediaLibrary.createAssetAsync(tempFile.uri);
  const album = await MediaLibrary.getAlbumAsync(albumName);
  if (album) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  } else {
    await MediaLibrary.createAlbumAsync(albumName, asset, false);
  }

  if (tempFile.exists) tempFile.delete();
}

/**
 * Process a camera image: save original to device media library
 * (in mode-specific album) and copy original to app storage.
 * Returns the URI of the stored image.
 */
export async function processCameraImage(
  sourceUri: string,
  imageId: string,
  graveUid: string,
  mode: ImageProcessingMode,
): Promise<string> {
  const imagesDir = getImagesDir();

  // 1. Normalize orientation (bake EXIF rotation into pixels)
  const normalizedUri = await normalizeOrientation(sourceUri);

  // 2. Save to media library
  const mediaFilename = generateMediaLibraryFilename(graveUid, 'jpg');
  await saveToMediaLibrary(normalizedUri, mediaFilename, getAlbumName(mode));

  // 3. Copy to app storage
  const destFile = new File(imagesDir, `${imageId}.jpg`);
  const normalizedFile = new File(normalizedUri);
  normalizedFile.copy(destFile);

  return destFile.uri;
}

/**
 * Save a gallery image: save to device media library
 * (in mode-specific album) and copy to app storage.
 * Returns the URI of the stored image.
 */
export async function saveGalleryImage(
  sourceUri: string,
  imageId: string,
  graveUid: string,
  mode: ImageProcessingMode,
): Promise<string> {
  const imagesDir = getImagesDir();

  // 1. Normalize orientation (bake EXIF rotation into pixels)
  const normalizedUri = await normalizeOrientation(sourceUri);

  // 2. Save to media library
  const mediaFilename = generateMediaLibraryFilename(graveUid, 'jpg');
  await saveToMediaLibrary(normalizedUri, mediaFilename, getAlbumName(mode));

  // 3. Copy to app storage
  const destFile = new File(imagesDir, `${imageId}.jpg`);
  const normalizedFile = new File(normalizedUri);
  normalizedFile.copy(destFile);

  return destFile.uri;
}
