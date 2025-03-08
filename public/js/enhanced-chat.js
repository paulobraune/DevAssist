/**
 * Enhanced Chat with model selection and token counting
 */
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a page that uses chat functionality
  const pageType = document.getElementById('page-type');
  if (pageType && (pageType.getAttribute('data-page') === 'file' || pageType.getAttribute('data-page') === 'analysis')) {
    console.log('Not on a chat page, skipping enhanced chat initialization');
    return;
  }

  // Check if we're on a page with chat functionality
  const chatTabsContainer = document.getElementById('chatTabs');
  if (!chatTabsContainer) {
    console.log('Chat tabs container not found, skipping enhanced chat initialization');
    return;
  }
  
  // Load token counter script
  if (!window.TokenCounter) {
    const tokenCounterScript = document.createElement('script');
    tokenCounterScript.src = '/js/token-counter.js';
    document.head.appendChild(tokenCounterScript);
    
    tokenCounterScript.onload = initEnhancedChat;
  } else {
    initEnhancedChat();
  }
  
  // Load Sortable.js for drag and drop
  if (!window.Sortable) {
    const sortableScript = document.createElement('script');
    sortableScript.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
    document.head.appendChild(sortableScript);
  }
});

function initEnhancedChat() {
  const tokenCounter = new TokenCounter();
  
  // Initialize token counter
  initTokenCounter(tokenCounter);
}

/**
 * Initialize token counter
 * @param {TokenCounter} tokenCounter - TokenCounter instance
 */
function initTokenCounter(tokenCounter) {
  // Add input event listener to all chat message textareas
  document.addEventListener('input', function(e) {
    if (!e.target.classList.contains('chat-message')) return;
    
    const form = e.target.closest('.chat-form');
    if (!form) return;
    
    const tabId = form.getAttribute('data-tab-id');
    if (!tabId) return;
    
    const text = e.target.value;
    
    // Get model for this tab
    let model = 'gpt-3.5-turbo'; // Default
    const tabIndex = chatTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1 && chatTabs[tabIndex].model) {
      model = chatTabs[tabIndex].model;
    }
    
    updateTokenCounter(tabId, text, model, tokenCounter);
  });
  
  // Add token counter to each form
  document.querySelectorAll('.chat-form').forEach(form => {
    const tabId = form.getAttribute('data-tab-id');
    if (!tabId) return;
    
    // Check if token counter already exists
    if (!form.querySelector('.token-counter')) {
      const tokenCounterDiv = document.createElement('div');
      tokenCounterDiv.className = 'token-counter';
      tokenCounterDiv.innerHTML = `
        <div class="token-counter-text">
          <span class="token-count">0 tokens</span>
          <span class="token-limit">Limite: 0 tokens</span>
        </div>
        <div class="token-counter-progress">
          <div class="token-counter-bar" style="width: 0%"></div>
        </div>
      `;
      
      const inputGroup = form.querySelector('.input-group');
      if (inputGroup) {
        inputGroup.after(tokenCounterDiv);
      }
    }
    
    // Initialize counter with empty text
    updateTokenCounter(tabId, '', 'gpt-3.5-turbo', tokenCounter);
  });
  
  // Add change event listener to all model selects
  document.addEventListener('change', function(e) {
    if (!e.target.classList.contains('model-select')) return;
    
    const tabId = e.target.getAttribute('data-tab-id');
    if (!tabId) return;
    
    const model = e.target.value;
    
    // Update token counter limit
    updateTokenCounterLimit(tabId, model);
    
    // Get text from textarea to update token count
    const textarea = document.getElementById(`message-${tabId}`);
    if (textarea) {
      updateTokenCounter(tabId, textarea.value, model, tokenCounter);
    }
  });
}

/**
 * Update token counter for a specific tab
 * @param {string} tabId - Tab ID
 * @param {string} text - Text to count tokens for
 * @param {string} model - Model name
 * @param {TokenCounter} tokenCounter - TokenCounter instance
 */
