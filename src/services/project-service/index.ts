import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env, requireSupabaseConfiguration } from "@/lib/supabase/env";
import {
  buildProjectSlug,
  type ProjectMailboxRegistryItem,
  type ProjectSummary,
} from "@/lib/projects/shared";
import {
  ensureDefaultTemplatesForProject,
  ensureDefaultTemplatesForProjects,
} from "@/services/template-seed-service";

function toProjectServiceError(step: string, error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : `Unknown project service error during ${step}.`;

  if (
    /Could not find the table ['"]public\.projects['"]/i.test(message) ||
    /relation ["']public\.projects["'] does not exist/i.test(message) ||
    /column .*last_active_project_id/i.test(message) ||
    /column .*project_id/i.test(message)
  ) {
    return new Error(
      `Project setup requires the latest Supabase migrations. Failed during ${step}: ${message}. ` +
        "Apply the current migrations, including project scoping, then reload the app.",
    );
  }

  return error instanceof Error ? error : new Error(`Project setup failed during ${step}: ${message}`);
}

function mapProjectRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    name: String(row.name),
    slug: String(row.slug),
    website: (row.website as string | null | undefined) ?? null,
    logo_url: (row.logo_url as string | null | undefined) ?? null,
    brand_name: (row.brand_name as string | null | undefined) ?? null,
    sender_display_name: (row.sender_display_name as string | null | undefined) ?? null,
    sender_title: (row.sender_title as string | null | undefined) ?? null,
    sender_signature: (row.sender_signature as string | null | undefined) ?? null,
  } satisfies ProjectSummary;
}

async function selectWorkspaceProjects(workspaceId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, workspace_id, name, slug, website, logo_url, brand_name, sender_display_name, sender_title, sender_signature",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    throw toProjectServiceError("loading workspace projects", error);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(mapProjectRow);
}

async function ensureDefaultProject(input: {
  workspaceId: string;
  userId: string;
  workspaceName: string;
}) {
  const supabase = createAdminSupabaseClient();
  const payload = {
    workspace_id: input.workspaceId,
    name: "Main Project",
    slug: "main-project",
    brand_name: input.workspaceName,
    created_by_user_id: input.userId,
  };

  const { data, error } = await (
    supabase.from("projects") as unknown as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    }
  )
    .upsert(payload, { onConflict: "workspace_id,slug" })
    .select(
      "id, workspace_id, name, slug, website, logo_url, brand_name, sender_display_name, sender_title, sender_signature",
    )
    .single();

  if (error) {
    throw toProjectServiceError("creating the default project", error);
  }

  const project = mapProjectRow(data as Record<string, unknown>);
  await ensureDefaultTemplatesForProject({
    workspaceId: input.workspaceId,
    projectId: project.id,
    userId: input.userId,
  });

  return project;
}

async function ensureActiveProjectMembership(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ last_active_project_id: input.projectId })
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId);

  if (error) {
    throw toProjectServiceError("saving the active project", error);
  }
}

export async function listWorkspaceProjects(workspaceId: string) {
  requireSupabaseConfiguration();
  return selectWorkspaceProjects(workspaceId);
}

export async function ensureWorkspaceProjects(input: {
  workspaceId: string;
  workspaceName: string;
  userId: string;
}) {
  requireSupabaseConfiguration();
  let projects = await selectWorkspaceProjects(input.workspaceId);

  if (!projects.length) {
    const defaultProject = await ensureDefaultProject(input);
    projects = [defaultProject];
  } else {
    await ensureDefaultTemplatesForProjects({
      workspaceId: input.workspaceId,
      projects,
      userId: input.userId,
    });
  }

  const supabase = createAdminSupabaseClient();
  const { data: rawMembership, error } = await supabase
    .from("workspace_members")
    .select("last_active_project_id")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw toProjectServiceError("loading the active project", error);
  }

  const membership = rawMembership as { last_active_project_id?: string | null } | null;
  const activeProject =
    projects.find((project) => project.id === membership?.last_active_project_id) ?? projects[0];

  if (!membership?.last_active_project_id || membership.last_active_project_id !== activeProject.id) {
    await ensureActiveProjectMembership({
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: activeProject.id,
    });
  }

  return {
    availableProjects: projects,
    activeProject,
  };
}

export async function getProjectById(workspaceId: string, projectId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, workspace_id, name, slug, website, logo_url, brand_name, sender_display_name, sender_title, sender_signature",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw toProjectServiceError("loading a project by id", error);
  }

  return data ? mapProjectRow(data as Record<string, unknown>) : null;
}

export async function setActiveProject(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
}) {
  requireSupabaseConfiguration();
  const projects = await listWorkspaceProjects(input.workspaceId);

  if (!projects.some((project) => project.id === input.projectId)) {
    throw new Error("Project access denied.");
  }

  await ensureActiveProjectMembership(input);

  return { projectId: input.projectId };
}

function getUniqueProjectSlug(existingProjects: ProjectSummary[], name: string) {
  const base = buildProjectSlug(name);
  const existingSlugs = new Set(existingProjects.map((project) => project.slug));

  if (!existingSlugs.has(base)) {
    return base;
  }

  let attempt = 2;
  while (existingSlugs.has(`${base}-${attempt}`)) {
    attempt += 1;
  }

  return `${base}-${attempt}`;
}

