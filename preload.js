const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getDirectoryContents: (dirPath) => ipcRenderer.invoke('get-directory-contents', dirPath),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    copyFile: (filePath) => ipcRenderer.invoke('copy-file', filePath),
    copyFilePath: (filePath) => ipcRenderer.invoke('copy-file-path', filePath),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', oldPath, newName),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    toggleMaximizeWindow: () => ipcRenderer.send('toggle-maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window')
});
