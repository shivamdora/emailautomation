import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/zod/schemas";

export async function POST(request: Request) {
  try {
    const payload = profileSchema
      .extend({
        markOnboardingComplete: z.boolean().optional(),
      })
      .safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient({ canSetCookies: false });

    if (!supabase) {
      return NextResponse.json({ error: "Supabase auth is not configured." }, { status: 500 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "No authenticated session found." }, { status: 401 });
    }

    const profilesTable = supabase.from("profiles") as unknown as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };

    const payloadToPersist: Record<string, unknown> = {
      id: user.id,
      full_name: payload.data.fullName,
      title: payload.data.title || null,
    };

    if (payload.data.markOnboardingComplete) {
      payloadToPersist.onboarding_completed_at = new Date().toISOString();
    }

    let { error } = await profilesTable.upsert(payloadToPersist, { onConflict: "id" });

    if (error?.message?.includes("onboarding_completed_at")) {
      delete payloadToPersist.onboarding_completed_at;
      const retry = await profilesTable.upsert(payloadToPersist, { onConflict: "id" });
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save profile." },
      { status: 500 },
    );
  }
}
