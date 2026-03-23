import { describe, expect, it } from "vitest";
import {
  mapInboxThreadDetail,
  mapInboxThreadSummary,
  selectInboxDisplayMessage,
  type InboxThreadMessage,
} from "@/lib/inbox/threads";

const messages: InboxThreadMessage[] = [
  {
    id: "out-1",
    direction: "outbound",
    from_email: "sender@example.com",
    subject: "Initial send",
    body_text: "Hello",
    body_html: "<p>Hello</p>",
    sent_at: "2026-03-19T09:00:00.000Z",
  },
  {
    id: "in-1",
    direction: "inbound",
    from_email: "lead@example.com",
    subject: "Re: Initial send",
    body_text: "Interested",
    body_html: "<p>Interested</p>",
    sent_at: "2026-03-20T12:30:00.000Z",
  },
];

describe("inbox thread helpers", () => {
  it("prefers the latest inbound message for summary and detail rendering", () => {
    expect(selectInboxDisplayMessage(messages)?.id).toBe("in-1");

    const summary = mapInboxThreadSummary({
      id: "thread-1",
      subject: "Campaign reply",
      latest_message_at: "2026-03-20T12:30:00.000Z",
      messages,
    });

    expect(summary.senderEmail).toBe("lead@example.com");
    expect(summary.receivedAt).toBe("2026-03-20T12:30:00.000Z");

    const detail = mapInboxThreadDetail({
      id: "thread-1",
      subject: "Campaign reply",
      latest_message_at: "2026-03-20T12:30:00.000Z",
      campaign_contact_id: "contact-1",
      reply_disposition: "positive",
      messages,
    });

    expect(detail.renderedMessage?.id).toBe("in-1");
    expect(detail.replyDisposition).toBe("positive");
  });

  it("falls back to the newest message when no inbound message exists", () => {
    const detail = mapInboxThreadDetail({
      id: "thread-2",
      subject: null,
      latest_message_at: "2026-03-20T15:00:00.000Z",
      messages: [
        {
          id: "out-1",
          direction: "outbound",
          from_email: "sender@example.com",
          subject: "Follow up",
          body_text: "Checking in",
          body_html: null,
          sent_at: "2026-03-20T15:00:00.000Z",
        },
      ],
    });

    expect(detail.renderedMessage?.from_email).toBe("sender@example.com");
    expect(detail.subject).toBe("Follow up");
  });
});
