/**
 * Chat Tabs Manager
 * Handles creating, managing, and persisting chat tabs
 */

// Global variables
window.chatTabs = [];
window.currentTabId = null;

// Initialize chat tabs when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a page that uses chat functionality
  const pageType = document.getElementById('page-type');
  if (pageType && (pageType.getAttribute('data-page') === 'file' || pageType.getAttribute('data-page') === 'analysis')) {
    console.log('Not on a chat page, skipping chat tabs initialization');
    return;
  }

  // Check if chat tabs container exists
  const tabsContainer = document.getElementById('chatTabs');
  if (!tabsContainer) {
    console.log('Chat tabs container not found, skipping initialization');
    return; // Skip initialization if container not found
  }
  
  console.log('Initializing chat tabs...');
  
  // Load tabs from localStorage or create default
  loadTabsFromLocalStorage();
  
  // Render tabs
  renderChatTabs();
  
  // Set up event listeners
  setupTabEventListeners();
  
  // If no tabs exist, create a default one
  if (chatTabs.length === 0) {
    console.log('No saved tabs found, creating default tab');
    createNewTab('Chat 1');
  }
});

/**
 * Load tabs from localStorage
 */
function loadTabsFromLocalStorage() {
  try {
    const savedTabs = localStorage.getItem('chatTabs');
    if (savedTabs) {
      chatTabs = JSON.parse(savedTabs);
      console.log('Loaded tabs from localStorage:', chatTabs.length);
      
      // Check if we have a saved current tab
      currentTabId = localStorage.getItem('currentTabId');
      
      // Validate if the current tab exists
      if (currentTabId && !chatTabs.find(tab => tab.id === currentTabId)) {
        currentTabId = chatTabs.length > 0 ? chatTabs[0].id : null;
      }
    } else {
      console.log('No saved tabs found in localStorage');
      chatTabs = [];
      currentTabId = null;
    }
  } catch (error) {
    console.error('Error loading tabs from localStorage:', error);
    chatTabs = [];
    currentTabId = null;
  }
}

/**
 * Save tabs to localStorage
 */
function saveTabsToLocalStorage() {
  try {
    localStorage.setItem('chatTabs', JSON.stringify(chatTabs));
    
    if (currentTabId) {
      localStorage.setItem('currentTabId', currentTabId);
    } else {
      localStorage.removeItem('currentTabId');
    }
    
    console.log('Saved tabs to localStorage:', chatTabs.length);
  } catch (error) {
    console.error('Error saving tabs to localStorage:', error);
  }
}

/**
 * Render chat tabs
 */
function renderChatTabs() {
  const tabsContainer = document.getElementById('chatTabs');
  if (!tabsContainer) {
    console.error('Chat tabs container not found');
    return;
  }
  
  // Store add button for later
  const addButton = tabsContainer.querySelector('.add-tab-button');
  
  // Clear all tabs except the add button
  tabsContainer.innerHTML = '';
  
  // Add back the add button if it existed
  if (addButton) {
    tabsContainer.appendChild(addButton);
  } else {
    // Create add button if it didn't exist
    const newAddButton = document.createElement('button');
    newAddButton.className = 'add-tab-button';
    newAddButton.setAttribute('title', 'Nova conversa');
    newAddButton.innerHTML = '<i class="bi bi-plus-lg"></i>';
    newAddButton.addEventListener('click', () => {
      createNewTab('Nova conversa');
    });
    tabsContainer.appendChild(newAddButton);
  }
  
  // Render each tab
  chatTabs.forEach(tab => {
    // Create tab element
    const tabEl = document.createElement('div');
    tabEl.className = `chat-tab ${tab.id === currentTabId ? 'active' : ''}`;
    tabEl.setAttribute('data-tab-id', tab.id);
    
    // Create tab content
    tabEl.innerHTML = `
      <span class="chat-tab-name" title="${tab.name}">${tab.name}</span>
      <button type="button" class="close-tab" title="Fechar" data-tab-id="${tab.id}">×</button>
    `;
    
    // Insert tab before the add button
    tabsContainer.insertBefore(tabEl, tabsContainer.lastChild);
  });
  
  // Render tab content
  renderTabContent();
}

/**
 * Render tab content
 */
