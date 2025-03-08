const { Client } = require('ssh2');
const SftpClient = require('ssh2-sftp-client');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Valores padrão para a configuração SSH
const DEFAULT_SSH_HOST = '104.238.145.89';
const DEFAULT_SSH_PORT = 22;
const DEFAULT_REMOTE_DIR = '/home/tracklead-files-chat/htdocs/files-chat.tracklead.com/files/';

// SSH connection configuration - lendo do .env para credenciais e usando valores padrão para o resto
const sshConfig = {
  host: DEFAULT_SSH_HOST,
  port: DEFAULT_SSH_PORT,
  username: process.env.SSH_USERNAME || '',
  password: process.env.SSH_PASSWORD || '',
  readyTimeout: 20000,
  keepaliveInterval: 5000,
  keepaliveCountMax: 3,
  // Atualizando os algoritmos para incluir opções mais modernas e seguras
  algorithms: {
    kex: [
      // Adicionar algoritmos mais modernos primeiro
      'curve25519-sha256',
      'curve25519-sha256@libssh.org',
      'ecdh-sha2-nistp256',
      'ecdh-sha2-nistp384',
      'ecdh-sha2-nistp521',
      'diffie-hellman-group-exchange-sha256',
      'diffie-hellman-group16-sha512',
      'diffie-hellman-group18-sha512',
      'diffie-hellman-group14-sha256',
      // Manter os algoritmos mais antigos por compatibilidade
      'diffie-hellman-group14-sha1',
      'diffie-hellman-group-exchange-sha1',
      'diffie-hellman-group1-sha1'
    ],
    cipher: [
      'aes128-ctr',
      'aes192-ctr',
      'aes256-ctr',
      'aes128-gcm',
      'aes128-gcm@openssh.com',
      'aes256-gcm',
      'aes256-gcm@openssh.com'
    ],
    serverHostKey: [
      'ssh-rsa',
      'ecdsa-sha2-nistp256',
      'ecdsa-sha2-nistp384',
      'ecdsa-sha2-nistp521',
      'ssh-ed25519'
    ],
    hmac: [
      'hmac-sha2-256',
      'hmac-sha2-512',
      'hmac-sha1'
    ]
  }
};

// Remote directory path
let REMOTE_DIR = DEFAULT_REMOTE_DIR;
// Local directory path (usado no modo de desenvolvimento)
const DEFAULT_LOCAL_DIR = path.join(__dirname, '..', 'files');
let LOCAL_DIR = DEFAULT_LOCAL_DIR;

// Armazenamento para as configurações no lado do servidor
let serverSettings = {
  forceLocalFolder: false,
  forceSshMode: false
};

// Arquivo para salvar as configurações do servidor
const settingsFilePath = path.join(__dirname, '..', 'server-settings.json');

// Carrega as configurações do servidor se o arquivo existir
try {
  if (fs.existsSync(settingsFilePath)) {
    const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
    serverSettings = JSON.parse(settingsData);
    console.log('Configurações do servidor carregadas do arquivo');
  }
} catch (err) {
  console.error('Erro ao carregar configurações do servidor:', err.message);
}

// Função para salvar as configurações do servidor no arquivo
function saveServerSettings() {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(serverSettings, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao salvar configurações do servidor:', err.message);
  }
}

// Garantir que o diretório LOCAL_DIR exista
try {
  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    console.log(`Diretório local para arquivos criado: ${LOCAL_DIR}`);
  }
} catch (err) {
  console.error(`Erro ao criar diretório local para arquivos: ${err.message}`);
}

/**
 * Tenta carregar configurações do localStorage (no navegador) se disponível
 */
function loadLocalSettings() {
  try {
    // Verificar se estamos em um ambiente de navegador com localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedConfig = JSON.parse(window.localStorage.getItem('sshConfig') || '{}');
      if (savedConfig.host) sshConfig.host = savedConfig.host;
      if (savedConfig.port) sshConfig.port = parseInt(savedConfig.port, 10);
      if (savedConfig.remoteDir) REMOTE_DIR = savedConfig.remoteDir;
      if (savedConfig.localDir) LOCAL_DIR = savedConfig.localDir;
      console.log('Configurações SSH carregadas do localStorage');
      
      // Garantir que o diretório LOCAL_DIR personalizado exista
      if (savedConfig.localDir && savedConfig.localDir !== DEFAULT_LOCAL_DIR) {
        try {
          if (!fs.existsSync(savedConfig.localDir)) {
            fs.mkdirSync(savedConfig.localDir, { recursive: true });
            console.log(`Diretório local personalizado criado: ${savedConfig.localDir}`);
          }
        } catch (err) {
          console.error(`Erro ao criar diretório local personalizado: ${err.message}`);
          // Revertendo para o diretório padrão em caso de erro
          LOCAL_DIR = DEFAULT_LOCAL_DIR;
        }
      }
    }
  } catch (err) {
    console.error('Erro ao carregar configurações do localStorage:', err.message);
  }
}

