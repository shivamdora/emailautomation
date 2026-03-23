import { cache } from "react";
import { buildVersionedCacheKey, getShellNamespaceVersion } from "@/lib/cache/namespaces";
import { readThroughJsonCache } from "@/lib/cache/redis";
import { workspaceContextSchema } from "@/lib/cache/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { buildWorkspaceShellLabel, getWorkspaceOwnerFirstName } from "@/lib/db/workspace-label";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { type ProjectSummary } from "@/lib/projects/shared";
import { env, requireSupabaseConfiguration } from "@/lib/supabase/env";
import { isMissingColumnError as isMissingSchemaColumnError } from "@/lib/utils/supabase-schema";
import {
  bootstrapWorkspaceProjects,
  getWorkspaceProjectsContext,
} from "@/services/project-service";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  kind: "personal" | "shared";
  role: "owner" | "admin" | "member";
};

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceLabel: string;
  workspaceKind: "personal" | "shared";
  workspaceRole: "owner" | "admin" | "member";
  userFirstName: string | null;
  availableWorkspaces: WorkspaceSummary[];
  activeProjectId: string;
  activeProject: ProjectSummary;
  availableProjects: ProjectSummary[];
};

type WorkspaceUserInput = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null } | null;
};

function buildWorkspaceName(email?: string | null, fullName?: string | null) {
  if (fullName?.trim()) {
    return `${fullName.trim()} Workspace`;
  }

  const emailPrefix = email?.split("@")[0]?.trim();
  if (emailPrefix) {
    return `${emailPrefix} Workspace`;
  }

  return "Workspace";
}

function buildWorkspaceSlug(userId: string, email?: string | null, fullName?: string | null) {
  const base = (fullName?.trim() || email?.split("@")[0]?.trim() || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return `${base || "workspace"}-${userId.slice(0, 8)}`;
}

function getSharedWorkspaceConfig() {
  const slug = env.SHARED_WORKSPACE_SLUG?.trim();
  const name = env.SHARED_WORKSPACE_NAME?.trim() || "OutboundFlow Team";

  if (!slug) {
    return null;
  }

  return { slug, name };
}

function inferWorkspaceKind(workspace: {
  slug?: string | null;
  kind?: "personal" | "shared" | null;
}) {
  if (workspace.kind) {
    return workspace.kind;
  }

  const shared = getSharedWorkspaceConfig();
  return workspace.slug && shared?.slug === workspace.slug ? "shared" : "personal";
}

function toWorkspaceBootstrapError(step: string, message: string) {
  const normalizedMessage = message.trim();

  if (
    /Could not find the table ['"]public\./i.test(normalizedMessage) ||
    /relation ["']public\..+["'] does not exist/i.test(normalizedMessage)
  ) {
    return new Error(
      `Failed to bootstrap workspace during ${step}: ${normalizedMessage}. ` +
        "The configured Supabase project is missing the required OutboundFlow tables. " +
        "Apply the latest Supabase migrations to the same project, then reload the app.",
    );
  }

  return new Error(`Failed to bootstrap workspace during ${step}: ${normalizedMessage}`);
}

function isMissingRelationshipError(
  message: string | null | undefined,
  sourceTable: string,
  targetTable: string,
) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes(`relationship between '${sourceTable.toLowerCase()}' and '${targetTable.toLowerCase()}'`) ||
    normalized.includes(`foreign key relationship between '${sourceTable.toLowerCase()}' and '${targetTable.toLowerCase()}'`)
  );
}

async function selectProfileWorkspaceState(userId: string) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("profiles")
    .select("id, full_name, primary_workspace_id, active_workspace_id")
    .eq("id", userId)
    .maybeSingle();

  if (result.error && isMissingSchemaColumnError(result.error.message, "profiles", "active_workspace_id")) {
    result = await supabase
      .from("profiles")
      .select("id, full_name, primary_workspace_id")
      .eq("id", userId)
      .maybeSingle();
  }

  return result;
}