function renderTabContent() {
  const chatCard = document.querySelector('.card-body');
  if (!chatCard) return;
  
  // Clear existing tab content
  chatCard.innerHTML = '';
  
  // Create tab content container
  chatTabs.forEach(tab => {
    // Create tab content
    const tabContent = document.createElement('div');
    tabContent.className = `chat-tab-content ${tab.id === currentTabId ? 'active' : ''}`;
    tabContent.setAttribute('data-tab-id', tab.id);
    
    const chatContainerWrapper = document.createElement('div');
    chatContainerWrapper.className = `chat-container-wrapper ${tab.id === currentTabId ? 'active' : ''}`;
    chatContainerWrapper.setAttribute('data-tab-id', tab.id);
    
    // Create chat container
    const chatContainer = document.createElement('div');
    chatContainer.id = `chatResponses-${tab.id}`;
    chatContainer.className = 'chat-container flex-grow-1';
    
    // Create messages wrapper
    const messagesWrapper = document.createElement('div');
    messagesWrapper.className = 'messages-wrapper';
    
    // Add messages if they exist
    if (tab.messages && tab.messages.length > 0) {
      tab.messages.forEach(msg => {
        const messageEl = createMessageElement(msg);
        messagesWrapper.appendChild(messageEl);
      });
    } else {
      // Add welcome message if no messages exist
      const welcomeMsg = {
        role: 'assistant',
        content: `<p class="mb-1">Olá! Sou o DevAssist GPT, seu assistente de desenvolvimento. Como posso ajudar você hoje?</p>
        <ul class="mb-0 ps-3">
          <li>Analisar seu código</li>
          <li>Responder dúvidas de programação</li>
          <li>Sugerir melhorias e otimizações</li>
          <li>Explicar conceitos técnicos</li>
        </ul>`,
        time: 'Agora'
      };
      const welcomeMsgEl = createMessageElement(welcomeMsg);
      messagesWrapper.appendChild(welcomeMsgEl);
    }
    
    // Add messages wrapper to chat container
    chatContainer.appendChild(messagesWrapper);
    
    // Add chat container to the chat container wrapper
    chatContainerWrapper.appendChild(chatContainer);
    
    // Create chat form
    const chatForm = document.createElement('form');
    chatForm.id = `chatForm-${tab.id}`;
    chatForm.className = 'chat-form p-3';
    chatForm.setAttribute('data-tab-id', tab.id);
    
    // Get model options from the global dropdown
    const globalModelSelect = document.getElementById('gptModel');
    let modelOptions = '';
    
    if (globalModelSelect) {
      Array.from(globalModelSelect.options).forEach(option => {
        modelOptions += `<option value="${option.value}" ${tab.model === option.value ? 'selected' : ''}>${option.text}</option>`;
      });
    } else {
      // Default options if global select not found
      modelOptions = `
        <option value="gpt-3.5-turbo" ${tab.model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
        <option value="gpt-4" ${tab.model === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
        <option value="gpt-4o" ${tab.model === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
        <option value="gpt-4o-mini" ${tab.model === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini</option>
      `;
    }
    
    chatForm.innerHTML = `
      <div class="input-group mb-2">
        <textarea id="message-${tab.id}" name="message" class="form-control chat-message" placeholder="Digite sua pergunta ou problema de programação..." rows="3" required></textarea>
      </div>
      <div class="token-counter">
        <div class="token-counter-text">
          <span class="token-count">0 tokens</span>
          <span class="token-limit">Limite: 16385 tokens</span>
        </div>
        <div class="token-counter-progress">
          <div class="token-counter-bar" style="width: 0%"></div>
        </div>
      </div>
      <div class="d-flex gap-2 mt-2">
        <button id="addDirStructureBtn-${tab.id}" type="button" class="btn btn-outline-primary flex-grow-1">
          <i class="bi bi-folder-fill me-2"></i>Estrutura
        </button>
        <button id="addAllFilesBtn-${tab.id}" type="button" class="btn btn-outline-primary flex-grow-1">
          <i class="bi bi-files me-2"></i>Arquivos
        </button>
        <button type="submit" class="btn btn-primary flex-grow-2">
          <i class="bi bi-send me-2"></i>Enviar
        </button>
      </div>
      <div class="model-selector-container mt-3">
        <label for="model-select-${tab.id}" class="form-label d-flex justify-content-between">
          <span>Modelo:</span>
          <span class="model-description text-muted small"></span>
        </label>
        <select id="model-select-${tab.id}" class="form-select model-select" data-tab-id="${tab.id}">
          ${modelOptions}
        </select>
      </div>
    `;
    
    // Add chat form to the chat container wrapper
    chatContainerWrapper.appendChild(chatForm);
    
    // Add chat container wrapper to tab content
    tabContent.appendChild(chatContainerWrapper);
    
    // Add tab content to the card body
    chatCard.appendChild(tabContent);
    
    // Set up form submit event
    chatForm.addEventListener('submit', (e) => {
      handleChatSubmit(e, tab.id);
    });
    
    // Set up structure and files buttons
    setupTabHelperButtons(tab.id);
    
    // Set up model selection
    setupModelSelector(tab.id);
  });
  
  // Scroll to the bottom of the active chat
  scrollActiveChat();
}