// Tentar carregar configurações do localStorage apenas se estiver em ambiente de navegador
try {
  loadLocalSettings();
} catch (err) {
  console.error('Erro ao inicializar configurações SSH:', err.message);
}

/**
 * Verifica se a aplicação está em modo de desenvolvimento
 * @returns {boolean} True se estiver em modo de desenvolvimento
 */
function isDevMode() {
  return process.env.NODE_ENV === 'development';
}

/**
 * Verifica se devemos usar pasta local mesmo quando em modo de produção
 * @returns {boolean} True se forçar uso da pasta local
 */
function forceLocalFolderMode() {
  // Verificar se estamos em um ambiente de navegador
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('forceLocalFolder') === 'true';
  }
  // Usar a configuração armazenada no servidor
  return serverSettings.forceLocalFolder;
}

/**
 * Verifica se devemos usar SSH mesmo quando em modo de desenvolvimento
 * @returns {boolean} True se forçar uso do SSH
 */
function forceSshMode() {
  // Verificar se estamos em um ambiente de navegador
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('forceSshMode') === 'true';
  }
  // Usar a configuração armazenada no servidor
  return serverSettings.forceSshMode;
}

/**
 * Determina se devemos usar o modo local
 * @returns {boolean} True se usar pasta local, false se usar SSH
 */
function useLocalFolder() {
  // Comportamento padrão: desenvolvimento usa pasta local, produção usa SSH
  let useLocal = isDevMode();
  
  // Override baseado nas configurações do usuário
  if (isDevMode() && forceSshMode()) {
    useLocal = false; // Força o uso de SSH mesmo em modo desenvolvimento
  } else if (!isDevMode() && forceLocalFolderMode()) {
    useLocal = true; // Força o uso de pasta local mesmo em modo produção
  }
  
  return useLocal;
}

/**
 * Atualiza a configuração SSH com valores novos
 * @param {Object} config - Novo objeto de configuração
 */
function updateSshConfig(config) {
  if (config.host) sshConfig.host = config.host;
  if (config.port) sshConfig.port = parseInt(config.port, 10);
  // Credenciais (username/password) não são atualizáveis via UI por segurança
}

/**
 * Retorna a configuração SSH atual (sem a senha)
 * @returns {Object} Configuração SSH atual
 */
function getSshConfig() {
  return {
    host: sshConfig.host,
    port: sshConfig.port,
    username: sshConfig.username,
    remoteDir: REMOTE_DIR,
    localDir: LOCAL_DIR,
    appMode: process.env.NODE_ENV,
    useLocalFolder: useLocalFolder(),
    forceLocalFolder: forceLocalFolderMode(),
    forceSshMode: forceSshMode()
  };
}

/**
 * Atualiza o diretório remoto
 * @param {string} dir - Novo diretório remoto
 */
function updateRemoteDir(dir) {
  REMOTE_DIR = dir;
}

/**
 * Atualiza o diretório local
 * @param {string} dir - Novo diretório local
 */
