-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('pending', 'verified', 'revoked');

-- CreateTable
CREATE TABLE "institution_domains" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'pending',
    "verification_token_hash" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "default_role_id" INTEGER NOT NULL,
    "auto_approve" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institution_domains_verification_token_hash_key" ON "institution_domains"("verification_token_hash");

-- CreateIndex
CREATE INDEX "institution_domains_institution_id_idx" ON "institution_domains"("institution_id");

-- AddForeignKey
ALTER TABLE "institution_domains" ADD CONSTRAINT "institution_domains_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_domains" ADD CONSTRAINT "institution_domains_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index for verified domains
CREATE UNIQUE INDEX "institution_domains_domain_verified_idx" ON "institution_domains" ("domain") WHERE "status" = 'verified';

-- Domains are always stored lowercase
ALTER TABLE "institution_domains" ADD CONSTRAINT "institution_domains_domain_lowercase_chk" CHECK ("domain" = lower("domain"));