/**
 * Set up model selector for a tab
 * @param {string} tabId - Tab ID
 */
function setupModelSelector(tabId) {
  const modelSelect = document.getElementById(`model-select-${tabId}`);
  if (!modelSelect) return;
  
  // Add event listener for model change
  modelSelect.addEventListener('change', function() {
    const selectedTabId = this.getAttribute('data-tab-id');
    const model = this.value;
    
    // Update tab data
    const tabIndex = chatTabs.findIndex(tab => tab.id === selectedTabId);
    if (tabIndex !== -1) {
      chatTabs[tabIndex].model = model;
      saveTabsToLocalStorage();
      
      // Update model description
      updateModelDescription(selectedTabId, model);
      
      // Update token counter limit
      updateTokenCounterLimit(selectedTabId, model);
    }
  });
  
  // Set initial model description
  updateModelDescription(tabId, modelSelect.value);
}

/**
 * Update model description
 * @param {string} tabId - Tab ID
 * @param {string} model - Selected model
 */
function updateModelDescription(tabId, model) {
  const modelDescriptionEl = document.querySelector(`.chat-form[data-tab-id="${tabId}"] .model-description`);
  if (!modelDescriptionEl) return;
  
  // Model descriptions
  const descriptions = {
    'gpt-3.5-turbo': 'Rápido e econômico',
    'gpt-4': 'Mais preciso, mais lento',
    'gpt-4-turbo': 'Precisão melhorada, rápido',
    'gpt-4o': 'Modelo avançado e rápido',
    'gpt-4o-mini': 'Equilíbrio entre velocidade e precisão',
    'o1': 'Última geração, alto desempenho',
    'o1-mini': 'Ótimo para tarefas simples',
    'o3-mini': 'Desempenho intermediário'
  };
  
  modelDescriptionEl.textContent = descriptions[model] || '';
}

/**
 * Update token counter limit based on selected model
 * @param {string} tabId - Tab ID
 * @param {string} model - Selected model
 */
function updateTokenCounterLimit(tabId, model) {
  if (typeof TokenCounter === 'undefined') {
    console.warn('TokenCounter not available yet');
    return;
  }
  
  const tokenCounter = new TokenCounter();
  const limit = tokenCounter.getTokenLimit(model);
  
  const tokenLimitEl = document.querySelector(`.chat-form[data-tab-id="${tabId}"] .token-limit`);
  if (tokenLimitEl) {
    tokenLimitEl.textContent = `Limite: ${limit} tokens`;
  }
}

/**
 * Create a message element
 * @param {Object} message - Message object with role, content, and time
 * @returns {HTMLElement} Message element
 */
function createMessageElement(message) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${message.role === 'user' ? 'user-message' : ''}`;
  
  if (message.role === 'user') {
    messageEl.innerHTML = `
      <div class="message-content">
        <div class="message-text">
          ${message.content}
        </div>
        <div class="message-time">${message.time}</div>
      </div>
      <div class="message-avatar">
        <i class="bi bi-person"></i>
      </div>
    `;
  } else {
    messageEl.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-robot"></i>
      </div>
      <div class="message-content">
        <div class="message-text">
          ${message.content}
        </div>
        <div class="message-time">${message.time}</div>
      </div>
    `;
  }
  
  return messageEl;
}

/**
 * Set up event listeners for tabs
 */
