const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.disableHardwareAcceleration();

var mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        icon: path.join(__dirname, 'assets', 'app-icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    mainWindow.maximize();
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Handle file opening request from the renderer process
ipcMain.handle('open-file', async (event, filePath) => {
    try {
        await shell.openPath(filePath);
    } catch (error) {
        console.error('Error opening file:', error);
    }
});

// Handle file copying request from the renderer process
ipcMain.handle('copy-file', async (event, filePath) => {
    try {
        const fileContent = fs.readFileSync(filePath);
        clipboard.writeBuffer('clipboard', Buffer.from(fileContent));
        console.log('File copied to clipboard:', filePath);
    } catch (error) {
        console.error('Error copying file to clipboard:', error);
    }
});

// Handle copying the file path to the clipboard
ipcMain.handle('copy-file-path', async (event, filePath) => {
    try {
        clipboard.writeText(filePath);
        console.log('File path copied to clipboard:', filePath);
    } catch (error) {
        console.error('Error copying file path to clipboard:', error);
    }
});

// Handle file/folder deletion request
ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmdirSync(filePath, { recursive: true });
        } else {
            fs.unlinkSync(filePath);
        }
        console.log('File deleted:', filePath);
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
});

// Handle renaming of a file or folder
ipcMain.handle('rename-file', async (event, oldPath, newName) => {
    try {
        const newPath = path.join(path.dirname(oldPath), newName);
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed from "${oldPath}" to "${newPath}"`);
        return true;
    } catch (error) {
        console.error('Error renaming file:', error);
        return false;
    }
});
ipcMain.handle('get-directory-contents', async (event, dirPath) => {
    const directoryPath = dirPath || path.join(os.homedir(), 'Downloads');
    const items = await fs.promises.readdir(directoryPath, { withFileTypes: true });

    // Generate breadcrumb paths
    const breadcrumbs = directoryPath.split(path.sep).map((part, index, parts) => ({
        name: part || (index === 0 ? '/' : ''),
        path: parts.slice(0, index + 1).join(path.sep),
    }));

    const contentPromises = items.map(async item => {
        const fullPath = path.join(directoryPath, item.name);
        const stats = await fs.promises.stat(fullPath);

        return {
            name: item.name,
            path: fullPath,
            isDirectory: item.isDirectory(),
            size: item.isDirectory() ? null : stats.size,  // File size in bytes
            created: stats.birthtime,  // Creation time
            modified: stats.mtime,     // Last modified time
            lastAccessed: stats.atime  // Last accessed time
        };
    });

    const content = await Promise.all(contentPromises);

    return { content, breadcrumbs };
});

ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
});

ipcMain.on('toggle-maximize-window', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('close-window', () => {
    mainWindow.close();
});