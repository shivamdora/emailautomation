import type { ShellNavigationItem } from "@/lib/layout/navigation";

type AuthModeCopy = {
  badge: string;
  title: string;
  description: string;
  submitLabel: string;
  googleLabel?: string;
  caption: string;
  switchPrompt?: string;
  switchLabel?: string;
  switchHref?: string;
};

type ProductContent = {
  shell: {
    brand: {
      name: string;
      subtitle: string;
    };
    navigation: ShellNavigationItem[];
    helper: {
      title: string;
      description: string;
    };
    signOutLabel: string;
  };
  auth: {
    securityLabel: string;
    signIn: AuthModeCopy;
    signUp: AuthModeCopy;
    forgotPassword: AuthModeCopy;
    updatePassword: AuthModeCopy;
    callback: {
      badge: string;
      caption: string;
      pendingTitle: string;
      pendingDescription: string;
      errorTitle: string;
      backToSignIn: string;
      createAccount: string;
      genericError: string;
    };
    welcome: {
      badge: string;
      title: string;
      description: string;
      caption: string;
      panelTitle: string;
      panelDescription: string;
      fullNameLabel: string;
      fullNamePlaceholder: string;
      titleLabel: string;
      titlePlaceholder: string;
      submitLabel: string;
      pendingLabel: string;
      nextLabel: string;
      successMessage: string;
      errorMessage: string;
    };
  };
  shared: {
    rowsLabel: string;
    emptyRecordsLabel: string;
    previewTab: string;
    textTab: string;
    noSubjectLabel: string;
    noBodyLabel: string;
    noTextPreviewLabel: string;
    liveRefresh: {
      syncNow: string;
      syncing: string;
    };
  };
  dashboard: {
    title: string;
    description: string;
    liveRefreshLabel: string;
    kpis: {
      totalLeads: string;
      queued: string;
      sent: string;
      followupSent: string;
      replied: string;
      unsubscribed: string;
      failed: string;
      replyRate: string;
    };
    chartTitle: string;
    checklistTitle: string;
    checklist: string[];
  };
  analytics: {
    title: string;
    description: string;
    allProjectsLabel: string;
    projectBreakdownTitle: string;
    campaignChartTitle: string;
  };
  contacts: {
    header: {
      eyebrow: string;
      title: string;
      description: string;
    };
    manualForm: {
      title: string;
      description: string;
      badge: string;
      submitLabel: string;
      pendingLabel: string;
      successMessage: string;
      createError: string;
      fields: {
        email: string;
        company: string;
        firstName: string;
        lastName: string;
        jobTitle: string;
        website: string;
      };
      placeholders: {
        email: string;
        company: string;
        website: string;
      };
    };
    controls: {
      title: string;
      description: string;
      visibleLabel: string;
      activeLabel: string;
      selectedLabel: string;
      cards: {
        contacts: {
          eyebrow: string;
          description: string;
        };
        selection: {
          eyebrow: string;
          description: string;
        };
        tags: {
          eyebrow: string;
          description: string;
        };
      };
      filterLabel: string;
      filterAllLabel: string;
      bulkTagsLabel: string;
      bulkTagsPlaceholder: string;
      addTags: string;
      removeTags: string;
      deleteSelected: string;
      selectionRequiredError: string;
      bulkTagsRequiredError: string;
      updateTagsError: string;
      addTagsSuccess: string;
      removeTagsSuccess: string;
      deleteSelectedConfirm: (count: number) => string;
      deleteSelectedError: string;
      deleteSelectedSuccess: string;
    };
    editor: {
      title: string;
      close: string;
      cancel: string;
      submitLabel: string;
      pendingLabel: string;
      tagsLabel: string;
      tagsPlaceholder: string;
      updateError: string;
      updateSuccess: string;
    };
    table: {
      title: string;
      description: string;
      columns: {
        email: string;
        name: string;
        company: string;
        tags: string;
        status: string;
        actions: string;
      };
      noNameLabel: string;
      noTagsLabel: string;
      activeStatusLabel: string;
      unsubscribedStatusLabel: string;
      editLabel: string;
      deleteLabel: string;
      emptyLabel: string;
      deleteConfirm: string;
      deleteError: string;
      deleteSuccess: string;
    };
  };
  imports: {
    header: {
      eyebrow: string;
      title: string;
      description: string;
    };
    banners: {
      fileUploaded: (count: string | undefined) => string;
      sheetImported: (count: string | undefined) => string;
    };
    uploadCardTitle: string;
    uploadHelper: string;
    mapper: {
      title: string;
      filterPlaceholder: string;
    };
    history: {
      title: string;
      untitledLabel: string;
    };
    panel: {
      chooseFileLabel: string;
      uploadLabel: string;
      uploadingLabel: string;
      sheetPlaceholder: string;
      sheetImportLabel: string;
      sheetImportingLabel: string;
      fileMissingError: string;
      genericError: string;
      fileSuccess: (count: number) => string;
      sheetSuccess: (count: number) => string;
    };
  };
  templates: {
    header: {
      eyebrow: string;
      title: string;
      description: string;
    };
    table: {
      title: string;
      emptyLabel: string;
      htmlPreviewLabel: string;
      textModeLabel: string;
      htmlModeLabel: string;
    };
    form: {
      title: string;
      nameLabel: string;
      subjectLabel: string;
      modeLabel: string;
      bodyLabel: string;
      htmlBodyLabel: string;
      importHtmlLabel: string;
      fallbackLabel: string;
      fallbackPlaceholder: string;
      saveLabel: string;
      savingLabel: string;
      successMessage: string;
      errorMessage: string;
      htmlTemplateBadge: string;
      textTemplateBadge: string;
      importFileButtonLabel: string;
      previewSubjectLabel: string;
      previewBodyLabel: string;
    };
  };
  campaigns: {
    header: {
      eyebrow: string;
      title: string;
      description: string;
      ctaLabel: string;
    };
    newCampaign: {
      eyebrow: string;
      title: string;
      description: string;
    };
    editCampaign: {
      eyebrow: string;
      title: (campaignName: string) => string;
      description: string;
    };
    detail: {
      eyebrow: string;
      description: string;
      editLabel: string;
      openLabel: string;
      pauseLabel: string;
      resumeLabel: string;
      statusLabel: string;
      dailyCapLabel: string;
      timezoneLabel: string;
      windowLabel: string;
      contactsTitle: string;
      primaryStepLabel: string;
      followupStepLabel: string;
      stepTitle: (stepNumber: number, stepLabel: string) => string;
      subjectLabel: string;
      bodyPreviewLabel: string;
      htmlBodyPreviewLabel: string;
    };
    wizard: {
      title: {
        create: string;
        edit: string;
      };
      summary: {
        audience: {
          eyebrow: string;
          description: string;
        };
        templates: {
          eyebrow: string;
          description: string;
        };
        mailboxes: {
          eyebrow: string;
          description: string;
        };
      };
      campaignNameLabel: string;
      senderLabel: string;
      senderEmptyLabel: string;
      senderHelperTitle: string;
      senderHelperDescription: string;
      senderHelperCta: string;
      targetContactsLabel: string;
      targetContactsSummary: (count: number) => string;
      searchContactsPlaceholder: string;
      selectVisibleLabel: string;
      clearSelectionLabel: string;
      noContactsSearchLabel: string;
      noContactsLabel: string;
      noNameLabel: string;
      addInlineTitle: string;
      addInlineDescription: string;
      addInlineSubmitLabel: string;
      schedule: {
        timezoneLabel: string;
        startLabel: string;
        endLabel: string;
        dailyCapLabel: string;
      };
      stepEditor: {
        savedTemplateLabel: string;
        savedTemplateHint: string;
        emptyTemplateOption: string;
        savedCountLabel: (count: number) => string;
        loadedTemplateMessage: (name: string) => string;
        textModeLabel: string;
        htmlModeLabel: string;
        composerModeLabel: string;
        subjectLabel: string;
        bodyLabel: string;
        htmlBodyLabel: string;
        importHtmlLabel: string;
        fallbackLabel: string;
        fallbackPlaceholder: string;
        previewSubjectLabel: string;
        previewBodyLabel: string;
      };
      primaryStep: {
        title: string;
        description: string;
      };
      followupStep: {
        title: string;
        description: string;
      };
      actions: {
        launchNow: string;
        launch: string;
        saveChanges: string;
        pendingCreate: string;
        pendingEdit: string;
      };
      toasts: {
        launchError: string;
        updateError: string;
        updated: string;
        launched: string;
        launchedAndSent: (processed: number) => string;
        launchedNoReadyContacts: string;
        sendNowFailed: string;
        missingCampaignId: string;
      };
    };
  };
  inbox: {
    header: {
      eyebrow: string;
      title: string;
      description: string;
      liveRefreshLabel: string;
    };
    viewer: {
      listTitle: string;
      emptyListTitle: string;
      emptyListDescription: string;
      emptyThreadTitle: string;
      emptyThreadDescription: string;
      untitledThreadLabel: string;
      replyCardTitle: string;
      replyCardDescription: string;
      replyPlaceholder: string;
      sendReplyLabel: string;
      sendingReplyLabel: string;
      sendReplyError: string;
      sendReplySuccess: string;
      renderedTab: string;
      inboundLabel: string;
      outboundLabel: string;
    };
  };
  profile: {
    header: {
      eyebrow: string;
      title: string;
      description: string;
    };
    banners: {
      connected: string;
      disconnected: string;
      missingCode: string;
      genericError: string;
    };
    form: {
      title: string;
      fullNameLabel: string;
      titleLabel: string;
      titlePlaceholder: string;
      submitLabel: string;
      pendingLabel: string;
      successMessage: string;
      errorMessage: string;
    };
    gmailCard: {
      title: string;
      connectLabel: string;
      emptyTitle: string;
      emptyDescription: string;
      disconnectLabel: string;
    };
  };
  settings: {
    header: {
      eyebrow: string;
      description: string;
    };
    members: {
      title: string;
      firstParagraph: string;
      secondParagraph: string;
    };
    limits: {
      title: string;
      firstParagraph: string;
      secondParagraph: string;
    };
  };
};

