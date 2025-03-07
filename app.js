const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
const indexRouter = require('./routes/index');

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Verifica se a API key está presente
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey.trim() === '') {
  console.error('\x1b[31m%s\x1b[0m', 'ERRO: API KEY do OpenAI não configurada!');
  console.error('\x1b[33m%s\x1b[0m', 'Verifique se o arquivo .env contém uma chave OPENAI_API_KEY válida.');
} else {
  console.log('\x1b[32m%s\x1b[0m', 'API KEY do OpenAI configurada com sucesso.');
}

const app = express();

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuração do express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);

// Set default locals for all views
app.use((req, res, next) => {
  res.locals.title = 'Assistente GPT';
  next();
});

// Middleware para melhorar tratamento de erros
app.use((req, res, next) => {
  res.locals.showTests = true;
  next();
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Garantir que o diretório temporário existe
const fs = require('fs');
const tempDir = path.join(__dirname, 'temp');
try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('Diretório temporário criado:', tempDir);
  }
} catch (err) {
  console.error('Erro ao criar diretório temporário:', err.message);
  console.log('Continuando sem diretório temporário...');
}

// Garantir que o diretório files existe para os exemplos locais
const filesDir = path.join(__dirname, 'files');
try {
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
    
    // Copiar o arquivo sample.js para o diretório files
    const sampleFileSrc = path.join(__dirname, 'files', 'sample.js');
    const sampleFileDest = path.join(filesDir, 'sample.js');
    
    if (fs.existsSync(sampleFileSrc)) {
      fs.copyFileSync(sampleFileSrc, sampleFileDest);
      console.log('Arquivo sample.js copiado para o diretório files');
    } else {
      // Criar o arquivo sample.js no diretório files
      fs.writeFileSync(
        sampleFileDest,
        '// sample.js - Exemplo de arquivo para análise\nconsole.log("Este é um exemplo de arquivo para análise pelo GPT.");\n'
      );
      console.log('Arquivo sample.js criado no diretório files');
    }
  }
} catch (err) {
  console.error('Erro ao configurar diretório files:', err.message);
  console.log('Continuando sem diretório files...');
}

// Definir NODE_ENV como development para facilitar o teste
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('NODE_ENV definido como development');
}

// Rotas
app.use('/', indexRouter);

// Middleware para tratar erros 404
app.use((req, res, next) => {
  res.status(404).render('error', { 
    message: 'Página não encontrada',
    title: 'Erro 404'
  });
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro na aplicação:', err);
  res.status(500).render('error', { 
    message: 'Ocorreu um erro interno no servidor',
    title: 'Erro 500'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});