import { describe, expect, it } from "vitest";
import { buildProjectSlug, getProjectMonogram } from "@/lib/projects/shared";

describe("project shared helpers", () => {
  it("builds stable project slugs from names", () => {
    expect(buildProjectSlug("Shelter Score Launch")).toBe("shelter-score-launch");
    expect(buildProjectSlug("  Jayant's Project  ")).toBe("jayant-s-project");
  });

  it("adds a suffix when requested", () => {
    expect(buildProjectSlug("Outbound", "Team A")).toBe("outbound-team-a");
  });

  it("builds project monograms from brand or project names", () => {
    expect(getProjectMonogram({ name: "Outbound Flow", brand_name: null })).toBe("OF");
    expect(getProjectMonogram({ name: "Project", brand_name: "Shelter Score" })).toBe("SS");
  });
});