function updateLocalDir(dir) {
  try {
    // Verificar se o diretório existe ou pode ser criado
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Diretório local criado: ${dir}`);
    }
    
    LOCAL_DIR = dir;
    return true;
  } catch (err) {
    console.error(`Erro ao atualizar diretório local para ${dir}:`, err.message);
    return false;
  }
}

/**
 * Atualiza modo forçado de pasta local
 * @param {boolean} forceLocal - Se true, força o uso de pasta local mesmo em produção
 */
function setForceLocalFolder(forceLocal) {
  // Verificar se estamos em um ambiente de navegador
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('forceLocalFolder', forceLocal ? 'true' : 'false');
  }
  
  // Atualizar e salvar configuração no servidor também
  serverSettings.forceLocalFolder = forceLocal;
  saveServerSettings();
}

/**
 * Atualiza modo forçado de SSH
 * @param {boolean} forceSsh - Se true, força o uso de SSH mesmo em desenvolvimento
 */
function setForceSshMode(forceSsh) {
  // Verificar se estamos em um ambiente de navegador
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('forceSshMode', forceSsh ? 'true' : 'false');
  }
  
  // Atualizar e salvar configuração no servidor também
  serverSettings.forceSshMode = forceSsh;
  saveServerSettings();
}

/**
 * List files and directories in the remote directory
 * @param {string} dirPath - Optional path to list (relative to root dir)
 * @returns {Promise<Array>} List of items with name, type, and path
 */
async function listRemoteFiles(dirPath = '') {
  // Path to list - normalize based on input
  const listPath = dirPath ? 
    (dirPath.startsWith('/') ? dirPath.substring(1) : dirPath) : '';
  
  // Full path to list
  const fullPath = useLocalFolder() ? 
    path.join(LOCAL_DIR, listPath) : 
    `${REMOTE_DIR}${listPath}`;
  
  console.log(`Listing files and directories in: ${fullPath}`);
  
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Listando arquivos da pasta local:`, fullPath);
    try {
      if (!fs.existsSync(fullPath)) {
        // Create directory if it doesn't exist
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Diretório local criado: ${fullPath}`);
        
        // Only create sample file in root directory
        if (!listPath) {
          // Criar arquivo de exemplo se o diretório estiver vazio
          const sampleFile = path.join(fullPath, 'sample.js');
          if (!fs.existsSync(sampleFile)) {
            fs.writeFileSync(
              sampleFile,
              '// sample.js - Exemplo de arquivo para análise\nconsole.log("Este é um exemplo de arquivo para análise pelo GPT.");\n'
            );
            console.log('Arquivo sample.js criado na pasta local');
          }
        }
      }
      
      // Read directory contents
      const items = fs.readdirSync(fullPath);
      
      // Map to structured format with files and directories
      const result = items
        .filter(item => !item.startsWith('.'))
        .map(item => {
          const itemPath = path.join(fullPath, item);
          const stats = fs.statSync(itemPath);
          const isDirectory = stats.isDirectory();
          
          return {
            name: item,
            path: listPath ? `${listPath}/${item}` : item,
            type: isDirectory ? 'directory' : 'file',
            size: stats.size
          };
        });
      
      console.log(`Found ${result.length} items in ${fullPath}:`, result);
      return result;
    } catch (err) {
      console.error('Erro ao listar arquivos locais:', err.message);
      return [];
    }
  }

  // Modo SSH
  console.log('Iniciando listRemoteFiles(), tentando listar arquivos em:', fullPath);
  console.log('Configuração SSH atual:', sshConfig.host, sshConfig.port, sshConfig.username);
  
  // Create a new instance each time to prevent connection issues
  const sftp = new SftpClient();
  
  try {
    console.log('Attempting to connect to SSH server...');
    await sftp.connect(sshConfig);
    console.log('Connected to SSH server successfully');
    
    console.log(`Listing items in directory: ${fullPath}`);
    const itemList = await sftp.list(fullPath);
    console.log(`Found ${itemList.length} items in the directory`);
    
    // Filter out . and .. entries and convert to structured format
    const result = itemList
      .filter(item => item.name !== '.' && item.name !== '..')
      .map(item => {
        return {
          name: item.name,
          path: listPath ? `${listPath}/${item.name}` : item.name,
          type: item.type === 'd' ? 'directory' : 'file',
          size: item.size || 0
        };
      });
    
    console.log(`Processed ${result.length} items:`, result);
    return result;
  } catch (err) {
    console.error('Error in listRemoteFiles:', err.message);
    throw err;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
        console.log('SFTP connection closed');
      }
    } catch (err) {
      console.error('Error closing SFTP connection:', err.message);
    }
  }
}

/**
 * Get folder structure with nested folders support
 * @returns {Promise<Array>} Array of folder objects with structure
 */
async function getFolderStructure() {
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Obtendo estrutura de pastas local`);
    
    try {
      // Função recursiva para processar diretórios
      function processDirectory(dirPath, parentPath = '') {
        const result = [];
        
        if (!fs.existsSync(dirPath)) {
          return result;
        }
        
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
          if (item.startsWith('.')) continue;
          
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);
          const relativePath = path.join(parentPath, item).replace(/\\/g, '/');
          
          if (stats.isDirectory()) {
            // Add this directory
            result.push({
              name: item,
              path: relativePath,
              type: 'directory',
              children: processDirectory(itemPath, relativePath)
            });
          } else {
            // Add this file
            result.push({
              name: item,
              path: relativePath,
              type: 'file',
              size: stats.size
            });
          }
        }
        
        return result;
      }
      
      // Start processing from root directory
      return processDirectory(LOCAL_DIR);
    } catch (err) {
      console.error('Erro ao obter estrutura de pastas local:', err.message);
      return [];
    }
  }

  // Modo SSH
  console.log('Obtendo estrutura de pastas via SSH');
  const sftp = new SftpClient();
  
  try {
    await sftp.connect(sshConfig);
    
    async function processRemoteDirectory(dirPath) {
      const result = [];
      const list = await sftp.list(dirPath);
      
      for (const item of list) {
        if (item.name === '.' || item.name === '..') continue;
        
        const itemPath = `${dirPath}${item.name}`;
        const relativePath = itemPath.replace(REMOTE_DIR, '');
        
        if (item.type === 'd') {
          // Add this directory
          result.push({
            name: item.name,
            path: relativePath,
            type: 'directory',
            children: await processRemoteDirectory(`${itemPath}/`)
          });
        } else {
          // Add this file
          result.push({
            name: item.name,
            path: relativePath,
            type: 'file',
            size: item.size
          });
        }
      }
      
      return result;
    }
    
    // Start processing from remote root
    return await processRemoteDirectory(REMOTE_DIR);
  } catch (err) {
    console.error('Error getting folder structure:', err.message);
    throw err;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
      }
    } catch (err) {
      console.error('Error closing SFTP connection:', err.message);
    }
  }
}

