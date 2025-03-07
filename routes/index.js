const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');

const FILES_DIR = path.join(__dirname, '..', 'files');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Garante que o diretório existe
    if (!fs.existsSync(FILES_DIR)) {
      fs.mkdirSync(FILES_DIR, { recursive: true });
    }
    cb(null, FILES_DIR);
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

// Rota principal: exibe a lista de arquivos e o chat
router.get('/', (req, res) => {
  // Garante que o diretório existe
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
  
  fs.readdir(FILES_DIR, (err, files) => {
    if (err) {
      return res.render('index', { files: [], title: 'Home' });
    }
    res.render('index', { files, title: 'Home' });
  });
});

// Rota para enviar mensagens para o GPT
router.post('/send', async (req, res) => {
  const { message } = req.body;
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: "Você é um assistente de desenvolvimento especializado em analisar código e ajudar programadores. Forneça respostas técnicas precisas e úteis." },
          { role: 'user', content: message }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Erro na API OpenAI:', error.response ? error.response.data : error.message);
    res.status(500).json({ 
      error: "Erro ao se comunicar com a API do GPT",
      message: error.message 
    });
  }
});

// Rota para upload de arquivos
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).render('error', { 
      message: "Nenhum arquivo foi enviado", 
      title: "Erro de Upload" 
    });
  }
  
  res.redirect('/');
});

// Rota para analisar um arquivo específico com o GPT
router.get('/analyze/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(FILES_DIR, filename);
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
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
    }
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: `Você é um assistente especializado em análise de código. Analise o seguinte código ${fileType} e forneça insights, melhorias possíveis e identifique potenciais bugs.` 
          },
          { role: 'user', content: fileContent }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.render('analysis', { 
      filename, 
      content: fileContent,
      analysis: response.data.choices[0].message.content,
      title: `Análise: ${filename}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      message: "Erro ao analisar o arquivo", 
      title: "Erro de Análise" 
    });
  }
});

// Rota para exibir o conteúdo de um arquivo específico
router.get('/file/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(FILES_DIR, filename);
  fs.readFile(filePath, 'utf-8', (err, content) => {
    if (err) {
      return res.status(404).render('error', { 
        message: "Arquivo não encontrado", 
        title: "Erro" 
      });
    }
    res.render('file', { 
      filename, 
      content, 
      title: `Arquivo: ${filename}` 
    });
  });
});

module.exports = router;