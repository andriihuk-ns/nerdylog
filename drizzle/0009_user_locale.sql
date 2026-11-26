CREATE TYPE "public"."locale" AS ENUM('uk', 'en');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" "locale" DEFAULT 'uk' NOT NULL;