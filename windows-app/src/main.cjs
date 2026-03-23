const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { buildDesktopReturnUrl, loadDesktopConfig } = require("./runtime.cjs");

const projectRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..", "..");
const runtimeState = loadDesktopConfig(projectRoot, { packaged: app.isPackaged });

let mainWindow = null;
let pendingDeepLink = null;

function getIconPath() {
  return path.join(projectRoot, "windows-app", "app-icon.ico");
}

function getAppOrigin() {
  return new URL(runtimeState.appOrigin).origin;
}

function getDeepLinkFromArgv(argv = []) {
  const prefix = `${runtimeState.protocolScheme}://`;
  return argv.find((value) => typeof value === "string" && value.startsWith(prefix)) ?? null;
}

function buildProfileUrl(input = {}) {
  const profileUrl = new URL("/settings/sending", runtimeState.appOrigin);

  if (input.status === "connected" || input.status === "error" || input.status === "missing-code" || input.status === "disconnected") {
    profileUrl.searchParams.set("mailbox", input.status);
  }

  if (input.provider) {
    profileUrl.searchParams.set("provider", input.provider);
  }

  if (input.message) {
    profileUrl.searchParams.set("message", input.message);
  }

  return profileUrl.toString();
}

function parseDesktopDeepLink(link) {
  try {
    const url = new URL(link);
    const isSupportedLocation =
      url.hostname === "oauth-complete" || url.pathname === "/oauth-complete";

    if (url.protocol !== `${runtimeState.protocolScheme}:` || !isSupportedLocation) {
      return null;
    }

    return {
      message: url.searchParams.get("message"),
      provider: url.searchParams.get("provider"),
      status: url.searchParams.get("status"),
    };
  } catch {
    return null;
  }
}

async function handleDesktopDeepLink(link) {
  const payload = parseDesktopDeepLink(link);

  if (!payload) {
    return false;
  }

  pendingDeepLink = null;

  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLink = link;
    return true;
  }

  await mainWindow.loadURL(buildProfileUrl(payload));
  mainWindow.show();
  mainWindow.focus();
  return true;
}

function isAllowedEmbeddedNavigation(targetUrl) {
  try {
    const url = new URL(targetUrl);

    if (url.origin === getAppOrigin()) {
      return true;
    }

    return (
      url.hostname === "accounts.google.com" ||
      url.hostname === "login.microsoftonline.com" ||
      url.hostname.endsWith(".supabase.co")
    );
  } catch {
    return false;
  }
}

function shouldOpenExternally(targetUrl) {
  return !isAllowedEmbeddedNavigation(targetUrl);
}

function attachNavigationGuards(windowToProtect) {
  windowToProtect.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) {
      void shell.openExternal(url);
      return { action: "deny" };
    }

    return { action: "allow" };
  });

  windowToProtect.webContents.on("will-navigate", (event, url) => {
    if (!shouldOpenExternally(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });
}

function registerDesktopProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(runtimeState.protocolScheme, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
    return;
  }

  app.setAsDefaultProtocolClient(runtimeState.protocolScheme);
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    backgroundColor: "#f5f0e7",
    height: 960,
    icon: getIconPath(),
    minHeight: 800,
    minWidth: 1280,
    show: false,
    title: runtimeState.appName,
    width: 1520,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: false,
    },
  });

  attachNavigationGuards(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    if (pendingDeepLink) {
      void handleDesktopDeepLink(pendingDeepLink);
    }
  });

  await mainWindow.loadURL(runtimeState.appOrigin);
}

async function resolveMailboxConnectUrl(provider) {
  const connectUrl = new URL(
    provider === "gmail" ? "/api/gmail/connect" : `/api/mailboxes/connect/${provider}`,
    runtimeState.appOrigin,
  );
  connectUrl.searchParams.set("desktopReturnUrl", buildDesktopReturnUrl(runtimeState.protocolScheme));

  const sessionCookies = await mainWindow.webContents.session.cookies.get({
    url: runtimeState.appOrigin,
  });
  const cookieHeader = sessionCookies.map(({ name, value }) => `${name}=${value}`).join("; ");
  const response = await fetch(connectUrl, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    redirect: "manual",
  });
  const location = response.headers.get("location");

  if (!response.ok && !(response.status >= 300 && response.status < 400)) {
    throw new Error(`Failed to start ${provider} connection (${response.status}).`);
  }

  if (!location) {
    throw new Error(`${provider} connection did not return a redirect URL.`);
  }

  return new URL(location, connectUrl).toString();
}

ipcMain.handle("desktop:connect-gmail", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      ok: false,
      error: "Desktop window is not ready yet. Please try again.",
    };
  }

  try {
    const externalUrl = await resolveMailboxConnectUrl("gmail");
    await shell.openExternal(externalUrl);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not launch the Gmail OAuth flow.",
    };
  }
});

ipcMain.handle("desktop:connect-mailbox", async (_event, provider) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      ok: false,
      error: "Desktop window is not ready yet. Please try again.",
    };
  }

  if (provider !== "gmail" && provider !== "outlook") {
    return {
      ok: false,
      error: "Unsupported mailbox provider.",
    };
  }

  try {
    const externalUrl = await resolveMailboxConnectUrl(provider);
    await shell.openExternal(externalUrl);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : `Could not launch the ${provider} OAuth flow.`,
    };
  }
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = getDeepLinkFromArgv(argv);

    if (deepLink) {
      void handleDesktopDeepLink(deepLink);
    }

    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      registerDesktopProtocol();
      pendingDeepLink = getDeepLinkFromArgv(process.argv);
      await createMainWindow();
    } catch (error) {
      console.error("Failed to start OutboundFlow Desktop.", error);
      app.quit();
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length > 0) {
      return;
    }

    await createMainWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
