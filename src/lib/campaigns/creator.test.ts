import { describe, expect, it } from "vitest";
import {
  buildLaunchChecklist,
  describeWorkflowRoute,
  formatSendWindowSummary,
  getSendWindowPresetId,
  isAdvancedWorkflow,
} from "@/lib/campaigns/creator";

describe("campaign creator helpers", () => {
  it("treats the default two-step flow as non-advanced", () => {
    expect(
      isAdvancedWorkflow([
        {
          subject: "Quick idea for {{company}}",
          mode: "text",
          body: "Hello there from the first step.",
          waitDays: 2,
          branchCondition: "time",
          onMatch: "next_step",
          onNoMatch: "next_step",
        },
        {
          subject: "Following up",
          mode: "text",
          body: "Checking back on my first note.",
          waitDays: 0,
          branchCondition: "time",
          onMatch: "exit_sequence",
          onNoMatch: "exit_sequence",
        },
      ]),
    ).toBe(false);
  });

  it("flags branching or extra steps as advanced", () => {
    expect(
      isAdvancedWorkflow([
        {
          subject: "Quick idea for {{company}}",
          mode: "text",
          body: "Hello there from the first step.",
          waitDays: 2,
          branchCondition: "opened",
          onMatch: "exit_sequence",
          onNoMatch: "next_step",
        },
        {
          subject: "Following up",
          mode: "text",
          body: "Checking back on my first note.",
          waitDays: 0,
          branchCondition: "time",
          onMatch: "exit_sequence",
          onNoMatch: "exit_sequence",
        },
      ]),
    ).toBe(true);

    expect(
      isAdvancedWorkflow([
        {
          subject: "Step 1",
          mode: "text",
          body: "One",
        },
        {
          subject: "Step 2",
          mode: "text",
          body: "Two",
        },
        {
          subject: "Step 3",
          mode: "text",
          body: "Three",
        },
      ]),
    ).toBe(true);
  });

  it("builds a launch checklist from sender, audience, and message state", () => {
    expect(
      buildLaunchChecklist({
        hasSender: true,
        selectedContactsCount: 3,
        primaryStep: {
          subject: "Quick idea for {{company}}",
          mode: "text",
          body: "This is a complete primary email body.",
        },
        followUpStep: {
          subject: "Following up",
          mode: "html",
          bodyHtml: "<p>This is a complete follow-up body.</p>",
        },
      }).every((item) => item.complete),
    ).toBe(true);
  });

  it("describes branch routing in plain language", () => {
    expect(
      describeWorkflowRoute({
        subject: "Follow up",
        mode: "text",
        body: "Checking in again.",
        waitDays: 3,
        branchCondition: "clicked",
        onMatch: "exit_sequence",
        onNoMatch: "next_step",
      }),
    ).toContain("clicks a tracked link");
  });

  it("matches window presets and formats the summary", () => {
    expect(getSendWindowPresetId("09:00", "17:00")).toBe("business-hours");
    expect(getSendWindowPresetId("10:00", "16:00")).toBe("custom");
    expect(formatSendWindowSummary("Asia/Calcutta", "09:00", "17:00")).toBe(
      "09:00 - 17:00 (Asia/Calcutta)",
    );
  });
});
