/**
 * Public Free-Mail Providers & Bare TLD / Public Suffix Blocklist
 * Prevents domain squatting and unmanaged personal email accounts from binding tenants.
 */

export const FREEMAIL_PROVIDERS = new Set<string>([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "mail.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "aol.com",
  "gmx.com",
  "tempmail.com",
  "guerrillamail.com",
  "sltnet.lk",
])

export const PUBLIC_SUFFIXES = new Set<string>([
  // Generic TLDs
  "com",
  "org",
  "net",
  "edu",
  "gov",
  "mil",
  "int",
  "biz",
  "info",
  "io",
  "co",
  // Country Codes
  "lk",
  "uk",
  "us",
  "in",
  "au",
  // Sri Lankan registry public suffixes
  "com.lk",
  "org.lk",
  "edu.lk",
  "gov.lk",
  "net.lk",
  "ac.lk",
  "co.lk",
  "ltd.lk",
  "ngo.lk",
  "sch.lk",
  "soc.lk",
  "web.lk",
  "int.lk",
  "assn.lk",
  "grp.lk",
  "hotel.lk",
  // Common multi-part suffixes
  "co.uk",
  "org.uk",
  "co.in",
])

/**
 * Normalizes a domain string: trim, lowercase, strip trailing dot.
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.+$/, "")
}

/**
 * Validates domain syntax according to RFC label rules.
 * - Max 253 characters total
 * - Labels separated by dots, each 1 to 63 characters
 * - Letters, digits, hyphens (cannot start or end with hyphen)
 * - TLD at least 2 alphabetic characters
 * - Rejects IP literals (IPv4 and IPv6)
 */
export function isValidDomainFormat(domain: string): boolean {
  if (!domain || domain.length > 253) return false

  // Reject IPv4 literals: e.g. 192.168.1.1
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) return false

  // Reject IPv6 literals
  if (domain.includes(":")) return false

  const labels = domain.split(".")
  if (labels.length < 2) return false

  const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i
  for (const label of labels) {
    if (!labelRegex.test(label)) return false
  }

  // TLD check: must be at least 2 alphabetic characters
  const tld = labels[labels.length - 1]
  if (!/^[a-z]{2,}$/i.test(tld)) return false

  return true
}

/**
 * Checks whether a normalized domain is on the free-mail blocklist
 * (either directly or as a subdomain of a free-mail provider) or is a bare public suffix.
 */
export function isBlockedDomain(domain: string): { blocked: boolean; reason?: string } {
  const norm = normalizeDomain(domain)

  // 1. Bare public suffix check
  if (PUBLIC_SUFFIXES.has(norm)) {
    return { blocked: true, reason: "Registration of bare public suffixes or TLDs is not permitted" }
  }

  // 2. Direct free-mail match
  if (FREEMAIL_PROVIDERS.has(norm)) {
    return { blocked: true, reason: "Public free-mail providers cannot be registered as institution domains" }
  }

  // 3. Subdomain match against free-mail providers
  for (const provider of FREEMAIL_PROVIDERS) {
    if (norm.endsWith(`.${provider}`)) {
      return { blocked: true, reason: "Subdomains of public free-mail providers are not permitted" }
    }
  }

  return { blocked: false }
}
