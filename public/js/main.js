document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, inicializando aplicação...');
  
  // Inicializa o chat
  initChat();
  
  // Configura o botão de teste da API
  setupApiTest();
});

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
  
  // Adicionar mensagem de status inicial
  console.log('Adicionando mensagem de status...');
  const statusMsg = document.createElement('div');
  statusMsg.className = 'message gpt-message';
  statusMsg.innerHTML = '<strong>Status:</strong> <span id="connection-status">Verificando conexão...</span>';
  responseDiv.querySelector('.messages-wrapper').appendChild(statusMsg);

  // Verificar a conexão com o backend
  console.log('Verificando status do servidor...');
  fetch('/api/status')
    .then(response => {
      console.log('Resposta de status recebida:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('Dados de status:', data);
      document.getElementById('connection-status').textContent = 'Conectado ao servidor ✓';
    })
    .catch(error => {
      console.error('Erro ao verificar status do servidor:', error);
      document.getElementById('connection-status').textContent = 'Erro de conexão com o servidor ✗';
    });
  
  // Configurar evento de envio do formulário
  const chatForm = document.getElementById('chatForm');
  if (!chatForm) {
    console.error('Formulário de chat não encontrado!');
    return;
  }
  
  console.log('Configurando evento de submit do formulário...');
  chatForm.addEventListener('submit', handleChatSubmit);
  
  console.log('Chat inicializado!');
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
  const userMsgContainer = document.createElement('div');
  userMsgContainer.className = 'message user-message';
  userMsgContainer.innerHTML = `<strong>Você:</strong> ${message}`;
  messagesWrapper.appendChild(userMsgContainer);
  
  // Rola para a mensagem mais recente
  responseDiv.scrollTop = responseDiv.scrollHeight;
  
  // Limpa o campo de mensagem
  messageInput.value = '';

  // Desabilita o botão durante o processamento
  const submitButton = document.querySelector('#chatForm button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  // Adiciona indicador de "pensando"
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'message gpt-message';
  loadingMsg.id = 'thinking-indicator';
  loadingMsg.innerHTML = '<em>DevAssist GPT está pensando...</em>';
  messagesWrapper.appendChild(loadingMsg);
  responseDiv.scrollTop = responseDiv.scrollHeight;

  try {
    console.log('Enviando requisição para o servidor...');
    
    const response = await fetch('/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
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
      const gptMsgContainer = document.createElement('div');
      gptMsgContainer.className = 'message gpt-message';
      gptMsgContainer.innerHTML = `<strong>DevAssist GPT:</strong> ${formatMessage(gptMsg)}`;
      messagesWrapper.appendChild(gptMsgContainer);
      responseDiv.scrollTop = responseDiv.scrollHeight;
    } else if (data.error) {
      // Mostra mensagem de erro da API
      const errorMsg = document.createElement('div');
      errorMsg.className = 'message gpt-message';
      errorMsg.innerHTML = `<strong>Erro:</strong> ${data.error}. ${data.message || ''}`;
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
    errorMsg.className = 'message gpt-message';
    errorMsg.innerHTML = `<strong>Erro:</strong> Não foi possível se comunicar com o servidor. <br><em>${error.message}</em>`;
    messagesWrapper.appendChild(errorMsg);
    responseDiv.scrollTop = responseDiv.scrollHeight;
  } finally {
    // Reativa o botão de envio
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
    }
  }
}

function setupApiTest() {
  const testButton = document.getElementById('testApiBtn');
  if (!testButton) {
    console.warn('Botão de teste da API não encontrado');
    return;
  }
  
  testButton.addEventListener('click', async function() {
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testando...';
    
    const statusDiv = document.getElementById('apiStatus');
    if (!statusDiv) {
      console.error('Elemento apiStatus não encontrado');
      return;
    }
    
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = 'Testando conexão com a API...';
    statusDiv.className = 'mt-2 alert alert-info';
    
    try {
      const response = await fetch('/api/test-openai');
      const data = await response.json();
      
      if (data.success) {
        statusDiv.className = 'mt-2 alert alert-success';
        statusDiv.innerHTML = `<strong>Sucesso!</strong> ${data.message}`;
      } else {
        statusDiv.className = 'mt-2 alert alert-warning';
        statusDiv.innerHTML = `<strong>Falha:</strong> ${data.error}`;
      }
    } catch (error) {
      console.error('Erro ao testar API:', error);
      statusDiv.className = 'mt-2 alert alert-warning';
      statusDiv.innerHTML = `<strong>Erro:</strong> Falha na comunicação com o servidor: ${error.message}`;
    } finally {
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-sync-alt"></i> Testar Conexão';
    }
  });
}

// Função para formatar mensagens com markdown básico e código
function formatMessage(text) {
  if (!text) return '';
  
  // Formata blocos de código (com ```código```)
  text = text.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
  
  // Formata código inline (com `código`)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Preserva quebras de linha
  text = text.replace(/\n/g, '<br>');
  
  return text;
}