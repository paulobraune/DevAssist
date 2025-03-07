document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, inicializando aplicação...');
  
  // Inicializa tooltips do Bootstrap
  const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  
  // Inicializa o chat
  initChat();
  
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
});

function setupFileUpload() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file');
  
  if (!dropzone || !fileInput) return;
  
  // Mostrar nome do arquivo selecionado
  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      const fileName = this.files[0].name;
      dropzone.querySelector('h6').textContent = fileName;
      dropzone.querySelector('p').textContent = `${(this.files[0].size / 1024).toFixed(1)} KB`;
      dropzone.querySelector('i').className = 'bi bi-file-earmark-check text-primary upload-icon';
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
    const files = dt.files;
    fileInput.files = files;
    
    // Trigger change event
    const event = new Event('change');
    fileInput.dispatchEvent(event);
  }, false);
  
  // Click event
  dropzone.addEventListener('click', function() {
    fileInput.click();
  });
}

function initChat() {
  console.log('Inicializando componentes do chat...');
  
  // Configurar container de chat
  const responseDiv = document.getElementById('chatResponses');
  if (!responseDiv) {
    console.error('Elemento chatResponses não encontrado!');
    return;
  }
  
  // Garantir que existe um wrapper para mensagens
  if (!responseDiv.querySelector('.messages-wrapper')) {
    console.log('Criando wrapper de mensagens...');
    const wrapper = document.createElement('div');
    wrapper.className = 'messages-wrapper';
    responseDiv.appendChild(wrapper);
  }
  
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
        connectionBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Conectado';
        connectionBadge.classList.remove('bg-primary-subtle', 'text-primary');
        connectionBadge.classList.add('bg-success-subtle', 'text-success');
        
        if (apiStatusBadge) {
          apiStatusBadge.textContent = 'Online';
          apiStatusBadge.classList.remove('bg-secondary');
          apiStatusBadge.classList.add('bg-success');
        }
        
        // Verificar também o status da conexão SSH
        if (data.ssh_status === 'disconnected') {
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
        connectionBadge.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i>Desconectado';
        connectionBadge.classList.remove('bg-primary-subtle', 'text-primary');
        connectionBadge.classList.add('bg-danger-subtle', 'text-danger');
        
        if (apiStatusBadge) {
          apiStatusBadge.textContent = 'Offline';
          apiStatusBadge.classList.remove('bg-secondary');
          apiStatusBadge.classList.add('bg-danger');
        }
      });
  }
  
  // Configurar evento de envio do formulário
  const chatForm = document.getElementById('chatForm');
  if (!chatForm) {
    console.error('Formulário de chat não encontrado!');
    return;
  }
  
  console.log('Configurando evento de submit do formulário...');
  chatForm.addEventListener('submit', handleChatSubmit);
  
  // Auto-resize do textarea
  const messageInput = document.getElementById('message');
  if (messageInput) {
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });
  }
  
  console.log('Chat inicializado!');
}

function getCurrentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + 
         now.getMinutes().toString().padStart(2, '0');
}

