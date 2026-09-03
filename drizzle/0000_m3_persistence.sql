DO $$ BEGIN
 CREATE TYPE "public"."terminal_run_state" AS ENUM('starting', 'running', 'stopping', 'exited', 'failed', 'interrupted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."terminal_restart_policy" AS ENUM('never', 'on-failure', 'always');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "display_path" text NOT NULL,
  "normalized_path" text NOT NULL,
  "default_shell" text DEFAULT 'powershell.exe' NOT NULL,
  "environment_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projects_order_nonnegative" CHECK ("projects"."order_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terminal_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "executable" text DEFAULT 'powershell.exe' NOT NULL,
  "arguments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "working_directory" text NOT NULL,
  "startup_command" text,
  "environment_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "auto_start" boolean DEFAULT false NOT NULL,
  "restart_policy" "terminal_restart_policy" DEFAULT 'never' NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "terminal_profiles_order_nonnegative" CHECK ("terminal_profiles"."order_index" >= 0),
  CONSTRAINT "terminal_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terminal_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "application_instance_id" uuid NOT NULL,
  "diagnostic_pid" integer,
  "state" "terminal_run_state" NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "duration_ms" integer,
  "exit_code" integer,
  "error_summary" text,
  "log_path" text,
  CONSTRAINT "terminal_runs_duration_nonnegative" CHECK ("terminal_runs"."duration_ms" is null or "terminal_runs"."duration_ms" >= 0),
  CONSTRAINT "terminal_runs_profile_id_terminal_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."terminal_profiles"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "name" text NOT NULL,
  "readiness" jsonb,
  "timeout_ms" integer DEFAULT 30000 NOT NULL,
  "retry_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "stop_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tasks_timeout_positive" CHECK ("tasks"."timeout_ms" > 0),
  CONSTRAINT "tasks_order_nonnegative" CHECK ("tasks"."order_index" >= 0),
  CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade,
  CONSTRAINT "tasks_profile_id_terminal_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."terminal_profiles"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_dependencies" (
  "task_id" uuid NOT NULL,
  "prerequisite_task_id" uuid NOT NULL,
  CONSTRAINT "task_dependencies_task_id_prerequisite_task_id_pk" PRIMARY KEY("task_id","prerequisite_task_id"),
  CONSTRAINT "task_dependencies_not_self" CHECK ("task_dependencies"."task_id" <> "task_dependencies"."prerequisite_task_id"),
  CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade,
  CONSTRAINT "task_dependencies_prerequisite_task_id_tasks_id_fk" FOREIGN KEY ("prerequisite_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_state" (
  "key" text PRIMARY KEY NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_normalized_path_unique" ON "projects" USING btree ("normalized_path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_order_idx" ON "projects" USING btree ("order_index","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "terminal_profiles_project_order_unique" ON "terminal_profiles" USING btree ("project_id","order_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terminal_profiles_project_idx" ON "terminal_profiles" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terminal_runs_profile_started_idx" ON "terminal_runs" USING btree ("profile_id","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terminal_runs_state_idx" ON "terminal_runs" USING btree ("state");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_project_name_unique" ON "tasks" USING btree ("project_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_order_idx" ON "tasks" USING btree ("project_id","order_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_dependencies_prerequisite_idx" ON "task_dependencies" USING btree ("prerequisite_task_id");
