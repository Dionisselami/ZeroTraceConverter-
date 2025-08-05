const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const Tesseract = require('tesseract.js');
const os = require('os');
const path = require('path');

const app = express();

// Configure multer with file size limit (10MB)
const upload = multer({ 
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15, // 15 requests per hour per IP
  message: "Too many requests from this IP, please try again in an hour."
});

app.use(limiter);

// Handle file size limit errors
app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.send(errorPage('File too large. Maximum file size is 10MB.'));
  }
  next(error);
});

const PORT = process.env.PORT || 3001;

// Find LibreOffice executable path
function getLibreOfficePath() {
  const possiblePaths = [
    '"C:\\Program Files\\LibreOffice\\program\\soffice.exe"',
    '"C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"',
    'soffice' // fallback to system PATH
  ];
  
  return possiblePaths[0]; // Try the most common path first
}

// File type validation function
function validateFileType(file, allowedTypes) {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;
  
  return allowedTypes.some(type => {
    if (type.startsWith('.')) {
      return fileExtension === type;
    } else {
      return mimeType.includes(type);
    }
  });
}

// Error page function
function errorPage(msg) {
  return `
    <!DOCTYPE html>
    <html lang="en"><head>
    <meta charset="UTF-8"><title>Conversion Error</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-primary: #f2f6fa;
        --bg-secondary: #ffffff;
        --text-primary: #242424;
        --text-secondary: #396080;
        --border-color: #d9e8f6;
        --shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
        --error-bg: #fff4f4;
        --error-border: #ffdede;
        --error-text: #e74c3c;
      }
      [data-theme="dark"] {
        --bg-primary: #0f1419;
        --bg-secondary: #1a1f2e;
        --text-primary: #e8eaed;
        --text-secondary: #9aa0a6;
        --border-color: #2d3748;
        --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        --error-bg: #2d1a1a;
        --error-border: #5a2d2d;
        --error-text: #fc8181;
      }
      body {background: var(--bg-primary); color: var(--text-primary); font-family:'Inter', Arial, sans-serif; margin: 0; padding: 0; transition: all 0.3s ease;}
      .container{max-width:450px;margin:3rem auto;background: var(--bg-secondary);border-radius:10px;box-shadow: var(--shadow);padding:2rem; transition: all 0.3s ease;}
      .error-message{color: var(--error-text);background: var(--error-bg);border:1px solid var(--error-border);padding:.7rem 1rem;border-radius:6px;margin-bottom:1rem;text-align:center;}
      a { color: #4f8cff; text-decoration: none; font-weight: 600;}
      .theme-toggle {position: absolute; top: 20px; right: 20px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 50px; padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-secondary); transition: all 0.3s ease;}
    </style>
    <script>
      let currentTheme = 'auto';
      function setTheme(theme) {
        currentTheme = theme;
        const themeText = document.getElementById('theme-text');
        if (theme === 'auto') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
          themeText.textContent = 'Auto';
        } else {
          document.documentElement.setAttribute('data-theme', theme);
          themeText.textContent = theme === 'dark' ? 'Dark' : 'Light';
        }
        localStorage.setItem('theme', theme);
      }
      function toggleTheme() {
        const themes = ['auto', 'light', 'dark'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        setTheme(nextTheme);
      }
      const savedTheme = localStorage.getItem('theme') || 'auto';
      setTheme(savedTheme);
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme === 'auto') setTheme('auto');
      });
    </script>
    </head><body>
    <div class="theme-toggle" onclick="toggleTheme()">
      <span class="theme-icon">🌓</span>
      <span id="theme-text">Auto</span>
    </div>
    <div class="container">
      <div class="error-message">${msg}</div>
      <a href="/">&#8592; Back to Home</a>
    </div></body></html>
  `;
}

