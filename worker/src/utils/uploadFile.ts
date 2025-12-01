const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

type UploadStrategy = 'stream' | 'arrayBuffer';

interface UploadResult {
  bytes: number;
  strategy: UploadStrategy;
}

/**
 * Uploads a File/Blob into R2 with automatic fallback when stream uploads are not supported.
 * Some Android share intents report `file.size === 0` even though the payload exists.
 * We optimistically stream when size metadata is available and fall back to arrayBuffer otherwise.
 */
export async function uploadFileToR2(
  bucket: R2Bucket,
  file: File,
  fileKey: string,
  logPrefix: string
): Promise<UploadResult> {
  const metadata = {
    httpMetadata: {
      contentType: file.type || DEFAULT_CONTENT_TYPE,
    },
  };

  const fallbackToArrayBuffer = async (reason: string): Promise<UploadResult> => {
    console.warn(`${logPrefix} Falling back to arrayBuffer upload: ${reason}`);
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength === 0) {
      // This may be a legitimate scenario on some Android devices where the file is truly empty or corrupt.
      // Handle gracefully: log a warning and return zero bytes to let caller decide how to proceed.
      console.warn(`${logPrefix} File buffer is empty after fallback. This may indicate the file is empty or corrupt, or a device-specific issue (e.g., Android share intent). Returning zero bytes.`);
      return { bytes: 0, strategy: 'arrayBuffer' };
    }
    await bucket.put(fileKey, buffer, metadata);
    return { bytes: buffer.byteLength, strategy: 'arrayBuffer' };
  };

  if (file.size && file.size > 0) {
    try {
      await bucket.put(fileKey, file.stream(), metadata);
      return { bytes: file.size, strategy: 'stream' };
    } catch (err) {
      console.warn(`${logPrefix} Stream upload failed, retrying with arrayBuffer`, err);
      return fallbackToArrayBuffer('stream upload error');
    }
  }

  // Size metadata is unreliable (Android share intents sometimes set size=0)
  return fallbackToArrayBuffer('size reported as 0');
}