function updateTokenCounter(tabId, text, model, tokenCounter) {
  const form = document.querySelector(`.chat-form[data-tab-id="${tabId}"]`);
  if (!form) return;
  
  const tokenCounterDiv = form.querySelector('.token-counter');
  if (!tokenCounterDiv) return;
  
  // Calculate tokens
  const count = tokenCounter.estimateTokenCount(text);
  const limit = tokenCounter.getTokenLimit(model);
  const usageLevel = tokenCounter.getUsageLevel(count, limit);
  
  // Update display
  const tokenCountSpan = tokenCounterDiv.querySelector('.token-count');
  const tokenLimitSpan = tokenCounterDiv.querySelector('.token-limit');
  const tokenBar = tokenCounterDiv.querySelector('.token-counter-bar');
  
  if (tokenCountSpan) tokenCountSpan.textContent = `${count} tokens`;
  if (tokenLimitSpan) tokenLimitSpan.textContent = `Limite: ${limit} tokens`;
  
  if (tokenBar) {
    // Calculate percentage
    const percentage = Math.min((count / limit) * 100, 100);
    tokenBar.style.width = `${percentage}%`;
    
    // Update color based on usage level
    tokenBar.classList.remove('warning', 'danger');
    if (usageLevel !== 'normal') {
      tokenBar.classList.add(usageLevel);
    }
  }
}

/**
 * Update token counter with usage information from the API
 * @param {string} tabId - Tab ID
 * @param {object} usage - Usage object from the API
 * @param {string} model - Model name
 */
function updateTokenCounterWithUsage(tabId, usage, model) {
  const form = document.querySelector(`.chat-form[data-tab-id="${tabId}"]`);
  if (!form) return;
  
  const tokenCounterDiv = form.querySelector('.token-counter');
  if (!tokenCounterDiv) return;
  
  const tokenCounter = new TokenCounter();
  const limit = tokenCounter.getTokenLimit(model);
  
  // Get token counts from the API response
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || 0;
  
  // Update display
  const tokenCountSpan = tokenCounterDiv.querySelector('.token-count');
  const tokenLimitSpan = tokenCounterDiv.querySelector('.token-limit');
  const tokenBar = tokenCounterDiv.querySelector('.token-counter-bar');
  
  if (tokenCountSpan) {
    tokenCountSpan.innerHTML = `
      <span title="Total: ${totalTokens}">
        ${promptTokens} + ${completionTokens} = ${totalTokens} tokens
      </span>
    `;
  }
  
  if (tokenLimitSpan) tokenLimitSpan.textContent = `Limite: ${limit} tokens`;
  
  if (tokenBar) {
    // Calculate percentage
    const percentage = Math.min((totalTokens / limit) * 100, 100);
    tokenBar.style.width = `${percentage}%`;
    
    // Update color based on percentage
    tokenBar.classList.remove('warning', 'danger');
    if (percentage > 90) {
      tokenBar.classList.add('danger');
    } else if (percentage > 75) {
      tokenBar.classList.add('warning');
    }
  }
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
 * Reset token counter for a specific tab
 * @param {string} tabId - Tab ID
 */
function resetTokenCounter(tabId) {
  const form = document.querySelector(`.chat-form[data-tab-id="${tabId}"]`);
  if (!form) return;
  
  const tokenCounterDiv = form.querySelector('.token-counter');
  if (!tokenCounterDiv) return;
  
  // Get model for this tab
  let model = 'gpt-3.5-turbo'; // Default
  const tabIndex = chatTabs.findIndex(tab => tab.id === tabId);
  if (tabIndex !== -1 && chatTabs[tabIndex].model) {
    model = chatTabs[tabIndex].model;
  }
  
  const tokenCounter = new TokenCounter();
  const limit = tokenCounter.getTokenLimit(model);
  
  // Reset display
  const tokenCountSpan = tokenCounterDiv.querySelector('.token-count');
  const tokenLimitSpan = tokenCounterDiv.querySelector('.token-limit');
  const tokenBar = tokenCounterDiv.querySelector('.token-counter-bar');
  
  if (tokenCountSpan) tokenCountSpan.textContent = '0 tokens';
  if (tokenLimitSpan) tokenLimitSpan.textContent = `Limite: ${limit} tokens`;
  if (tokenBar) {
    tokenBar.style.width = '0%';
    tokenBar.classList.remove('warning', 'danger');
  }
}