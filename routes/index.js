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
  updateRemoteDir,
  updateLocalDir,
  getDirectoryStructure,
  getAllFilesContent,
  formatAllFilesContent,
  isDevMode,
  useLocalFolder,
  setForceLocalFolder,
  setForceSshMode,
  deleteRemoteFile,
  createRemoteFolder,
  getFolderStructure,
  LOCAL_DIR,
  DEFAULT_LOCAL_DIR
} = require('../utils/sshConfig');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Usar o diretório temporário para armazenamento inicial
    const tempDir = path.join(__dirname, '..', 'temp');
    try {
      // Garante que o diretório existe
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('Diretório temporário criado:', tempDir);
      }
      cb(null, tempDir);
    } catch (err) {
      console.error('Erro ao verificar/criar diretório temporário:', err);
      // Usar o diretório atual como fallback
      cb(null, __dirname);
    }
  },
  filename: function(req, file, cb) {
    // Usar o nome original do arquivo
    cb(null, file.originalname);
  }
});

// Configurar os limites do upload
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Aumentado para 50MB para suportar pastas maiores
  }
});

// Middleware para verificar a conexão SSH
async function checkSshConnection(req, res, next) {
  try {
    // Em modo de desenvolvimento com pasta local, não precisamos verificar a conexão SSH
    if (useLocalFolder()) {
      req.sshConnectionOk = true;
      next();
      return;
    }
    
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
    // Se a conexão SSH estiver ok ou estiver em modo de desenvolvimento, tenta listar os arquivos
    let files = [];
    let sshError = null;
    
    try {
      // Lista arquivos da raiz 
      files = await listRemoteFiles();
    } catch (error) {
      console.error('Erro ao listar arquivos remotos:', error);
      
      if (useLocalFolder()) {
        // Em modo pasta local, isso não é um erro crítico
        sshError = null;
      } else {
        sshError = 'Não foi possível listar os arquivos remotos. Verifique a conexão SSH.';
      }
    }
    
    // Obtém as configurações atuais para passar à view
    const config = getSshConfig();
    
    res.render('index', { 
      files, 
      title: 'Home',
      error: sshError,
      sshStatus: req.sshConnectionOk ? 'connected' : 'disconnected',
      appMode: process.env.NODE_ENV,
      useLocalFolder: config.useLocalFolder,
      localDir: config.localDir
    });
  } catch (error) {
    console.error('Erro ao processar a requisição principal:', error);
    res.render('index', { 
      files: [], 
      title: 'Home',
      error: 'Erro ao processar a requisição. ' + error.message,
      sshStatus: 'error',
      appMode: process.env.NODE_ENV,
      useLocalFolder: useLocalFolder()
    });
  }
});

// Rota para listar arquivos/pastas de um diretório específico
router.get('/api/list-directory/:path?', checkSshConnection, async (req, res) => {
  try {
    let dirPath = req.params.path || '';
    
    // Decode the path from URL-encoded format
    dirPath = decodeURIComponent(dirPath);
    
    // If not using SSH, check directory access
    if (!useLocalFolder() && !req.sshConnectionOk) {
      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar ao servidor SSH'
      });
    }
    
    const items = await listRemoteFiles(dirPath);
    
    res.json({
      success: true,
      path: dirPath,
      items: items
    });
  } catch (error) {
    console.error('Erro ao listar diretório:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar arquivos do diretório'
    });
  }
});

// Rota para obter a estrutura de pastas
router.get('/api/folder-structure', checkSshConnection, async (req, res) => {
  try {
    if (!req.sshConnectionOk && !useLocalFolder()) {
      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar ao servidor SSH'
      });
    }
    
    const structure = await getFolderStructure();
    res.json({
      success: true,
      structure
    });
  } catch (error) {
    console.error('Erro ao obter estrutura de pastas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter estrutura de pastas'
    });
  }
});

