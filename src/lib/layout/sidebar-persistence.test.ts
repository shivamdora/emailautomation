import { describe, expect, it } from "vitest";
import {
  parseSidebarCollapsed,
  serializeSidebarCollapsed,
} from "@/lib/layout/sidebar-persistence";

describe("sidebar persistence helpers", () => {
  it("parses stored values safely", () => {
    expect(parseSidebarCollapsed("true")).toBe(true);
    expect(parseSidebarCollapsed("false")).toBe(false);
    expect(parseSidebarCollapsed(null)).toBe(false);
  });

  it("serializes values consistently", () => {
    expect(serializeSidebarCollapsed(true)).toBe("true");
    expect(serializeSidebarCollapsed(false)).toBe("false");
  });
});