/**
 * Create a new folder in the remote or local directory
 * @param {string} folderName - Name of the folder to create
 * @param {string} parentPath - Path to the parent folder (default: root)
 * @returns {Promise<boolean>} True if folder was created successfully
 */
async function createRemoteFolder(folderName, parentPath = '/') {
  console.log(`Creating remote folder: ${folderName} in ${parentPath}`);
  
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Criando pasta local: ${folderName}`);
    
    try {
      // Normalizar o caminho pai
      let fullPath;
      if (parentPath === '/') {
        fullPath = path.join(LOCAL_DIR, folderName);
      } else {
        // Remove leading slash if present
        const cleanParentPath = parentPath.startsWith('/') ? parentPath.substring(1) : parentPath;
        fullPath = path.join(LOCAL_DIR, cleanParentPath, folderName);
      }
      
      console.log('Caminho completo da nova pasta:', fullPath);
      
      // Criar a pasta se não existir
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Pasta local ${folderName} criada com sucesso em ${parentPath}`);
        return true;
      } else {
        console.log(`Pasta local ${folderName} já existe em ${parentPath}`);
        return false;
      }
    } catch (err) {
      console.error(`Erro ao criar pasta local ${folderName}:`, err.message);
      throw err;
    }
  }

  // Modo SSH
  console.log(`Iniciando createRemoteFolder() para a pasta: ${folderName} em ${parentPath}`);
  
  // Create a new instance each time to prevent connection issues
  const sftp = new SftpClient();
  
  try {
    console.log('Conectando ao servidor SSH para criar pasta...');
    await sftp.connect(sshConfig);
    
    // Construir o caminho completo da pasta
    let fullPath;
    if (parentPath === '/') {
      fullPath = `${REMOTE_DIR}${folderName}`;
    } else {
      // Remove leading slash if present
      const cleanParentPath = parentPath.startsWith('/') ? parentPath.substring(1) : parentPath;
      fullPath = `${REMOTE_DIR}${cleanParentPath}/${folderName}`;
    }
    
    console.log('Caminho completo da nova pasta:', fullPath);
    
    // Verificar se a pasta já existe
    const exists = await sftp.exists(fullPath);
    if (exists) {
      console.log(`Pasta ${folderName} já existe em ${parentPath}`);
      return false;
    }
    
    // Criar a pasta
    await sftp.mkdir(fullPath, true);
    console.log(`Pasta ${folderName} criada com sucesso em ${parentPath}`);
    return true;
  } catch (err) {
    console.error(`Erro ao criar pasta remota ${folderName}:`, err.message);
    throw err;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
        console.log('Conexão SFTP fechada');
      }
    } catch (err) {
      console.error('Erro ao fechar conexão SFTP:', err.message);
    }
  }
}

/**
 * Delete a file from the remote or local directory
 * @param {string} filename - Name of file to delete
 * @returns {Promise<boolean>} True if file was deleted successfully
 */
