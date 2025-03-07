const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const { 
  listRemoteFiles, 
  getRemoteFileContent, 
  uploadToRemoteServer,
  testSshConnection,
  getSshConfig,
  updateSshConfig,
  updateRemoteDir
} = require('../utils/sshConfig');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const tempDir = path.join(__dirname, '..', 'temp');
    try {
      // Garante que o diretório existe
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    } catch (err) {
      console.error('Erro ao verificar/criar diretório temporário:', err);
      // Usar o diretório atual como fallback
      cb(null, __dirname);
    }
  },
  filename: function(req, file, cb) {
    // Mantém o nome original do arquivo
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB
  }
});

// Middleware para verificar a conexão SSH
async function checkSshConnection(req, res, next) {
  try {
    // Tenta testar a conexão SSH, se falhar, continuamos mas adicionamos um flag ao req
    const connectionOk = await testSshConnection();
    req.sshConnectionOk = connectionOk;
    next();
  } catch (error) {
    console.error('Erro ao verificar conexão SSH:', error);
    req.sshConnectionOk = false;
    next();
  }
}

// Rota principal: exibe a lista de arquivos e o chat
router.get('/', checkSshConnection, async (req, res) => {
  try {
    // Se a conexão SSH estiver ok, tenta listar os arquivos
    let files = [];
    let sshError = null;
    
    try {
      files = await listRemoteFiles();
    } catch (error) {
      console.error('Erro ao listar arquivos remotos:', error);
      sshError = 'Não foi possível listar os arquivos remotos. Verifique a conexão SSH.';
    }
    
    // Se não houver arquivos, tentar listar arquivos locais (para desenvolvimento)
    if (files.length === 0 && process.env.NODE_ENV === 'development') {
      try {
        const localFiles = fs.readdirSync(path.join(__dirname, '..', 'files'));
        files = localFiles.filter(file => !file.startsWith('.'));
        console.log('Usando arquivos locais:', files);
      } catch (error) {
        console.error('Erro ao listar arquivos locais:', error);
      }
    }
    
    res.render('index', { 
      files, 
      title: 'Home',
      error: sshError,
      sshStatus: req.sshConnectionOk ? 'connected' : 'disconnected'
    });
  } catch (error) {
    console.error('Erro ao processar a requisição principal:', error);
    res.render('index', { 
      files: [], 
      title: 'Home',
      error: 'Erro ao processar a requisição. ' + error.message,
      sshStatus: 'error'
    });
  }
});