// Rota para criar nova pasta
router.post('/api/create-folder', checkSshConnection, async (req, res) => {
  try {
    const { folderName, parentPath } = req.body;
    
    console.log('Criando pasta:', folderName, 'em', parentPath);
    
    if (!folderName) {
      return res.status(400).json({
        success: false,
        error: 'Nome da pasta não fornecido'
      });
    }
    
    if (!req.sshConnectionOk && !useLocalFolder()) {
      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar ao servidor SSH'
      });
    }
    
    // Normalizar caminho pai
    const normalizedParentPath = parentPath || '/';
    
    // Criar a pasta
    const created = await createRemoteFolder(folderName, normalizedParentPath);
    
    if (created) {
      res.json({
        success: true,
        message: `Pasta ${folderName} criada com sucesso`,
        path: path.join(normalizedParentPath, folderName).replace(/\\/g, '/')
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Falha ao criar a pasta ${folderName}`
      });
    }
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar pasta'
    });
  }
});

// Rota para excluir arquivo
router.delete('/api/delete-file/:filename', checkSshConnection, async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Nome do arquivo não fornecido'
      });
    }
    
    // Verificar a conexão SSH se não estiver usando pasta local
    if (!useLocalFolder() && !req.sshConnectionOk) {
      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar ao servidor SSH'
      });
    }
    
    // Exclui o arquivo (local ou remoto)
    const deleted = await deleteRemoteFile(filename);
    
    if (deleted) {
      res.json({
        success: true,
        message: `Arquivo ${filename} excluído com sucesso`
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Falha ao excluir o arquivo ${filename}`
      });
    }
  } catch (error) {
    console.error('Erro ao excluir arquivo:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao excluir arquivo'
    });
  }
});

// Rota para verificar status da API e SSH
router.get('/api/status', async (req, res) => {
  try {
    // Verifica status da conexão SSH se não estiver usando pasta local
    const sshStatus = useLocalFolder() ? true : await testSshConnection();
    const config = getSshConfig();
    
    res.json({ 
      api_status: 'online', 
      ssh_status: sshStatus ? 'connected' : 'disconnected',
      app_mode: process.env.NODE_ENV,
      local_folder: useLocalFolder(),
      local_dir: config.localDir,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.json({ 
      api_status: 'online',
      ssh_status: 'error',
      app_mode: process.env.NODE_ENV,
      local_folder: useLocalFolder(),
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
    const { host, port, remoteDir, localDir, forceLocalFolder, forceSshMode } = req.body;
    
    // Validar dados
    if ((!host || !port || !remoteDir) && !localDir) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros inválidos ou incompletos'
      });
    }
    
    // Atualizar configuração SSH
    if (host && port && remoteDir) {
      updateSshConfig({ host, port });
      updateRemoteDir(remoteDir);
    }
    
    // Atualizar diretório local
    if (localDir) {
      const updated = updateLocalDir(localDir);
      if (!updated) {
        return res.status(500).json({
          success: false,
          error: 'Não foi possível atualizar o diretório local'
        });
      }
    }
    
    // Atualizar opções de modo
    if (typeof forceLocalFolder === 'boolean') {
      setForceLocalFolder(forceLocalFolder);
    }
    
    if (typeof forceSshMode === 'boolean') {
      setForceSshMode(forceSshMode);
    }
    
    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar configurações'
    });
  }
});

// Rota para alternar entre os modos de desenvolvimento e produção
router.post('/api/toggle-mode', (req, res) => {
  try {
    const newMode = process.env.NODE_ENV === 'development' ? 'production' : 'development';
    process.env.NODE_ENV = newMode;
    
    console.log(`\x1b[36m%s\x1b[0m`, `Modo da aplicação alterado para: ${newMode.toUpperCase()}`);
    
    res.json({
      success: true,
      mode: newMode,
      message: `Aplicação agora está em modo ${newMode}`
    });
  } catch (error) {
    console.error('Erro ao alternar modo da aplicação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao alternar modo da aplicação'
    });
  }
});

// Rota para alternar entre uso de pasta local e SSH
router.post('/api/toggle-local-folder', (req, res) => {
  try {
    const { useLocal } = req.body;
    
    if (isDevMode()) {
      // Em desenvolvimento, alternamos entre usar a pasta local (padrão) e forçar SSH
      setForceSshMode(useLocal === false);
    } else {
      // Em produção, alternamos entre usar SSH (padrão) e forçar pasta local
      setForceLocalFolder(useLocal === true);
    }
    
    res.json({
      success: true,
      useLocalFolder: useLocalFolder(),
      message: useLocalFolder() 
        ? 'Usando pasta local para armazenamento' 
        : 'Usando SSH para armazenamento'
    });
  } catch (error) {
    console.error('Erro ao alternar modo de armazenamento:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao alternar modo de armazenamento'
    });
  }
});

