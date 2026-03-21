"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { productContent } from "@/content/product";
import { profileSchema } from "@/lib/zod/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  defaultValues,
}: {
  defaultValues: z.infer<typeof profileSchema>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        toast.error(error?.error ?? productContent.profile.form.errorMessage);
        return;
      }

      toast.success(productContent.profile.form.successMessage);
      router.refresh();
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{productContent.profile.form.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:max-w-xl" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="fullName">{productContent.profile.form.fullNameLabel}</Label>
            <Input id="fullName" {...form.register("fullName")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">{productContent.profile.form.titleLabel}</Label>
            <Input id="title" placeholder={productContent.profile.form.titlePlaceholder} {...form.register("title")} />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? productContent.profile.form.pendingLabel : productContent.profile.form.submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
