import "server-only";
import { cache } from "react";
import {
  buildVersionedCacheKey,
  getInboxNamespaceVersion,
  getProjectNamespaceVersion,
  getWorkspaceNamespaceVersion,
} from "@/lib/cache/namespaces";
import { readThroughJsonCache } from "@/lib/cache/redis";
import {
  campaignSummarySchema,
  contactRecordSchema,
  contactTagSchema,
  dashboardMetricsSchema,
  importSummarySchema,
  inboxThreadSummaryBatchSchema,
  projectMetricsSchema,
  replyRateSchema,
  templateListItemSchema,
} from "@/lib/cache/schemas";
import {
  getReplyRateByCampaign,
  listInboxThreadSummaries,
  listWorkspaceProjectMetrics,
} from "@/services/analytics-service";
import { listCampaigns, listTemplates } from "@/services/campaign-service";
import { listContacts, listImports, listWorkspaceContactTags } from "@/services/import-service";

const getCachedWorkspaceProjectMetricsInternal = cache(
  async (userId: string, workspaceId: string) => {
    const workspaceVersion = await getWorkspaceNamespaceVersion(userId, workspaceId);
    const key = buildVersionedCacheKey(workspaceVersion, [
      "dashboard-project-metrics",
      "user",
      userId,
      "workspace",
      workspaceId,
      "project",
      "all",
    ]);

    return readThroughJsonCache({
      key,
      label: "dashboard-project-metrics",
      ttlSeconds: 30,
      schema: projectMetricsSchema.array(),
      load: () => listWorkspaceProjectMetrics(workspaceId),
    });
  },
);

export async function getCachedWorkspaceProjectMetrics(userId: string, workspaceId: string) {
  return getCachedWorkspaceProjectMetricsInternal(userId, workspaceId);
}

export async function getCachedDashboardMetrics(
  userId: string,
  workspaceId: string,
  projectId?: string,
) {
  const workspaceVersion = await getWorkspaceNamespaceVersion(userId, workspaceId);
  const key = buildVersionedCacheKey(workspaceVersion, [
    "dashboard-metrics",
    "user",
    userId,
    "workspace",
    workspaceId,
    "project",
    projectId ?? "all",
  ]);

  return readThroughJsonCache({
    key,
    label: "dashboard-metrics",
    ttlSeconds: 30,
    schema: dashboardMetricsSchema,
    load: async () => {
      const allMetrics = await getCachedWorkspaceProjectMetrics(userId, workspaceId);

      if (projectId) {
        const projectMetrics = allMetrics.find((item) => item.projectId === projectId);

        return (
          projectMetrics ?? {
            totalLeads: 0,
            queued: 0,
            sent: 0,
            followupSent: 0,
            replied: 0,
            unsubscribed: 0,
            failed: 0,
            replyRate: 0,
          }
        );
      }

      return allMetrics.reduce(
        (totals, item) => {
          totals.totalLeads += item.totalLeads;
          totals.queued += item.queued;
          totals.sent += item.sent;
          totals.followupSent += item.followupSent;
          totals.replied += item.replied;
          totals.unsubscribed += item.unsubscribed;
          totals.failed += item.failed;

          return totals;
        },
        {
          totalLeads: 0,
          queued: 0,
          sent: 0,
          followupSent: 0,
          replied: 0,
          unsubscribed: 0,
          failed: 0,
          replyRate: 0,
        },
      );
    },
  }).then((metrics) => ({
    ...metrics,
    replyRate: metrics.sent ? Number(((metrics.replied / metrics.sent) * 100).toFixed(1)) : 0,
  }));
}

export async function getCachedReplyRateByCampaign(
  userId: string,
  workspaceId: string,
  projectId?: string,
) {
  const workspaceVersion = await getWorkspaceNamespaceVersion(userId, workspaceId);
  const key = buildVersionedCacheKey(workspaceVersion, [
    "analytics",
    "user",
    userId,
    "workspace",
    workspaceId,
    "project",
    projectId ?? "all",
  ]);

  return readThroughJsonCache({
    key,
    label: "reply-rate-by-campaign",
    ttlSeconds: 30,
    schema: replyRateSchema.array(),
    load: () => getReplyRateByCampaign(workspaceId, projectId ? { projectId } : undefined),
  });
}

