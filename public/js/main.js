document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM carregado, inicializando chat...');
  
  // Adiciona div para mensagens se não existir
  const responseDiv = document.getElementById('chatResponses');
  if (!responseDiv.querySelector('.messages-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'messages-wrapper';
    responseDiv.appendChild(wrapper);
  }
  
  // Adiciona uma mensagem de status inicial
  const statusMsg = document.createElement('div');
  statusMsg.className = 'message gpt-message';
  statusMsg.innerHTML = '<strong>Status:</strong> <span id="connection-status">Sistema inicializado</span>';
  responseDiv.querySelector('.messages-wrapper').appendChild(statusMsg);

  // Verifica conexão com o backend
  fetch('/api/status')
    .then(response => response.json())
    .then(data => {
      document.getElementById('connection-status').textContent = 'Conectado ao servidor ✓';
    })
    .catch(error => {
      document.getElementById('connection-status').textContent = 'Erro de conexão com o servidor ✗';
      console.error('Erro ao verificar status do servidor:', error);
    });
  
  console.log('Chat inicializado e pronto para usar!');
});

// Manipulador para o formulário do chat
document.getElementById('chatForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  console.log('Formulário enviado');
  
  const messageInput = document.getElementById('message');
  const message = messageInput.value;
  
  if (!message.trim()) {
    console.log('Mensagem vazia, ignorando');
    return; // Evita enviar mensagens vazias
  }
  
  const responseDiv = document.getElementById('chatResponses');
  const messagesWrapper = responseDiv.querySelector('.messages-wrapper');

  // Adiciona a mensagem do usuário à interface
  const userMsgContainer = document.createElement('div');
  userMsgContainer.className = 'message user-message';
  userMsgContainer.innerHTML = `<strong>Você:</strong> ${message}`;
  messagesWrapper.appendChild(userMsgContainer);
  
  // Rola para a mensagem mais recente
  responseDiv.scrollTop = responseDiv.scrollHeight;
  
  // Limpa a área de texto
  messageInput.value = '';

  // Referência para o botão de envio
  const submitButton = document.querySelector('#chatForm button[type="submit"]');
  
  // Desabilita o botão enquanto processa
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    // Exibe indicador de carregamento
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'message gpt-message';
    loadingMsg.innerHTML = '<em>DevAssist GPT está pensando...</em>';
    messagesWrapper.appendChild(loadingMsg);
    responseDiv.scrollTop = responseDiv.scrollHeight;

    console.log('Enviando mensagem para o servidor:', message);
    
    const response = await fetch('/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    console.log('Resposta recebida do servidor, status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Tipo de conteúdo inválido: ${contentType}`);
    }
    
    const data = await response.json();
    console.log('Dados da resposta:', data);

    // Remove o indicador de carregamento
    messagesWrapper.removeChild(loadingMsg);

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
});

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
