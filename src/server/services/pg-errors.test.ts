import { describe, expect, it } from "vitest";
import { isForeignKeyViolation, isUniqueViolation } from "./pg-errors";

const pk = "slack_submissions_pkey";

describe("isUniqueViolation", () => {
  it("matches a postgres-js error on the given constraint", () => {
    expect(isUniqueViolation({ code: "23505", constraint_name: pk }, pk)).toBe(true);
  });

  it("matches through a wrapping error's cause chain", () => {
    const wrapped = new Error("Failed query", { cause: { code: "23505", constraint_name: pk } });
    expect(isUniqueViolation(wrapped, pk)).toBe(true);
  });

  it("ignores other constraints, other codes and non-errors", () => {
    expect(isUniqueViolation({ code: "23505", constraint_name: "users_auth_user_id_unique" }, pk)).toBe(false);
    expect(isUniqueViolation({ code: "23503", constraint_name: pk }, pk)).toBe(false);
    expect(isUniqueViolation(new Error("boom"), pk)).toBe(false);
    expect(isUniqueViolation(null, pk)).toBe(false);
    expect(isUniqueViolation("23505", pk)).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  const fk = "time_entries_project_id_projects_id_fk";
  it("matches 23503 on the given constraint only", () => {
    expect(isForeignKeyViolation(new Error("x", { cause: { code: "23503", constraint_name: fk } }), fk)).toBe(true);
    expect(isForeignKeyViolation({ code: "23505", constraint_name: fk }, fk)).toBe(false);
    expect(isForeignKeyViolation({ code: "23503", constraint_name: "other_fk" }, fk)).toBe(false);
  });
});
