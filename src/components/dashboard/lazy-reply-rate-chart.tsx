"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ReplyRateChart = dynamic(
  () => import("@/components/dashboard/reply-rate-chart").then((module) => module.ReplyRateChart),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle>Reply rate by campaign</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px] min-w-0 animate-pulse rounded-[1.5rem] bg-muted/40" />
      </Card>
    ),
    ssr: false,
  },
);

export function LazyReplyRateChart({
  data,
  title,
}: {
  data: Array<{ name: string; replyRate: number }>;
  title: string;
}) {
  return <ReplyRateChart data={data} title={title} />;
}
