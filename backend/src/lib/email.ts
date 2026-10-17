/**
 * Domain Verification Email Service
 * Logs verification link in non-production; fails closed in production.
 */

export interface EmailService {
  sendDomainVerification(to: string, domain: string, rawToken: string): Promise<void>
}

export class ConsoleEmailService implements EmailService {
  async sendDomainVerification(to: string, domain: string, rawToken: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email provider not configured for production environment.")
    }

    const frontendBaseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")
    const verificationUrl = `${frontendBaseUrl}/verify-domain?token=${rawToken}`

    console.log(`[Email Mock] Sending domain verification email to: ${to}`)
    console.log(`[Email Mock] Target domain: ${domain}`)
    console.log(`[Email Mock] Verification Link: ${verificationUrl}`)
  }
}

export const emailService: EmailService = new ConsoleEmailService()
