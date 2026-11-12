import { once } from "node:events";
import { app, BrowserWindow } from "electron";
import { createAppServer } from "../server.js";

let server;

async function getAppUrl() {
  if (!server) {
    server = createAppServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
  }

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The local application server did not start correctly.");
  }
  return `http://127.0.0.1:${address.port}/`;
}

async function createWindow() {
  const appUrl = await getAppUrl();
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 760,
    minHeight: 620,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const allowedOrigin = new URL(appUrl).origin;

  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (new URL(navigationUrl).origin !== allowedOrigin) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  await window.loadURL(appUrl);
}

app.whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error("Could not start DataTech Thermal Compensation.", error);
    app.quit();
  });

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error("Could not reopen DataTech Thermal Compensation.", error);
      app.quit();
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (server?.listening) {
    server.close();
    server.closeAllConnections();
  }
});