export const productContent: ProductContent = {
  shell: {
    brand: {
      name: "OutboundFlow",
      subtitle: "Project Console",
    },
    navigation: [
      {
        href: "/dashboard",
        label: "Dashboard",
      },
      {
        href: "/analytics",
        label: "Analytics",
      },
      {
        href: "/campaigns",
        label: "Campaigns",
        children: [
          { href: "/templates", label: "Email Templates" },
          { href: "/inbox", label: "Inbox" },
        ],
      },
      {
        href: "/contacts",
        label: "Contacts",
        children: [{ href: "/imports", label: "Import Contact" }],
      },
      {
        href: "/profile",
        label: "Profile",
      },
    ],
    helper: {
      title: "Project quick actions",
      description: "Keep sender setup and the most-used project actions close without bloating the sidebar.",
    },
    signOutLabel: "Sign out",
  },
  auth: {
    securityLabel: "Secure session with Supabase Auth",
    signIn: {
      badge: "Workspace access",
      title: "Sign in",
      description: "Open your workspace and keep the next send moving.",
      submitLabel: "Sign in",
      googleLabel: "Continue with Google",
      caption: "Use your account to access your workspace.",
      switchPrompt: "New here?",
      switchLabel: "Create account",
      switchHref: "/sign-up",
    },
    signUp: {
      badge: "Start a workspace",
      title: "Create your workspace",
      description: "Start with email or Google and get the workspace ready in minutes.",
      submitLabel: "Create account",
      googleLabel: "Continue with Google",
      caption: "Set up your account and start quickly.",
      switchPrompt: "Already have an account?",
      switchLabel: "Sign in",
      switchHref: "/sign-in",
    },
    forgotPassword: {
      badge: "Account recovery",
      title: "Reset your password",
      description: "We will send a reset link to the email on your account.",
      submitLabel: "Send reset link",
      caption: "Reset access and return to the workspace.",
      switchPrompt: "Remembered it?",
      switchLabel: "Return to sign in",
      switchHref: "/sign-in",
    },
    updatePassword: {
      badge: "Choose a new password",
      title: "Set a new password",
      description: "Choose a secure password to finish recovery.",
      submitLabel: "Update password",
      caption: "Set a new password to continue.",
      switchPrompt: "Remembered it?",
      switchLabel: "Return to sign in",
      switchHref: "/sign-in",
    },
    callback: {
      badge: "Completing sign-in",
      caption: "Completing your authentication.",
      pendingTitle: "Finishing your sign-in",
      pendingDescription: "We are securing your session and routing you to the right workspace.",
      errorTitle: "Authentication failed",
      backToSignIn: "Back to sign in",
      createAccount: "Create account",
      genericError: "Authentication failed",
    },
    welcome: {
      badge: "Quick setup",
      title: "Finish your profile before you open the workspace.",
      description:
        "One short step keeps ownership, mailbox activity, and team visibility clean from day one.",
      caption: "You can update these details later from Profile.",
      panelTitle: "Tell the team who is sending",
      panelDescription:
        "We will save this on your profile now so shared visibility and mailbox activity stay easy to read.",
      fullNameLabel: "Full name",
      fullNamePlaceholder: "Jane Doe",
      titleLabel: "Title",
      titlePlaceholder: "Founder",
      submitLabel: "Continue to dashboard",
      pendingLabel: "Saving...",
      nextLabel: "Next stop: dashboard",
      successMessage: "Profile saved",
      errorMessage: "Failed to save your profile",
    },
  },
  shared: {
    rowsLabel: "rows",
    emptyRecordsLabel: "No records yet.",
    previewTab: "Preview",
    textTab: "Text",
    noSubjectLabel: "No subject yet",
    noBodyLabel: "No body yet",
    noTextPreviewLabel: "No text preview yet",
    liveRefresh: {
      syncNow: "Sync now",
      syncing: "Syncing...",
    },
  },
  dashboard: {
    title: "Dashboard",
    description:
      "Track total list size, sends, replies, and cross-project momentum from one global workspace view.",
    liveRefreshLabel: "Auto refresh while active",
    kpis: {
      totalLeads: "Total leads",
      queued: "Queued",
      sent: "Sent",
      followupSent: "Follow-up sent",
      replied: "Replied",
      unsubscribed: "Unsubscribed",
      failed: "Failed",
      replyRate: "Reply rate",
    },
    chartTitle: "Reply rate by campaign",
    checklistTitle: "Launch checklist",
    checklist: [
      "Connect a Gmail mailbox from Profile.",
      "Import contacts from a CSV, XLSX, or public Google Sheet.",
      "Save at least one reusable template.",
      "Launch a campaign and keep this page open while sends and replies sync.",
    ],
  },
  analytics: {
    title: "Analytics",
    description:
      "Review delivery, replies, failures, and campaign performance for the active project or across all projects.",
    allProjectsLabel: "All Projects",
    projectBreakdownTitle: "Project breakdown",
    campaignChartTitle: "Reply rate by campaign",
  },
  contacts: {
    header: {
      eyebrow: "Contacts",
      title: "Project contacts",
      description: "Add leads, review the active project list, and keep tags organized.",
    },
    manualForm: {
      title: "Add a contact",
      description: "Create one lead without leaving the workspace.",
      badge: "Manual entry",
      submitLabel: "Add contact",
      pendingLabel: "Adding...",
      successMessage: "Contact added",
      createError: "Failed to create contact",
      fields: {
        email: "Email",
        company: "Company",
        firstName: "First name",
        lastName: "Last name",
        jobTitle: "Job title",
        website: "Website",
      },
      placeholders: {
        email: "lead@company.com",
        company: "Northstar",
        website: "company.com",
      },
    },
    controls: {
      title: "Contact controls",
      description:
        "Filter the list, tag selected rows in bulk, and remove stale records without leaving the page.",
      visibleLabel: "visible",
      activeLabel: "active",
      selectedLabel: "selected",
      cards: {
        contacts: {
          eyebrow: "Project contacts",
          description: "Total leads available in the active project.",
        },
        selection: {
          eyebrow: "Visible selection",
          description: "Selected rows in the current filtered view.",
        },
        tags: {
          eyebrow: "Saved tags",
          description: "Reusable tags available for filtering and bulk updates.",
        },
      },
      filterLabel: "Filter by tag",
      filterAllLabel: "All contacts",
      bulkTagsLabel: "Bulk tags",
      bulkTagsPlaceholder: "vip, founders, q2",
      addTags: "Add tags",
      removeTags: "Remove tags",
      deleteSelected: "Delete selected",
      selectionRequiredError: "Select at least one contact first.",
      bulkTagsRequiredError: "Enter one or more tags.",
      updateTagsError: "Failed to update tags",
      addTagsSuccess: "Tags added",
      removeTagsSuccess: "Tags removed",
      deleteSelectedConfirm: (count) => `Delete ${count} selected contact(s)?`,
      deleteSelectedError: "Failed to delete contacts",
      deleteSelectedSuccess: "Contacts deleted",
    },
    editor: {
      title: "Edit contact",
      close: "Close",
      cancel: "Cancel",
      submitLabel: "Save changes",
      pendingLabel: "Saving...",
      tagsLabel: "Tags",
      tagsPlaceholder: "vip, founders, q2",
      updateError: "Failed to update contact",
      updateSuccess: "Contact updated",
    },
    table: {
      title: "Contacts",
      description: "Review, edit, or remove leads from the shared workspace list.",
      columns: {
        email: "Email",
        name: "Name",
        company: "Company",
        tags: "Tags",
        status: "Status",
        actions: "Actions",
      },
      noNameLabel: "Unknown",
      noTagsLabel: "No tags",
      activeStatusLabel: "active",
      unsubscribedStatusLabel: "unsubscribed",
      editLabel: "Edit",
      deleteLabel: "Delete",
      emptyLabel: "No contacts match this view yet.",
      deleteConfirm: "Delete this contact?",
      deleteError: "Failed to delete contact",
      deleteSuccess: "Contact deleted",
    },
  },
  imports: {
    header: {
      eyebrow: "Imports",
      title: "Import leads",
      description:
        "Bring in CSV or XLSX files or a public Google Sheet for the active project and keep the raw import history visible.",
    },
    banners: {
      fileUploaded: (count) => `File import completed. ${count ?? "0"} contact(s) were processed.`,
      sheetImported: (count) => `Google Sheet import completed. ${count ?? "0"} contact(s) were processed.`,
    },
    uploadCardTitle: "Import sources",
    uploadHelper:
      "Use a public Google Sheet link. Private sheets and non-exportable links will be rejected.",
    mapper: {
      title: "Column mapping preview",
      filterPlaceholder: "Filter source columns",
    },
    history: {
      title: "Import history",
      untitledLabel: "Untitled import",
    },
    panel: {
      chooseFileLabel: "Choose file",
      uploadLabel: "Upload file",
      uploadingLabel: "Uploading...",
      sheetPlaceholder: "https://docs.google.com/spreadsheets/...",
      sheetImportLabel: "Import public Sheet",
      sheetImportingLabel: "Importing...",
      fileMissingError: "Please choose a CSV or XLSX file.",
      genericError: "Import failed.",
      fileSuccess: (count) => `File import completed. ${count} contact(s) processed.`,
      sheetSuccess: (count) => `Google Sheet import completed. ${count} contact(s) processed.`,
    },
  },
  templates: {
    header: {
      eyebrow: "Templates",
      title: "Email Templates",
      description:
        "Browse featured templates, manage the active project library, and launch a campaign with the right starting point.",
    },
    table: {
      title: "Saved templates",
      emptyLabel: "No templates yet.",
      htmlPreviewLabel: "Designed HTML template with text fallback",
      textModeLabel: "Text",
      htmlModeLabel: "HTML",
    },
    form: {
      title: "Create template",
      nameLabel: "Template name",
      subjectLabel: "Subject",
      modeLabel: "Template mode",
      bodyLabel: "Body",
      htmlBodyLabel: "HTML body",
      importHtmlLabel: "Import HTML file",
      fallbackLabel: "Text fallback",
      fallbackPlaceholder: "Optional plain-text fallback. Leave blank to auto-generate.",
      saveLabel: "Save template",
      savingLabel: "Saving...",
      successMessage: "Template saved",
      errorMessage: "Failed to save template",
      htmlTemplateBadge: "HTML template",
      textTemplateBadge: "Text template",
      importFileButtonLabel: "Import HTML file",
      previewSubjectLabel: "Subject",
      previewBodyLabel: "Body",
    },
  },
  campaigns: {
    header: {
      eyebrow: "Campaigns",
      title: "Campaigns",
      description: "Launch, pause, resume, and review tracked outbound workflows.",
      ctaLabel: "New campaign",
    },
    newCampaign: {
      eyebrow: "Campaign builder",
      title: "Create a campaign",
      description: "Choose a starting point, pick the audience, shape the message, and launch with confidence.",
    },
    editCampaign: {
      eyebrow: "Campaign editor",
      title: (campaignName) => `Edit ${campaignName}`,
      description:
        "Update the mailbox, audience, schedule, and workflow without losing campaign history.",
    },
    detail: {
      eyebrow: "Campaign detail",
      description:
        "Review queue state, workflow steps, and pause or resume without leaving the campaign record.",
      editLabel: "Edit campaign",
      openLabel: "Open",
      pauseLabel: "Pause campaign",
      resumeLabel: "Resume campaign",
      statusLabel: "Status",
      dailyCapLabel: "Daily cap",
      timezoneLabel: "Timezone",
      windowLabel: "Window",
      contactsTitle: "Campaign contacts",
      primaryStepLabel: "Primary email",
      followupStepLabel: "Follow-up",
      stepTitle: (stepNumber, stepLabel) => `Step ${stepNumber}: ${stepLabel}`,
      subjectLabel: "Subject",
      bodyPreviewLabel: "Body preview",
      htmlBodyPreviewLabel: "Stored as HTML with text fallback",
    },
    wizard: {
      title: {
        create: "Campaign builder",
        edit: "Edit campaign",
      },
      summary: {
        audience: {
          eyebrow: "Audience",
          description: "contacts selected for this campaign",
        },
        templates: {
          eyebrow: "Templates",
          description: "saved text or HTML templates ready to apply",
        },
        mailboxes: {
          eyebrow: "Mailboxes",
          description: "connected senders available for launch",
        },
      },
      campaignNameLabel: "Campaign name",
      senderLabel: "Sender mailbox",
      senderEmptyLabel: "No mailbox connected",
      senderHelperTitle: "Connect Gmail before launch",
      senderHelperDescription:
        "This project does not have a connected Gmail mailbox yet. Connect one from Profile before you launch or send.",
      senderHelperCta: "Open Profile",
      targetContactsLabel: "Target contacts",
      targetContactsSummary: (count) => `${count} selected across the full list`,
      searchContactsPlaceholder: "Search by email, name, company, title, or tag",
      selectVisibleLabel: "Select visible",
      clearSelectionLabel: "Clear selection",
      noContactsSearchLabel: "No contacts match this search yet.",
      noContactsLabel: "No contacts yet. Add one here or import a list first.",
      noNameLabel: "No name",
      addInlineTitle: "Add contact inline",
      addInlineDescription:
        "Create a contact without leaving the builder. New contacts are selected automatically.",
      addInlineSubmitLabel: "Add and select",
      schedule: {
        timezoneLabel: "Timezone",
        startLabel: "Start",
        endLabel: "End",
        dailyCapLabel: "Daily cap",
      },
      stepEditor: {
        savedTemplateLabel: "Saved template",
        savedTemplateHint: "Selecting one will apply it immediately",
        emptyTemplateOption: "Choose a template",
        savedCountLabel: (count) => `${count} saved`,
        loadedTemplateMessage: (name) => `Loaded ${name}`,
        textModeLabel: "Text",
        htmlModeLabel: "HTML",
        composerModeLabel: "Composer mode",
        subjectLabel: "Subject",
        bodyLabel: "Body",
        htmlBodyLabel: "HTML body",
        importHtmlLabel: "Import HTML file",
        fallbackLabel: "Text fallback",
        fallbackPlaceholder: "Optional plain-text fallback. Leave blank to auto-generate.",
        previewSubjectLabel: "Subject",
        previewBodyLabel: "Body",
      },
      primaryStep: {
        title: "Primary email",
        description:
          "Draft the first touch as text or HTML. Merge fields like {{first_name}} and {{company}} work in both modes.",
      },
      followupStep: {
        title: "Follow-up",
        description:
          "This step uses the fixed workspace follow-up delay and can run in text or HTML mode.",
      },
      actions: {
        launchNow: "Launch and send now",
        launch: "Launch campaign",
        saveChanges: "Save changes",
        pendingCreate: "Launching...",
        pendingEdit: "Saving...",
      },
      toasts: {
        launchError: "Failed to launch campaign",
        updateError: "Failed to update campaign",
        updated: "Campaign updated",
        launched: "Campaign launched",
        launchedAndSent: (processed) =>
          `Campaign launched and sent to ${processed} contact${processed === 1 ? "" : "s"}.`,
        launchedNoReadyContacts: "Campaign launched. No contacts were ready to send yet.",
        sendNowFailed: "Campaign created, but send now failed",
        missingCampaignId: "Campaign was saved without a valid ID.",
      },
    },
  },
  inbox: {
    header: {
      eyebrow: "Inbox",
      title: "Inbox",
      description: "Review synced Gmail threads and reply from the shared workspace.",
      liveRefreshLabel: "Inbox refresh while active",
    },
    viewer: {
      listTitle: "Recent threads",
      emptyListTitle: "No synced threads yet",
      emptyListDescription:
        "Replies will appear here after a connected Gmail mailbox sends campaigns and starts receiving responses.",
      emptyThreadTitle: "Thread history",
      emptyThreadDescription:
        "Pick a thread from the left when sync has data, or connect Gmail and launch a campaign first.",
      untitledThreadLabel: "Untitled thread",
      replyCardTitle: "Reply from workspace",
      replyCardDescription: "Send into the same Gmail thread from the connected mailbox.",
      replyPlaceholder: "Type your reply...",
      sendReplyLabel: "Send reply",
      sendingReplyLabel: "Sending...",
      sendReplyError: "Failed to send reply",
      sendReplySuccess: "Reply sent",
      renderedTab: "Rendered",
      inboundLabel: "inbound",
      outboundLabel: "outbound",
    },
  },
  profile: {
    header: {
      eyebrow: "Profile",
      title: "Personal settings",
      description: "Keep your profile current, review project branding, and connect the Gmail mailboxes you send from.",
    },
    banners: {
      connected: "Gmail mailbox connected successfully.",
      disconnected: "Gmail mailbox disconnected.",
      missingCode: "Google did not return a valid OAuth code.",
      genericError: "Gmail connection failed.",
    },
    form: {
      title: "Personal profile",
      fullNameLabel: "Full name",
      titleLabel: "Title",
      titlePlaceholder: "Growth lead",
      submitLabel: "Save profile",
      pendingLabel: "Saving...",
      successMessage: "Profile updated",
      errorMessage: "Failed to save profile",
    },
    gmailCard: {
      title: "Connected Gmail accounts",
      connectLabel: "Connect Gmail",
      emptyTitle: "No Gmail mailbox connected",
      emptyDescription:
        "Connect the mailbox you want to send from so campaigns and replies stay tied to the right project.",
      disconnectLabel: "Disconnect",
    },
  },
  settings: {
    header: {
      eyebrow: "Workspace settings",
      description:
        "Review workspace membership notes, delivery limits, and the placeholders reserved for future controls.",
    },
    members: {
      title: "Members",
      firstParagraph: "Default workspace ownership is created at signup.",
      secondParagraph:
        "Use the workspace_members table and its RLS policies to manage future invites and admin roles.",
    },
    limits: {
      title: "Plan limits",
      firstParagraph:
        "The schema is ready for mailbox, team seat, active campaign, and CRM access restrictions.",
      secondParagraph: "Billing is intentionally outside the current product scope.",
    },
  },
};
