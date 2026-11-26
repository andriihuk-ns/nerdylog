import { describe, expect, it } from "vitest";
import { profileDisplayName, profileSubtitle } from "./profile-label";

describe("profile labels", () => {
  it("shows the Slack title under the name", () => {
    expect(profileSubtitle({ title: "Product Designer", role: "member" })).toBe("Product Designer");
  });

  it("falls back to the role label when the title is null or blank", () => {
    expect(profileSubtitle({ title: null, role: "admin" })).toBe("Admin");
    expect(profileSubtitle({ title: "   ", role: "manager" })).toBe("Manager");
  });

  it("uses the full name, then email, then a neutral label", () => {
    expect(profileDisplayName({ fullName: "Olena K", email: "o@x.io" })).toBe("Olena K");
    expect(profileDisplayName({ fullName: " ", email: "o@x.io" })).toBe("o@x.io");
    expect(profileDisplayName({ fullName: "", email: null })).toBe("Signed in");
  });
});
