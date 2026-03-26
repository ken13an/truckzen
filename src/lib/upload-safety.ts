// ============================================================
// TRUCKZEN — Upload safety helpers (client-side)
// Allowlists, filename sanitizer, size limits
// ============================================================

// WO file uploads: images, PDFs, common docs
export const WO_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'])
export const WO_FILE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
])

// Customer documents: images, PDFs, office docs
export const DOC_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'zip'])
export const DOC_MIMES = new Set([
  ...WO_FILE_MIMES,
  'application/zip', 'application/x-zip-compressed',
])

// Size limits
export const MAX_WO_FILE_SIZE = 10 * 1024 * 1024   // 10MB
export const MAX_DOC_SIZE = 25 * 1024 * 1024         // 25MB

/**
 * Sanitize a filename for safe storage paths.
 * - strips path traversal (../ ..\)
 * - replaces unsafe chars with _
 * - truncates to maxLen
 * - preserves extension
 */
export function sanitizeFilename(name: string, maxLen = 200): string {
  // Remove path traversal
  let safe = name.replace(/\.\.\//g, '').replace(/\.\.\\/g, '').replace(/\.\./g, '')
  // Remove leading dots/slashes
  safe = safe.replace(/^[./\\]+/, '')
  // Replace unsafe chars (keep alphanumeric, dash, underscore, dot, space)
  safe = safe.replace(/[^a-zA-Z0-9._\- ]/g, '_')
  // Collapse multiple underscores/spaces
  safe = safe.replace(/[_ ]{2,}/g, '_')
  // Truncate but preserve extension
  if (safe.length > maxLen) {
    const dotIdx = safe.lastIndexOf('.')
    if (dotIdx > 0) {
      const ext = safe.slice(dotIdx) // e.g. ".pdf"
      safe = safe.slice(0, maxLen - ext.length) + ext
    } else {
      safe = safe.slice(0, maxLen)
    }
  }
  return safe || 'file'
}

/** Get lowercase extension from filename */
export function getExt(name: string): string {
  return (name.split('.').pop() || '').toLowerCase()
}

/** Validate file against allowlists + size. Returns error string or null. */
export function validateFile(
  file: File,
  allowedExts: Set<string>,
  allowedMimes: Set<string>,
  maxSize: number,
): string | null {
  const ext = getExt(file.name)
  if (!allowedExts.has(ext)) return `File type .${ext} not allowed`
  if (!allowedMimes.has(file.type) && file.type !== '') return `MIME type ${file.type} not allowed`
  if (file.size > maxSize) return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${(maxSize / 1024 / 1024).toFixed(0)}MB`
  return null
}
