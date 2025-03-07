document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('message').value;
  
  if (!message.trim()) {
    return; // Evita enviar mensagens vazias
  }
  
  const responseDiv = document.getElementById('chatResponses');

  // Adiciona a mensagem do usuário à interface
  const userMsgContainer = document.createElement('div');
  userMsgContainer.className = 'message user-message';
  userMsgContainer.innerHTML = `<strong>Você:</strong> ${message}`;
  responseDiv.querySelector('.messages-wrapper').appendChild(userMsgContainer);
  
  // Rola para a mensagem mais recente
  responseDiv.scrollTop = responseDiv.scrollHeight;
  
  // Limpa a área de texto
  document.getElementById('message').value = '';

  try {
    // Exibe indicador de carregamento
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'message gpt-message';
    loadingMsg.innerHTML = '<em>DevAssist GPT está pensando...</em>';
    responseDiv.querySelector('.messages-wrapper').appendChild(loadingMsg);
    responseDiv.scrollTop = responseDiv.scrollHeight;

    console.log('Enviando mensagem:', message);
    
    const response = await fetch('/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    const data = await response.json();
    console.log('Resposta recebida:', data);

    // Remove o indicador de carregamento
    responseDiv.querySelector('.messages-wrapper').removeChild(loadingMsg);

    // Exibe a resposta do GPT
    if (data.choices && data.choices.length) {
      const gptMsg = data.choices[0].message.content;
      const gptMsgContainer = document.createElement('div');
      gptMsgContainer.className = 'message gpt-message';
      gptMsgContainer.innerHTML = `<strong>DevAssist GPT:</strong> ${formatMessage(gptMsg)}`;
      responseDiv.querySelector('.messages-wrapper').appendChild(gptMsgContainer);
      responseDiv.scrollTop = responseDiv.scrollHeight;
    } else if (data.error) {
      // Mostra mensagem de erro da API
      const errorMsg = document.createElement('div');
      errorMsg.className = 'message gpt-message';
      errorMsg.innerHTML = `<strong>Erro:</strong> ${data.error}. ${data.message || ''}`;
      responseDiv.querySelector('.messages-wrapper').appendChild(errorMsg);
      responseDiv.scrollTop = responseDiv.scrollHeight;
    }
  } catch (error) {
    console.error('Erro na comunicação:', error);
    
    // Exibe mensagem de erro
    const errorMsg = document.createElement('div');
    errorMsg.className = 'message gpt-message';
    errorMsg.innerHTML = '<strong>Erro:</strong> Não foi possível se comunicar com a API do GPT. Verifique o console para mais detalhes.';
    responseDiv.querySelector('.messages-wrapper').appendChild(errorMsg);
    responseDiv.scrollTop = responseDiv.scrollHeight;
  }
});

// Função para formatar mensagens com markdown básico e código
function formatMessage(text) {
  // Formata blocos de código (com ```código```)
  text = text.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
  
  // Formata código inline (com `código`)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Preserva quebras de linha
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  // Adiciona div para mensagens se não existir
  const responseDiv = document.getElementById('chatResponses');
  if (!responseDiv.querySelector('.messages-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'messages-wrapper';
    responseDiv.appendChild(wrapper);
  }
  
  console.log('Chat inicializado e pronto para usar!');
});
