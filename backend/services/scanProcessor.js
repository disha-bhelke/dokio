const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const scriptPath = path.join(__dirname, '..', 'scripts', 'scan_document.py');
const python311Path = 'C:/Users/DISHA/AppData/Local/Programs/Python/Python311/python.exe';

const pythonCandidates = process.env.PYTHON_BIN
  ? [{ command: process.env.PYTHON_BIN, prefix: [] }]
  : process.platform === 'win32'
    ? [
        { command: 'python', prefix: [] },
        { command: 'python3', prefix: [] },
        { command: 'py', prefix: [] },
        { command: 'py', prefix: ['-3.11'] },
      ]
    : [
        { command: 'python3', prefix: [] },
        { command: 'python', prefix: [] },
      ];

const fallbackScanProcessing = async ({ imageBuffer, corners = null }) => {
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  // Default corners if Python is unavailable in cloud host
  const defaultCorners = [
    { x: 40, y: 40 },
    { x: 760, y: 40 },
    { x: 760, y: 960 },
    { x: 40, y: 960 },
  ];

  return {
    corners: corners || defaultCorners,
    previewDataUrl: dataUrl,
    previewWidth: 800,
    previewHeight: 1000,
  };
};

const runPythonProcessor = async ({ imagePath, corners, blackAndWhite }) => {
  const args = [scriptPath, '--image', imagePath];

  if (corners) {
    args.push('--corners', JSON.stringify(corners));
  }

  if (blackAndWhite) {
    args.push('--black-and-white');
  }

  let lastError = null;

  for (const candidate of pythonCandidates) {
    try {
      const { stdout } = await execFileAsync(
        candidate.command,
        [...candidate.prefix, ...args],
        { maxBuffer: 20 * 1024 * 1024 }
      );

      const output = stdout.trim();
      if (!output) {
        throw new Error('Python scan processor returned no output');
      }

      return JSON.parse(output);
    } catch (error) {
      const stderr = error.stderr ? String(error.stderr).trim() : '';
      const message = stderr || error.message || 'Python scan processing failed';
      lastError = new Error(message);
      continue;
    }
  }

  throw lastError || new Error('Python executable not found');
};

const processScanImage = async ({ imageBuffer, corners = null, blackAndWhite = false }) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dokioo-scan-'));
  const imagePath = path.join(tempDir, 'input.jpg');

  try {
    await fs.writeFile(imagePath, imageBuffer);

    return await runPythonProcessor({
      imagePath,
      corners,
      blackAndWhite,
    });
  } catch (pythonErr) {
    console.warn('Python scan processor failed, using fallback:', pythonErr.message);
    return await fallbackScanProcessing({ imageBuffer, corners });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

module.exports = { processScanImage };