// Success page function
function successPage(fileName, downloadUrl, conversionType) {
  return `
    <!DOCTYPE html>
    <html lang="en"><head>
    <meta charset="UTF-8"><title>Conversion Complete!</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-primary: #f2f6fa;
        --bg-secondary: #ffffff;
        --text-primary: #242424;
        --text-secondary: #396080;
        --text-muted: #8eb7d1;
        --border-color: #d9e8f6;
        --shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
        --gradient-primary: linear-gradient(90deg, #4f8cff 0%, #235bc5 100%);
        --success-bg: #e9fbe8;
        --success-border: #bce6b7;
        --success-text: #15803d;
      }
      [data-theme="dark"] {
        --bg-primary: #0f1419;
        --bg-secondary: #1a1f2e;
        --text-primary: #e8eaed;
        --text-secondary: #9aa0a6;
        --text-muted: #5f6368;
        --border-color: #2d3748;
        --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        --gradient-primary: linear-gradient(90deg, #4f8cff 0%, #6fa8ff 100%);
        --success-bg: #1a2e1a;
        --success-border: #2d5a2d;
        --success-text: #68d391;
      }
      body {background: var(--bg-primary); color: var(--text-primary); font-family:'Inter', Arial, sans-serif; margin: 0; padding: 0; transition: all 0.3s ease;}
      .container{max-width:500px;margin:3rem auto;background: var(--bg-secondary);border-radius:12px;box-shadow: var(--shadow);padding:2.5rem 2rem; text-align: center; transition: all 0.3s ease;}
      h1 {font-family: 'Montserrat', Arial, sans-serif; font-size: 2.2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;}
      .success-icon {font-size: 4rem; margin-bottom: 1rem; animation: bounce 1s ease-in-out;}
      .success-message{color: var(--success-text);background: var(--success-bg);border:1px solid var(--success-border);padding:1rem;border-radius:8px;margin-bottom:2rem;}
      .download-button {background: var(--gradient-primary); color: white; padding: 1rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 1.1rem; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.3s ease; margin: 1rem 0; box-shadow: 0 4px 16px rgba(79,140,255,0.2);}
      .download-button:hover {transform: translateY(-3px); box-shadow: 0 8px 24px rgba(79,140,255,0.3);}
      .btn-secondary {background: transparent; border: 2px solid var(--border-color); color: var(--text-secondary); padding: .8rem 2rem; border-radius: 7px; font-weight: 600; text-decoration: none; display: inline-block; margin: 0.5rem; transition: all 0.3s ease;}
      .btn-secondary:hover {border-color: #4f8cff; color: #4f8cff; transform: translateY(-2px);}
      .theme-toggle {position: absolute; top: 20px; right: 20px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 50px; padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-secondary); transition: all 0.3s ease;}
      @keyframes bounce {0%, 20%, 60%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 80% { transform: translateY(-5px); }}
    </style>
    <script>
      let currentTheme = 'auto';
      function setTheme(theme) {
        currentTheme = theme;
        const themeText = document.getElementById('theme-text');
        if (theme === 'auto') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
          themeText.textContent = 'Auto';
        } else {
          document.documentElement.setAttribute('data-theme', theme);
          themeText.textContent = theme === 'dark' ? 'Dark' : 'Light';
        }
        localStorage.setItem('theme', theme);
      }
      function toggleTheme() {
        const themes = ['auto', 'light', 'dark'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        setTheme(nextTheme);
      }
      const savedTheme = localStorage.getItem('theme') || 'auto';
      setTheme(savedTheme);
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme === 'auto') setTheme('auto');
      });
    </script>
    </head><body>
    <div class="theme-toggle" onclick="toggleTheme()">
      <span class="theme-icon">🌓</span>
      <span id="theme-text">Auto</span>
    </div>
    <div class="container">
      <div class="success-icon">🎉</div>
      <h1>Conversion Complete!</h1>
      <div class="success-message">
        Your ${conversionType} conversion was successful!<br>
        <strong>${fileName}</strong> is ready for download.
      </div>
      <a href="${downloadUrl}" class="download-button" download>
        📥 Download File
      </a>
      <div style="margin-top: 2rem;">
        <a href="/" class="btn-secondary">🔄 Convert Another File</a>
      </div>
    </div></body></html>
  `;
}