function setupTabEventListeners() {
  // Tab click event
  document.addEventListener('click', (e) => {
    // Handle tab clicks
    if (e.target.closest('.chat-tab') && !e.target.closest('.close-tab') && !e.target.closest('select')) {
      const tab = e.target.closest('.chat-tab');
      const tabId = tab.getAttribute('data-tab-id');
      setActiveTab(tabId);
    }
    
    // Handle close tab clicks
    if (e.target.closest('.close-tab')) {
      const closeButton = e.target.closest('.close-tab');
      const tabId = closeButton.getAttribute('data-tab-id');
      closeTab(tabId);
      e.stopPropagation(); // Prevent triggering tab click
    }
    
    // Handle add tab button
    if (e.target.closest('.add-tab-button')) {
      createNewTab('Nova conversa');
    }
  });
  
  // Tab scroll buttons
  const leftScrollBtn = document.querySelector('.tab-scroll-left');
  const rightScrollBtn = document.querySelector('.tab-scroll-right');
  
  if (leftScrollBtn) {
    leftScrollBtn.addEventListener('click', () => {
      const tabsContainer = document.getElementById('chatTabs');
      if (tabsContainer) {
        tabsContainer.scrollBy({ left: -200, behavior: 'smooth' });
      }
    });
  }
  
  if (rightScrollBtn) {
    rightScrollBtn.addEventListener('click', () => {
      const tabsContainer = document.getElementById('chatTabs');
      if (tabsContainer) {
        tabsContainer.scrollBy({ left: 200, behavior: 'smooth' });
      }
    });
  }
}

/**
 * Set up helper buttons (structure and files) for a tab
 * @param {string} tabId - Tab ID
 */
function setupTabHelperButtons(tabId) {
  // Structure button
  const structureBtn = document.getElementById(`addDirStructureBtn-${tabId}`);
  if (structureBtn) {
    structureBtn.addEventListener('click', async function() {
      try {
        structureBtn.disabled = true;
        structureBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Carregando...';
        
        const response = await fetch('/api/directory-structure');
        const data = await response.json();
        
        if (data.success) {
          const messageInput = document.getElementById(`message-${tabId}`);
          if (messageInput) {
            messageInput.value = data.structure;
            // Ajusta a altura do textarea para mostrar todo o conteúdo
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
            // Foca no textarea para facilitar a edição
            messageInput.focus();
          }
          showToast('Estrutura de diretórios adicionada com sucesso!', 'success');
        } else {
          showToast(`Erro: ${data.error}`, 'danger');
        }
      } catch (error) {
        console.error('Erro ao obter estrutura de diretórios:', error);
        showToast('Erro ao obter estrutura de diretórios. Verifique a conexão.', 'danger');
      } finally {
        structureBtn.disabled = false;
        structureBtn.innerHTML = '<i class="bi bi-folder-fill me-2"></i>Estrutura';
      }
    });
  }
  
  // Files button
  const filesBtn = document.getElementById(`addAllFilesBtn-${tabId}`);
  if (filesBtn) {
    filesBtn.addEventListener('click', async function() {
      try {
        filesBtn.disabled = true;
        filesBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Carregando...';
        
        // Mostrar alerta de carregamento
        showToast('Carregando todos os arquivos, isso pode levar algum tempo...', 'info');
        
        const response = await fetch('/api/all-files');
        const data = await response.json();
        
        if (data.success) {
          const messageInput = document.getElementById(`message-${tabId}`);
          if (messageInput) {
            messageInput.value = data.formattedContent;
            // Ajusta a altura do textarea para mostrar todo o conteúdo
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
            // Foca no textarea para facilitar a edição
            messageInput.focus();
          }
          showToast(`${data.files.length} arquivos carregados com sucesso!`, 'success');
        } else {
          showToast(`Erro: ${data.error}`, 'danger');
        }
      } catch (error) {
        console.error('Erro ao obter todos os arquivos:', error);
        showToast('Erro ao obter todos os arquivos. Verifique a conexão.', 'danger');
      } finally {
        filesBtn.disabled = false;
        filesBtn.innerHTML = '<i class="bi bi-files me-2"></i>Arquivos';
      }
    });
  }
}

/**
 * Create a new tab
 * @param {string} name - Tab name
 * @returns {Object} Tab object
 */
