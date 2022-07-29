const { app, BrowserWindow, protocol } = require('electron')
const path = require("path");
const url = require("url");

const allowedNavigationDestinations = "https://www.dinopass.com";

app.whenReady().then(() => {
    createWindow();
    setupLocalFilesNormalizerProxy();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (!allowedNavigationDestinations.includes(parsedUrl.origin)) {
      event.preventDefault();
    }
  });
});

const createWindow = () => {
    
    const ver = app.getVersion();
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        additionalArguments: ["?appver|"+ver]
      },
    })
    if (app.isPackaged) win.removeMenu();
  
    const appURL = app.isPackaged
    ? url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true,
      })
    : "http://localhost:3000";
    win.loadURL(appURL);
    if (!app.isPackaged) win.webContents.openDevTools()
}

function setupLocalFilesNormalizerProxy() {
    protocol.registerHttpProtocol(
      "file",
      (request, callback) => {
        const url = request.url.substr(8);
        callback({ path: path.normalize(`${__dirname}/${url}`) });
      },
      (error) => {
        if (error) console.error("Failed to register protocol");
      }
    );
}