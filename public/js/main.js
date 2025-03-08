document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, inicializando aplicação...');
  
  // Inicializa tooltips do Bootstrap
  const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  
  // Configura drag and drop para upload
  setupFileUpload();
  
  // Configura o botão de teste da API na página principal
  const testApiBtn = document.getElementById('testApiBtn');
  if (testApiBtn) {
    testApiBtn.addEventListener('click', testApiConnection);
  }
  
  // Configura o botão de teste da API no navbar e footer
  const testApiButton = document.getElementById('testApiButton');
  const apiStatusCheck = document.getElementById('apiStatusCheck');
  
  [testApiButton, apiStatusCheck].forEach(button => {
    if (button) {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        const apiTestModal = new bootstrap.Modal(document.getElementById('apiTestModal'));
        apiTestModal.show();
        testApiConnectionModal();
      });
    }
  });
  
  // Configura o botão de re-teste no modal
  const retestApiButton = document.getElementById('retestApiButton');
  if (retestApiButton) {
    retestApiButton.addEventListener('click', testApiConnectionModal);
  }
  
  // Inicializa a configuração do modelo GPT
  initGptModelSettings();
  
  // Inicializa a verificação da conexão SSH
  checkSshStatus();
  
  // Inicializa as configurações de SSH
  initSshSettings();

  // Configura os botões de estrutura de arquivos SSH
  setupSshFileButtons();

  // Configura o botão para alternar entre modos de desenvolvimento e produção
  setupAppModeToggle();
  
  // Configura o botão para alternar entre SSH e pasta local
  setupStorageToggle();
  
  // Configura os controles de configuração de pasta local
  setupLocalFolderConfig();

  // Configura o seletor de diretório
  setupDirectorySelector();
  
  // Configura os botões de exclusão de arquivo
  setupFileDeleteButtons();
  
  // Verificar status da aplicação
  checkApplicationStatus();
  
  // Configure folder navigation
  setupFolderNavigation();
  
  // Configure folder creation
  setupFolderCreation();
});

