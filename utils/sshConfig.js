const { Client } = require('ssh2');
const SftpClient = require('ssh2-sftp-client');
const dotenv = require('dotenv');

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Valores padrão para a configuração SSH
const DEFAULT_SSH_HOST = '104.238.145.89';
const DEFAULT_SSH_PORT = 22;
const DEFAULT_REMOTE_DIR = '/home/tracklead-chat/htdocs/files-chat.tracklead.com/files/';

// SSH connection configuration - lendo do .env para credenciais e usando valores padrão para o resto
const sshConfig = {
  host: DEFAULT_SSH_HOST,
  port: DEFAULT_SSH_PORT,
  username: process.env.SSH_USERNAME || '',
  password: process.env.SSH_PASSWORD || '',
  readyTimeout: 20000,
  keepaliveInterval: 5000,
  keepaliveCountMax: 3,
  algorithms: {
    kex: [
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
    ]
  }
};

// Remote directory path
let REMOTE_DIR = DEFAULT_REMOTE_DIR;

/**
 * Tenta carregar configurações do localStorage (no navegador) se disponível
 */
function loadLocalSettings() {
  if (typeof localStorage !== 'undefined') {
    try {
      const savedConfig = JSON.parse(localStorage.getItem('sshConfig') || '{}');
      if (savedConfig.host) sshConfig.host = savedConfig.host;
      if (savedConfig.port) sshConfig.port = parseInt(savedConfig.port, 10);
      if (savedConfig.remoteDir) REMOTE_DIR = savedConfig.remoteDir;
      console.log('Configurações SSH carregadas do localStorage');
    } catch (err) {
      console.error('Erro ao carregar configurações do localStorage:', err.message);
    }
  }
}

// Tentar carregar configurações do localStorage
try {
  loadLocalSettings();
} catch (err) {
  console.error('Erro ao inicializar configurações SSH:', err.message);
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
    remoteDir: REMOTE_DIR
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
 * List files in the remote directory
 * @returns {Promise<Array>} List of filenames
 */
async function listRemoteFiles() {
  // In browser environment, always return mock data
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    console.log('Browser or development environment detected, returning mock files');
    return ['example.js', 'test.html', 'style.css', 'sample.js'];
  }
  
  // Create a new instance each time to prevent connection issues
  const sftp = new SftpClient();
  
  try {
    console.log('Attempting to connect to SSH server...');
    await sftp.connect(sshConfig);
    console.log('Connected to SSH server successfully');
    
    console.log(`Listing files in directory: ${REMOTE_DIR}`);
    const fileList = await sftp.list(REMOTE_DIR);
    console.log(`Found ${fileList.length} items in the directory`);
    
    // Filter only files (not directories)
    const files = fileList
      .filter(item => item.type === '-')
      .map(item => item.name);
    
    console.log(`Filtered to ${files.length} files`);
    return files;
  } catch (err) {
    console.error('Error in listRemoteFiles:', err.message);
    // Return mock files for development or if connection fails
    return ['example.js', 'test.html', 'style.css', 'sample.js'];
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
 * Get the content of a remote file
 * @param {string} filename - Name of the file to read
 * @returns {Promise<string>} Content of the file
 */
async function getRemoteFileContent(filename) {
  // In browser environment or for development, return mock content or try to read local file
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    console.log('Browser or development environment detected, returning mock content');
    
    // If filename is sample.js, try to read from the local files directory
    if (filename === 'sample.js') {
      try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', 'files', 'sample.js');
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath, 'utf8');
        }
      } catch (err) {
        console.error('Error reading local file:', err.message);
      }
    }
    
    // Return mock content based on file extension
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'js') {
      return `// Mock content for ${filename}\nconsole.log("This is a mock file for development");`;
    } else if (ext === 'html') {
      return `<!DOCTYPE html>\n<html>\n<head>\n  <title>Mock HTML</title>\n</head>\n<body>\n  <h1>Mock HTML Content</h1>\n</body>\n</html>`;
    } else if (ext === 'css') {
      return `/* Mock CSS for ${filename} */\nbody {\n  font-family: sans-serif;\n  color: #333;\n}`;
    } else {
      return `Mock content for ${filename}`;
    }
  }
  
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
    
    // Return mock content if connection fails
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'js') {
      return `// Mock content for ${filename}\nconsole.log("This is a mock file for development");`;
    } else if (ext === 'html') {
      return `<!DOCTYPE html>\n<html>\n<head>\n  <title>Mock HTML</title>\n</head>\n<body>\n  <h1>Mock HTML Content</h1>\n</body>\n</html>`;
    } else if (ext === 'css') {
      return `/* Mock CSS for ${filename} */\nbody {\n  font-family: sans-serif;\n  color: #333;\n}`;
    } else {
      return `Mock content for ${filename}`;
    }
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
 * @returns {Promise<boolean>} Success status
 */
async function uploadToRemoteServer(file) {
  // In browser environment, simulate successful upload
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    console.log('Browser or development environment detected, simulating upload');
    return true;
  }
  
  // Create a new instance each time to prevent connection issues
  const sftp = new SftpClient();
  
  try {
    console.log(`Connecting to upload file: ${file.originalname}`);
    await sftp.connect(sshConfig);
    
    const remoteFilePath = `${REMOTE_DIR}${file.originalname}`;
    console.log(`Uploading to: ${remoteFilePath}`);
    
    // Upload the file
    await sftp.put(file.path, remoteFilePath);
    console.log('File uploaded successfully');
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
  // In browser environment, simulate successful command execution
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    console.log('Browser or development environment detected, simulating command execution');
    return Promise.resolve({ code: 0, stdout: 'Mock command output', stderr: '' });
  }
  
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
  // In browser environment, simulate failed connection
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    console.log('Browser or development environment detected, simulating SSH connection test');
    return false;
  }
  
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
  REMOTE_DIR,
  listRemoteFiles,
  getRemoteFileContent,
  uploadToRemoteServer,
  executeRemoteCommand,
  testSshConnection,
  updateSshConfig,
  getSshConfig,
  updateRemoteDir
};