// Rota para obter a estrutura de diretórios
router.get('/api/directory-structure', checkSshConnection, async (req, res) => {
  try {
    if (!req.sshConnectionOk && !useLocalFolder()) {
      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar ao servidor SSH'
      });
    }
    
    const structure = await getDirectoryStructure();
    res.json({
      success: true,
      structure
    });
  } catch (error) {
    console.error('Erro ao obter estrutura de diretórios:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter estrutura de diretórios'
    });
  }
});

// Rota para obter todos os arquivos com conteúdo
router.get('/api/all-files', checkSshConnection, async (req, res) => {
  try {
    if (!req.sshConnectionOk && !useLocalFolder()) {
      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar ao servidor SSH'
      });
    }
    
    const files = await getAllFilesContent();
    const formattedContent = formatAllFilesContent(files);
    
    res.json({
      success: true,
      files,
      formattedContent
    });
  } catch (error) {
    console.error('Erro ao obter todos os arquivos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter todos os arquivos'
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
    
    // Adicionar informações de uso de tokens à resposta
    if (response.data.usage) {
      console.log('Uso de tokens:', response.data.usage);
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
    // Verificar se está usando pasta local
    const isUsingLocalFolder = useLocalFolder();
    
    // Em pasta local, consideramos que a conexão está ok
    const isConnected = isUsingLocalFolder ? true : await testSshConnection();
    
    res.json({
      success: true,
      connected: isConnected,
      appMode: process.env.NODE_ENV,
      localFolder: isUsingLocalFolder,
      localDir: LOCAL_DIR,
      message: isUsingLocalFolder 
        ? `Usando pasta local: ${LOCAL_DIR}`
        : (isConnected 
          ? 'Conexão SSH estabelecida com sucesso'
          : 'Não foi possível estabelecer conexão SSH com o servidor')
    });
  } catch (error) {
    console.error('Erro ao verificar status SSH:', error);
    res.status(500).json({
      success: false,
      connected: false,
      appMode: process.env.NODE_ENV,
      error: error.message || 'Erro desconhecido ao verificar conexão SSH'
    });
  }
});