function createNewTab(name) {
  // Create tab object
  const newTab = {
    id: 'tab-' + Date.now(),
    name: name,
    messages: [],
    model: localStorage.getItem('gptModel') || 'gpt-3.5-turbo'
  };
  
  // Add to tabs array
  chatTabs.push(newTab);
  
  // Set as active tab
  setActiveTab(newTab.id);
  
  // Save to localStorage
  saveTabsToLocalStorage();
  
  // Render tabs
  renderChatTabs();
  
  return newTab;
}

/**
 * Set active tab
 * @param {string} tabId - Tab ID
 */
function setActiveTab(tabId) {
  // Update current tab
  currentTabId = tabId;
  
  // Update localStorage
  saveTabsToLocalStorage();
  
  // Remove active class from all tabs
  document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Add active class to current tab
  const tabEl = document.querySelector(`.chat-tab[data-tab-id="${tabId}"]`);
  if (tabEl) {
    tabEl.classList.add('active');
  }
  
  // Remove active class from all tab content
  document.querySelectorAll('.chat-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Add active class to current tab content
  const contentEl = document.querySelector(`.chat-tab-content[data-tab-id="${tabId}"]`);
  if (contentEl) {
    contentEl.classList.add('active');
  }
  
  // Remove active class from all chat container wrappers
  document.querySelectorAll('.chat-container-wrapper').forEach(wrapper => {
    wrapper.classList.remove('active');
  });
  
  // Add active class to current chat container wrapper
  const wrapperEl = document.querySelector(`.chat-container-wrapper[data-tab-id="${tabId}"]`);
  if (wrapperEl) {
    wrapperEl.classList.add('active');
  }
  
  // Scroll to the bottom of the active chat
  scrollActiveChat();
}

/**
 * Scroll to the bottom of the active chat
 */
function scrollActiveChat() {
  if (currentTabId) {
    const chatResponses = document.getElementById(`chatResponses-${currentTabId}`);
    if (chatResponses) {
      chatResponses.scrollTop = chatResponses.scrollHeight;
    }
  }
}

/**
 * Close a tab
 * @param {string} tabId - Tab ID
 */
function closeTab(tabId) {
  // Find tab index
  const tabIndex = chatTabs.findIndex(tab => tab.id === tabId);
  if (tabIndex === -1) return;
  
  // Remove tab
  chatTabs.splice(tabIndex, 1);
  
  // If we closed the active tab, set a new active tab
  if (currentTabId === tabId) {
    if (chatTabs.length > 0) {
      // Set the next tab as active, or the previous if we closed the last tab
      const newIndex = Math.min(tabIndex, chatTabs.length - 1);
      currentTabId = chatTabs[newIndex].id;
    } else {
      // If no tabs left, create a new one
      createNewTab('Chat 1');
      return; // createNewTab will handle rendering
    }
  }
  
  // Save to localStorage
  saveTabsToLocalStorage();
  
  // Render tabs
  renderChatTabs();
}

/**
 * Add a message to a tab
 * @param {string} tabId - Tab ID
 * @param {Object} message - Message object with role, content, and time
 */
function addMessageToTab(tabId, message) {
  // Find tab
  const tabIndex = chatTabs.findIndex(tab => tab.id === tabId);
  if (tabIndex === -1) return;
  
  // Add message to tab
  if (!chatTabs[tabIndex].messages) {
    chatTabs[tabIndex].messages = [];
  }
  
  chatTabs[tabIndex].messages.push(message);
  
  // Save to localStorage
  saveTabsToLocalStorage();
  
  // Add message to DOM
  const messagesWrapper = document.querySelector(`.chat-container-wrapper[data-tab-id="${tabId}"] .messages-wrapper`);
  if (messagesWrapper) {
    const messageEl = createMessageElement(message);
    messagesWrapper.appendChild(messageEl);
    
    // Scroll to the bottom
    const chatResponses = document.getElementById(`chatResponses-${tabId}`);
    if (chatResponses) {
      chatResponses.scrollTop = chatResponses.scrollHeight;
    }
  }
}

/**
 * Get current time for messages
 * @returns {string} Formatted time (HH:MM)
 */
function getCurrentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + 
         now.getMinutes().toString().padStart(2, '0');
}

/**
 * Format message with markdown basic
 * @param {string} message - Text message to format
 * @returns {string} Formatted HTML
 */
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

/**
 * Handle chat form submission
 * @param {Event} e - Submit event
 * @param {string} tabId - Tab ID
 */