// Set up folder navigation
function setupFolderNavigation() {
  const filesList = document.getElementById('filesList');
  const breadcrumbNav = document.querySelector('.breadcrumb');
  
  // Store current path for navigation
  let currentPath = '';
  
  // Set up click event for folder links
  document.addEventListener('click', async function(e) {
    // Handle folder links
    if (e.target.closest('.folder-link')) {
      e.preventDefault();
      const folderLink = e.target.closest('.folder-link');
      const path = folderLink.getAttribute('data-path');
      
      // Navigate to the folder
      await navigateToFolder(path);
    }
    
    // Handle breadcrumb links
    if (e.target.closest('.folder-breadcrumb-link')) {
      e.preventDefault();
      const breadcrumbLink = e.target.closest('.folder-breadcrumb-link');
      const path = breadcrumbLink.getAttribute('data-path');
      
      // Navigate to the folder
      await navigateToFolder(path);
    }
  });
  
  /**
   * Navigate to a specific folder
   * @param {string} path - Folder path to navigate to
   */
  async function navigateToFolder(path) {
    console.log('Navigating to folder:', path);
    
    try {
      // Update current path
      currentPath = path;
      
      // Show loading indicator
      if (filesList) {
        filesList.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Carregando...</p></div>';
      }
      
      // Fetch the folder contents
      const response = await fetch(`/api/list-directory/${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.success) {
        // Update files list
        updateFilesList(data.items);
        
        // Update breadcrumb
        updateBreadcrumb(path);
      } else {
        showToast(`Erro ao listar o conteúdo da pasta: ${data.error}`, 'danger');
      }
    } catch (error) {
      console.error('Erro ao navegar para a pasta:', error);
      showToast('Erro ao navegar para a pasta.', 'danger');
    }
  }
  
  /**
   * Update the files list with the contents of a folder
   * @param {Array} items - Array of file/folder items
   */
  function updateFilesList(items) {
    if (!filesList) return;
    
    if (items.length === 0) {
      filesList.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-folder-x empty-state-icon"></i>
          <h6 class="mb-2">Pasta vazia</h6>
          <p class="text-light small mb-0">
            Esta pasta não contém arquivos ou subpastas.
          </p>
        </div>
      `;
      return;
    }
    
    // Sort items - directories first, then files
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    // Build HTML
    let html = '';
    
    items.forEach(item => {
      if (item.type === 'directory') {
        // Folder item
        html += `
          <div class="file-item rounded-custom-sm" data-filename="${item.path}" data-type="directory" draggable="true">
            <i class="bi bi-folder-fill file-icon" style="color: var(--primary-color);"></i>
            <div class="file-name">
              <a href="#" class="text-light text-decoration-none folder-link" data-path="${item.path}">
                ${item.name}
              </a>
            </div>
            <div class="file-actions">
              <button class="btn btn-sm btn-danger rounded-pill delete-file-btn" 
                data-filename="${item.path}" data-bs-toggle="tooltip" title="Excluir pasta">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        // File item
        html += `
          <div class="file-item rounded-custom-sm" data-filename="${item.path}" data-type="file" draggable="true">
            <i class="bi bi-file-earmark-code file-icon"></i>
            <div class="file-name">
              <a href="/file/${item.path}" class="text-light text-decoration-none">
                ${item.name}
              </a>
            </div>
            <div class="file-actions">
              <a href="/analyze/${item.path}" class="btn btn-sm btn-primary rounded-pill" data-bs-toggle="tooltip" title="Analisar com GPT">
                <i class="bi bi-search"></i>
              </a>
              <button class="btn btn-sm btn-danger rounded-pill delete-file-btn" 
                data-filename="${item.path}" data-bs-toggle="tooltip" title="Excluir arquivo">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `;
      }
    });
    
    filesList.innerHTML = html;
    
    // Reinitialize tooltips
    const tooltips = filesList.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(el => new bootstrap.Tooltip(el));
    
    // Setup delete buttons
    setupFileDeleteButtons();
  }
  
  /**
   * Update the breadcrumb navigation based on current path
   * @param {string} path - Current folder path
   */
  function updateBreadcrumb(path) {
    if (!breadcrumbNav) return;
    
    // Clear breadcrumb except for the "Root" link
    while (breadcrumbNav.children.length > 1) {
      breadcrumbNav.removeChild(breadcrumbNav.lastChild);
    }
    
    // If we're at root, nothing else to do
    if (path === '/' || !path) return;
    
    // Split path into segments
    const segments = path.split('/').filter(segment => segment !== '');
    
    // Build the breadcrumb path
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Create breadcrumb item
      const breadcrumbItem = document.createElement('li');
      breadcrumbItem.className = 'breadcrumb-item';
      
      // If it's the last segment, make it active
      if (index === segments.length - 1) {
        breadcrumbItem.classList.add('active');
        breadcrumbItem.textContent = segment;
      } else {
        // Otherwise, make it a link
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'folder-breadcrumb-link';
        link.setAttribute('data-path', currentPath);
        link.textContent = segment;
        breadcrumbItem.appendChild(link);
      }
      
      breadcrumbNav.appendChild(breadcrumbItem);
    });
  }
}

// Setup folder creation
function setupFolderCreation() {
  const createFolderBtn = document.getElementById('createFolderBtn');
  const newFolderNameInput = document.getElementById('newFolderName');
  
  if (createFolderBtn && newFolderNameInput) {
    createFolderBtn.addEventListener('click', async function() {
      const folderName = newFolderNameInput.value.trim();
      
      if (!folderName) {
        showToast('Por favor, digite um nome para a pasta.', 'warning');
        return;
      }
      
      // Get current path from breadcrumb
      let currentPath = '/';
      const breadcrumbItems = document.querySelectorAll('.breadcrumb-item.active');
      if (breadcrumbItems.length > 0) {
        const breadcrumbPath = [];
        
        // Build path from breadcrumb
        document.querySelectorAll('.breadcrumb-item').forEach((item, index) => {
          if (index === 0) return; // Skip "Root" item
          
          const linkEl = item.querySelector('.folder-breadcrumb-link');
          const segmentName = linkEl ? linkEl.textContent : item.textContent;
          breadcrumbPath.push(segmentName);
        });
        
        currentPath = breadcrumbPath.length > 0 ? `/${breadcrumbPath.join('/')}` : '/';
      }
      
      try {
        createFolderBtn.disabled = true;
        createFolderBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        
        // Create folder via API
        const response = await fetch('/api/create-folder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            folderName,
            parentPath: currentPath
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showToast(`Pasta "${folderName}" criada com sucesso.`, 'success');
          newFolderNameInput.value = '';
          
          // Refresh folder content
          const currentBreadcrumbLink = document.querySelector('.breadcrumb-item.active');
          if (currentBreadcrumbLink) {
            // Trigger a click on the current folder breadcrumb link to refresh
            const prevLink = currentBreadcrumbLink.previousElementSibling;
            if (prevLink) {
              const linkEl = prevLink.querySelector('.folder-breadcrumb-link');
              if (linkEl) {
                linkEl.click();
              }
            } else {
              // If no previous link, we're at root, click on root
              const rootLink = document.querySelector('.folder-breadcrumb-link[data-path="/"]');
              if (rootLink) {
                rootLink.click();
              } else {
                // Fallback: reload the page
                window.location.reload();
              }
            }
          } else {
            // Fallback: reload the page
            window.location.reload();
          }
        } else {
          showToast(`Erro ao criar pasta: ${data.error}`, 'danger');
        }
      } catch (error) {
        console.error('Erro ao criar pasta:', error);
        showToast('Erro ao criar pasta. Verifique sua conexão.', 'danger');
      } finally {
        createFolderBtn.disabled = false;
        createFolderBtn.innerHTML = '<i class="bi bi-folder-plus"></i>';
      }
    });
    
    // Handle Enter key press
    newFolderNameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        createFolderBtn.click();
      }
    });
  }
}

// Verifica o status da aplicação (API, servidor, etc.)
function checkApplicationStatus() {
  // Adicionar badge de status de conexão
  const connectionBadge = document.getElementById('connection-badge');
  const apiStatusBadge = document.getElementById('api-status-badge');
  
  if (connectionBadge) {
    // Verificar a conexão com o backend
    console.log('Verificando status do servidor...');
    fetch('/api/status')
      .then(response => {
        console.log('Resposta de status recebida:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('Dados de status:', data);
        
        // Atualizar badge de conexão
        if (connectionBadge) {
          connectionBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Online';
          connectionBadge.classList.remove('bg-secondary');
          connectionBadge.classList.add('bg-success');
        }
        
        // Atualizar badge de API
        if (apiStatusBadge) {
          apiStatusBadge.textContent = 'Online';
          apiStatusBadge.classList.remove('bg-secondary', 'bg-danger', 'bg-warning');
          apiStatusBadge.classList.add('bg-success');
        }
        
        // Verificar status SSH apenas se não estiver em pasta local
        if (data.ssh_status === 'disconnected' && !data.local_folder) {
          const sshStatusBadge = document.getElementById('ssh-status-badge');
          if (sshStatusBadge) {
            sshStatusBadge.textContent = 'Offline';
            sshStatusBadge.classList.remove('bg-success', 'bg-secondary');
            sshStatusBadge.classList.add('bg-danger');
          }
          
          showToast('Não foi possível conectar ao servidor SSH. Os arquivos remotos não estarão disponíveis.', 'warning');
        }
      })
      .catch(error => {
        console.error('Erro ao verificar status do servidor:', error);
        
        // Atualizar badge de conexão
        if (connectionBadge) {
          connectionBadge.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i>Offline';
          connectionBadge.classList.remove('bg-secondary');
          connectionBadge.classList.add('bg-danger');
        }
        
        // Atualizar badge de API
        if (apiStatusBadge) {
          apiStatusBadge.textContent = 'Offline';
          apiStatusBadge.classList.remove('bg-secondary');
          apiStatusBadge.classList.add('bg-danger');
        }
      });
  }
}

// Configura os botões de exclusão de arquivo
function setupFileDeleteButtons() {
  // Configurar os botões de exclusão para cada arquivo
  const deleteButtons = document.querySelectorAll('.delete-file-btn');
  const deleteFileModal = new bootstrap.Modal(document.getElementById('deleteFileModal'));
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const fileToDeleteElement = document.getElementById('fileToDelete');
  
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const filename = this.getAttribute('data-filename');
      
      // Atualiza o modal com o nome do arquivo
      if (fileToDeleteElement) {
        fileToDeleteElement.textContent = filename;
      }
      
      // Configurar o botão de confirmação
      if (confirmDeleteBtn) {
        confirmDeleteBtn.setAttribute('data-filename', filename);
      }
      
      // Mostrar o modal de confirmação
      deleteFileModal.show();
    });
  });
  
  // Configurar o botão de confirmação de exclusão
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async function() {
      const filename = this.getAttribute('data-filename');
      this.disabled = true;
      this.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Excluindo...';
      
      try {
        const response = await fetch(`/api/delete-file/${encodeURIComponent(filename)}`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
          showToast(`Arquivo ${filename} excluído com sucesso`, 'success');
          // Fechar o modal
          deleteFileModal.hide();
          // Recarregar a página para atualizar a lista de arquivos
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showToast(`Erro ao excluir arquivo: ${data.error}`, 'danger');
          this.disabled = false;
          this.innerHTML = '<i class="bi bi-trash me-2"></i>Excluir';
        }
      } catch (error) {
        console.error('Erro ao excluir arquivo:', error);
        showToast('Erro ao comunicar com o servidor', 'danger');
        this.disabled = false;
        this.innerHTML = '<i class="bi bi-trash me-2"></i>Excluir';
      }
    });
  }
}

// Configura o seletor de diretório para o campo de pasta local
function setupDirectorySelector() {
  const folderSelector = document.getElementById('folderSelector');
  const browseFolderBtn = document.getElementById('browseFolderBtn');
  const localDirInput = document.getElementById('localDir');
  
  if (folderSelector && browseFolderBtn && localDirInput) {
    browseFolderBtn.addEventListener('click', function() {
      folderSelector.click();
    });
    
    folderSelector.addEventListener('change', function(e) {
      if (this.files && this.files.length > 0) {
        try {
          // Obter o caminho do diretório selecionado
          // Como o atributo webkitdirectory permite selecionar o conteúdo do diretório,
          // precisamos extrair o caminho base comum de todos os arquivos
          
          // Primeiro, obter todos os caminhos dos arquivos
          const filePaths = Array.from(this.files).map(file => file.webkitRelativePath);
          
          if (filePaths.length > 0) {
            // A primeira parte do webkitRelativePath é o nome da pasta selecionada
            const selectedFolderName = filePaths[0].split('/')[0];
            
            // Obter caminho base do input atual
            let basePath = localDirInput.value || '/home/project/files';
            
            // Se o caminho atual terminar com "/", remove para evitar dupla barra
            if (basePath.endsWith('/')) {
              basePath = basePath.slice(0, -1);
            }
            
            // Determinar o novo caminho baseado no contexto atual
            // Se já estiver em algum subdiretório específico, sugerir o novo dentro dele
            if (basePath === '/home/project/files') {
              // Caso padrão: substituir completamente pelo diretório selecionado
              localDirInput.value = `/home/project/files/${selectedFolderName}`;
            } else {
              // Adicionar ao caminho existente
              localDirInput.value = `${basePath}/${selectedFolderName}`;
            }
            
            // Mostrar um toast de confirmação
            showToast(`Diretório selecionado: ${selectedFolderName}`, 'success');
          }
        } catch (err) {
          console.error('Erro ao processar seleção de diretório:', err);
          showToast('Erro ao selecionar diretório. Tente novamente.', 'danger');
        }
      }
    });
  }
}

// Configura os controles de configuração da pasta local
function setupLocalFolderConfig() {
  const useLocalFolderSwitch = document.getElementById('useLocalFolderSwitch');
  const localFolderSection = document.getElementById('localFolderSection');
  const localDirInput = document.getElementById('localDir');
  const resetDefaultDirBtn = document.getElementById('resetDefaultDirBtn');
  
  if (useLocalFolderSwitch) {
    useLocalFolderSwitch.addEventListener('change', function() {
      // Mostrar/ocultar seção de configuração da pasta local
      if (localFolderSection) {
        localFolderSection.classList.toggle('d-none', !this.checked);
      }
    });
  }
  
  if (resetDefaultDirBtn && localDirInput) {
    resetDefaultDirBtn.addEventListener('click', function() {
      localDirInput.value = '/home/project/files';
    });
  }
}

// Função para configurar o botão de alternância entre SSH e pasta local
function setupStorageToggle() {
  const toggleStorageBtn = document.getElementById('toggleStorageBtn');
  
  if (toggleStorageBtn) {
    toggleStorageBtn.addEventListener('click', async function() {
      toggleStorageBtn.disabled = true;
      
      try {
        const response = await fetch('/api/toggle-local-folder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            useLocal: !toggleStorageBtn.querySelector('.bi-folder')
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showToast(data.message, 'success');
          
          // Recarregar a página após 1 segundo
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showToast(`Erro ao alternar modo de armazenamento: ${data.error}`, 'danger');
          toggleStorageBtn.disabled = false;
        }
      } catch (error) {
        console.error('Erro ao alternar modo de armazenamento:', error);
        showToast('Erro ao comunicar com o servidor', 'danger');
        toggleStorageBtn.disabled = false;
      }
    });
  }
}

// Função para configurar o botão de alternância de modo da aplicação
function setupAppModeToggle() {
  const toggleButtons = [
    document.getElementById('toggleAppMode'),
    document.getElementById('footerToggleAppMode'),
    document.getElementById('toggleAppModeBtn')
  ];

  toggleButtons.forEach(button => {
    if (button) {
      button.addEventListener('click', async function(e) {
        e.preventDefault();
        
        // Desabilitar o botão durante o processamento
        toggleButtons.forEach(btn => {
          if (btn) btn.classList.add('disabled');
        });
        
        try {
          const response = await fetch('/api/toggle-mode', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          const data = await response.json();
          
          if (data.success) {
            showToast(`Modo alterado para: ${data.mode.toUpperCase()}`, 'success');
            
            // Recarregar a página após 1 segundo
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            showToast(`Erro ao alternar modo: ${data.error}`, 'danger');
          }
        } catch (error) {
          console.error('Erro ao alternar modo da aplicação:', error);
          showToast('Erro ao comunicar com o servidor', 'danger');
        } finally {
          // Re-habilitar o botão
          toggleButtons.forEach(btn => {
            if (btn) btn.classList.remove('disabled');
          });
        }
      });
    }
  });
}

// Função para configurar os botões de estrutura de arquivos SSH
function setupSshFileButtons() {
  // Estes botões são agora configurados por tab no chat-tabs.js
  // Não precisamos mais configurá-los aqui
}

function setupFileUpload() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file');
  const uploadForm = document.getElementById('uploadForm');
  const folderInput = document.createElement('input');
  
  // Create folder input element
  folderInput.type = 'file';
  folderInput.id = 'folder';
  folderInput.name = 'folder';
  folderInput.webkitdirectory = true;
  folderInput.directory = true;
  folderInput.multiple = true;
  folderInput.style.display = 'none';
  
  if (uploadForm) {
    uploadForm.appendChild(folderInput);
  }
  
  if (!dropzone || !fileInput || !uploadForm) {
    console.warn('Elementos de upload não encontrados');
    return;
  }
  
  // Add upload progress indicator
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress mt-2 d-none';
  progressContainer.style.height = '10px';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
  progressBar.role = 'progressbar';
  progressBar.style.width = '0%';
  
  progressContainer.appendChild(progressBar);
  uploadForm.appendChild(progressContainer);
  
  // Add status message element
  const statusMessage = document.createElement('div');
  statusMessage.className = 'upload-status text-center mt-2 small d-none';
  uploadForm.appendChild(statusMessage);

  // Configurar o evento submit do formulário
  uploadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Formulário de upload enviado');
    
    // Verifique se arquivos ou pastas foram selecionados
    if (fileInput.files.length === 0 && folderInput.files.length === 0) {
      showToast('Por favor, selecione um arquivo ou pasta para upload.', 'warning');
      return false;
    }
    
    // Determine se estamos fazendo upload de arquivos ou pastas
    const isFolder = folderInput.files.length > 0;
    const files = isFolder ? folderInput.files : fileInput.files;
    
    // Mostrar indicador de progresso e desabilitar o botão
    const submitBtn = this.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Enviando...';
    }
    
    // Mostrar barra de progresso
    progressContainer.classList.remove('d-none');
    statusMessage.classList.remove('d-none');
    statusMessage.textContent = 'Preparando upload...';
    
    // Para pastas, processar upload manual
    if (isFolder) {
      handleFolderUpload(files)
        .then(() => {
          showToast('Upload da pasta concluído com sucesso!', 'success');
          resetUploadForm();
          
          // Recarregar a página após 1 segundo
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        })
        .catch(error => {
          console.error('Erro no upload da pasta:', error);
          showToast(`Erro no upload da pasta: ${error.message}`, 'danger');
          resetUploadForm();
        });
    } else {
      // Para arquivos individuais, processar upload normal via FormData
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('isFolder', 'false');
      
      uploadWithProgress(formData)
        .then(() => {
          showToast('Upload do arquivo concluído com sucesso!', 'success');
          resetUploadForm();
          
          // Recarregar a página após 1 segundo
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        })
        .catch(error => {
          console.error('Erro no upload do arquivo:', error);
          showToast(`Erro no upload do arquivo: ${error.message}`, 'danger');
          resetUploadForm();
        });
    }
    
    return false;
  });
  
  /**
   * Upload files with progress tracking
   * @param {FormData} formData - Form data to upload
   * @returns {Promise} - Promise that resolves when upload is complete
   */
  async function uploadWithProgress(formData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Setup progress event
      xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = percentComplete + '%';
          statusMessage.textContent = `Enviando... ${percentComplete}%`;
        }
      });
      
      // Setup load event
      xhr.addEventListener('load', function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          progressBar.style.width = '100%';
          statusMessage.textContent = 'Upload concluído!';
          resolve();
        } else {
          let errorMsg;
          try {
            const response = JSON.parse(xhr.responseText);
            errorMsg = response.error || 'Erro no servidor';
          } catch (e) {
            errorMsg = `Erro HTTP ${xhr.status}`;
          }
          reject(new Error(errorMsg));
        }
      });
      
      // Setup error and abort events
      xhr.addEventListener('error', () => reject(new Error('Erro de rede durante o upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelado')));
      
      // Send the request
      xhr.open('POST', '/upload');
      xhr.send(formData);
    });
  }
  
  /**
   * Handle folder upload with structure preservation
   * @param {FileList} files - Files from the folder input
   * @returns {Promise} - Promise that resolves when all uploads are complete
   */
  async function handleFolderUpload(files) {
    // Get current path from breadcrumb
    let currentPath = '/';
    const breadcrumbItems = document.querySelectorAll('.breadcrumb-item.active');
    if (breadcrumbItems.length > 0) {
      const breadcrumbPath = [];
      
      // Build path from breadcrumb
      document.querySelectorAll('.breadcrumb-item').forEach((item, index) => {
        if (index === 0) return; // Skip "Root" item
        
        const linkEl = item.querySelector('.folder-breadcrumb-link');
        const segmentName = linkEl ? linkEl.textContent : item.textContent;
        breadcrumbPath.push(segmentName);
      });
      
      currentPath = breadcrumbPath.length > 0 ? `/${breadcrumbPath.join('/')}` : '/';
    }
    
    // Group files by directory
    const filesByDir = {};
    const totalFiles = files.length;
    let processedFiles = 0;
    
    // Extract the root folder name
    const rootFolder = files[0].webkitRelativePath.split('/')[0];
    
    // Create the root folder first
    statusMessage.textContent = `Criando estrutura de pastas...`;
    
    try {
      // Send request to create the root folder
      await fetch('/api/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          folderName: rootFolder,
          parentPath: currentPath
        })
      });
      
      // Update currentPath to include the root folder
      currentPath = currentPath === '/' ? `/${rootFolder}` : `${currentPath}/${rootFolder}`;
      
      // Process each file path and group by directory
      Array.from(files).forEach(file => {
        const relativePath = file.webkitRelativePath;
        const pathParts = relativePath.split('/');
        
        // Skip the first part (root folder name) as we've already created it
        if (pathParts.length > 1) {
          // Extract directory path (excluding the file name and root folder)
          const dirParts = pathParts.slice(1, -1);
          const dirPath = dirParts.length > 0 ? dirParts.join('/') : '';
          
          if (!filesByDir[dirPath]) {
            filesByDir[dirPath] = [];
          }
          
          filesByDir[dirPath].push(file);
        }
      });
      
      // Create all required directories
      const directories = Object.keys(filesByDir).sort();
      
      // Process directories in order (parents before children)
      for (const dir of directories) {
        if (dir === '') continue; // Skip empty directory (root)
        
        // Split directory path into components
        const dirParts = dir.split('/');
        let currentDir = '';
        
        // Create each directory level if needed
        for (let i = 0; i < dirParts.length; i++) {
          const parentDir = currentDir;
          currentDir = currentDir ? `${currentDir}/${dirParts[i]}` : dirParts[i];
          
          // Create directory
          try {
            statusMessage.textContent = `Criando pasta: ${currentDir}`;
            
            await fetch('/api/create-folder', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                folderName: dirParts[i],
                parentPath: parentDir ? `${currentPath}/${parentDir}` : currentPath
              })
            });
          } catch (error) {
            console.warn(`Pasta ${currentDir} possivelmente já existe:`, error);
            // Continue anyway as the folder might already exist
          }
        }
      }
      
      // Upload files in each directory
      for (const dir of directories) {
        const dirFiles = filesByDir[dir];
        const targetPath = dir ? `${currentPath}/${dir}` : currentPath;
        
        // Process files in this directory
        for (let i = 0; i < dirFiles.length; i++) {
          const file = dirFiles[i];
          processedFiles++;
          
          // Update progress
          const progressPercent = Math.round((processedFiles / totalFiles) * 100);
          progressBar.style.width = `${progressPercent}%`;
          statusMessage.textContent = `Enviando ${processedFiles}/${totalFiles}: ${file.name}`;
          
          // Create form data for this file
          const formData = new FormData();
          formData.append('file', file);
          formData.append('targetPath', targetPath);
          
          // Upload the file
          await uploadWithProgress(formData);
        }
      }
      
      // Upload files in the root folder
      const rootFiles = filesByDir[''] || [];
      for (let i = 0; i < rootFiles.length; i++) {
        const file = rootFiles[i];
        processedFiles++;
        
        // Update progress
        const progressPercent = Math.round((processedFiles / totalFiles) * 100);
        progressBar.style.width = `${progressPercent}%`;
        statusMessage.textContent = `Enviando ${processedFiles}/${totalFiles}: ${file.name}`;
        
        // Create form data for this file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('targetPath', currentPath);
        
        // Upload the file
        await uploadWithProgress(formData);
      }
      
      statusMessage.textContent = 'Upload concluído com sucesso!';
      progressBar.style.width = '100%';
      progressBar.classList.add('bg-success');
      
      return Promise.resolve();
    } catch (error) {
      console.error('Erro durante o upload da pasta:', error);
      statusMessage.textContent = `Erro: ${error.message}`;
      progressBar.classList.add('bg-danger');
      return Promise.reject(error);
    }
  }
  
  /**
   * Reset the upload form after completion or error
   */
  function resetUploadForm() {
    // Reset file inputs
    fileInput.value = '';
    folderInput.value = '';
    
    // Reset form button
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-upload me-2"></i>Enviar Arquivo';
    }
    
    // Reset dropzone
    dropzone.querySelector('h6').textContent = 'Arraste o arquivo ou clique aqui';
    dropzone.querySelector('p').textContent = 'Upload para pasta local';
    dropzone.querySelector('i').className = 'bi bi-cloud-arrow-up text-primary upload-icon';
    
    // Hide progress after a delay
    setTimeout(() => {
      progressContainer.classList.add('d-none');
      statusMessage.classList.add('d-none');
      progressBar.style.width = '0%';
      progressBar.classList.remove('bg-success', 'bg-danger');
    }, 3000);
  }
  
  // Toggle between file and folder upload modes
  const uploadTypeToggle = document.createElement('div');
  uploadTypeToggle.className = 'btn-group btn-group-sm w-100 mb-2';
  
  const fileButton = document.createElement('button');
  fileButton.type = 'button';
  fileButton.className = 'btn btn-outline-primary active';
  fileButton.textContent = 'Arquivo';
  
  const folderButton = document.createElement('button');
  folderButton.type = 'button';
  folderButton.className = 'btn btn-outline-primary';
  folderButton.textContent = 'Pasta';
  
  uploadTypeToggle.appendChild(fileButton);
  uploadTypeToggle.appendChild(folderButton);
  
  // Insert toggle before the dropzone
  if (dropzone) {
    dropzone.parentNode.insertBefore(uploadTypeToggle, dropzone);
  }
  
  // Set up toggle behavior
  fileButton.addEventListener('click', function() {
    fileButton.classList.add('active');
    folderButton.classList.remove('active');
    dropzone.setAttribute('data-upload-mode', 'file');
    dropzone.querySelector('p').textContent = 'Upload de arquivo único';
  });
  
  folderButton.addEventListener('click', function() {
    folderButton.classList.add('active');
    fileButton.classList.remove('active');
    dropzone.setAttribute('data-upload-mode', 'folder');
    dropzone.querySelector('p').textContent = 'Upload de pasta completa (mantém estrutura)';
  });
  
  // Mostrar nome do arquivo selecionado e atualizar UI
  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      const fileName = this.files[0].name;
      dropzone.querySelector('h6').textContent = fileName;
      dropzone.querySelector('p').textContent = `${(this.files[0].size / 1024).toFixed(1)} KB`;
      dropzone.querySelector('i').className = 'bi bi-file-earmark-check text-primary upload-icon';
      
      // Clear folder input
      folderInput.value = '';
      
      // Activate file button
      fileButton.click();
    }
  });
  
  // Handle folder input change
  folderInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      // Get folder name from the first file's path
      const folderPath = this.files[0].webkitRelativePath;
      const folderName = folderPath.split('/')[0];
      
      dropzone.querySelector('h6').textContent = folderName;
      dropzone.querySelector('p').textContent = `${this.files.length} arquivos`;
      dropzone.querySelector('i').className = 'bi bi-folder-check text-primary upload-icon';
      
      // Clear file input
      fileInput.value = '';
      
      // Activate folder button
      folderButton.click();
    }
  });
  
  // Drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, function() {
      dropzone.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, function() {
      dropzone.classList.remove('dragover');
    }, false);
  });
  
  dropzone.addEventListener('drop', function(e) {
    const dt = e.dataTransfer;
    const items = dt.items;
    
    // Check if items are available (for folder detection)
    if (items && items.length > 0) {
      const item = items[0];
      
      // Check if the item is a directory
      if (item.webkitGetAsEntry && item.webkitGetAsEntry().isDirectory) {
        // Check if we're already in folder mode
        const isInFolderMode = folderButton.classList.contains('active');
        
        if (isInFolderMode) {
          // We're already in folder mode, just show a hint but don't change anything
          showToast('Para fazer upload de pastas, use o botão "Escolher Pasta".', 'info');
        } else {
          // This is a folder drop, switch to folder mode
          showToast('Detectado upload de pasta. Alterando para modo pasta.', 'info');
          folderButton.click();
        }
        return;
      }
    }
    
    // Handle as regular file drop
    if (dt.files.length > 0) {
      fileInput.files = dt.files;
      
      // Trigger change event
      const event = new Event('change');
      fileInput.dispatchEvent(event);
    }
  }, false);
  
  // Click event based on current mode
  dropzone.addEventListener('click', function() {
    const mode = dropzone.getAttribute('data-upload-mode') || 'file';
    if (mode === 'file') {
      fileInput.click();
    } else {
      folderInput.click();
    }
  });
  
  // Set initial mode
  dropzone.setAttribute('data-upload-mode', 'file');
}

function getCurrentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + 
         now.getMinutes().toString().padStart(2, '0');
}

// Função para inicializar configurações do modelo GPT
function initGptModelSettings() {
  // Recuperar o modelo salvo ou usar o padrão
  const currentModel = localStorage.getItem('gptModel') || 'gpt-3.5-turbo';
  
  // Atualizar os selects com o modelo atual
  const modelSelects = [
    document.getElementById('gptModel'),
    document.getElementById('modelSelect')
  ];
  
  modelSelects.forEach(select => {
    if (select) {
      select.value = currentModel;
      
      // Adicionar event listener para salvar a seleção
      select.addEventListener('change', function() {
        const newModel = this.value;
        localStorage.setItem('gptModel', newModel);
        
        // Atualizar outros selects
        modelSelects.forEach(otherSelect => {
          if (otherSelect && otherSelect !== this) {
            otherSelect.value = newModel;
          }
        });
        
        // Atualizar o modelo exibido no modal de status da API
        updateCurrentModelDisplay(newModel);
      });
    }
  });
  
  // Configurar o botão de salvar no modal de configurações
  const saveSettingsBtn = document.getElementById('saveSettings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function() {
      // Salvar configurações do modelo GPT
      const modelSelect = document.getElementById('modelSelect');
      if (modelSelect) {
        const newModel = modelSelect.value;
        localStorage.setItem('gptModel', newModel);
        
        // Atualizar o select da interface principal
        const gptModelSelect = document.getElementById('gptModel');
        if (gptModelSelect) {
          gptModelSelect.value = newModel;
        }
        
        // Atualizar o modelo exibido no modal de status da API
        updateCurrentModelDisplay(newModel);
      }
      
      // Salvar configurações de armazenamento
      const useLocalFolderSwitch = document.getElementById('useLocalFolderSwitch');
      const localDirInput = document.getElementById('localDir');
      
      // Preparar os dados para enviar
      const configData = {};
      
      // Se está usando SSH, salvar as configurações de SSH
      if (!useLocalFolderSwitch || !useLocalFolderSwitch.checked) {
        const sshHostInput = document.getElementById('sshHost');
        const sshPortInput = document.getElementById('sshPort');
        const sshDirInput = document.getElementById('sshDir');
        
        if (sshHostInput && sshPortInput && sshDirInput) {
          configData.host = sshHostInput.value.trim();
          configData.port = parseInt(sshPortInput.value, 10);
          configData.remoteDir = sshDirInput.value.trim();
        }
      }
      
      // Se está usando pasta local, salvar o diretório local
      if (useLocalFolderSwitch && useLocalFolderSwitch.checked && localDirInput) {
        configData.localDir = localDirInput.value.trim();
      }
      
      // Guardar a preferência de modo de armazenamento
      if (useLocalFolderSwitch) {
        configData.forceLocalFolder = useLocalFolderSwitch.checked;
        configData.forceSshMode = !useLocalFolderSwitch.checked;
      }
      
      // Enviar configurações para o servidor
      fetch('/api/ssh-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            console.log('Configurações atualizadas com sucesso');
            
            // Fechar o modal
            const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
            if (settingsModal) {
              settingsModal.hide();
            }
            
            // Mostrar toast de confirmação
            showToast('Configurações salvas com sucesso!', 'success');
            
            // Recarregar a página para aplicar as novas configurações
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            console.error('Erro ao atualizar configurações:', data.error);
            showToast(`Erro ao atualizar configurações: ${data.error}`, 'danger');
          }
        })
        .catch(error => {
          console.error('Erro na comunicação com o servidor:', error);
          showToast('Erro na comunicação com o servidor.', 'danger');
        });
    });
  }
  
  // Atualizar a exibição do modelo atual
  updateCurrentModelDisplay(currentModel);
}

// Inicializar configurações SSH
function initSshSettings() {
  // Campos do formulário
  const sshHostInput = document.getElementById('sshHost');
  const sshPortInput = document.getElementById('sshPort');
  const sshDirInput = document.getElementById('sshDir');
  const useLocalFolderSwitch = document.getElementById('useLocalFolderSwitch');
  const localDirInput = document.getElementById('localDir');
  
  // Obter as configurações atuais do servidor
  fetch('/api/ssh-config')
    .then(response => response.json())
    .then(data => {
      // Carregar configurações de SSH
      if (sshHostInput && sshPortInput && sshDirInput) {
        sshHostInput.value = data.host || '104.238.145.89';
        sshPortInput.value = data.port || 22;
        sshDirInput.value = data.remoteDir || '/home/tracklead-files-chat/htdocs/files-chat.tracklead.com/files/';
      }
      
      // Carregar configurações de pasta local
      if (useLocalFolderSwitch) {
        useLocalFolderSwitch.checked = data.useLocalFolder || false;
        
        // Mostrar/ocultar seção de pasta local
        const localFolderSection = document.getElementById('localFolderSection');
        if (localFolderSection) {
          localFolderSection.classList.toggle('d-none', !data.useLocalFolder);
        }
      }
      
      if (localDirInput) {
        localDirInput.value = data.localDir || '/home/project/files';
      }
      
      // Exibir o modo atual da aplicação
      const appModeIndicator = document.getElementById('app-mode-indicator');
      if (appModeIndicator && data.appMode) {
        appModeIndicator.className = `alert ${data.appMode === 'development' ? 'alert-warning' : 'alert-success'} d-flex align-items-center`;
        appModeIndicator.innerHTML = `
          <i class="bi ${data.appMode === 'development' ? 'bi-tools' : 'bi-rocket'} me-3 fs-5"></i>
          <div>
            <strong>Modo ${data.appMode === 'development' ? 'Desenvolvimento' : 'Produção'}</strong>
            <p class="mb-0 small">${data.appMode === 'development' ? 'Usando pasta local para armazenamento' : 'Usando servidor SSH para armazenamento'}</p>
          </div>
        `;
      }
    })
    .catch(error => {
      console.error('Erro ao obter configurações SSH:', error);
    });
}

// Função para mostrar toast de notificação
function showToast(message, type = 'info') {
  // Verificar se já existe um container de toasts
  let toastContainer = document.querySelector('.toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(toastContainer);
  }
  
  const toastId = 'toast-' + Date.now();
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
  toastEl.id = toastId;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  `;
  
  toastContainer.appendChild(toastEl);
  
  const toast = new bootstrap.Toast(toastEl, {
    autohide: true,
    delay: 3000
  });
  
  toast.show();
  
  // Remover o toast após ser escondido
  toastEl.addEventListener('hidden.bs.toast', function() {
    toastEl.remove();
  });
}

// Função para obter o modelo atual
function getCurrentGptModel() {
  return localStorage.getItem('gptModel') || 'gpt-3.5-turbo';
}

// Função para atualizar a exibição do modelo atual em todos os lugares da interface
function updateCurrentModelDisplay(model) {
  // Atualizar o texto do modelo no modal de status da API
  const currentModelDisplay = document.getElementById('currentModel');
  if (currentModelDisplay) {
    currentModelDisplay.textContent = model;
  }
  
  // Atualizar o badge do modelo na interface principal
  const modelBadge = document.querySelector('.badge.bg-dark:not(#api-status-badge)');
  if (modelBadge) {
    modelBadge.textContent = model;
  }
}

// Função para verificar o status da conexão SSH
function checkSshStatus() {
  console.log('Verificando status da conexão SSH...');
  
  const sshStatusBadge = document.getElementById('ssh-status-badge');
  if (!sshStatusBadge) return;
  
  // Inicialmente, mostrar como "Verificando..."
  sshStatusBadge.textContent = 'Verificando...';
  sshStatusBadge.classList.remove('bg-success', 'bg-danger', 'bg-warning');
  sshStatusBadge.classList.add('bg-secondary');
  
  fetch('/api/ssh-status')
    .then(response => response.json())
    .then(data => {
      console.log('Status SSH:', data);
      
      // Verificar se está usando pasta local
      if (data.localFolder) {
        sshStatusBadge.textContent = 'Local';
        sshStatusBadge.classList.remove('bg-secondary', 'bg-danger', 'bg-success');
        sshStatusBadge.classList.add('bg-warning');
      } else if (data.connected) {
        sshStatusBadge.textContent = 'Online';
        sshStatusBadge.classList.remove('bg-secondary', 'bg-danger', 'bg-warning');
        sshStatusBadge.classList.add('bg-success');
      } else {
        sshStatusBadge.textContent = 'Offline';
        sshStatusBadge.classList.remove('bg-secondary', 'bg-success', 'bg-warning');
        sshStatusBadge.classList.add('bg-danger');
        
        // Mostrar notificação sobre problema de conexão SSH (somente se não estiver usando pasta local)
        if (!data.localFolder) {
          showToast('Não foi possível conectar ao servidor SSH. Os arquivos remotos não estarão disponíveis.', 'warning');
        }
      }
    })
    .catch(error => {
      console.error('Erro ao verificar status SSH:', error);
      sshStatusBadge.textContent = 'Erro';
      sshStatusBadge.classList.remove('bg-secondary', 'bg-success', 'bg-warning');
      sshStatusBadge.classList.add('bg-danger');
    });
}

// Função para testar API na página principal
async function testApiConnection() {
  const testButton = document.getElementById('testApiBtn');
  const statusDiv = document.getElementById('apiStatus');
  const apiStatusBadge = document.getElementById('api-status-badge');
  
  if (!testButton || !statusDiv) {
    console.warn('Elementos de teste da API não encontrados');
    return;
  }
  
  testButton.disabled = true;
  testButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Testando...';
  
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<div class="d-flex align-items-center gap-2"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Testando conexão com a API...</div>';
  statusDiv.className = 'alert alert-info mt-3';
  
  try {
    const model = getCurrentGptModel();
    const response = await fetch(`/api/test-openai?model=${model}`);
    const data = await response.json();
    
    if (data.success) {
      statusDiv.className = 'alert alert-success mt-3';
      statusDiv.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i><strong>Sucesso!</strong> ${data.message}`;
      
      if (apiStatusBadge) {
        apiStatusBadge.textContent = 'Online';
        apiStatusBadge.classList.remove('bg-secondary', 'bg-danger', 'bg-warning');
        apiStatusBadge.classList.add('bg-success');
      }
    } else {
      statusDiv.className = 'alert alert-warning mt-3';
      statusDiv.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i><strong>Falha:</strong> ${data.error}`;
      
      if (apiStatusBadge) {
        apiStatusBadge.textContent = 'Problema';
        apiStatusBadge.classList.remove('bg-secondary', 'bg-success', 'bg-danger');
        apiStatusBadge.classList.add('bg-warning');
      }
      
      // Se o modelo não estiver disponível, mostrar os modelos disponíveis
      if (data.availableModels && data.availableModels.length) {
        const modelList = data.availableModels.join(', ');
        statusDiv.innerHTML += `<div class="mt-2 small">Modelos disponíveis: <strong>${modelList}</strong></div>`;
      }
    }
  } catch (error) {
    console.error('Erro ao testar API:', error);
    statusDiv.className = 'alert alert-danger mt-3';
    statusDiv.innerHTML = `<i class="bi bi-x-circle-fill me-2"></i><strong>Erro:</strong> Falha na comunicação com o servidor: ${error.message}`;
    
    if (apiStatusBadge) {
      apiStatusBadge.textContent = 'Offline';
      apiStatusBadge.classList.remove('bg-secondary', 'bg-success', 'bg-warning');
      apiStatusBadge.classList.add('bg-danger');
    }
  } finally {
    testButton.disabled = false;
    testButton.innerHTML = '<i class="bi bi-arrow-repeat me-2"></i>Testar Conexão';
  }
  
  // Também verificar status SSH
  checkSshStatus();
}

// Função para testar API no modal
async function testApiConnectionModal() {
  const statusContent = document.getElementById('apiStatusContent');
  const retestButton = document.getElementById('retestApiButton');
  const apiStatusBadge = document.getElementById('api-status-badge');
  const sshStatusIndicator = document.getElementById('ssh-status-indicator');
  
  if (!statusContent || !retestButton) {
    console.warn('Elementos do modal de teste não encontrados');
    return;
  }
  
  retestButton.disabled = true;
  retestButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Testando...';
  
  statusContent.className = 'alert alert-info d-flex align-items-center';
  statusContent.innerHTML = '<div class="spinner-border spinner-border-sm me-3" role="status"></div><div>Testando conexão com a API OpenAI...</div>';
  
  // Também atualiza o status do SSH
  if (sshStatusIndicator) {
    sshStatusIndicator.className = 'alert alert-info d-flex align-items-center mt-3';
    sshStatusIndicator.innerHTML = '<div class="spinner-border spinner-border-sm me-3" role="status"></div><div>Verificando conexão SSH...</div>';
  }
  
  // Teste da API OpenAI
  try {
    const model = getCurrentGptModel();
    const response = await fetch(`/api/test-openai?model=${model}`);
    const data = await response.json();
    
    if (data.success) {
      statusContent.className = 'alert alert-success d-flex align-items-center';
      statusContent.innerHTML = `<i class="bi bi-check-circle-fill me-2 fs-5"></i><div><strong>Conectado!</strong> ${data.message}</div>`;
      
      if (apiStatusBadge) {
        apiStatusBadge.textContent = 'Online';
        apiStatusBadge.classList.remove('bg-secondary', 'bg-danger', 'bg-warning');
        apiStatusBadge.classList.add('bg-success');
      }
    } else {
      statusContent.className = 'alert alert-warning d-flex align-items-center';
      statusContent.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i><div><strong>Alerta!</strong> ${data.error}</div>`;
      
      if (apiStatusBadge) {
        apiStatusBadge.textContent = 'Problema';
        apiStatusBadge.classList.remove('bg-secondary', 'bg-success', 'bg-danger');
        apiStatusBadge.classList.add('bg-warning');
      }
      
      // Se o modelo não estiver disponível, mostrar os modelos disponíveis
      if (data.availableModels && data.availableModels.length) {
        statusContent.innerHTML += `<div class="mt-2 small">Modelos disponíveis: <strong>${data.availableModels.join(', ')}</strong></div>`;
      }
    }
  } catch (error) {
    console.error('Erro ao testar API:', error);
    statusContent.className = 'alert alert-danger d-flex align-items-center';
    statusContent.innerHTML = `<i class="bi bi-x-circle-fill me-2 fs-5"></i><div><strong>Erro!</strong> Falha na comunicação com o servidor: ${error.message}</div>`;
    
    if (apiStatusBadge) {
      apiStatusBadge.textContent = 'Offline';
      apiStatusBadge.classList.remove('bg-secondary', 'bg-success', 'bg-warning');
      apiStatusBadge.classList.add('bg-danger');
    }
  } finally {
    retestButton.disabled = false;
    retestButton.innerHTML = '<i class="bi bi-arrow-repeat me-2"></i>Testar Novamente';
  }
  
  // Teste da conexão SSH
  if (sshStatusIndicator) {
    try {
      const sshResponse = await fetch('/api/ssh-status');
      const sshData = await sshResponse.json();
      
      // Verificar se está usando pasta local
      if (sshData.localFolder) {
        sshStatusIndicator.className = 'alert alert-warning d-flex align-items-center mt-3';
        sshStatusIndicator.innerHTML = `<i class="bi bi-folder me-2 fs-5"></i><div><strong>Pasta Local</strong> <p class="mb-0 small">${sshData.message}</p></div>`;
      } else if (sshData.connected) {
        sshStatusIndicator.className = 'alert alert-success d-flex align-items-center mt-3';
        sshStatusIndicator.innerHTML = `<i class="bi bi-check-circle-fill me-2 fs-5"></i><div><strong>SSH Online!</strong> Conexão com o servidor remoto estabelecida.</div>`;
      } else {
        sshStatusIndicator.className = 'alert alert-warning d-flex align-items-center mt-3';
        sshStatusIndicator.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i><div><strong>SSH Offline!</strong> ${sshData.message || 'Não foi possível conectar ao servidor SSH.'}</div>`;
      }
    } catch (error) {
      console.error('Erro ao testar SSH:', error);
      sshStatusIndicator.className = 'alert alert-danger d-flex align-items-center mt-3';
      sshStatusIndicator.innerHTML = `<i class="bi bi-x-circle-fill me-2 fs-5"></i><div><strong>Erro SSH!</strong> Falha ao verificar conexão SSH: ${error.message}</div>`;
    }
  }
}