async function deleteRemoteFile(filename) {
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Excluindo arquivo local: ${filename}`);
    try {
      const filePath = path.join(LOCAL_DIR, filename);
      if (!fs.existsSync(filePath)) {
        console.error(`Arquivo não encontrado: ${filePath}`);
        return false;
      }
      
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        // It's a directory, use rmdir
        fs.rmdirSync(filePath, { recursive: true });
        console.log(`Pasta ${filename} excluída com sucesso`);
      } else {
        // It's a file, use unlink
        fs.unlinkSync(filePath);
        console.log(`Arquivo ${filename} excluído com sucesso`);
      }
      return true;
    } catch (err) {
      console.error(`Erro ao excluir arquivo local ${filename}:`, err.message);
      return false;
    }
  }

  // Modo SSH
  console.log(`Iniciando deleteRemoteFile() para o arquivo: ${filename}`);
  
  // Create a new instance each time to prevent connection issues
  const sftp = new SftpClient();
  
  try {
    console.log(`Connecting to delete file: ${filename}`);
    await sftp.connect(sshConfig);
    
    const filePath = `${REMOTE_DIR}${filename}`;
    console.log(`Verifying file existence: ${filePath}`);
    
    // Check if file exists
    const fileExists = await sftp.exists(filePath);
    if (!fileExists) {
      console.error(`File ${filename} does not exist on the remote server`);
      return false;
    }
    
    // Check if it's a directory
    const fileType = await sftp.stat(filePath);
    if (fileType.isDirectory) {
      // Delete the directory recursively
      await sftp.rmdir(filePath, true);
      console.log(`Directory ${filename} deleted successfully`);
    } else {
      // Delete the file
      await sftp.delete(filePath);
      console.log(`File ${filename} deleted successfully`);
    }
    
    return true;
  } catch (err) {
    console.error(`Error deleting remote file ${filename}:`, err.message);
    return false;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
        console.log('SFTP connection closed');
      }
    } catch (err) {
      console.error('Error closing SFTP connection:', err.message);
    }
  }
}

/**
 * List files and directories recursively on the remote server
 * @param {string} basePath - Base directory path to start from (default to REMOTE_DIR)
 * @param {string} prefix - Prefix for nested directories in output (used for recursion)
 * @returns {Promise<string>} Formatted string representation of directory structure
 */
async function getDirectoryStructure(basePath = REMOTE_DIR, prefix = '') {
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Obtendo estrutura da pasta local`);
    let result = '';
    
    try {
      const dirPath = prefix === '' ? LOCAL_DIR : path.join(LOCAL_DIR, basePath.replace(REMOTE_DIR, ''));
      
      if (fs.existsSync(dirPath)) {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        // Sort items - directories first, then files
        const sortedItems = items.sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        
        for (const item of sortedItems) {
          if (item.name.startsWith('.')) continue;
          
          if (item.isDirectory()) {
            result += `${prefix}📁 ${item.name}/\n`;
            const subPath = path.join(dirPath, item.name);
            const relativePath = basePath === REMOTE_DIR ? 
              `${item.name}/` : 
              `${basePath.replace(REMOTE_DIR, '')}${item.name}/`;
              
            const subDirContents = await getDirectoryStructure(
              `${REMOTE_DIR}${relativePath}`, 
              `${prefix}  `
            );
            result += subDirContents;
          } else {
            result += `${prefix}📄 ${item.name}\n`;
          }
        }
        
        return result;
      } else {
        console.log(`Diretório não existe: ${dirPath}`);
        return `${prefix}📄 sample.js\n`;
      }
    } catch (err) {
      console.error('Erro ao listar estrutura de diretórios local:', err.message);
      return `${prefix}📄 sample.js\n`;
    }
  }

  // Modo SSH
  console.log(`Getting directory structure for: ${basePath}`);
  const sftp = new SftpClient();
  let result = '';
  
  try {
    await sftp.connect(sshConfig);
    const list = await sftp.list(basePath);
    
    // Sort list - directories first, then files
    const sortedList = list.sort((a, b) => {
      // If types are different, sort directories before files
      if (a.type !== b.type) {
        return a.type === 'd' ? -1 : 1;
      }
      // Otherwise sort alphabetically
      return a.name.localeCompare(b.name);
    });
    
    for (const item of sortedList) {
      // Skip . and .. entries
      if (item.name === '.' || item.name === '..') continue;
      
      const itemPath = `${basePath}${item.name}`;
      
      if (item.type === 'd') {
        // This is a directory
        result += `${prefix}📁 ${item.name}/\n`;
        // Get contents of this directory (recursive call)
        const subDirContents = await getDirectoryStructure(`${itemPath}/`, `${prefix}  `);
        result += subDirContents;
      } else {
        // This is a file
        result += `${prefix}📄 ${item.name}\n`;
      }
    }
    
    return result;
  } catch (err) {
    console.error('Error getting directory structure:', err.message);
    throw err;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
      }
    } catch (err) {
      console.error('Error closing SFTP connection:', err.message);
    }
  }
}