async function handleChatSubmit(e, tabId) {
  e.preventDefault();
  console.log('Formulário de chat submetido para a aba', tabId);
  
  // Find the message input for this tab
  const messageInput = document.getElementById(`message-${tabId}`);
  if (!messageInput) {
    console.error('Campo de mensagem não encontrado para a aba', tabId);
    return;
  }
  
  const message = messageInput.value;
  
  if (!message || !message.trim()) {
    console.log('Mensagem vazia, ignorando...');
    return;
  }
  
  console.log('Processando mensagem:', message);
  
  // Get the messages wrapper for this tab
  const messagesWrapper = document.querySelector(`.chat-container-wrapper[data-tab-id="${tabId}"] .messages-wrapper`);
  if (!messagesWrapper) {
    console.error('Container de mensagens não encontrado para a aba', tabId);
    return;
  }

  // Add user message
  const userMessageObj = {
    role: 'user',
    content: message,
    time: getCurrentTime()
  };
  
  // Add message to tab
  addMessageToTab(tabId, userMessageObj);
  
  // Clear message input
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Disable submit button
  const submitButton = document.querySelector(`#chatForm-${tabId} button[type="submit"]`);
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Enviando...';
  }

  // Add thinking indicator
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'message';
  loadingMsg.id = `thinking-indicator-${tabId}`;
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
  
  // Scroll to bottom
  const chatResponses = document.getElementById(`chatResponses-${tabId}`);
  if (chatResponses) {
    chatResponses.scrollTop = chatResponses.scrollHeight;
  }

  try {
    console.log('Enviando requisição para o servidor...');
    
    // Get model for this tab
    let model = 'gpt-3.5-turbo'; // Default
    const tabIndex = chatTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1 && chatTabs[tabIndex].model) {
      model = chatTabs[tabIndex].model;
    }
    
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

    // Remove thinking indicator
    const thinkingIndicator = document.getElementById(`thinking-indicator-${tabId}`);
    if (thinkingIndicator && thinkingIndicator.parentNode) {
      thinkingIndicator.parentNode.removeChild(thinkingIndicator);
    } else {
      console.warn('Indicador de "pensando" não encontrado para remoção');
    }

    // Display GPT response
    if (data.choices && data.choices.length) {
      const gptMsg = data.choices[0].message.content;
      const formattedGptMsg = formatMessage(gptMsg);
      
      // Create assistant message object
      const assistantMessageObj = {
        role: 'assistant',
        content: formattedGptMsg,
        time: getCurrentTime()
      };
      
      // Add message to tab
      addMessageToTab(tabId, assistantMessageObj);
      
      // Update tab name if this is the first user message (after welcome message)
      if (tabIndex !== -1 && chatTabs[tabIndex].messages.length === 3) {
        // Extract a short name from the first user message
        const userMsg = chatTabs[tabIndex].messages[1].content;
        const shortName = userMsg.split(' ').slice(0, 3).join(' ');
        chatTabs[tabIndex].name = shortName.length > 20 ? shortName.substring(0, 20) + '...' : shortName;
        
        // Re-render tabs to update the name
        renderChatTabs();
      }
    } else if (data.error) {
      // Show error message
      const errorMessageObj = {
        role: 'assistant',
        content: `<div class="text-danger"><strong>Erro:</strong> ${data.error}. ${data.message || ''}</div>`,
        time: getCurrentTime()
      };
      
      // Add error message to tab
      addMessageToTab(tabId, errorMessageObj);
    } else {
      throw new Error('Formato de resposta desconhecido');
    }
  } catch (error) {
    console.error('Erro na comunicação com o servidor:', error);
    
    // Remove thinking indicator if it still exists
    const thinkingIndicator = document.getElementById(`thinking-indicator-${tabId}`);
    if (thinkingIndicator && thinkingIndicator.parentNode) {
      thinkingIndicator.parentNode.removeChild(thinkingIndicator);
    }
    
    // Show error message
    const errorMessageObj = {
      role: 'assistant',
      content: `<div class="text-danger">
        <strong>Erro:</strong> Não foi possível se comunicar com o servidor.
        <p class="small mt-1 mb-0"><em>${error.message}</em></p>
      </div>`,
      time: getCurrentTime()
    };
    
    // Add error message to tab
    addMessageToTab(tabId, errorMessageObj);
  } finally {
    // Re-enable submit button
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="bi bi-send me-2"></i>Enviar';
    }
  }
}