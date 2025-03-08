/**
 * Folder Manager
 * Handles folder tree rendering, creation, navigation, and drag-and-drop
 */
class FolderManager {
  constructor() {
    this.currentPath = '/';
    this.folderTree = [];
    
    // Check if necessary DOM elements exist before initializing
    const folderTree = document.getElementById('folderTree');
    if (!folderTree) {
      console.log('Folder tree element not found, skipping folder manager initialization');
      return;
    }
    
    this.initDragAndDrop();
  }
  
  /**
   * Initialize the folder manager
   */
  async init() {
    await this.loadFolderStructure();
    this.setupEventListeners();
  }
  
  /**
   * Load folder structure from the server
   */
  async loadFolderStructure() {
    try {
      console.log('Loading folder structure from server...');
      const response = await fetch('/api/folder-structure');
      if (!response.ok) {
        throw new Error(`Failed to load folder structure: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Folder structure data:', data);
      
      if (data.success) {
        this.folderTree = data.structure;
        this.renderFolderTree();
      } else {
        console.error('Error loading folder structure:', data.error);
        this.showError('Erro ao carregar estrutura de pastas: ' + data.error);
      }
    } catch (error) {
      console.error('Error loading folder structure:', error);
      this.showError('Erro ao carregar estrutura de pastas: ' + error.message);
    }
  }
  
  /**
   * Render the folder tree in the UI
   */
  renderFolderTree() {
    const folderTreeElement = document.getElementById('folderTree');
    if (!folderTreeElement) return;
    
    // Clear existing content except the root folder
    const rootFolder = folderTreeElement.querySelector('.folder-tree-item[data-path="/"]');
    folderTreeElement.innerHTML = '';
    
    if (rootFolder) {
      folderTreeElement.appendChild(rootFolder);
    } else {
      // Create root folder if it doesn't exist
      const rootItem = document.createElement('div');
      rootItem.className = 'folder-tree-item';
      rootItem.setAttribute('data-path', '/');
      rootItem.setAttribute('data-expanded', 'true');
      rootItem.innerHTML = `
        <i class="bi bi-folder-fill folder-tree-icon"></i>
        <span class="folder-tree-name">Raiz</span>
        <div class="folder-tree-actions">
          <button type="button" class="refresh-btn" title="Atualizar">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      `;
      folderTreeElement.appendChild(rootItem);
    }
    
    // Render the tree recursively
    this.renderFolderItems(this.folderTree, folderTreeElement, 0);
  }
  
  /**
   * Render folder items recursively
   * @param {Array} items - Folder items to render
   * @param {HTMLElement} parentElement - Parent element to append to
   * @param {Number} level - Indentation level
   */
  renderFolderItems(items, parentElement, level) {
    if (!items || !items.length) return;
    
    items.forEach(item => {
      if (item.type === 'directory') {
        const folderItem = document.createElement('div');
        folderItem.className = 'folder-tree-item';
        folderItem.setAttribute('data-path', item.path);
        folderItem.setAttribute('data-expanded', 'false');
        folderItem.style.paddingLeft = `${level * 20 + 12}px`;
        folderItem.innerHTML = `
          <i class="bi bi-folder folder-tree-icon"></i>
          <span class="folder-tree-name">${item.name}</span>
          <div class="folder-tree-actions">
            <button type="button" class="expand-btn" title="Expandir">
              <i class="bi bi-chevron-right"></i>
            </button>
            <button type="button" class="delete-btn" title="Excluir">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
        parentElement.appendChild(folderItem);
        
        // Create container for children but don't display yet
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'folder-children';
        childrenContainer.setAttribute('data-parent', item.path);
        childrenContainer.style.display = 'none';
        parentElement.appendChild(childrenContainer);
        
        // Render children recursively
        this.renderFolderItems(item.children, childrenContainer, level + 1);
      }
    });
  }
  
