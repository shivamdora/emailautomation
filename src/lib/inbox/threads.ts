export type InboxThreadMessage = {
  id: string;
  direction: string;
  from_email: string | null;
  to_emails?: string[] | null;
  subject: string | null;
  body_text: string | null;
  body_html?: string | null;
  sent_at: string;
};

export type InboxThreadSummary = {
  id: string;
  subject: string | null;
  senderEmail: string | null;
  receivedAt: string | null;
};

export type InboxThreadDetail = {
  id: string;
  subject: string | null;
  latestMessageAt: string | null;
  campaignContactId: string | null;
  campaignStatus: string | null;
  replyDisposition: string | null;
  renderedMessage: InboxThreadMessage | null;
};

type InboxThreadRecord = {
  id: string;
  subject: string | null;
  latest_message_at: string | null;
  campaign_contact_id?: string | null;
  campaign_status?: string | null;
  reply_disposition?: string | null;
  messages?: InboxThreadMessage[] | null;
};

function sortMessagesNewestFirst(messages: InboxThreadMessage[]) {
  return [...messages].sort((left, right) => {
    const rightTimestamp = Date.parse(right.sent_at);
    const leftTimestamp = Date.parse(left.sent_at);
    return rightTimestamp - leftTimestamp;
  });
}

export function selectInboxDisplayMessage(messages: InboxThreadMessage[] | null | undefined) {
  const sortedMessages = sortMessagesNewestFirst(messages ?? []);
  const latestInboundMessage = sortedMessages.find((message) => message.direction === "inbound");
  return latestInboundMessage ?? sortedMessages[0] ?? null;
}

export function mapInboxThreadSummary(thread: InboxThreadRecord): InboxThreadSummary {
  const displayMessage = selectInboxDisplayMessage(thread.messages);

  return {
    id: thread.id,
    subject: thread.subject ?? displayMessage?.subject ?? null,
    senderEmail: displayMessage?.from_email ?? null,
    receivedAt: displayMessage?.sent_at ?? thread.latest_message_at ?? null,
  };
}

export function mapInboxThreadDetail(thread: InboxThreadRecord): InboxThreadDetail {
  const renderedMessage = selectInboxDisplayMessage(thread.messages);

  return {
    id: thread.id,
    subject: thread.subject ?? renderedMessage?.subject ?? null,
    latestMessageAt: thread.latest_message_at ?? renderedMessage?.sent_at ?? null,
    campaignContactId: thread.campaign_contact_id ?? null,
    campaignStatus: thread.campaign_status ?? null,
    replyDisposition: thread.reply_disposition ?? null,
    renderedMessage,
  };
}