/**
 * Get all files content with their paths from the remote server
 * @param {string} basePath - Base directory path to start from (default to REMOTE_DIR)
 * @returns {Promise<Array>} Array of {path, content} objects
 */
async function getAllFilesContent(basePath = REMOTE_DIR) {
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Obtendo conteúdo de todos os arquivos locais`);
    const result = [];
    
    try {
      // Função recursiva para processar diretórios locais
      async function processLocalDirectory(currentPath, relativeDirPath = '') {
        const items = fs.readdirSync(currentPath, { withFileTypes: true });
        
        for (const item of items) {
          if (item.name.startsWith('.')) continue;
          
          const itemPath = path.join(currentPath, item.name);
          const relPath = relativeDirPath ? `${relativeDirPath}/${item.name}` : item.name;
          
          if (item.isDirectory()) {
            await processLocalDirectory(itemPath, relPath);
          } else {
            try {
              const content = fs.readFileSync(itemPath, 'utf8');
              result.push({
                path: relPath,
                content: content
              });
            } catch (fileErr) {
              console.error(`Erro ao ler arquivo local ${itemPath}:`, fileErr.message);
              result.push({
                path: relPath,
                content: `ERROR: Could not read file (${fileErr.message})`
              });
            }
          }
        }
      }
      
      await processLocalDirectory(LOCAL_DIR);
      return result;
    } catch (err) {
      console.error('Erro ao obter todos os arquivos locais:', err.message);
      
      // Fallback para dados de exemplo
      return [
        {
          path: 'sample.js',
          content: '// sample.js - Exemplo de arquivo para análise\nconsole.log("Este é um exemplo de arquivo para análise pelo GPT.");\n'
        },
        {
          path: 'mock_data.json',
          content: '{"name": "Mock Data", "type": "example"}'
        }
      ];
    }
  }

  // Modo SSH
  console.log(`Getting all files content from: ${basePath}`);
  const sftp = new SftpClient();
  const result = [];
  
  try {
    await sftp.connect(sshConfig);
    
    // Recursively get files in directory
    async function processDirectory(currentPath) {
      const list = await sftp.list(currentPath);
      
      for (const item of list) {
        // Skip . and .. entries
        if (item.name === '.' || item.name === '..') continue;
        
        const itemPath = `${currentPath}${item.name}`;
        const relativePath = itemPath.replace(basePath, '');
        
        if (item.type === 'd') {
          // This is a directory, recurse into it
          await processDirectory(`${itemPath}/`);
        } else {
          // This is a file, get its content
          try {
            const content = await sftp.get(itemPath);
            result.push({
              path: relativePath,
              content: content.toString('utf8')
            });
          } catch (fileErr) {
            console.error(`Error reading file ${itemPath}:`, fileErr.message);
            // Add error message instead of content
            result.push({
              path: relativePath,
              content: `ERROR: Could not read file (${fileErr.message})`
            });
          }
        }
      }
    }
    
    // Start processing from the base path
    await processDirectory(basePath);
    return result;
    
  } catch (err) {
    console.error('Error getting all files:', err.message);
    throw err;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
      }
    } catch (err) {
      console.error('Error closing SFTP connection:', err.message);
    }
  }
}

/**
 * Format all files with their paths and content
 * @param {Array} files - Array of {path, content} objects
 * @returns {string} Formatted string representation of all files
 */
function formatAllFilesContent(files) {
  let result = '';
  
  result += `# Estrutura de Arquivos do Projeto\n\n`;
  result += `Total de arquivos: ${files.length}\n\n`;
  
  // Group files by directory
  const fileGroups = {};
  
  files.forEach(file => {
    const dir = file.path.includes('/') 
      ? file.path.substring(0, file.path.lastIndexOf('/'))
      : '';
    
    if (!fileGroups[dir]) {
      fileGroups[dir] = [];
    }
    
    fileGroups[dir].push(file);
  });
  
  // Process directory groups in order
  const dirs = Object.keys(fileGroups).sort();
  
  for (const dir of dirs) {
    if (dir) {
      result += `\n## Diretório: ${dir}\n\n`;
    } else {
      result += `\n## Diretório Raiz\n\n`;
    }
    
    // Process files in this directory
    for (const file of fileGroups[dir]) {
      const fileName = file.path.includes('/') 
        ? file.path.substring(file.path.lastIndexOf('/') + 1)
        : file.path;
      
      result += `### Arquivo: ${fileName}\n`;
      result += '```\n';
      result += file.content;
      result += '\n```\n\n';
    }
  }
  
  return result;
}

