import { describe, expect, it } from "vitest";
import {
  computeNextScheduledSendAt,
  computeNextWindowStartAt,
  isTerminalCampaignContactStatus,
} from "@/lib/campaigns/send-queue-shared";

describe("campaign send queue scheduling", () => {
  it("keeps the same timestamp when the base time is already inside the send window", () => {
    expect(
      computeNextScheduledSendAt({
        baseSentAt: "2026-03-20T05:00:00.000Z",
        waitDays: 0,
        timezone: "Asia/Calcutta",
        sendWindowStart: "09:00",
        sendWindowEnd: "17:00",
      }),
    ).toBe("2026-03-20T05:00:00.000Z");
  });

  it("clamps an initial send to the same-day window start when launched too early", () => {
    expect(
      computeNextScheduledSendAt({
        baseSentAt: "2026-03-20T01:00:00.000Z",
        waitDays: 0,
        timezone: "Asia/Calcutta",
        sendWindowStart: "09:00",
        sendWindowEnd: "17:00",
      }),
    ).toBe("2026-03-20T03:30:00.000Z");
  });

  it("rolls a weekend follow-up to the next allowed day at window start", () => {
    expect(
      computeNextScheduledSendAt({
        baseSentAt: "2026-03-20T05:00:00.000Z",
        waitDays: 1,
        timezone: "Asia/Calcutta",
        sendWindowStart: "09:00",
        sendWindowEnd: "17:00",
      }),
    ).toBe("2026-03-23T03:30:00.000Z");
  });

  it("preserves the local clock across a DST boundary when the send day stays allowed", () => {
    expect(
      computeNextScheduledSendAt({
        baseSentAt: "2026-03-06T15:30:00.000Z",
        waitDays: 3,
        timezone: "America/New_York",
        sendWindowStart: "09:00",
        sendWindowEnd: "17:00",
        allowedSendDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      }),
    ).toBe("2026-03-09T14:30:00.000Z");
  });

  it("moves daily-cap reschedules to the next window start", () => {
    expect(
      computeNextWindowStartAt({
        baseAt: "2026-03-20T05:00:00.000Z",
        timezone: "Asia/Calcutta",
        sendWindowStart: "09:00",
      }),
    ).toBe("2026-03-23T03:30:00.000Z");
  });

  it("recognizes terminal campaign contact states", () => {
    expect(isTerminalCampaignContactStatus("replied")).toBe(true);
    expect(isTerminalCampaignContactStatus("meeting_booked")).toBe(true);
    expect(isTerminalCampaignContactStatus("queued")).toBe(false);
  });
});