// Home Page with three ad placeholders
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Open Source File Converter</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-primary: #f2f6fa;
          --bg-secondary: #ffffff;
          --text-primary: #242424;
          --text-secondary: #396080;
          --text-muted: #8eb7d1;
          --border-color: #d9e8f6;
          --shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
          --gradient-primary: linear-gradient(90deg, #4f8cff 0%, #235bc5 100%);
          --gradient-secondary: linear-gradient(90deg, #e3edf7 0%, #f7fafd 100%);
          --ad-border: #bcdffb;
          --success-bg: #e9fbe8;
          --success-border: #bce6b7;
          --success-text: #15803d;
          --error-bg: #fff4f4;
          --error-border: #ffdede;
          --error-text: #e74c3c;
        }

        [data-theme="dark"] {
          --bg-primary: #0f1419;
          --bg-secondary: #1a1f2e;
          --text-primary: #e8eaed;
          --text-secondary: #9aa0a6;
          --text-muted: #5f6368;
          --border-color: #2d3748;
          --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
          --gradient-primary: linear-gradient(90deg, #4f8cff 0%, #6fa8ff 100%);
          --gradient-secondary: linear-gradient(90deg, #2a2d3a 0%, #1a1f2e 100%);
          --ad-border: #4a5568;
          --success-bg: #1a2e1a;
          --success-border: #2d5a2d;
          --success-text: #68d391;
          --error-bg: #2d1a1a;
          --error-border: #5a2d2d;
          --error-text: #fc8181; 
        }

        body {
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Inter', Arial, sans-serif;
          margin: 0; padding: 0;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        .container {
          max-width: 500px;
          margin: 3rem auto 1rem auto;
          background: var(--bg-secondary);
          border-radius: 12px;
          box-shadow: var(--shadow);
          padding: 2.5rem 2rem 2rem 2rem;
          transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        
        .theme-toggle {
          position: absolute;
          top: 20px;
          right: 20px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 50px;
          padding: 8px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          transition: all 0.3s ease;
          z-index: 1000;
        }
        
        .theme-toggle:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }
        
        .theme-icon {
          font-size: 16px;
          transition: transform 0.3s ease;
        }
        
        .theme-toggle:hover .theme-icon {
          transform: rotate(180deg);
        }
        h1 {
          font-family: 'Montserrat', Arial, sans-serif;
          font-size: 2.2rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -1px;
          margin-bottom: 1rem;
          text-align: center;
        }
        .ad-placeholder {
          background: var(--gradient-secondary);
          border: 1px dashed var(--ad-border);
          color: var(--text-muted);
          text-align: center;
          padding: 0.8rem;
          margin-bottom: 1.5rem;
          border-radius: 7px;
          transition: all 0.3s ease;
        }
        label {
          font-weight: 600;
          margin-bottom: .4rem;
          color: var(--text-secondary);
        }
        .form-control, .form-select {
          width: 100%;
          padding: .7rem;
          border-radius: 7px;
          border: 1px solid var(--border-color);
          margin-bottom: 1.2rem;
          font-size: 1rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
          transition: all 0.3s ease;
        }
        .form-control:focus, .form-select:focus {
          outline: none;
          border-color: #4f8cff;
          box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
        }
        .form-control[type="file"] {
          padding: .3rem 0;
        }
        .btn-primary {
          background: var(--gradient-primary);
          border: none;
          color: #fff;
          padding: .8rem 2rem;
          font-size: 1.1rem;
          border-radius: 7px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(79,140,255,0.08);
          width: 100%;
        }
        .btn-primary:hover {
          background: linear-gradient(90deg,#235bc5 0%,#4f8cff 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(79,140,255,0.15);
        }
        
        .btn-secondary {
          background: transparent;
          border: 2px solid var(--border-color);
          color: var(--text-secondary);
          padding: .8rem 2rem;
          font-size: 1.1rem;
          border-radius: 7px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          text-align: center;
          margin-top: 1rem;
        }
        
        .btn-secondary:hover {
          border-color: #4f8cff;
          color: #4f8cff;
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(79,140,255,0.1);
        }
        .nav-links {
          text-align: center;
          margin: 2rem 0 0 0;
        }
        .nav-links a {
          color: #4f8cff;
          text-decoration: none;
          margin: 0 0.5rem;
          font-weight: 600;
          transition: color 0.3s ease;
        }
        .nav-links a:hover { 
          text-decoration: underline;
          color: #235bc5;
        }
        .footer {
          text-align: center;
          color: var(--text-muted);
          margin-top: 2rem;
          font-size: 0.95em;
        }
        .progress-spinner {
          display: none;
          margin: 1.2rem auto 0 auto;
          text-align: center;
        }
        .lds-dual-ring {
          display: inline-block;
          width: 40px;
          height: 40px;
        }
        .lds-dual-ring:after {
          content: " ";
          display: block;
          width: 32px;
          height: 32px;
          margin: 4px;
          border-radius: 50%;
          border: 4px solid #4f8cff;
          border-color: #4f8cff transparent #4f8cff transparent;
          animation: lds-dual-ring 1s linear infinite;
        }
        @keyframes lds-dual-ring {
          0% { transform: rotate(0deg);}
          100% { transform: rotate(360deg);}
        }
        .error-message {
          color: var(--error-text);
          background: var(--error-bg);
          border: 1px solid var(--error-border);
          padding: .7rem 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          text-align: center;
        }
        .success-message {
          color: var(--success-text);
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          padding: .7rem 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          text-align: center;
        }
        
        .success-container {
          text-align: center;
          padding: 2rem 0;
        }
        
        .success-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          animation: bounce 1s ease-in-out;
        }
        
        .download-button {
          background: var(--gradient-primary);
          color: white;
          padding: 1rem 2rem;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1.1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
          margin: 1rem 0;
          box-shadow: 0 4px 16px rgba(79,140,255,0.2);
        }
        
        .download-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(79,140,255,0.3);
        }
        
        @keyframes bounce {
          0%, 20%, 60%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          80% { transform: translateY(-5px); }
        }
        @media (max-width:600px) {
          .container { padding: 1.5rem 0.5rem 1.5rem 0.5rem;}
        }
      </style>
    </head>
    <body>
      <div class="theme-toggle" onclick="toggleTheme()">
        <span class="theme-icon">🌓</span>
        <span id="theme-text">Auto</span>
      </div>
      <div class="container">
        <h1>🔓 File Converter</h1>
        <div class="ad-placeholder" id="ad-top">
          [Ad Placeholder - Top Banner]
        </div>
        <form id="convertForm" action="/convert" method="post" enctype="multipart/form-data">
          <label>Choose file(s):</label>
          <input type="file" name="files" class="form-control" multiple required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif">
          <div style="font-size: 0.85em; color: var(--text-muted); margin-top: -0.8rem; margin-bottom: 1rem;">
            Maximum file size: 10MB per file
          </div>
          
          <!-- In-Form Ad -->
          <div class="ad-placeholder" id="ad-inform" style="margin:1rem 0;">
            [Ad Placeholder - In Form]
          </div>

          <label>Conversion type:</label>
          <select name="type" class="form-select" required id="conversionType">
            <option value="pdf2word">PDF to Word</option>
            <option value="word2pdf">Word to PDF</option>
            <option value="img2pdf">Image to PDF</option>
            <option value="pdf2img">PDF to Image</option>
            <option value="excel2pdf">Excel to PDF</option>
            <option value="pdf2excel">PDF to Excel</option>
            <option value="mergepdf">Merge PDFs</option>
            <option value="splitpdf">Split PDF (each page)</option>
            <option value="compresspdf">Compress PDF</option>
            <option value="ocr">OCR (extract text from PDF/Image)</option>
          </select>
          <button type="submit" class="btn-primary w-100">Convert</button>
          <div class="progress-spinner" id="spinner">
            <div class="lds-dual-ring"></div>
            <div style="margin-top: .6rem; color:#396080;">Processing...</div>
          </div>
        </form>
        <!-- Bottom Ad -->
        <div class="ad-placeholder" id="ad-bottom" style="margin-top:1.5rem;">
          [Ad Placeholder - Bottom Banner]
        </div>
        <div class="nav-links">
          <a href="/privacy">Privacy</a> | <a href="https://github.com/Dionisselami/file-converter" target="_blank">Open Source on GitHub</a>
        </div>
      </div>
      <div class="footer">
        No signup, no tracking, no files stored. All processing done locally. <br>
        <span style="font-size:.97em;">Rate limited for fairness. Maximum 10MB per file.<br>Made with ❤️ for privacy and efficiency.</span>
      </div>
      <script>
        // Theme management
        let currentTheme = 'auto';
        
        function setTheme(theme) {
          currentTheme = theme;
          const themeText = document.getElementById('theme-text');
          
          if (theme === 'auto') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            themeText.textContent = 'Auto';
          } else {
            document.documentElement.setAttribute('data-theme', theme);
            themeText.textContent = theme === 'dark' ? 'Dark' : 'Light';
          }
          
          localStorage.setItem('theme', theme);
        }
        
        function toggleTheme() {
          const themes = ['auto', 'light', 'dark'];
          const currentIndex = themes.indexOf(currentTheme);
          const nextTheme = themes[(currentIndex + 1) % themes.length];
          setTheme(nextTheme);
        }
        
        // Initialize theme
        const savedTheme = localStorage.getItem('theme') || 'auto';
        setTheme(savedTheme);
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (currentTheme === 'auto') {
            setTheme('auto');
          }
        });
        
        // Form submission with spinner
        document.getElementById('convertForm').addEventListener('submit', function() {
          document.getElementById('spinner').style.display = 'block';
        });
        
        // Dynamic file type restrictions
        const fileInput = document.querySelector('input[type="file"]');
        const conversionType = document.getElementById('conversionType');
        
        const fileTypeMap = {
          'pdf2word': '.pdf',
          'word2pdf': '.doc,.docx',
          'img2pdf': '.jpg,.jpeg,.png,.gif',
          'pdf2img': '.pdf',
          'excel2pdf': '.xls,.xlsx',
          'pdf2excel': '.pdf',
          'mergepdf': '.pdf',
          'splitpdf': '.pdf',
          'compresspdf': '.pdf',
          'ocr': '.jpg,.jpeg,.png,.pdf'
        };
        
        conversionType.addEventListener('change', function() {
          const selectedType = this.value;
          fileInput.setAttribute('accept', fileTypeMap[selectedType] || '*');
        });
        
        // Set initial accept attribute
        fileInput.setAttribute('accept', fileTypeMap[conversionType.value] || '*');
      </script>
    </body>
    </html>
  `);
});

// Privacy Page
app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Privacy Policy</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        body {
          background: #f2f6fa; font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0;
        }
        .container {
          max-width: 520px; margin: 3rem auto 2rem auto; background: #fff; border-radius: 12px;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07); padding: 2.5rem 2rem 2rem 2rem;
        }
        h1 { color: #242424; font-size: 2rem; font-family: 'Montserrat', Arial, sans-serif; }
        a { color: #4f8cff; text-decoration: none; font-weight: 600;}
        a:hover { text-decoration: underline;}
        ul { color: #396080;}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔒 Privacy Policy</h1>
        <ul>
          <li>We <b>do not</b> store your files. All processing is done in memory and files are deleted after conversion.</li>
          <li>No signup, no tracking, no cookies (except essential). </li>
          <li>Open source for full transparency.</li>
          <li>Rate limited only to prevent abuse.</li>
        </ul>
        <div style="margin-top:1.3rem;"><a href="/">&#8592; Back to Home</a></div>
      </div>
    </body>
    </html>
  `);
});

