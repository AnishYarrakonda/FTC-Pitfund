'use client'

/*
 * Direct browser → storage uploads with real progress (plan §3.2 "PDF upload"). fetch() can't
 * report upload progress, so this uses XMLHttpRequest. The AbortSignal really cancels the
 * request. Errors are typed so the UI can say "Upload interrupted." with a Retry that keeps the file.
 */

export type UploadProgress = { loaded: number; total: number }

export class UploadError extends Error {
  constructor(
    public readonly kind: 'network' | 'aborted' | 'rejected',
    message: string,
  ) {
    super(message)
    this.name = 'UploadError'
  }
}

export function putFile(
  url: string,
  body: Blob,
  options: { contentType: string; onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new UploadError('aborted', 'Upload cancelled.'))
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', options.contentType)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress?.({ loaded: e.loaded, total: e.total })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.({ loaded: body.size, total: body.size })
        resolve()
      } else {
        reject(new UploadError('rejected', `The upload was refused (${xhr.status}).`))
      }
    }
    xhr.onerror = () => reject(new UploadError('network', 'Upload interrupted.'))
    xhr.ontimeout = () => reject(new UploadError('network', 'Upload interrupted.'))
    xhr.onabort = () => reject(new UploadError('aborted', 'Upload cancelled.'))
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t encode the image'))), type, quality)
  })
}

/**
 * WebP under `maxBytes`, stepping quality down. Browsers that can't encode WebP return PNG from
 * toBlob; those get JPEG instead, which every browser encodes and stays small.
 */
export async function encodeImage(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let format: 'image/webp' | 'image/jpeg' = 'image/webp'
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    const blob = await canvasToBlob(canvas, format, quality)
    if (blob.type !== format) {
      format = 'image/jpeg'
      continue
    }
    if (blob.size <= maxBytes) return blob
  }
  return canvasToBlob(canvas, 'image/jpeg', 0.4)
}