export async function createProject(input: {
  workspaceId: string;
  userId: string;
  name: string;
  website?: string | null;
  brandName?: string | null;
  senderDisplayName?: string | null;
  senderTitle?: string | null;
  senderSignature?: string | null;
  logoUrl?: string | null;
}) {
  requireSupabaseConfiguration();
  const existingProjects = await listWorkspaceProjects(input.workspaceId);
  const slug = getUniqueProjectSlug(existingProjects, input.name);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await (
    supabase.from("projects") as unknown as {
      insert: (value: Record<string, unknown>) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    }
  )
    .insert({
      workspace_id: input.workspaceId,
      name: input.name.trim(),
      slug,
      website: input.website?.trim() || null,
      logo_url: input.logoUrl?.trim() || null,
      brand_name: input.brandName?.trim() || null,
      sender_display_name: input.senderDisplayName?.trim() || null,
      sender_title: input.senderTitle?.trim() || null,
      sender_signature: input.senderSignature?.trim() || null,
      created_by_user_id: input.userId,
    })
    .select(
      "id, workspace_id, name, slug, website, logo_url, brand_name, sender_display_name, sender_title, sender_signature",
    )
    .single();

  if (error) {
    throw toProjectServiceError("creating a project", error);
  }

  const project = mapProjectRow(data as Record<string, unknown>);
  await ensureDefaultTemplatesForProject({
    workspaceId: input.workspaceId,
    projectId: project.id,
    userId: input.userId,
  });
  await setActiveProject({
    workspaceId: input.workspaceId,
    userId: input.userId,
    projectId: project.id,
  });

  return project;
}

export async function updateProject(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  website?: string | null;
  brandName?: string | null;
  senderDisplayName?: string | null;
  senderTitle?: string | null;
  senderSignature?: string | null;
  logoUrl?: string | null;
}) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const existingProjects = await listWorkspaceProjects(input.workspaceId);
  const currentProject = existingProjects.find((project) => project.id === input.projectId);

  if (!currentProject) {
    throw new Error("Project not found.");
  }

  const nextSlug =
    currentProject.name.trim().toLowerCase() === input.name.trim().toLowerCase()
      ? currentProject.slug
      : getUniqueProjectSlug(
          existingProjects.filter((project) => project.id !== input.projectId),
          input.name,
        );

  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name.trim(),
      slug: nextSlug,
      website: input.website?.trim() || null,
      logo_url: input.logoUrl?.trim() || currentProject.logo_url,
      brand_name: input.brandName?.trim() || null,
      sender_display_name: input.senderDisplayName?.trim() || null,
      sender_title: input.senderTitle?.trim() || null,
      sender_signature: input.senderSignature?.trim() || null,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.projectId)
    .select(
      "id, workspace_id, name, slug, website, logo_url, brand_name, sender_display_name, sender_title, sender_signature",
    )
    .single();

  if (error) {
    throw toProjectServiceError("updating a project", error);
  }

  return mapProjectRow(data as Record<string, unknown>);
}

export async function listWorkspaceProjectMailboxRegistry(workspaceId: string) {
  requireSupabaseConfiguration();
  const supabase = createAdminSupabaseClient();
  const [projects, rawAccounts] = await Promise.all([
    listWorkspaceProjects(workspaceId),
    supabase
      .from("gmail_accounts")
      .select("id, project_id, email_address, status, approval_status, approval_note")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  if (rawAccounts.error) {
    throw toProjectServiceError("loading the project mailbox registry", rawAccounts.error);
  }

  const accounts = (rawAccounts.data ?? []) as Array<{
    id: string;
    project_id: string;
    email_address: string;
    status: string;
    approval_status?: string | null;
    approval_note?: string | null;
  }>;

  return projects.map((project) => ({
    ...project,
    gmailAccounts: accounts.filter((account) => account.project_id === project.id),
  })) satisfies ProjectMailboxRegistryItem[];
}

export async function uploadProjectLogo(input: {
  workspaceId: string;
  projectId: string;
  file?: File | null;
  logoUrl?: string | null;
}) {
  requireSupabaseConfiguration();

  if (!input.file && !input.logoUrl?.trim()) {
    throw new Error("A logo file or logo URL is required.");
  }

  let nextLogoUrl = input.logoUrl?.trim() || null;

  if (input.file && input.file.size > 0) {
    const bucket = createAdminSupabaseClient().storage.from("project-assets") as unknown as {
      upload: (
        path: string,
        body: File,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
    const path = `${input.workspaceId}/${input.projectId}/${Date.now()}-${safeName}`;
    const { error } = await bucket.upload(path, input.file, {
      upsert: true,
      cacheControl: "3600",
      contentType: input.file.type || undefined,
    });

    if (error) {
      throw new Error(`Failed to upload project logo: ${error.message}`);
    }

    nextLogoUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-assets/${path}`;
  }

  if (!nextLogoUrl) {
    throw new Error("Failed to resolve the next project logo URL.");
  }

  const currentProject = await getProjectById(input.workspaceId, input.projectId);

  if (!currentProject) {
    throw new Error("Project not found.");
  }

  const project = await updateProject({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: currentProject.name,
    logoUrl: nextLogoUrl,
    website: currentProject.website,
    brandName: currentProject.brand_name,
    senderDisplayName: currentProject.sender_display_name,
    senderTitle: currentProject.sender_title,
    senderSignature: currentProject.sender_signature,
  });

  return {
    projectId: project.id,
    logoUrl: project.logo_url,
  };
}