async function handleChatSubmit(e) {
  e.preventDefault();
  console.log('Formulário de chat submetido!');
  
  const messageInput = document.getElementById('message');
  if (!messageInput) {
    console.error('Campo de mensagem não encontrado!');
    return;
  }
  
  const message = messageInput.value;
  
  if (!message || !message.trim()) {
    console.log('Mensagem vazia, ignorando...');
    return;
  }
  
  console.log('Processando mensagem:', message);
  
  const responseDiv = document.getElementById('chatResponses');
  const messagesWrapper = responseDiv.querySelector('.messages-wrapper');
  if (!messagesWrapper) {
    console.error('Container de mensagens não encontrado!');
    return;
  }

  // Adiciona a mensagem do usuário
  const userMsgElement = document.createElement('div');
  userMsgElement.className = 'message user-message';
  userMsgElement.innerHTML = `
    <div class="message-content">
      <div class="message-text">
        ${message}
      </div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
    <div class="message-avatar">
      <i class="bi bi-person"></i>
    </div>
  `;
  messagesWrapper.appendChild(userMsgElement);
  
  // Rola para a mensagem mais recente
  responseDiv.scrollTop = responseDiv.scrollHeight;
  
  // Limpa o campo de mensagem
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Desabilita o botão durante o processamento
  const submitButton = document.querySelector('#chatForm button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Enviando...';
  }

  // Adiciona indicador de "pensando"
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'message';
  loadingMsg.id = 'thinking-indicator';
  loadingMsg.innerHTML = `
    <div class="message-avatar">
      <i class="bi bi-robot"></i>
    </div>
    <div class="message-content">
      <div class="message-text">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    </div>
  `;
  messagesWrapper.appendChild(loadingMsg);
  responseDiv.scrollTop = responseDiv.scrollHeight;

  try {
    console.log('Enviando requisição para o servidor...');
    
    // Obter o modelo atual selecionado
    const model = getCurrentGptModel();
    
    const response = await fetch('/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, model })
    });
    
    console.log('Resposta recebida, status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Tipo de conteúdo inválido: ${contentType}`);
    }
    
    const data = await response.json();
    console.log('Dados da resposta:', data);

    // Remove o indicador de "pensando"
    const thinkingIndicator = document.getElementById('thinking-indicator');
    if (thinkingIndicator && thinkingIndicator.parentNode) {
      thinkingIndicator.parentNode.removeChild(thinkingIndicator);
    } else {
      console.warn('Indicador de "pensando" não encontrado para remoção');
    }

    // Exibe a resposta do GPT
    if (data.choices && data.choices.length) {
      const gptMsg = data.choices[0].message.content;
      const gptMsgElement = document.createElement('div');
      gptMsgElement.className = 'message';
      gptMsgElement.innerHTML = `
        <div class="message-avatar">
          <i class="bi bi-robot"></i>
        </div>
        <div class="message-content">
          <div class="message-text">
            ${formatMessage(gptMsg)}
          </div>
          <div class="message-time">${getCurrentTime()}</div>
        </div>
      `;
      messagesWrapper.appendChild(gptMsgElement);
      responseDiv.scrollTop = responseDiv.scrollHeight;
    } else if (data.error) {
      // Mostra mensagem de erro da API
      const errorMsg = document.createElement('div');
      errorMsg.className = 'message';
      errorMsg.innerHTML = `
        <div class="message-avatar">
          <i class="bi bi-exclamation-triangle"></i>
        </div>
        <div class="message-content bg-danger bg-opacity-10">
          <div class="message-text text-danger">
            <strong>Erro:</strong> ${data.error}. ${data.message || ''}
          </div>
          <div class="message-time">${getCurrentTime()}</div>
        </div>
      `;
      messagesWrapper.appendChild(errorMsg);
      responseDiv.scrollTop = responseDiv.scrollHeight;
    } else {
      throw new Error('Formato de resposta desconhecido');
    }
  } catch (error) {
    console.error('Erro na comunicação com o servidor:', error);
    
    // Remove o indicador de "pensando" se ainda existir
    const thinkingIndicator = document.getElementById('thinking-indicator');
    if (thinkingIndicator && thinkingIndicator.parentNode) {
      thinkingIndicator.parentNode.removeChild(thinkingIndicator);
    }
    
    // Exibe mensagem de erro detalhada
    const errorMsg = document.createElement('div');
    errorMsg.className = 'message';
    errorMsg.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-exclamation-triangle"></i>
      </div>
      <div class="message-content bg-danger bg-opacity-10">
        <div class="message-text text-danger">
          <strong>Erro:</strong> Não foi possível se comunicar com o servidor.
          <p class="small mt-1 mb-0"><em>${error.message}</em></p>
        </div>
        <div class="message-time">${getCurrentTime()}</div>
      </div>
    `;
    messagesWrapper.appendChild(errorMsg);
    responseDiv.scrollTop = responseDiv.scrollHeight;
  } finally {
    // Reativa o botão de envio
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="bi bi-send me-2"></i>Enviar';
    }
  }
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
      
      // Salvar configurações SSH
      saveSshSettings();
      
      // Fechar o modal
      const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
      if (settingsModal) {
        settingsModal.hide();
      }
      
      // Mostrar toast de confirmação ou mensagem de sucesso
      showToast('Configurações salvas com sucesso!', 'success');
      
      // Recarregar a página para aplicar as novas configurações SSH
      setTimeout(() => {
        window.location.reload();
      }, 1500);
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
  
  if (!sshHostInput || !sshPortInput || !sshDirInput) {
    console.warn('Campos de configuração SSH não encontrados');
    return;
  }
  
  // Carregar configurações salvas ou usar valores padrão
  const sshConfig = JSON.parse(localStorage.getItem('sshConfig') || '{}');
  
  // Obter as configurações atuais do servidor
  fetch('/api/ssh-config')
    .then(response => response.json())
    .then(data => {
      // Preencher os campos com os valores do servidor ou localstorage
      sshHostInput.value = sshConfig.host || data.host || '104.238.145.89';
      sshPortInput.value = sshConfig.port || data.port || 22;
      sshDirInput.value = sshConfig.remoteDir || data.remoteDir || '/home/tracklead-chat/htdocs/files-chat.tracklead.com/files/';
    })
    .catch(error => {
      console.error('Erro ao obter configurações SSH:', error);
      
      // Em caso de erro, usar valores do localStorage ou padrões
      sshHostInput.value = sshConfig.host || '104.238.145.89';
      sshPortInput.value = sshConfig.port || 22;
      sshDirInput.value = sshConfig.remoteDir || '/home/tracklead-chat/htdocs/files-chat.tracklead.com/files/';
    });
}

// Salvar configurações SSH
function saveSshSettings() {
  const sshHostInput = document.getElementById('sshHost');
  const sshPortInput = document.getElementById('sshPort');
  const sshDirInput = document.getElementById('sshDir');
  
  if (!sshHostInput || !sshPortInput || !sshDirInput) {
    console.warn('Campos de configuração SSH não encontrados');
    return;
  }
  
  // Validar valores
  const host = sshHostInput.value.trim();
  const port = parseInt(sshPortInput.value, 10);
  const remoteDir = sshDirInput.value.trim();
  
  if (!host || isNaN(port) || !remoteDir) {
    showToast('Preencha todos os campos de configuração SSH corretamente', 'warning');
    return false;
  }
  
  // Adicionar a barra final ao diretório, se não existir
  const formattedDir = remoteDir.endsWith('/') ? remoteDir : `${remoteDir}/`;
  
  // Guardar no localStorage
  const sshConfig = { host, port, remoteDir: formattedDir };
  localStorage.setItem('sshConfig', JSON.stringify(sshConfig));
  
  // Enviar para o servidor
  fetch('/api/ssh-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sshConfig)
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('Configurações SSH atualizadas com sucesso');
      } else {
        console.error('Erro ao atualizar configurações SSH:', data.error);
        showToast(`Erro ao atualizar configurações: ${data.error}`, 'danger');
      }
    })
    .catch(error => {
      console.error('Erro na comunicação com o servidor:', error);
      showToast('Erro na comunicação com o servidor. As configurações foram salvas localmente.', 'warning');
    });
  
  return true;
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
  sshStatusBadge.classList.remove('bg-success', 'bg-danger');
  sshStatusBadge.classList.add('bg-secondary');
  
  fetch('/api/ssh-status')
    .then(response => response.json())
    .then(data => {
      console.log('Status SSH:', data);
      
      if (data.connected) {
        sshStatusBadge.textContent = 'Conectado';
        sshStatusBadge.classList.remove('bg-secondary', 'bg-danger');
        sshStatusBadge.classList.add('bg-success');
      } else {
        sshStatusBadge.textContent = 'Desconectado';
        sshStatusBadge.classList.remove('bg-secondary', 'bg-success');
        sshStatusBadge.classList.add('bg-danger');
        
        // Mostrar notificação sobre problema de conexão SSH
        showToast('Não foi possível conectar ao servidor SSH. Os arquivos remotos não estarão disponíveis.', 'warning');
      }
    })
    .catch(error => {
      console.error('Erro ao verificar status SSH:', error);
      sshStatusBadge.textContent = 'Erro';
      sshStatusBadge.classList.remove('bg-secondary', 'bg-success');
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
      
      if (sshData.connected) {
        sshStatusIndicator.className = 'alert alert-success d-flex align-items-center mt-3';
        sshStatusIndicator.innerHTML = `<i class="bi bi-check-circle-fill me-2 fs-5"></i><div><strong>SSH Conectado!</strong> Conexão com o servidor remoto estabelecida.</div>`;
      } else {
        sshStatusIndicator.className = 'alert alert-warning d-flex align-items-center mt-3';
        sshStatusIndicator.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i><div><strong>SSH Desconectado!</strong> ${sshData.message || 'Não foi possível conectar ao servidor SSH.'}</div>`;
      }
    } catch (error) {
      console.error('Erro ao testar SSH:', error);
      sshStatusIndicator.className = 'alert alert-danger d-flex align-items-center mt-3';
      sshStatusIndicator.innerHTML = `<i class="bi bi-x-circle-fill me-2 fs-5"></i><div><strong>Erro SSH!</strong> Falha ao verificar conexão SSH: ${error.message}</div>`;
    }
  }
}

// Função para formatar mensagens com markdown básico e código
function formatMessage(text) {
  if (!text) return '';
  
  // Formata blocos de código (com ```código```)
  text = text.replace(/```([\s\S]*?)```/g, '<pre class="bg-darkest border border-secondary p-3 my-3 rounded-custom-sm">$1</pre>');
  
  // Formata código inline (com `código`)
  text = text.replace(/`([^`]+)`/g, '<code class="bg-darkest px-2 py-1 rounded-custom-sm">$1</code>');
  
  // Preserva quebras de linha
  text = text.replace(/\n/g, '<br>');
  
  return text;
}