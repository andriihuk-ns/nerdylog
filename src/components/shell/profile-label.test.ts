import { describe, expect, it } from "vitest";
import { profileDisplayName, profileSubtitle } from "./profile-label";

describe("profile labels", () => {
  it("shows the Slack title under the name", () => {
    expect(profileSubtitle({ title: "Product Designer" }, "Member")).toBe("Product Designer");
  });

  it("falls back to the role label when the title is null or blank", () => {
    expect(profileSubtitle({ title: null }, "Admin")).toBe("Admin");
    expect(profileSubtitle({ title: "   " }, "Менеджер")).toBe("Менеджер");
  });

  it("uses the full name, then email, then the neutral label", () => {
    expect(profileDisplayName({ fullName: "Olena K", email: "o@x.io" }, "Signed in")).toBe("Olena K");
    expect(profileDisplayName({ fullName: " ", email: "o@x.io" }, "Signed in")).toBe("o@x.io");
    expect(profileDisplayName({ fullName: "", email: null }, "Signed in")).toBe("Signed in");
  });
});
