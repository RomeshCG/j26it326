-- AlterTable
ALTER TABLE "agent_tier_policies" ADD COLUMN     "agent_id" TEXT;

-- AlterTable
ALTER TABLE "agent_actions" ADD COLUMN     "agent_id" TEXT,
ADD COLUMN     "decision_reason" TEXT,
ADD COLUMN     "is_override" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model_version" TEXT,
ADD COLUMN     "processing_time_ms" INTEGER,
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "tools_used" JSONB;

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE INDEX "agent_tier_policies_agent_id_idx" ON "agent_tier_policies"("agent_id");

-- CreateIndex
CREATE INDEX "agent_tier_policies_tier_idx" ON "agent_tier_policies"("tier");

-- CreateIndex
CREATE INDEX "agent_actions_agent_id_idx" ON "agent_actions"("agent_id");

-- CreateIndex
CREATE INDEX "agent_actions_is_override_idx" ON "agent_actions"("is_override");

-- CreateIndex
CREATE INDEX "agent_actions_created_at_idx" ON "agent_actions"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_type_actor_id_idx" ON "audit_log"("actor_type", "actor_id");