/**
 * Get the content of a remote file
 * @param {string} filename - Name of the file to read
 * @returns {Promise<string>} Content of the file
 */
async function getRemoteFileContent(filename) {
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Lendo arquivo local: ${filename}`);
    try {
      const filePath = path.join(LOCAL_DIR, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filename}`);
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      return content;
    } catch (err) {
      console.error(`Erro ao ler arquivo local ${filename}:`, err.message);
      throw err;
    }
  }

  // Modo SSH
  console.log(`Iniciando getRemoteFileContent() para o arquivo: ${filename}`);
  
  // Create a new instance each time to prevent connection issues
  const sftp = new SftpClient();
  
  try {
    console.log(`Connecting to retrieve file: ${filename}`);
    await sftp.connect(sshConfig);
    
    const filePath = `${REMOTE_DIR}${filename}`;
    console.log(`Checking if file exists: ${filePath}`);
    
    // Check if file exists
    const fileExists = await sftp.exists(filePath);
    if (!fileExists) {
      throw new Error(`File ${filename} does not exist on the remote server`);
    }
    
    console.log('File exists, retrieving content...');
    // Get content as string
    const content = await sftp.get(filePath);
    console.log(`Retrieved file content (${content.length} bytes)`);
    return content.toString('utf8');
  } catch (err) {
    console.error(`Error getting content of remote file ${filename}:`, err.message);
    throw err;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
        console.log('SFTP connection closed');
      }
    } catch (err) {
      console.error('Error closing SFTP connection:', err.message);
    }
  }
}

/**
 * Upload a file to the remote server
 * @param {Object} file - File object from multer
 * @param {string} targetPath - Optional target path for the file
 * @returns {Promise<boolean>} Success status
 */
