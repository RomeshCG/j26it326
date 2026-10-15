/**
 * Safely cast an Express query param (string | string[] | undefined) to string | undefined.
 * Takes only the first value if an array is passed.
 */
export function qs(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

/**
 * Safely cast an Express route param (string | string[]) to string.
 * In Express 5 with strict mode, req.params values are typed as string | string[].
 */
export function p(v: string | string[] | undefined): string {
  if (!v) return ""
  if (Array.isArray(v)) return v[0] ?? ""
  return v
}

