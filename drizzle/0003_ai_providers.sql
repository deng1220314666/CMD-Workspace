CREATE TYPE "public"."ai_provider_type" AS ENUM('openai', 'openai-compatible');--> statement-breakpoint
CREATE TYPE "public"."ai_provider_protocol" AS ENUM('responses', 'chat-completions');--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "ai_provider_type" NOT NULL,
	"protocol" "ai_provider_protocol" NOT NULL,
	"base_url" text NOT NULL,
	"model" text NOT NULL,
	"credential_id" uuid NOT NULL,
	"timeout_ms" integer DEFAULT 15000 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_providers_credential_id_unique" UNIQUE("credential_id"),
	CONSTRAINT "ai_providers_timeout_range" CHECK ("ai_providers"."timeout_ms" between 1000 and 120000)
);--> statement-breakpoint
CREATE INDEX "ai_providers_type_idx" ON "ai_providers" USING btree ("type");