async function uploadToRemoteServer(file, targetPath = '') {
  // Se devemos usar pasta local
  if (useLocalFolder()) {
    console.log(`Modo ${isDevMode() ? 'desenvolvimento' : 'overridden'}: Salvando arquivo localmente: ${file.originalname}`);
    try {
      // Garantir que o diretório local base existe
      if (!fs.existsSync(LOCAL_DIR)) {
        console.log('Criando diretório local base:', LOCAL_DIR);
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
      
      // Verificar se o arquivo temporário existe
      if (!fs.existsSync(file.path)) {
        throw new Error(`Arquivo temporário não encontrado: ${file.path}`);
      }
      
      // Destino do arquivo
      const destPath = path.join(fullTargetDir, file.originalname);
      console.log('Copiando arquivo para:', destPath);
      
      fs.copyFileSync(file.path, destPath);
      console.log('Arquivo salvo localmente com sucesso');
      return true;
    } catch (err) {
      console.error(`Erro ao salvar arquivo localmente ${file.originalname}:`, err.message);
      throw err;
    }
  }

  // Modo SSH
  console.log(`Iniciando uploadToRemoteServer() para o arquivo: ${file.originalname}`);
  
  // Create a new instance each time to prevent connection issues
  const sftp = new SftpClient();
  
  try {
    console.log(`Connecting to upload file: ${file.originalname}`);
    await sftp.connect(sshConfig);
    
    // Determine full remote path
    let fullRemotePath;
    if (targetPath) {
      // For folder uploads with specific target path
      const cleanTargetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;
      // Ensure the target directory exists by ending with /
      const remoteTargetDir = `${REMOTE_DIR}${cleanTargetPath}/`;
      
      // Ensure the target directory exists
      const dirExists = await sftp.exists(remoteTargetDir);
      if (!dirExists) {
        console.log(`Creating remote directory: ${remoteTargetDir}`);
        await sftp.mkdir(remoteTargetDir, true);
      }
      
      fullRemotePath = `${remoteTargetDir}${file.originalname}`;
    } else {
      // Regular file upload to root
      fullRemotePath = `${REMOTE_DIR}${file.originalname}`;
    }
    
    console.log(`Uploading to: ${fullRemotePath}`);
    
    // Verificar se o arquivo existe
    console.log('Verificando se o arquivo local existe:', file.path);
    if (!fs.existsSync(file.path)) {
      throw new Error(`Arquivo local não encontrado: ${file.path}`);
    }
    
    // Check if the uploaded item is a directory
    const stats = fs.statSync(file.path);
    if (stats.isDirectory()) {
      console.log(`Uploaded item is a directory: ${file.originalname}`);
      
      // If target path is provided, use it
      const remoteDirPath = targetPath 
        ? `${REMOTE_DIR}${targetPath.startsWith('/') ? targetPath.substring(1) : targetPath}/${file.originalname}`
        : `${REMOTE_DIR}${file.originalname}`;
        
      // Create directory on remote server
      await sftp.mkdir(remoteDirPath, true);
      return true;
    }
    
    // Upload the file
    await sftp.put(file.path, fullRemotePath);
    console.log('File uploaded successfully to:', fullRemotePath);
    return true;
  } catch (err) {
    console.error(`Error uploading file ${file.originalname}:`, err.message);
    throw err;
  } finally {
    try {
      if (sftp && sftp.end) {
        await sftp.end();
        console.log('SFTP connection closed');
      }
    } catch (err) {
      console.error('Error closing SFTP connection:', err.message);
    }
  }
}

/**
 * Execute a command on the remote server
 * @param {string} command - Command to execute
 * @returns {Promise<Object>} Object containing stdout and stderr
 */
function executeRemoteCommand(command) {
  // Se devemos usar pasta local, essa função não é suportada
  if (useLocalFolder()) {
    console.log('Modo local: Comando remoto não é suportado');
    return Promise.resolve({
      code: 0,
      stdout: 'Comando simulado (modo local)',
      stderr: ''
    });
  }

  // Modo SSH
  return new Promise((resolve, reject) => {
    console.log(`Executing remote command: ${command}`);
    const conn = new Client();
    
    // Set up connection events
    conn.on('ready', () => {
      console.log('SSH connection ready for command execution');
      conn.exec(command, (err, stream) => {
        if (err) {
          console.error('Error executing command:', err.message);
          conn.end();
          return reject(err);
        }
        
        let stdout = '';
        let stderr = '';
        
        stream.on('close', (code, signal) => {
          console.log(`Command execution completed with code ${code}`);
          conn.end();
          resolve({ code, stdout, stderr });
        });
        
        stream.on('data', (data) => {
          stdout += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    }).on('error', (err) => {
      console.error('SSH connection error:', err.message);
      reject(err);
    }).on('end', () => {
      console.log('SSH connection ended');
    }).on('close', (hadError) => {
      console.log(`SSH connection closed${hadError ? ' with error' : ''}`);
    }).connect(sshConfig);
  });
}

/**
 * Ping the SSH server to verify connection
 * @returns {Promise<boolean>} Connection status
 */
async function testSshConnection() {
  // Se devemos usar pasta local, não precisamos testar o SSH
  if (useLocalFolder() && isDevMode()) {
    console.log('Modo desenvolvimento com pasta local: Simulando teste de conexão SSH bem-sucedido');
    return Promise.resolve(true);
  }

  // Para produção ou quando forçando SSH, realiza o teste real
  console.log('Iniciando testSshConnection()');
  console.log('Configuração SSH atual:', sshConfig.host, sshConfig.port, sshConfig.username);
  
  const conn = new Client();
  
  return new Promise((resolve) => {
    console.log('Testing SSH connection...');
    
    // Set a connection timeout
    const timeout = setTimeout(() => {
      console.error('SSH connection test timed out');
      if (conn) conn.end();
      resolve(false);
    }, 10000);
    
    conn.on('ready', () => {
      console.log('SSH connection test successful');
      clearTimeout(timeout);
      conn.end();
      resolve(true);
    }).on('error', (err) => {
      console.error('SSH connection test failed:', err.message);
      clearTimeout(timeout);
      resolve(false);
    }).connect(sshConfig);
  });
}

module.exports = {
  sshConfig,
  DEFAULT_SSH_HOST,
  DEFAULT_SSH_PORT,
  DEFAULT_REMOTE_DIR,
  DEFAULT_LOCAL_DIR,
  REMOTE_DIR,
  LOCAL_DIR,
  listRemoteFiles,
  getRemoteFileContent,
  uploadToRemoteServer,
  executeRemoteCommand,
  testSshConnection,
  updateSshConfig,
  getSshConfig,
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
  getFolderStructure
};