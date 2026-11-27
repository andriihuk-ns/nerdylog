ALTER TABLE "users" ADD COLUMN "sick_allowance_days" numeric(4, 1);
ALTER TABLE "users" ADD CONSTRAINT "users_sick_allowance_days_range"
  CHECK ("sick_allowance_days" IS NULL OR "sick_allowance_days" BETWEEN 0 AND 365);

ALTER TABLE "project_members" ADD COLUMN "allocation_hours_per_month" numeric(5, 1) NOT NULL DEFAULT 160;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_allocation_hours_range"
  CHECK ("allocation_hours_per_month" BETWEEN 0.5 AND 744 AND mod("allocation_hours_per_month" * 10, 5) = 0);