// Rota para verificar status da API e SSH
router.get('/api/status', async (req, res) => {
  try {
    // Verifica status da conexão SSH
    const sshStatus = await testSshConnection();
    
    res.json({ 
      api_status: 'online', 
      ssh_status: sshStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.json({ 
      api_status: 'online',
      ssh_status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para obter configuração SSH atual
router.get('/api/ssh-config', (req, res) => {
  try {
    // Obter a configuração SSH atual (sem credenciais)
    const config = getSshConfig();
    res.json(config);
  } catch (error) {
    console.error('Erro ao obter configuração SSH:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter configuração SSH'
    });
  }
});

// Rota para atualizar configuração SSH
router.post('/api/ssh-config', (req, res) => {
  try {
    const { host, port, remoteDir } = req.body;
    
    // Validar dados
    if (!host || !port || !remoteDir) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros inválidos ou incompletos'
      });
    }
    
    // Atualizar configuração
    updateSshConfig({ host, port });
    updateRemoteDir(remoteDir);
    
    res.json({
      success: true,
      message: 'Configuração SSH atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração SSH:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar configuração SSH'
    });
  }
});

// Rota para testar a conexão com a API OpenAI
router.get('/api/test-openai', async (req, res) => {
  try {
    // Verifica se API key está definida
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
      return res.status(500).json({ 
        success: false, 
        error: 'API Key do OpenAI não está configurada' 
      });
    }

    // Obter o modelo selecionado da query ou usar o padrão
    const model = req.query.model || 'gpt-3.5-turbo';

    // Teste simples de endpoint que não consome tokens
    const testResponse = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10s timeout
    });
    
    // Verificar se o modelo solicitado está disponível
    const modelData = testResponse.data.data;
    const modelExists = modelData.some(m => m.id === model);
    
    if (modelExists) {
      // Se chegou aqui, a conexão foi bem-sucedida e o modelo existe
      res.json({ 
        success: true, 
        models: testResponse.data.data.length, 
        model: model,
        message: `Conexão com a API OpenAI funcionando corretamente. Modelo ${model} disponível.` 
      });
    } else {
      // O modelo específico não está disponível
      res.json({
        success: false,
        error: `O modelo ${model} não está disponível na sua conta. Verifique seu plano de acesso ou escolha outro modelo.`,
        availableModels: modelData.map(m => m.id).filter(id => id.startsWith('gpt'))
      });
    }
  } catch (error) {
    console.error('Erro ao testar API OpenAI:', error.message);
    
    let errorMessage = 'Falha na conexão com a API OpenAI';
    
    // Extrair mensagens de erro mais específicas
    if (error.response) {
      console.error('Dados da resposta erro:', error.response.status, error.response.data);
      if (error.response.status === 401) {
        errorMessage = 'API Key inválida ou expirada';
      } else if (error.response.status === 429) {
        errorMessage = 'Limite de requisições excedido na API OpenAI. Tente novamente mais tarde.';
      } else if (error.response.data && error.response.data.error) {
        errorMessage = `Erro da API: ${error.response.data.error.message || error.response.data.error}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Tempo de conexão esgotado';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Não foi possível conectar ao servidor da OpenAI (problema de DNS/rede)';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: error.response ? error.response.data : null
    });
  }
});

// Rota para enviar mensagens para o GPT
router.post('/send', async (req, res) => {
  const { message, model } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'A mensagem é obrigatória' });
  }
  
  // Usar o modelo fornecido ou o padrão se não for especificado
  const gptModel = model || 'gpt-3.5-turbo';
  
  console.log('Requisição recebida para /send', { messageLength: message.length, model: gptModel });
  
  try {
    // Verifica se API key está definida
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
      console.error('API Key não configurada');
      return res.status(500).json({ error: 'API Key do OpenAI não configurada' });
    }
    
    console.log('Enviando mensagem para a API OpenAI...');
    
    const payload = {
      model: gptModel,
      messages: [
        { role: 'system', content: "Você é um assistente de desenvolvimento especializado em analisar código e ajudar programadores. Forneça respostas técnicas precisas e úteis." },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1500
    };
    
    console.log('API Key:', process.env.OPENAI_API_KEY.substring(0, 10) + '...[oculto]');
    console.log('Modelo utilizado:', gptModel);
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos de timeout
      }
    );
    
    console.log('Resposta recebida da API OpenAI');
    
    // Verifica se a resposta é válida
    if (!response.data || !response.data.choices || !response.data.choices.length) {
      console.error('Resposta inválida da API:', response.data);
      return res.status(500).json({
        error: "Formato de resposta inválido da API OpenAI",
        details: response.data
      });
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('Erro na API OpenAI:', error.message);
    
    let errorMessage = 'Erro ao se comunicar com a API do GPT';
    
    // Extrair mensagens de erro mais específicas
    if (error.response) {
      console.error('Dados da resposta erro:', error.response.status, error.response.data);
      if (error.response.status === 401) {
        errorMessage = 'API Key inválida ou expirada';
      } else if (error.response.status === 429) {
        errorMessage = 'Limite de requisições excedido na API OpenAI. Aguarde alguns minutos e tente novamente.';
      } else if (error.response.status === 404) {
        errorMessage = `Modelo ${gptModel} não encontrado ou não disponível na sua conta.`;
      } else if (error.response.data && error.response.data.error) {
        errorMessage = `Erro da API: ${error.response.data.error.message || error.response.data.error}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Tempo de conexão esgotado';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      message: error.message,
      details: error.response ? error.response.data : null
    });
  }
});

// Rota para verificar status da conexão SSH
router.get('/api/ssh-status', async (req, res) => {
  try {
    const isConnected = await testSshConnection();
    res.json({
      success: true,
      connected: isConnected,
      message: isConnected 
        ? 'Conexão SSH estabelecida com sucesso'
        : 'Não foi possível estabelecer conexão SSH com o servidor'
    });
  } catch (error) {
    console.error('Erro ao verificar status SSH:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message || 'Erro desconhecido ao verificar conexão SSH'
    });
  }
});

// Rota para upload de arquivos
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).render('error', { 
      message: "Nenhum arquivo foi enviado", 
      title: "Erro de Upload" 
    });
  }
  
  try {
    // Verifica a conexão SSH antes de tentar o upload
    const isConnected = await testSshConnection();
    if (!isConnected) {
      throw new Error('Não foi possível estabelecer conexão SSH com o servidor. Verifique suas credenciais ou a disponibilidade do servidor.');
    }
    
    // Faz upload do arquivo para o servidor remoto via SSH
    await uploadToRemoteServer(req.file);
    
    // Remove o arquivo temporário
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (err) {
      console.error('Erro ao remover arquivo temporário:', err.message);
    }
    
    res.redirect('/');
  } catch (error) {
    console.error('Erro ao fazer upload para o servidor remoto:', error);
    
    // Remove o arquivo temporário em caso de erro
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (err) {
      console.error('Erro ao remover arquivo temporário após erro de upload:', err.message);
    }
    
    res.status(500).render('error', { 
      message: `Erro ao fazer upload para o servidor remoto: ${error.message}`, 
      title: "Erro de Upload" 
    });
  }
});

