import { describe, expect, it } from "vitest";
import {
  getDefaultOpenNavigationKeys,
  isNavigationItemActive,
  type ShellNavigationItem,
} from "@/lib/layout/navigation";

const items: ShellNavigationItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    href: "/campaigns",
    label: "Campaigns",
    children: [
      { href: "/templates", label: "Email Templates" },
      { href: "/inbox", label: "Inbox" },
    ],
  },
  {
    href: "/contacts",
    label: "Contacts",
    children: [{ href: "/imports", label: "Import Contact" }],
  },
];

describe("navigation helpers", () => {
  it("marks parents active when a child route is active", () => {
    expect(isNavigationItemActive(items[1], "/templates")).toBe(true);
    expect(isNavigationItemActive(items[2], "/imports")).toBe(true);
  });

  it("opens active parent groups by default", () => {
    expect(getDefaultOpenNavigationKeys(items, "/inbox")).toEqual(["/campaigns"]);
    expect(getDefaultOpenNavigationKeys(items, "/contacts")).toEqual(["/contacts"]);
  });
});