export async function getCachedCampaigns(userId: string, workspaceId: string, projectId: string) {
  const projectVersion = await getProjectNamespaceVersion(userId, workspaceId, projectId);
  const key = buildVersionedCacheKey(projectVersion, [
    "campaigns",
    "user",
    userId,
    "workspace",
    workspaceId,
    "project",
    projectId,
  ]);

  return readThroughJsonCache({
    key,
    label: "campaigns",
    ttlSeconds: 60,
    schema: campaignSummarySchema.array(),
    load: () => listCampaigns(workspaceId, projectId),
  });
}

export async function getCachedContacts(userId: string, workspaceId: string, projectId: string) {
  const projectVersion = await getProjectNamespaceVersion(userId, workspaceId, projectId);
  const key = buildVersionedCacheKey(projectVersion, [
    "contacts",
    "user",
    userId,
    "workspace",
    workspaceId,
    "project",
    projectId,
  ]);

  return readThroughJsonCache({
    key,
    label: "contacts",
    ttlSeconds: 60,
    schema: contactRecordSchema.array(),
    load: () => listContacts(workspaceId, projectId),
  });
}

export async function getCachedWorkspaceContactTags(
  userId: string,
  workspaceId: string,
  projectId: string,
) {
  const projectVersion = await getProjectNamespaceVersion(userId, workspaceId, projectId);
  const key = buildVersionedCacheKey(projectVersion, [
    "contact-tags",
    "user",
    userId,
    "workspace",
    workspaceId,
    "project",
    projectId,
  ]);

  return readThroughJsonCache({
    key,
    label: "contact-tags",
    ttlSeconds: 60,
    schema: contactTagSchema.array(),
    load: () => listWorkspaceContactTags(workspaceId, projectId),
  });
}

export async function getCachedImports(userId: string, workspaceId: string, projectId: string) {
  const projectVersion = await getProjectNamespaceVersion(userId, workspaceId, projectId);
  const key = buildVersionedCacheKey(projectVersion, [
    "imports",
    "user",
    userId,
    "workspace",
    workspaceId,
    "project",
    projectId,
  ]);

  return readThroughJsonCache({
    key,
    label: "imports",
    ttlSeconds: 60,
    schema: importSummarySchema.array(),
    load: () => listImports(workspaceId, projectId),
  });
}

export async function getCachedTemplates(userId: string, workspaceId: string, projectId: string) {
  const projectVersion = await getProjectNamespaceVersion(userId, workspaceId, projectId);
  const key = buildVersionedCacheKey(projectVersion, [
    "templates",
    "user",
    userId,
    "workspace",
    workspaceId,
    "project",
    projectId,
  ]);

  return readThroughJsonCache({
    key,
    label: "templates",
    ttlSeconds: 60,
    schema: templateListItemSchema.array(),
    load: () => listTemplates(workspaceId, projectId),
  });
}

export async function getCachedInboxThreadSummaries(input: {
  userId: string;
  workspaceId: string;
  projectId: string;
  limit: number;
  offset: number;
}) {
  const inboxVersion = await getInboxNamespaceVersion(
    input.userId,
    input.workspaceId,
    input.projectId,
  );
  const key = buildVersionedCacheKey(inboxVersion, [
    "inbox",
    "list",
    "user",
    input.userId,
    "workspace",
    input.workspaceId,
    "project",
    input.projectId,
    "limit",
    input.limit,
    "offset",
    input.offset,
  ]);

  return readThroughJsonCache({
    key,
    label: "inbox-list",
    ttlSeconds: 15,
    schema: inboxThreadSummaryBatchSchema,
    load: () =>
      listInboxThreadSummaries(input.workspaceId, {
        projectId: input.projectId,
        limit: input.limit,
        offset: input.offset,
      }),
  });
}