// Rota para analisar um arquivo específico com o GPT
router.get('/analyze/:filename', checkSshConnection, async (req, res) => {
  const { filename } = req.params;
  
  try {
    // Verifica se API key está definida
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
      return res.status(500).render('error', { 
        message: "API Key do OpenAI não está configurada", 
        title: "Erro de Configuração" 
      });
    }
    
    // Obtém o conteúdo do arquivo remoto ou local
    let fileContent;
    try {
      fileContent = await getRemoteFileContent(filename);
    } catch (error) {
      console.error('Erro ao obter conteúdo do arquivo remoto:', error);
      
      // Tenta ler o arquivo localmente se for um ambiente de desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        try {
          fileContent = fs.readFileSync(path.join(__dirname, '..', 'files', filename), 'utf8');
          console.log('Arquivo lido localmente com sucesso');
        } catch (localError) {
          console.error('Erro ao ler arquivo local:', localError);
          throw new Error(`Não foi possível ler o arquivo "${filename}" (nem remotamente nem localmente)`);
        }
      } else {
        throw error;
      }
    }
    
    if (!fileContent || fileContent.trim() === '') {
      return res.status(400).render('error', { 
        message: "O arquivo está vazio", 
        title: "Erro de Análise" 
      });
    }
    
    const fileExtension = path.extname(filename).toLowerCase();
    
    // Determina o tipo de arquivo para melhor análise
    let fileType = "código";
    if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExtension)) {
      fileType = "JavaScript/TypeScript";
    } else if (['.py'].includes(fileExtension)) {
      fileType = "Python";
    } else if (['.java'].includes(fileExtension)) {
      fileType = "Java";
    } else if (['.html', '.htm'].includes(fileExtension)) {
      fileType = "HTML";
    } else if (['.css'].includes(fileExtension)) {
      fileType = "CSS";
    } else if (['.php'].includes(fileExtension)) {
      fileType = "PHP";
    }
    
    // Obter o modelo atual da sessão ou localStorage (via cookie)
    const gptModel = req.query.model || req.cookies?.gptModel || 'gpt-3.5-turbo';
    
    console.log(`Analisando arquivo ${filename} (tipo: ${fileType}) com modelo ${gptModel}...`);
    
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: gptModel,
          messages: [
            { 
              role: 'system', 
              content: `Você é um assistente especializado em análise de código. Analise o seguinte código ${fileType} e forneça insights, melhorias possíveis e identifique potenciais bugs.` 
            },
            { role: 'user', content: fileContent }
          ],
          temperature: 0.7,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 segundos de timeout para análises de arquivos
        }
      );
      
      if (!response.data || !response.data.choices || !response.data.choices.length) {
        throw new Error('Formato de resposta inválido da API OpenAI');
      }
      
      res.render('analysis', { 
        filename, 
        content: fileContent,
        analysis: response.data.choices[0].message.content,
        title: `Análise: ${filename}`
      });
    } catch (apiError) {
      console.error('Erro na API OpenAI:', apiError.message);
      
      let mensagemErro = "Erro ao analisar o arquivo";
      
      // Tratamento específico para erro 429 (rate limit)
      if (apiError.response && apiError.response.status === 429) {
        mensagemErro = 'Você atingiu o limite de requisições à API OpenAI. Por favor, aguarde alguns minutos antes de tentar novamente.';
        console.error('Detalhes do erro 429:', apiError.response.data);
      } else if (apiError.response && apiError.response.status === 401) {
        mensagemErro = 'A chave de API OpenAI parece ser inválida ou expirou.';
      } else if (apiError.response && apiError.response.status === 404) {
        mensagemErro = `O modelo ${gptModel} não está disponível na sua conta ou não existe.`;
      } else if (apiError.response && apiError.response.data && apiError.response.data.error) {
        mensagemErro = `Erro da API: ${apiError.response.data.error.message || apiError.response.data.error}`;
      }
      
      res.status(500).render('error', { 
        message: mensagemErro, 
        title: "Erro de Análise" 
      });
    }
  } catch (error) {
    console.error('Erro ao processar arquivo para análise:', error.message);
    
    res.status(500).render('error', { 
      message: `Erro ao processar o arquivo: ${error.message}`, 
      title: "Erro de Análise" 
    });
  }
});

// Rota para exibir o conteúdo de um arquivo específico
router.get('/file/:filename', checkSshConnection, async (req, res) => {
  const { filename } = req.params;
  
  try {
    let content;
    
    try {
      // Tenta obter o conteúdo do arquivo remoto
      content = await getRemoteFileContent(filename);
    } catch (error) {
      console.error('Erro ao ler arquivo remoto:', error);
      
      // Se estiver em desenvolvimento, tenta ler o arquivo localmente
      if (process.env.NODE_ENV === 'development') {
        try {
          content = fs.readFileSync(path.join(__dirname, '..', 'files', filename), 'utf8');
          console.log('Arquivo lido localmente com sucesso');
        } catch (localError) {
          console.error('Erro ao ler arquivo local:', localError);
          throw new Error(`Não foi possível ler o arquivo "${filename}" (nem remotamente nem localmente)`);
        }
      } else {
        throw error;
      }
    }
    
    res.render('file', { 
      filename, 
      content, 
      title: `Arquivo: ${filename}` 
    });
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    res.status(500).render('error', { 
      message: `Erro ao ler o arquivo: ${error.message}`, 
      title: "Erro" 
    });
  }
});

module.exports = router;