async function selectWorkspaceById(workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("workspaces")
    .select("id, name, slug, kind")
    .eq("id", workspaceId)
    .maybeSingle();

  if (result.error && isMissingSchemaColumnError(result.error.message, "workspaces", "kind")) {
    result = await supabase
      .from("workspaces")
      .select("id, name, slug")
      .eq("id", workspaceId)
      .maybeSingle();
  }

  return result;
}

async function selectWorkspaceBySlug(slug: string) {
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("workspaces")
    .select("id, name, slug, kind")
    .eq("slug", slug)
    .maybeSingle();

  if (result.error && isMissingSchemaColumnError(result.error.message, "workspaces", "kind")) {
    result = await supabase
      .from("workspaces")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle();
  }

  return result;
}

async function insertWorkspaceRecord(input: {
  name: string;
  slug: string;
  kind: "personal" | "shared";
}) {
  const supabase = createAdminSupabaseClient();
  let result = await (
    supabase.from("workspaces") as unknown as {
      insert: (value: Record<string, unknown>) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    }
  )
    .insert(input)
    .select("id, name, slug, kind")
    .single();

  if (result.error && isMissingSchemaColumnError(result.error.message, "workspaces", "kind")) {
    result = await (
      supabase.from("workspaces") as unknown as {
        insert: (value: Record<string, unknown>) => {
          select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      }
    )
      .insert({
        name: input.name,
        slug: input.slug,
      })
      .select("id, name, slug")
      .single();
  }

  return result;
}

async function upsertProfileWorkspaceState(input: {
  id: string;
  full_name: string;
  primary_workspace_id: string;
  active_workspace_id: string;
}) {
  const supabase = createAdminSupabaseClient();
  let result = await (
    supabase.from("profiles") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(input, { onConflict: "id" });

  if (result.error && isMissingSchemaColumnError(result.error.message, "profiles", "active_workspace_id")) {
    result = await (
      supabase.from("profiles") as unknown as {
        upsert: (
          value: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).upsert(
      {
        id: input.id,
        full_name: input.full_name,
        primary_workspace_id: input.primary_workspace_id,
      },
      { onConflict: "id" },
    );
  }

  return result;
}

async function ensureWorkspaceUsageCounter(workspaceId: string) {
  const supabase = createAdminSupabaseClient();

  const { error } = await (
    supabase.from("workspace_usage_counters") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    {
      workspace_id: workspaceId,
      seats_used: 1,
    },
    { onConflict: "workspace_id,period_start" },
  );

  if (error) {
    throw new Error(`Failed to bootstrap workspace usage counters: ${error.message}`);
  }
}

async function ensurePersonalWorkspace(user: {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null } | null;
}) {
  const supabase = createAdminSupabaseClient();
  const { data: rawProfile, error: profileLookupError } = await selectProfileWorkspaceState(user.id);

  if (profileLookupError) {
    throw toWorkspaceBootstrapError("profile lookup", profileLookupError.message);
  }

  const profile = rawProfile as
    | {
        primary_workspace_id?: string | null;
        active_workspace_id?: string | null;
        full_name?: string | null;
      }
    | null;

  const workspaceId = profile?.primary_workspace_id ?? null;
  let workspaceName = buildWorkspaceName(user.email, profile?.full_name ?? user.user_metadata?.full_name);

  if (workspaceId) {
    const { data: rawWorkspace, error: workspaceLookupError } = await selectWorkspaceById(workspaceId);

    if (workspaceLookupError) {
      throw toWorkspaceBootstrapError("workspace lookup", workspaceLookupError.message);
    }

    const workspace = rawWorkspace as
      | { id: string; name?: string | null; slug?: string | null; kind?: "personal" | "shared" | null }
      | null;

    if (workspace) {
      workspaceName = workspace.name ?? workspaceName;
      return {
        id: workspace.id,
        name: workspaceName,
        slug: workspace.slug ?? buildWorkspaceSlug(user.id, user.email, profile?.full_name ?? user.user_metadata?.full_name),
        kind: inferWorkspaceKind(workspace),
      };
    }
  }

  const nextWorkspaceSlug = buildWorkspaceSlug(
    user.id,
    user.email,
    profile?.full_name ?? user.user_metadata?.full_name,
  );
  const { data: insertedWorkspace, error: workspaceError } = await insertWorkspaceRecord({
    name: workspaceName,
    slug: nextWorkspaceSlug,
    kind: "personal",
  });

  if (workspaceError) {
    throw toWorkspaceBootstrapError("workspace creation", workspaceError.message);
  }

  const workspace = insertedWorkspace as {
    id: string;
    name: string;
    slug: string;
    kind?: "personal" | "shared" | null;
  };

  const { error: profileError } = await upsertProfileWorkspaceState({
    id: user.id,
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
    primary_workspace_id: workspace.id,
    active_workspace_id: workspace.id,
  });

  if (profileError) {
    throw new Error(`Failed to bootstrap profile: ${profileError.message}`);
  }

  const { error: membershipError } = await (
    supabase.from("workspace_members") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    {
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (membershipError) {
    throw new Error(`Failed to bootstrap workspace membership: ${membershipError.message}`);
  }

  await ensureWorkspaceUsageCounter(workspace.id);

  return workspace;
}

async function ensureSharedWorkspaceMembership(userId: string) {
  const shared = getSharedWorkspaceConfig();

  if (!shared) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data: existingWorkspace, error: workspaceLookupError } = await selectWorkspaceBySlug(shared.slug);

  if (workspaceLookupError) {
    throw toWorkspaceBootstrapError("shared workspace lookup", workspaceLookupError.message);
  }

  let sharedWorkspace = existingWorkspace as
    | { id: string; name: string; slug: string; kind?: "personal" | "shared" | null }
    | null;

  if (!sharedWorkspace) {
    const { data: insertedWorkspace, error: workspaceError } = await insertWorkspaceRecord({
      name: shared.name,
      slug: shared.slug,
      kind: "shared",
    });

    if (workspaceError) {
      throw toWorkspaceBootstrapError("shared workspace creation", workspaceError.message);
    }

    sharedWorkspace = insertedWorkspace as {
      id: string;
      name: string;
      slug: string;
      kind?: "personal" | "shared" | null;
    };
  }

  const { error: membershipError } = await (
    supabase.from("workspace_members") as unknown as {
      upsert: (
        value: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    {
      workspace_id: sharedWorkspace.id,
      user_id: userId,
      role: "member",
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (membershipError) {
    throw new Error(`Failed to join shared workspace: ${membershipError.message}`);
  }

  await ensureWorkspaceUsageCounter(sharedWorkspace.id);

  return {
    id: sharedWorkspace.id,
    name: sharedWorkspace.name,
    slug: sharedWorkspace.slug,
    kind: inferWorkspaceKind(sharedWorkspace),
  };
}

async function ensureWorkspaceMemberships(user: {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null } | null;
}) {
  const personalWorkspace = await ensurePersonalWorkspace(user);
  const sharedWorkspace = await ensureSharedWorkspaceMembership(user.id);
  const { data: rawProfile, error: profileError } = await selectProfileWorkspaceState(user.id);

  if (profileError) {
    throw toWorkspaceBootstrapError("active workspace lookup", profileError.message);
  }

  const profile = rawProfile as
    | {
        id: string;
        full_name?: string | null;
        primary_workspace_id?: string | null;
        active_workspace_id?: string | null;
      }
    | null;

  const activeWorkspaceId = profile?.active_workspace_id ?? sharedWorkspace?.id ?? personalWorkspace.id;
  const nextPrimaryWorkspaceId = profile?.primary_workspace_id ?? personalWorkspace.id;

  const { error: profileUpdateError } = await upsertProfileWorkspaceState({
    id: user.id,
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
    primary_workspace_id: nextPrimaryWorkspaceId,
    active_workspace_id: activeWorkspaceId,
  });

  if (profileUpdateError) {
    throw new Error(`Failed to save active workspace: ${profileUpdateError.message}`);
  }
}

export async function bootstrapWorkspaceForUser(user: WorkspaceUserInput) {
  requireSupabaseConfiguration();

  await ensureWorkspaceMemberships(user);

  const [availableWorkspaces, rawProfileResult] = await Promise.all([
    listUserWorkspaces(user.id),
    selectProfileWorkspaceState(user.id),
  ]);

  const profile = rawProfileResult.data as
    | {
        primary_workspace_id?: string | null;
        active_workspace_id?: string | null;
      }
    | null;

  const activeWorkspace =
    availableWorkspaces.find(
      (workspace) => workspace.id === (profile?.active_workspace_id ?? profile?.primary_workspace_id),
    ) ??
    availableWorkspaces[0];

  if (!activeWorkspace) {
    throw new Error("No workspace membership found.");
  }

  await bootstrapWorkspaceProjects({
    workspaceId: activeWorkspace.id,
    workspaceName: activeWorkspace.name,
    userId: user.id,
  });
}

export async function listUserWorkspaces(userId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  let result = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug, kind)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (result.error && isMissingSchemaColumnError(result.error.message, "workspaces", "kind")) {
    result = await supabase
      .from("workspace_members")
      .select("role, workspaces(id, name, slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
  }

  const { data, error } = result;

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    role: "owner" | "admin" | "member";
    workspaces?: { id: string; name: string; slug: string; kind?: "personal" | "shared" | null } | null;
  }>)
    .flatMap((membership) => {
      if (!membership.workspaces) {
        return [];
      }

      return [
        {
          id: membership.workspaces.id,
          name: membership.workspaces.name,
          slug: membership.workspaces.slug,
          kind: inferWorkspaceKind(membership.workspaces),
          role: membership.role,
        } satisfies WorkspaceSummary,
      ];
    })
    .sort((left, right) => {
      if (left.kind === right.kind) {
        return left.name.localeCompare(right.name);
      }

      return left.kind === "shared" ? -1 : 1;
    });
}

export async function setActiveWorkspace(userId: string, workspaceId: string) {
  requireSupabaseConfiguration();
  const workspaces = await listUserWorkspaces(userId);

  if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
    throw new Error("Workspace access denied.");
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("profiles").update({ active_workspace_id: workspaceId }).eq("id", userId);

  if (error && !isMissingSchemaColumnError(error.message, "profiles", "active_workspace_id")) {
    throw error;
  }

  return { workspaceId };
}

export async function listWorkspaceMembers(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("workspace_members")
    .select("id, role, user_id, profiles(full_name, title)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (result.error && isMissingRelationshipError(result.error.message, "workspace_members", "profiles")) {
    const membershipsResult = await supabase
      .from("workspace_members")
      .select("id, role, user_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (membershipsResult.error) {
      throw membershipsResult.error;
    }

    const memberships = (membershipsResult.data ?? []) as Array<{
      id: string;
      role: "owner" | "admin" | "member";
      user_id: string;
    }>;
    const profileIds = memberships.map((member) => member.user_id).filter(Boolean);
    let profilesById = new Map<string, { full_name?: string | null; title?: string | null }>();

    if (profileIds.length) {
      const { data: rawProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, title")
        .in("id", profileIds);

      if (profilesError) {
        throw profilesError;
      }

      profilesById = new Map(
        ((rawProfiles ?? []) as Array<{ id: string; full_name?: string | null; title?: string | null }>).map(
          (profile) => [
            profile.id,
            {
              full_name: profile.full_name ?? null,
              title: profile.title ?? null,
            },
          ],
        ),
      );
    }

    return memberships.map((member) => ({
      id: member.id,
      role: member.role,
      userId: member.user_id,
      fullName: profilesById.get(member.user_id)?.full_name ?? "Teammate",
      title: profilesById.get(member.user_id)?.title ?? null,
    }));
  }

  const { data, error } = result;

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    role: "owner" | "admin" | "member";
    user_id: string;
    profiles?: { full_name?: string | null; title?: string | null } | null;
  }>).map((member) => ({
    id: member.id,
    role: member.role,
    userId: member.user_id,
    fullName: member.profiles?.full_name ?? "Teammate",
    title: member.profiles?.title ?? null,
  }));
}

async function loadWorkspaceContextForUser(
  user: WorkspaceUserInput,
  options?: { allowBootstrap?: boolean },
): Promise<WorkspaceContext> {
  requireSupabaseConfiguration();

  const [availableWorkspaces, rawProfileResult] = await Promise.all([
    listUserWorkspaces(user.id),
    selectProfileWorkspaceState(user.id),
  ]);

  const profile = rawProfileResult.data as
    | {
        full_name?: string | null;
        primary_workspace_id?: string | null;
        active_workspace_id?: string | null;
      }
    | null;

  const activeWorkspace =
    availableWorkspaces.find(
      (workspace) => workspace.id === (profile?.active_workspace_id ?? profile?.primary_workspace_id),
    ) ??
    availableWorkspaces[0];

  if (!activeWorkspace) {
    if (options?.allowBootstrap) {
      await bootstrapWorkspaceForUser(user);
      return loadWorkspaceContextForUser(user, { allowBootstrap: false });
    }

    throw new Error("No workspace membership found.");
  }

  const fullName = profile?.full_name ?? (user.user_metadata?.full_name as string | null | undefined) ?? null;
  const userFirstName = getWorkspaceOwnerFirstName({
    fullName,
    workspaceName: activeWorkspace.name,
    email: user.email,
  });
  let projectContext: Awaited<ReturnType<typeof getWorkspaceProjectsContext>>;

  try {
    projectContext = await getWorkspaceProjectsContext({
      workspaceId: activeWorkspace.id,
      userId: user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workspace projects.";

    if (options?.allowBootstrap && message === "No workspace projects found.") {
      await bootstrapWorkspaceProjects({
        workspaceId: activeWorkspace.id,
        workspaceName: activeWorkspace.name,
        userId: user.id,
      });

      projectContext = await getWorkspaceProjectsContext({
        workspaceId: activeWorkspace.id,
        userId: user.id,
      });
    } else {
      throw error;
    }
  }

  return {
    userId: user.id,
    workspaceId: activeWorkspace.id,
    workspaceName: activeWorkspace.name,
    workspaceKind: activeWorkspace.kind,
    workspaceRole: activeWorkspace.role,
    workspaceLabel: buildWorkspaceShellLabel({
      fullName,
      workspaceName: activeWorkspace.name,
      email: user.email,
    }),
    userFirstName,
    availableWorkspaces,
    activeProjectId: projectContext.activeProject.id,
    activeProject: projectContext.activeProject,
    availableProjects: projectContext.availableProjects,
  };
}

const getWorkspaceContextForUser = cache(
  async (userId: string, email: string | null, fullName: string | null) => {
    const shellVersion = await getShellNamespaceVersion(userId);
    const key = buildVersionedCacheKey(shellVersion, ["shell", "user", userId]);

    return readThroughJsonCache({
      key,
      label: "workspace-shell",
      ttlSeconds: 120,
      schema: workspaceContextSchema,
      load: () =>
      loadWorkspaceContextForUser(
        {
          id: userId,
          email,
          user_metadata: fullName ? { full_name: fullName } : null,
        },
          { allowBootstrap: false },
        ),
    });
  },
);

export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  requireSupabaseConfiguration();
  const user = await getSessionUser();

  if (!user) {
    throw new Error("No authenticated user session.");
  }

  return getWorkspaceContextForUser(
    user.id,
    user.email ?? null,
    (user.user_metadata?.full_name as string | null | undefined) ?? null,
  );
});