  /**
   * Set up event listeners for folder navigation and actions
   */
  setupEventListeners() {
    console.log('Setting up folder manager event listeners');
    
    // Create folder button
    const createFolderBtn = document.getElementById('createFolderBtn');
    if (createFolderBtn) {
      createFolderBtn.addEventListener('click', () => {
        console.log('Create folder button clicked');
        this.showCreateFolderModal();
      });
    } else {
      console.warn('Create folder button not found');
    }
    
    // New folder form submission
    const newFolderNameInput = document.getElementById('newFolderName');
    if (newFolderNameInput) {
      newFolderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          console.log('Enter key pressed in new folder input');
          e.preventDefault();
          this.createFolder(newFolderNameInput.value, this.currentPath);
          newFolderNameInput.value = '';
        }
      });
    }
    
    // Modal folder creation confirmation
    const confirmCreateFolderBtn = document.getElementById('confirmCreateFolderBtn');
    if (confirmCreateFolderBtn) {
      confirmCreateFolderBtn.addEventListener('click', () => {
        console.log('Confirm create folder button clicked');
        const folderNameInput = document.getElementById('folderNameInput');
        const parentFolderSelect = document.getElementById('parentFolderSelect');
        
        if (folderNameInput && parentFolderSelect) {
          this.createFolder(
            folderNameInput.value, 
            parentFolderSelect.value
          );
        }
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createFolderModal'));
        if (modal) modal.hide();
      });
    }
    
    // Event delegation for folder tree interactions
    const folderTree = document.getElementById('folderTree');
    if (folderTree) {
      folderTree.addEventListener('click', (e) => {
        // Get the folder item element
        const folderItem = e.target.closest('.folder-tree-item');
        if (!folderItem) return;
        
        // Handle expand/collapse button
        if (e.target.closest('.expand-btn')) {
          this.toggleFolderExpand(folderItem);
          return;
        }
        
        // Handle delete button
        if (e.target.closest('.delete-btn')) {
          this.deleteFolder(folderItem.getAttribute('data-path'));
          return;
        }
        
        // Handle refresh button
        if (e.target.closest('.refresh-btn')) {
          this.loadFolderStructure();
          return;
        }
        
        // Handle folder selection (navigation)
        this.selectFolder(folderItem);
      });
    }
  }
  
  /**
   * Select a folder and update the current path
   * @param {HTMLElement} folderItem - The folder item element
   */
  selectFolder(folderItem) {
    // Remove active class from all folders
    document.querySelectorAll('.folder-tree-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to selected folder
    folderItem.classList.add('active');
    
    // Update current path
    this.currentPath = folderItem.getAttribute('data-path');
    
    // Update file list to show files in this folder
    this.loadFilesForFolder(this.currentPath);
  }
  
  /**
   * Toggle folder expand/collapse
   * @param {HTMLElement} folderItem - The folder item element
   */
  toggleFolderExpand(folderItem) {
    const path = folderItem.getAttribute('data-path');
    const isExpanded = folderItem.getAttribute('data-expanded') === 'true';
    
    // Update expanded state
    folderItem.setAttribute('data-expanded', !isExpanded);
    
    // Update icon
    const expandBtn = folderItem.querySelector('.expand-btn');
    if (expandBtn) {
      const icon = expandBtn.querySelector('i');
      if (isExpanded) {
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-right');
      } else {
        icon.classList.remove('bi-chevron-right');
        icon.classList.add('bi-chevron-down');
      }
    }
    
    // Update folder icon
    const folderIcon = folderItem.querySelector('.folder-tree-icon');
    if (folderIcon) {
      if (isExpanded) {
        folderIcon.classList.remove('bi-folder-fill');
        folderIcon.classList.add('bi-folder');
      } else {
        folderIcon.classList.remove('bi-folder');
        folderIcon.classList.add('bi-folder-fill');
      }
    }
    
    // Show/hide children container
    const childrenContainer = document.querySelector(`.folder-children[data-parent="${path}"]`);
    if (childrenContainer) {
      childrenContainer.style.display = isExpanded ? 'none' : 'block';
    }
  }
  
  /**
   * Show the create folder modal
   */
  showCreateFolderModal() {
    // Get the modal
    const modal = document.getElementById('createFolderModal');
    if (!modal) {
      console.error('Create folder modal not found');
      return;
    }
    
    // Clear input field
    const folderNameInput = document.getElementById('folderNameInput');
    if (folderNameInput) {
      folderNameInput.value = '';
    }
    
    // Populate parent folder select
    this.populateParentFolderSelect();
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }
  
  /**
   * Populate the parent folder select dropdown
   */
  populateParentFolderSelect() {
    const select = document.getElementById('parentFolderSelect');
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '<option value="/">Raiz</option>';
    
    // Add folder paths recursively
    const addFolderOptions = (items, prefix = '') => {
      if (!items || !items.length) return;
      
      items.forEach(item => {
        if (item.type === 'directory') {
          const option = document.createElement('option');
          option.value = item.path;
          option.textContent = prefix + item.name;
          select.appendChild(option);
          
          // Add children recursively
          if (item.children) {
            addFolderOptions(item.children, prefix + item.name + ' / ');
          }
        }
      });
    };
    
    addFolderOptions(this.folderTree);
    
    // Set current path as selected
    if (this.currentPath) {
      select.value = this.currentPath;
    }
  }
  
  /**
   * Create a new folder
   * @param {string} folderName - Name of the folder to create
   * @param {string} parentPath - Path of the parent folder
   */
  async createFolder(folderName, parentPath = '/') {
    console.log(`Creating folder: ${folderName} in ${parentPath}`);
    
    if (!folderName || folderName.trim() === '') {
      this.showError('Nome da pasta não pode estar vazio');
      return;
    }
    
    try {
      const response = await fetch('/api/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          folderName: folderName.trim(),
          parentPath
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Create folder response:', data);
      
      if (data.success) {
        // Reload folder structure
        await this.loadFolderStructure();
        
        // Show success message
        this.showSuccess(`Pasta ${folderName} criada com sucesso`);
        
        // Clear input field
        const newFolderNameInput = document.getElementById('newFolderName');
        if (newFolderNameInput) {
          newFolderNameInput.value = '';
        }
      } else {
        this.showError(data.error || 'Erro ao criar pasta');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      this.showError('Erro ao criar pasta: ' + error.message);
    }
  }
  
  /**
   * Delete a folder
   * @param {string} path - Path of the folder to delete
   */
  deleteFolder(path) {
    if (confirm(`Tem certeza que deseja excluir a pasta "${path}"? Esta ação não pode ser desfeita.`)) {
      // Implement folder deletion logic
      console.log('Deletando pasta:', path);
      // After deletion, reload folder structure
      this.loadFolderStructure();
    }
  }
  
  /**
   * Load files for a specific folder
   * @param {string} folderPath - Path of the folder to load files from
   */
  loadFilesForFolder(folderPath) {
    // TODO: Implement loading files for a specific folder
    console.log('Loading files for folder:', folderPath);
  }
  
  /**
   * Initialize drag and drop functionality
   */
  initDragAndDrop() {
    // Check if required elements exist
    const filesList = document.getElementById('filesList');
    const folderTree = document.getElementById('folderTree');
    
    if (!filesList || !folderTree) {
      console.log('File list or folder tree not found, skipping drag and drop initialization');
      return;
    }
    
    // Add event delegation for drag events on file items
    document.addEventListener('dragstart', (e) => {
      const fileItem = e.target.closest('.file-item');
      if (!fileItem) return;
      
      // Set data for dragging
      e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-filename'));
      
      // Add dragging class for visual feedback
      fileItem.classList.add('dragging');
    });
    
    document.addEventListener('dragend', (e) => {
      const fileItem = e.target.closest('.file-item');
      if (!fileItem) return;
      
      // Remove dragging class
      fileItem.classList.remove('dragging');
    });
    
    // Add drag over and drop events to folder items
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      
      const folderItem = e.target.closest('.folder-tree-item');
      if (!folderItem) return;
      
      // Add visual feedback
      folderItem.classList.add('drop-target');
    });
    
    document.addEventListener('dragleave', (e) => {
      const folderItem = e.target.closest('.folder-tree-item');
      if (!folderItem) return;
      
      // Remove visual feedback
      folderItem.classList.remove('drop-target');
    });
    
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      
      const folderItem = e.target.closest('.folder-tree-item');
      if (!folderItem) return;
      
      // Remove visual feedback
      folderItem.classList.remove('drop-target');
      
      // Get the file being dragged
      const filename = e.dataTransfer.getData('text/plain');
      if (!filename) return;
      
      // Get the target folder path
      const targetPath = folderItem.getAttribute('data-path');
      
      // Move the file to the target folder
      this.moveFile(filename, targetPath);
    });
  }
  
  /**
   * Move a file to a different folder
   * @param {string} filename - Name of the file to move
   * @param {string} targetPath - Path of the target folder
   */
  moveFile(filename, targetPath) {
    console.log(`Moving file ${filename} to folder ${targetPath}`);
    // TODO: Implement file moving logic
  }
  
  /**
   * Show a success toast message
   * @param {string} message - Message to show
   */
  showSuccess(message) {
    if (typeof showToast === 'function') {
      showToast(message, 'success');
    } else {
      console.log('Success:', message);
      // Simple fallback toast if showToast function isn't loaded
      alert(message);
    }
  }
  
  /**
   * Show an error toast message
   * @param {string} message - Message to show
   */
  showError(message) {
    if (typeof showToast === 'function') {
      showToast(message, 'danger');
    } else {
      console.error('Error:', message);
      // Simple fallback toast if showToast function isn't loaded
      alert('Error: ' + message);
    }
  }
}

// Initialize folder manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on a page that uses folder functionality
  const pageType = document.getElementById('page-type');
  if (pageType && (pageType.getAttribute('data-page') === 'file' || pageType.getAttribute('data-page') === 'analysis')) {
    console.log('Not on a folder management page, skipping folder manager initialization');
    return;
  }

  // Only initialize if we're on a page with folder functionality
  const folderTree = document.getElementById('folderTree');
  if (!folderTree) {
    console.log('Not on a page with folder functionality, skipping folder manager initialization');
    return;
  }
  
  console.log('Initializing folder manager');
  window.folderManager = new FolderManager();
  window.folderManager.init();
});