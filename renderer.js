let currentPath = '';
let currentFiles = [];  // To store the current directory contents
let showHidden = false;
let sortColumn = '';
let sortOrder = '';  // '', 'asc', or 'desc'

function formatSize(size) {
    if (size === null || size === undefined || isNaN(size)) return '';
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}

function formatDate(date) {
    return new Date(date).toLocaleString();
}

function getFileType(name, isDirectory) {
    if (isDirectory) return 'Folder';
    const extension = name.split('.').pop();
    return extension === name ? 'Unknown' : extension.toUpperCase();
}

function updateBreadcrumb(breadcrumbs) {
    const breadcrumbElement = document.getElementById('breadcrumb');
    breadcrumbElement.innerHTML = '';

    breadcrumbs.forEach(breadcrumb => {
        const span = document.createElement('span');
        span.textContent = breadcrumb.name;
        span.onclick = () => {
            navigateTo(breadcrumb.path);
        };
        breadcrumbElement.appendChild(span);
    });
}

function navigateTo(dirPath) {
    return window.electronAPI.getDirectoryContents(dirPath).then(({ content, breadcrumbs }) => {
        currentPath = dirPath || currentPath;
        currentFiles = content;
        updateBreadcrumb(breadcrumbs);
        displayFiles(currentFiles);
    });
}

function sortFiles(column) {
    if (sortColumn === column) {
        sortOrder = sortOrder === 'asc' ? 'desc' : sortOrder === 'desc' ? '' : 'asc';
    } else {
        sortColumn = column;
        sortOrder = 'asc';
    }

    // Remove sort icons from all columns
    const headers = document.querySelectorAll('th');
    headers.forEach(header => header.classList.remove('asc', 'desc', 'none'));

    // Set the appropriate sort icon
    const header = document.querySelector(`th[onclick="sortFiles('${column}')"]`);
    if (sortOrder) {
        header.classList.add(sortOrder);
    } else {
        header.classList.add('none');
    }

    if (sortOrder) {
        currentFiles.sort((a, b) => {
            if (column === 'name' || column === 'type') {
                const aValue = column === 'name' ? a.name.toLowerCase() : getFileType(a.name, a.isDirectory).toLowerCase();
                const bValue = column === 'name' ? b.name.toLowerCase() : getFileType(b.name, b.isDirectory).toLowerCase();
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            } else if (column === 'size') {
                return sortOrder === 'asc' ? a.size - b.size : b.size - a.size;
            } else {
                const aDate = new Date(a[column]);
                const bDate = new Date(b[column]);
                return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
            }
        });
    } else {
        // Reset to the original order if sorting is removed
        navigateTo(currentPath);
    }

    displayFiles(currentFiles);
}

function displayFiles(files) {
    const fileListElement = document.getElementById('file-list');
    fileListElement.innerHTML = '';

    const searchQuery = document.getElementById('search').value.toLowerCase();
    let displayedFileCount = 0;
    let totalSize = 0; // Initialize total size

    files.forEach(file => {
        if (!showHidden && file.name.startsWith('.')) return;  // Skip hidden files if toggle is off
        if (!file.name.toLowerCase().includes(searchQuery)) return;  // Skip files not matching search query

        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = file.name;
        nameSpan.style.cursor = 'pointer';

        if (file.isDirectory) {
            nameSpan.classList.add('folder');
            nameSpan.onclick = () => navigateTo(file.path);
        } else {
            nameSpan.onclick = () => openFile(file.path);
        }

        nameTd.appendChild(nameSpan);

        // Add a down arrow button for the context menu
        const menuButton = document.createElement('button');
        menuButton.textContent = '⋮';  // Vertical ellipsis for the menu
        menuButton.classList.add('menu-button');
        menuButton.onclick = (event) => {
            event.stopPropagation();  // Prevent the row click event from triggering
            showContextMenu(event, file);
        };

        nameTd.appendChild(menuButton);
        tr.appendChild(nameTd);

        const typeTd = document.createElement('td');
        typeTd.textContent = getFileType(file.name, file.isDirectory);
        tr.appendChild(typeTd);

        const sizeTd = document.createElement('td');
        sizeTd.textContent = formatSize(file.size);
        tr.appendChild(sizeTd);

        const createdTd = document.createElement('td');
        createdTd.textContent = formatDate(file.created);
        tr.appendChild(createdTd);

        const modifiedTd = document.createElement('td');
        modifiedTd.textContent = formatDate(file.modified);
        tr.appendChild(modifiedTd);

        const lastAccessedTd = document.createElement('td');
        lastAccessedTd.textContent = formatDate(file.lastAccessed);
        tr.appendChild(lastAccessedTd);

        fileListElement.appendChild(tr);
        displayedFileCount++;
        totalSize += file.size || 0; // Accumulate total size
    });

    updateFileCount(displayedFileCount);
    updateTotalSize(totalSize); // Update total size display
}

