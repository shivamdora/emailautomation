const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("outboundFlowDesktop", {
  connectMailbox: (provider) => ipcRenderer.invoke("desktop:connect-mailbox", provider),
  connectGmail: () => ipcRenderer.invoke("desktop:connect-gmail"),
  isDesktop: true,
  version: process.versions.electron,
});