// Download route for converted files
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(os.tmpdir(), filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, () => {
      // Clean up file after download
      setTimeout(() => fs.unlink(filePath, () => {}), 5000);
    });
  } else {
    res.status(404).send(errorPage('File not found or has expired.'));
  }
});

// Conversion Route
app.post('/convert', upload.array('files', 10), async (req, res) => {
  const { type } = req.body;
  const files = req.files;
  
  if (!files || files.length === 0) {
    return res.send(errorPage('No file uploaded.'));
  }

  // Validate file types based on conversion type
  const validationRules = {
    'pdf2word': ['.pdf', 'application/pdf'],
    'word2pdf': ['.doc', '.docx', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'img2pdf': ['.jpg', '.jpeg', '.png', '.gif', 'image/'],
    'pdf2img': ['.pdf', 'application/pdf'],
    'excel2pdf': ['.xls', '.xlsx', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    'pdf2excel': ['.pdf', 'application/pdf'],
    'mergepdf': ['.pdf', 'application/pdf'],
    'splitpdf': ['.pdf', 'application/pdf'],
    'compresspdf': ['.pdf', 'application/pdf'],
    'ocr': ['.jpg', '.jpeg', '.png', '.pdf', 'image/', 'application/pdf']
  };

  const allowedTypes = validationRules[type];
  if (allowedTypes) {
    for (const file of files) {
      if (!validateFileType(file, allowedTypes)) {
        cleanup(files.map(f => f.path));
        return res.send(errorPage(`Invalid file type for ${type}. Please upload the correct file format.`));
      }
    }
  }

  try {
    // PDF to Word (requires LibreOffice installed)
    if (type === 'pdf2word') {
      const input = files[0].path;
      const outputFilename = `converted_${Date.now()}.docx`;
      const output = path.join(os.tmpdir(), outputFilename);
      const libreOfficePath = getLibreOfficePath();
      
      await execPromise(`${libreOfficePath} --headless --convert-to docx --outdir ${os.tmpdir()} "${input}"`);
      
      // Rename the output file to our desired name
      const generatedOutput = input + '.docx';
      if (fs.existsSync(generatedOutput)) {
        fs.renameSync(generatedOutput, output);
      }
      
      cleanup([input]);
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'PDF to Word'));
    }

    // Word to PDF
    if (type === 'word2pdf') {
      const input = files[0].path;
      const outputFilename = `converted_${Date.now()}.pdf`;
      const output = path.join(os.tmpdir(), outputFilename);
      const libreOfficePath = getLibreOfficePath();
      await execPromise(`${libreOfficePath} --headless --convert-to pdf --outdir ${os.tmpdir()} "${input}"`);
      
      // Rename the output file to our desired name
      const generatedOutput = input + '.pdf';
      if (fs.existsSync(generatedOutput)) {
        fs.renameSync(generatedOutput, output);
      }
      
      cleanup([input]);
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'Word to PDF'));
    }

    // Image(s) to PDF
    if (type === 'img2pdf') {
      const pdfDoc = await PDFDocument.create();
      for (const file of files) {
        const imgBytes = fs.readFileSync(file.path);
        let image;
        if (file.mimetype === 'image/jpeg') {
          image = await pdfDoc.embedJpg(imgBytes);
        } else if (file.mimetype === 'image/png') {
          image = await pdfDoc.embedPng(imgBytes);
        }
        if (image) {
          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        }
      }
      const pdfBytes = await pdfDoc.save();
      
      const outputFilename = `converted_images_${Date.now()}.pdf`;
      const outputPath = path.join(os.tmpdir(), outputFilename);
      fs.writeFileSync(outputPath, pdfBytes);
      
      cleanup(files.map(f => f.path));
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'Images to PDF'));
    }

    // PDF to Images (returns zip of images)
    if (type === 'pdf2img') {
      const input = files[0].path;
      const libreOfficePath = getLibreOfficePath();
      const tempDir = os.tmpdir();
      
      try {
        // Convert PDF to PNG images using LibreOffice
        await execPromise(`${libreOfficePath} --headless --convert-to png --outdir "${tempDir}" "${input}"`);
        
        // Find generated PNG files
        const baseName = path.basename(input, path.extname(input));
        const pngFiles = fs.readdirSync(tempDir).filter(file => 
          file.startsWith(baseName) && file.endsWith('.png')
        );
        
        if (pngFiles.length > 0) {
          const archiver = require('archiver');
          const outputFilename = `pdf_images_${Date.now()}.zip`;
          const outputPath = path.join(tempDir, outputFilename);
          const output = fs.createWriteStream(outputPath);
          const archive = archiver('zip', { zlib: { level: 9 }});
          
          archive.pipe(output);
          
          for (const pngFile of pngFiles) {
            const pngPath = path.join(tempDir, pngFile);
            archive.file(pngPath, { name: pngFile });
          }
          
          // Wait for the archive to finish
          await new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('error', reject);
            archive.finalize();
          });
          
          // Clean up PNG files
          for (const pngFile of pngFiles) {
            try {
              fs.unlinkSync(path.join(tempDir, pngFile));
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          
          cleanup(files.map(f => f.path));
          return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'PDF to Images'));
        } else {
          cleanup(files.map(f => f.path));
          return res.send(errorPage('Failed to convert PDF to images. Please ensure the PDF is valid.'));
        }
      } catch (error) {
        cleanup(files.map(f => f.path));
        return res.send(errorPage('Error converting PDF to images: ' + error.message));
      }
    }

    // Excel to PDF
    if (type === 'excel2pdf') {
      const input = files[0].path;
      const outputFilename = `converted_excel_${Date.now()}.pdf`;
      const output = path.join(os.tmpdir(), outputFilename);
      const libreOfficePath = getLibreOfficePath();
      await execPromise(`${libreOfficePath} --headless --convert-to pdf --outdir ${os.tmpdir()} "${input}"`);
      
      // Rename the output file to our desired name
      const generatedOutput = input + '.pdf';
      if (fs.existsSync(generatedOutput)) {
        fs.renameSync(generatedOutput, output);
      }
      
      cleanup([input]);
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'Excel to PDF'));
    }

    // PDF to Excel
    if (type === 'pdf2excel') {
      const input = files[0].path;
      const outputFilename = `converted_${Date.now()}.xlsx`;
      const output = path.join(os.tmpdir(), outputFilename);
      const libreOfficePath = getLibreOfficePath();
      await execPromise(`${libreOfficePath} --headless --convert-to xlsx --outdir ${os.tmpdir()} "${input}"`);
      
      // Rename the output file to our desired name
      const generatedOutput = input + '.xlsx';
      if (fs.existsSync(generatedOutput)) {
        fs.renameSync(generatedOutput, output);
      }
      
      cleanup([input]);
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'PDF to Excel'));
    }

    // Merge PDFs
    if (type === 'mergepdf') {
      const pdfDoc = await PDFDocument.create();
      for (const file of files) {
        const srcPdf = await PDFDocument.load(fs.readFileSync(file.path));
        const pages = await pdfDoc.copyPages(srcPdf, srcPdf.getPageIndices());
        for (const page of pages) pdfDoc.addPage(page);
      }
      const pdfBytes = await pdfDoc.save();
      
      const outputFilename = `merged_pdfs_${Date.now()}.pdf`;
      const outputPath = path.join(os.tmpdir(), outputFilename);
      fs.writeFileSync(outputPath, pdfBytes);
      
      cleanup(files.map(f => f.path));
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'PDF Merge'));
    }

    // Split PDF (each page as separate PDF in zip)
    if (type === 'splitpdf') {
      const srcPdf = await PDFDocument.load(fs.readFileSync(files[0].path));
      const pageCount = srcPdf.getPageCount();
      const archiver = require('archiver');
      
      const outputFilename = `split_pages_${Date.now()}.zip`;
      const outputPath = path.join(os.tmpdir(), outputFilename);
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 }});
      
      archive.pipe(output);
      
      // Add all pages to the archive
      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(srcPdf, [i]);
        newPdf.addPage(page);
        const pdfBytes = await newPdf.save();
        archive.append(Buffer.from(pdfBytes), { name: `page_${i + 1}.pdf` });
      }
      
      // Wait for the archive to finish
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.finalize();
      });
      
      cleanup(files.map(f => f.path));
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'PDF Split'));
    }

    // Compress PDF
    if (type === 'compresspdf') {
      // For compression, we'll recreate the PDF which often reduces file size
      const srcPdf = await PDFDocument.load(fs.readFileSync(files[0].path));
      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      
      for (const page of pages) {
        newPdf.addPage(page);
      }
      
      const pdfBytes = await newPdf.save({
        useObjectStreams: false,
        addDefaultPage: false,
        objectsPerTick: 50,
      });
      
      const outputFilename = `compressed_${Date.now()}.pdf`;
      const outputPath = path.join(os.tmpdir(), outputFilename);
      fs.writeFileSync(outputPath, pdfBytes);
      
      cleanup(files.map(f => f.path));
      return res.send(successPage(outputFilename, `/download/${outputFilename}`, 'PDF Compression'));
    }

    // OCR (extract text from image or PDF first page)
    if (type === 'ocr') {
      const inputFile = files[0];
      let text = '';
      
      try {
        if (inputFile.mimetype.startsWith('image/')) {
          // Process image directly with Tesseract
          const result = await Tesseract.recognize(inputFile.path, 'eng');
          text = result.data.text;
        } else if (inputFile.mimetype === 'application/pdf') {
          // First convert PDF to image, then OCR
          const libreOfficePath = getLibreOfficePath();
          const tempDir = os.tmpdir();
          
          await execPromise(`${libreOfficePath} --headless --convert-to png --outdir "${tempDir}" "${inputFile.path}"`);
          
          // Find the generated PNG file
          const baseName = path.basename(inputFile.path, path.extname(inputFile.path));
          const pngFiles = fs.readdirSync(tempDir).filter(file => 
            file.startsWith(baseName) && file.endsWith('.png')
          );
          
          if (pngFiles.length > 0) {
            const pngPath = path.join(tempDir, pngFiles[0]);
            const result = await Tesseract.recognize(pngPath, 'eng');
            text = result.data.text;
            
            // Clean up the temporary PNG file
            try {
              fs.unlinkSync(pngPath);
            } catch (e) {
              // Ignore cleanup errors
            }
          } else {
            text = 'Could not extract text from PDF. The PDF might be empty or contain only non-text content.';
          }
        } else {
          text = 'Unsupported file type for OCR. Please upload an image (PNG, JPG) or PDF file.';
        }
      } catch (error) {
        text = 'Error during OCR processing: ' + error.message;
      }
      
      cleanup(files.map(f => f.path));
      return res.send(`
        <!DOCTYPE html>
        <html lang="en"><head>
        <meta charset="UTF-8"><title>OCR Result</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-primary: #f2f6fa;
            --bg-secondary: #ffffff;
            --text-primary: #242424;
            --text-secondary: #396080;
            --border-color: #d9e8f6;
            --shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
            --ocr-bg: #eaf5ff;
            --ocr-text: #23436f;
          }
          [data-theme="dark"] {
            --bg-primary: #0f1419;
            --bg-secondary: #1a1f2e;
            --text-primary: #e8eaed;
            --text-secondary: #9aa0a6;
            --border-color: #2d3748;
            --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            --ocr-bg: #1a2332;
            --ocr-text: #8cc8ff;
          }
          body {background: var(--bg-primary); color: var(--text-primary); font-family:'Inter', Arial, sans-serif; margin: 0; padding: 0; transition: all 0.3s ease;}
          .container{max-width:600px;margin:3rem auto;background: var(--bg-secondary);border-radius:10px;box-shadow: var(--shadow);padding:2rem; transition: all 0.3s ease;}
          h2 {font-family: 'Montserrat', Arial, sans-serif; color: var(--text-primary); margin-bottom: 1rem;}
          pre {background: var(--ocr-bg); color: var(--ocr-text); padding: 1.2rem; border-radius: 7px; white-space: pre-wrap; max-height: 400px; overflow-y: auto;}
          a { color: #4f8cff; text-decoration: none; font-weight: 600;}
          .theme-toggle {position: absolute; top: 20px; right: 20px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 50px; padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-secondary); transition: all 0.3s ease;}
          .copy-button {background: #4f8cff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; margin-top: 1rem; font-weight: 600;}
          .copy-button:hover {background: #235bc5;}
        </style>
        <script>
          let currentTheme = 'auto';
          function setTheme(theme) {
            currentTheme = theme;
            const themeText = document.getElementById('theme-text');
            if (theme === 'auto') {
              const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
              themeText.textContent = 'Auto';
            } else {
              document.documentElement.setAttribute('data-theme', theme);
              themeText.textContent = theme === 'dark' ? 'Dark' : 'Light';
            }
            localStorage.setItem('theme', theme);
          }
          function toggleTheme() {
            const themes = ['auto', 'light', 'dark'];
            const currentIndex = themes.indexOf(currentTheme);
            const nextTheme = themes[(currentIndex + 1) % themes.length];
            setTheme(nextTheme);
          }
          function copyText() {
            const textElement = document.getElementById('extractedText');
            navigator.clipboard.writeText(textElement.textContent).then(() => {
              const button = document.getElementById('copyButton');
              button.textContent = '✓ Copied!';
              setTimeout(() => {
                button.textContent = '📋 Copy Text';
              }, 2000);
            });
          }
          const savedTheme = localStorage.getItem('theme') || 'auto';
          setTheme(savedTheme);
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (currentTheme === 'auto') setTheme('auto');
          });
        </script>
        </head><body>
        <div class="theme-toggle" onclick="toggleTheme()">
          <span class="theme-icon">🌓</span>
          <span id="theme-text">Auto</span>
        </div>
        <div class="container">
          <h2>📝 Extracted Text</h2>
          <pre id="extractedText">${text}</pre>
          <button id="copyButton" class="copy-button" onclick="copyText()">📋 Copy Text</button>
          <div style="margin-top:1rem;"><a href="/">&#8592; Back to Home</a></div>
        </div>
        </body></html>
      `);
    }

    // Default fallback
    cleanup(files.map(f => f.path));
    res.send(errorPage('Conversion type not implemented.'));
  } catch (err) {
    cleanup(files.map(f => f.path));
    res.status(500).send(errorPage('Error during conversion: ' + err));
  }
});

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(stderr || stdout || err);
      else resolve(stdout);
    });
  });
}

function cleanup(paths) {
  for (const p of paths) fs.unlink(p, () => {});
}

// Start server
app.listen(PORT, () => {
  console.log(`File converter running at http://localhost:${PORT}`);
});