function updateTotalSize(totalSize) {
    const totalSizeElement = document.getElementById('total-size');
    totalSizeElement.innerHTML = `Total Size: <strong>${formatSize(totalSize)}</strong>`;
}

function showContextMenu(event, file) {
    // Remove any existing context menus
    document.querySelectorAll('.context-menu').forEach(menu => menu.remove());

    const menu = document.createElement('div');
    menu.classList.add('context-menu');

    // Create menu options
    const renameOption = document.createElement('div');
    renameOption.textContent = 'Rename';
    renameOption.onclick = () => {
        showRenameInput(file);
        menu.remove(); // Close the menu after the action
    };
    menu.appendChild(renameOption);

    const copyOption = document.createElement('div');
    copyOption.textContent = 'Copy';
    copyOption.onclick = () => {
        window.electronAPI.copyFile(file.path);
        menu.remove(); // Close the menu after copying
    };
    menu.appendChild(copyOption);

    const copyPathOption = document.createElement('div');
    copyPathOption.textContent = 'Copy Path';
    copyPathOption.onclick = () => {
        window.electronAPI.copyFilePath(file.path);
        menu.remove(); // Close the menu after copying the path
    };
    menu.appendChild(copyPathOption);

    const deleteOption = document.createElement('div');
    deleteOption.textContent = 'Delete';
    deleteOption.onclick = () => {
        if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
            window.electronAPI.deleteFile(file.path).then((success) => {
                if (success) {
                    refreshDirectory(); // Refresh the directory after deletion
                } else {
                    alert('Failed to delete the file or folder.');
                }
            });
        }
        menu.remove(); // Close the menu after the action
    };
    menu.appendChild(deleteOption);

    // Position the menu near the button
    menu.style.position = 'absolute';
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;

    // Append the menu to the document
    document.body.appendChild(menu);

    // Close the menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
        }
    }, { once: true });

    // Prevent the default context menu from appearing
    event.preventDefault();
}

function showRenameInput(file) {
    console.log("showRenameInput");
    const fileListElement = document.getElementById('file-list');
    const fileRow = Array.from(fileListElement.children).find(row => {
        const nameSpan = row.querySelector('span');
        return nameSpan && nameSpan.textContent.trim() === file.name;
    });
    console.log("fileRow: ", fileRow);
    
    if (!fileRow) return;

    const nameTd = fileRow.firstChild;
    const nameSpan = nameTd.querySelector('span');
    const menuButton = nameTd.querySelector('button');

    // Hide the name span and menu button
    nameSpan.style.display = 'none';
    menuButton.style.display = 'none';

    // Create the input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = file.name;
    input.classList.add('rename-input');
    nameTd.appendChild(input);

    input.focus();

    // Handle input events
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finalizeRename(input, file);
        } else if (e.key === 'Escape') {
            cancelRename(input, nameSpan, menuButton);
        }
    });

    input.addEventListener('blur', () => {
        cancelRename(input, nameSpan, menuButton);
    });
}

function finalizeRename(input, file) {
    const newName = input.value.trim();
    if (newName && newName !== file.name) {
        window.electronAPI.renameFile(file.path, newName).then((success) => {
            if (success) {
                refreshDirectory(); // Refresh the directory to show the new name
            } else {
                alert('Failed to rename the file or folder.');
            }
        });
    }
    // Clean up UI
    if (document.body.contains(input)) {
        cancelRename(input, input.previousSibling, input.nextSibling);
    }
}

function cancelRename(input, nameSpan, menuButton) {
    // Ensure the input element still exists before removing it
    if (input && input.parentNode) {
        input.remove();
    }
    // Restore the name span and menu button
    if (nameSpan) nameSpan.style.display = '';
    if (menuButton) menuButton.style.display = '';
}

function updateFileCount(count) {
    const fileCountElement = document.getElementById('file-count');
    fileCountElement.innerHTML = `Files: <strong>${count}</strong>`;
}

function filterFiles() {
    displayFiles(currentFiles);
}

function toggleHidden() {
    showHidden = document.getElementById('toggle-hidden').checked;
    displayFiles(currentFiles);
}

function refreshDirectory() {
    showSpinner();
    navigateTo(currentPath).finally(hideSpinner);
}

function showSpinner() {
    document.getElementById('loading-spinner').style.display = 'inline-block';
}

function hideSpinner() {
    console.log('hideSpinner called');
    document.getElementById('loading-spinner').style.display = 'none';
}

function openFile(filePath) {
    window.electronAPI.openFile(filePath);
}

function minimizeWindow() {
    window.electronAPI.minimizeWindow();
}

function toggleMaximizeWindow() {
    window.electronAPI.toggleMaximizeWindow();
}

function closeWindow() {
    window.electronAPI.closeWindow();
}

// Start by loading the Downloads directory
navigateTo('');
