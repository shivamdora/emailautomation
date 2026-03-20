"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { productContent } from "@/content/product";
import { SafeHtmlContent } from "@/components/shared/safe-html-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { InboxThreadDetail, InboxThreadSummary } from "@/lib/inbox/threads";
import { cn } from "@/lib/utils";

function formatThreadDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

export function ThreadViewer({
  initialThreads,
  initialSelectedThread,
  initialHasMore,
}: {
  initialThreads: InboxThreadSummary[];
  initialSelectedThread: InboxThreadDetail | null;
  initialHasMore: boolean;
}) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialSelectedThread?.id ?? initialThreads[0]?.id ?? null);
  const [threadCache, setThreadCache] = useState<Record<string, InboxThreadDetail>>(
    initialSelectedThread ? { [initialSelectedThread.id]: initialSelectedThread } : {},
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const viewerCopy = productContent.inbox.viewer;
  const selectedSummary = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [selectedThreadId, threads],
  );
  const selectedThread = useMemo(
    () => (selectedThreadId ? threadCache[selectedThreadId] ?? null : null),
    [selectedThreadId, threadCache],
  );
  const isLoadingDetail = Boolean(selectedThreadId) && !selectedThread;

  useEffect(() => {
    const nextSelectedThreadId = selectedThreadId ?? threads[0]?.id ?? null;

    if (!nextSelectedThreadId) {
      return;
    }

    if (threadCache[nextSelectedThreadId]) {
      return;
    }

    let cancelled = false;

    fetch(`/api/inbox/threads/${nextSelectedThreadId}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load the selected thread.");
        }

        return payload as InboxThreadDetail;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setThreadCache((current) => ({
          ...current,
          [payload.id]: payload,
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load the selected thread.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, threadCache, threads]);

  function handleDisposition(replyDisposition: "negative" | "booked" | "positive" | "question" | "other") {
    if (!selectedThread) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/inbox/disposition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadRecordId: selectedThread.id,
          replyDisposition,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        toast.error(payload?.error ?? "Failed to update reply disposition");
        return;
      }

      router.refresh();
      toast.success(`Marked thread as ${replyDisposition}.`);
    });
  }

  const renderedMessage = selectedThread?.renderedMessage ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="card-shadow overflow-hidden">
        <CardHeader>
          <CardTitle>{viewerCopy.listTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-3">
          {threads.length ? (
            <>
              <div className="max-h-[32rem] overflow-y-auto pr-1">
                <div className="grid gap-3">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={cn(
                        "glass-control rounded-[1.35rem] px-4 py-3 text-left transition hover:border-white/90",
                        selectedThreadId === thread.id
                          ? "border-[rgba(118,174,201,0.42)] bg-[linear-gradient(180deg,rgba(215,237,247,0.9),rgba(250,253,255,0.82))]"
                          : "",
                      )}
                    >
                      <p className="truncate text-sm font-semibold text-foreground">
                        {thread.subject ?? viewerCopy.untitledThreadLabel}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{thread.senderEmail ?? "Unknown sender"}</span>
                        <span className="shrink-0">{formatThreadDate(thread.receivedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoadingMore}
                  onClick={() => {
                    setIsLoadingMore(true);

                    fetch(`/api/inbox/threads?limit=10&offset=${threads.length}`)
                      .then(async (response) => {
                        const payload = await response.json().catch(() => null);

                        if (!response.ok) {
                          throw new Error(payload?.error ?? "Failed to load more threads.");
                        }

                        return payload as { threads: InboxThreadSummary[]; hasMore: boolean };
                      })
                      .then((payload) => {
                        setThreads((current) => [...current, ...payload.threads]);
                        setHasMore(payload.hasMore);
                      })
                      .catch((error) => {
                        toast.error(error instanceof Error ? error.message : "Failed to load more threads.");
                      })
                      .finally(() => {
                        setIsLoadingMore(false);
                      });
                  }}
                >
                  {isLoadingMore ? "Loading..." : "Load more"}
                </Button>
              ) : null}
            </>
          ) : (
            <div className="glass-control rounded-[1.5rem] px-4 py-5">
              <p className="font-medium text-foreground">{viewerCopy.emptyListTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{viewerCopy.emptyListDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="card-shadow">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{selectedSummary?.subject ?? selectedThread?.subject ?? viewerCopy.emptyThreadTitle}</CardTitle>
              {renderedMessage ? (
                <p className="text-sm text-muted-foreground">
                  {renderedMessage.from_email ?? "Unknown sender"} · {formatThreadDate(renderedMessage.sent_at)}
                </p>
              ) : null}
            </div>
            {selectedThread?.replyDisposition ? (
              <Badge variant={selectedThread.replyDisposition === "negative" ? "danger" : selectedThread.replyDisposition === "booked" ? "success" : "neutral"}>
                {selectedThread.replyDisposition}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {selectedThread?.campaignContactId ? (
            <div className="glass-control flex flex-wrap items-center gap-2 rounded-[1.25rem] p-3">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Workflow disposition
              </span>
              <Button size="sm" variant="outline" type="button" disabled={isPending} onClick={() => handleDisposition("negative")}>
                Stop
              </Button>
              <Button size="sm" variant="outline" type="button" disabled={isPending} onClick={() => handleDisposition("booked")}>
                Booked
              </Button>
              <Button size="sm" variant="outline" type="button" disabled={isPending} onClick={() => handleDisposition("positive")}>
                Positive
              </Button>
              <Button size="sm" variant="outline" type="button" disabled={isPending} onClick={() => handleDisposition("question")}>
                Question
              </Button>
              <Button size="sm" variant="outline" type="button" disabled={isPending} onClick={() => handleDisposition("other")}>
                Other
              </Button>
            </div>
          ) : null}
          {isLoadingDetail ? (
            <div className="glass-control rounded-[1.5rem] px-4 py-5 text-sm text-muted-foreground">
              Loading thread...
            </div>
          ) : renderedMessage ? (
            <div className="glass-control rounded-[1.5rem] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{renderedMessage.from_email ?? "Unknown sender"}</p>
                  <p className="text-sm text-muted-foreground">
                    {renderedMessage.subject ?? selectedThread?.subject ?? viewerCopy.emptyThreadTitle}
                  </p>
                </div>
                <Badge variant={renderedMessage.direction === "inbound" ? "success" : "neutral"}>
                  {renderedMessage.direction === "inbound" ? viewerCopy.inboundLabel : viewerCopy.outboundLabel}
                </Badge>
              </div>
              {renderedMessage.body_html ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-white/65 bg-white p-4 text-sm leading-6 text-slate-700">
                  <SafeHtmlContent html={renderedMessage.body_html} />
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-white/65 bg-white/78 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {renderedMessage.body_text ?? productContent.shared.noBodyLabel}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-control rounded-[1.5rem] px-4 py-5">
              <p className="font-medium text-foreground">{viewerCopy.emptyThreadTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{viewerCopy.emptyThreadDescription}</p>
            </div>
          )}
          {selectedThread ? (
            <form
              className="glass-control grid gap-3 rounded-[1.5rem] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const response = await fetch("/api/inbox/reply", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      threadRecordId: selectedThread.id,
                      body: draft,
                    }),
                  });

                  if (!response.ok) {
                    const error = await response.json().catch(() => null);
                    toast.error(error?.error ?? viewerCopy.sendReplyError);
                    return;
                  }

                  setDraft("");
                  router.refresh();
                  toast.success(viewerCopy.sendReplySuccess);
                });
              }}
            >
              <div className="space-y-1">
                <p className="font-medium">{viewerCopy.replyCardTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {viewerCopy.replyCardDescription}
                </p>
              </div>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={viewerCopy.replyPlaceholder}
              />
              <Button type="submit" disabled={isPending || !draft.trim()}>
                {isPending ? viewerCopy.sendingReplyLabel : viewerCopy.sendReplyLabel}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
