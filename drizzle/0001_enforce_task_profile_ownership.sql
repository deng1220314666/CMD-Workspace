DO $$ BEGIN
 ALTER TABLE "terminal_profiles" ADD CONSTRAINT "terminal_profiles_id_project_unique" UNIQUE("id", "project_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_profile_project_ownership_fk" FOREIGN KEY ("profile_id", "project_id") REFERENCES "public"."terminal_profiles"("id", "project_id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