// Rota para upload de arquivos
router.post('/upload', upload.single('file'), async (req, res) => {
  console.log('Recebendo requisição de upload:', req.file ? req.file.originalname : 'sem arquivo');
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "Nenhum arquivo foi enviado"
    });
  }
  
  try {
    console.log('Arquivo temporário salvo em:', req.file.path);
    console.log('Informações do arquivo:', {
      nome: req.file.originalname,
      tamanho: req.file.size,
      tipo: req.file.mimetype
    });
    
    // Get target path from the request body if provided (for folder uploads)
    const targetPath = req.body.targetPath || '';
    console.log('Target path:', targetPath);
    
    // Check if this is a folder upload by checking req.body.isFolder
    const isFolder = req.body.isFolder === 'true';
    
    // If in local folder mode
    if (useLocalFolder()) {
      console.log(`Usando pasta local: Salvando arquivo em ${LOCAL_DIR}`);
      
      try {
        // Garantir que o diretório local base existe
        if (!fs.existsSync(LOCAL_DIR)) {
          console.log('Criando diretório base local:', LOCAL_DIR);
          fs.mkdirSync(LOCAL_DIR, { recursive: true });
        }
        
        // Determine full target path
        let fullTargetDir;
        if (targetPath) {
          // For folder uploads with specific target path
          fullTargetDir = path.join(LOCAL_DIR, targetPath.replace(/^\//, ''));
        } else {
          // Regular file upload to root
          fullTargetDir = LOCAL_DIR;
        }
        
        // Ensure the target directory exists
        if (!fs.existsSync(fullTargetDir)) {
          console.log('Criando diretório destino:', fullTargetDir);
          fs.mkdirSync(fullTargetDir, { recursive: true });
        }
        
        // Destination path for the file
        const destPath = path.join(fullTargetDir, req.file.originalname);
        console.log('Salvando arquivo em:', destPath);
        
        // Ensure the source file exists
        if (!fs.existsSync(req.file.path)) {
          throw new Error(`Arquivo temporário não encontrado: ${req.file.path}`);
        }
        
        // Copy the file to the destination
        fs.copyFileSync(req.file.path, destPath);
        console.log('Arquivo salvo localmente com sucesso');
      } catch (err) {
        console.error('Erro ao salvar arquivo localmente:', err);
        throw err;
      }
    } else {
      // SSH mode
      // Verifica a conexão SSH antes de tentar o upload
      const isConnected = await testSshConnection();
      console.log('Status da conexão SSH:', isConnected ? 'conectado' : 'desconectado');
      
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor SSH. Verifique a conexão.');
      }
      
      // Verificar se o arquivo temporário existe
      if (!fs.existsSync(req.file.path)) {
        throw new Error(`Arquivo temporário não encontrado: ${req.file.path}`);
      }
      
      // Faz upload do arquivo para o servidor remoto via SSH com suporte a caminhos específicos
      await uploadToRemoteServer(req.file, targetPath);
      console.log('Arquivo enviado para o servidor remoto com sucesso');
    }
    
    // Remove o arquivo temporário
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('Arquivo temporário removido');
      }
    } catch (err) {
      console.error('Erro ao remover arquivo temporário:', err.message);
    }
    
    // Return success response
    res.json({
      success: true,
      message: 'Arquivo enviado com sucesso',
      fileName: req.file.originalname,
      size: req.file.size,
      targetPath: targetPath || '/'
    });
  } catch (error) {
    console.error('Erro ao fazer upload do arquivo:', error);
    
    // Remove o arquivo temporário em caso de erro
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (err) {
      console.error('Erro ao remover arquivo temporário após erro de upload:', err.message);
    }
    
    res.status(500).json({
      success: false,
      error: `Erro ao fazer upload do arquivo: ${error.message}`
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
        title: "Erro de Configuração",
        appMode: process.env.NODE_ENV
      });
    }
    
    // Obtém o conteúdo do arquivo
    let fileContent;
    try {
      console.log(`Tentando obter conteúdo do arquivo: ${filename}`);
      fileContent = await getRemoteFileContent(filename);
      console.log('Conteúdo do arquivo obtido com sucesso');
    } catch (error) {
      console.error('Erro ao obter conteúdo do arquivo:', error);
      throw new Error(`Não foi possível ler o arquivo "${filename}". ${error.message}`);
    }
    
    if (!fileContent || fileContent.trim() === '') {
      return res.status(400).render('error', { 
        message: "O arquivo está vazio", 
        title: "Erro de Análise",
        appMode: process.env.NODE_ENV
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
        title: `Análise: ${filename}`,
        appMode: process.env.NODE_ENV,
        useLocalFolder: useLocalFolder()
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
        title: "Erro de Análise",
        appMode: process.env.NODE_ENV,
        useLocalFolder: useLocalFolder()
      });
    }
  } catch (error) {
    console.error('Erro ao processar arquivo para análise:', error.message);
    
    res.status(500).render('error', { 
      message: `Erro ao processar o arquivo: ${error.message}`, 
      title: "Erro de Análise",
      appMode: process.env.NODE_ENV,
      useLocalFolder: useLocalFolder()
    });
  }
});

// Rota para exibir o conteúdo de um arquivo específico
router.get('/file/:filename', checkSshConnection, async (req, res) => {
  const { filename } = req.params;
  
  try {
    let content;
    
    try {
      // Tenta obter o conteúdo do arquivo (remoto ou local, dependendo do modo)
      console.log(`Tentando obter conteúdo do arquivo: ${filename}`);
      content = await getRemoteFileContent(filename);
      console.log('Conteúdo do arquivo obtido com sucesso');
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      throw new Error(`Não foi possível ler o arquivo "${filename}". ${error.message}`);
    }
    
    res.render('file', { 
      filename, 
      content, 
      title: `Arquivo: ${filename}`,
      appMode: process.env.NODE_ENV,
      useLocalFolder: useLocalFolder(),
      localDir: LOCAL_DIR
    });
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    res.status(500).render('error', { 
      message: `Erro ao ler o arquivo: ${error.message}`, 
      title: "Erro",
      appMode: process.env.NODE_ENV,
      useLocalFolder: useLocalFolder()
    });
  }
});

module.exports = router;