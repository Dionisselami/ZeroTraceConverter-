# File Converter Web Application

A privacy-focused, open-source web application for converting files between different formats. Features modern UI with dark/light themes, no signup required, no file storage, and comprehensive conversion capabilities.

## ✨ Features

### Document Conversions
- **PDF to Word** - Convert PDF documents to editable Word (.docx) format
- **Word to PDF** - Convert Word documents (.doc/.docx) to PDF format  
- **Excel to PDF** - Convert Excel files (.xls/.xlsx) to PDF format
- **PDF to Excel** - Convert PDF tables back to Excel (.xlsx) format

### PDF Tools
- **Merge PDFs** - Combine multiple PDF files into one document
- **Split PDF** - Separate each PDF page into individual files (ZIP download)
- **Compress PDF** - Reduce PDF file size while maintaining quality

### Image & OCR
- **Image to PDF** - Convert images (JPEG, PNG, GIF) to PDF
- **PDF to Images** - Extract PDF pages as PNG images (ZIP download)
- **OCR** - Extract text from images and PDFs with copy functionality

### Modern UI/UX
- **Dark/Light/Auto Theme** - Automatic system theme detection with manual toggle
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **File Type Validation** - Dynamic file acceptance based on conversion type
- **Progress Indicators** - Loading animations during conversions
- **Beautiful Success Pages** - Celebration animations and download buttons

## 🔒 Privacy & Security

- **No File Storage** - All files processed in memory and deleted immediately
- **No Tracking** - No cookies, no analytics, no data collection
- **Local Processing** - Everything happens on your server
- **Rate Limited** - 15 requests per hour to prevent abuse
- **File Size Limits** - 10MB maximum per file
- **Open Source** - Complete transparency

## 📋 Prerequisites

- **Node.js 16+** installed
- **LibreOffice** installed (required for Office document conversions)

## 🚀 Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## 🏃‍♂️ Running the Application

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:3001`

## 📦 Dependencies

- **express** - Web framework
- **multer** - File upload middleware with size limits
- **express-rate-limit** - Rate limiting middleware
- **pdf-lib** - Advanced PDF manipulation library
- **tesseract.js** - OCR functionality for text extraction
- **archiver** - ZIP file creation for multi-file downloads
- **nodemon** - Development auto-reload (dev dependency)

## 🖥️ LibreOffice Installation

For PDF/Word/Excel conversions, LibreOffice must be installed:

### Windows
Download and install from: https://www.libreoffice.org/

### macOS
```bash
brew install --cask libreoffice
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get install libreoffice
```

### Linux (CentOS/RHEL/Fedora)
```bash
sudo yum install libreoffice
# or
sudo dnf install libreoffice
```

## 🎨 Supported File Types

| Conversion Type | Input Formats | Output Format |
|----------------|---------------|---------------|
| PDF to Word | .pdf | .docx |
| Word to PDF | .doc, .docx | .pdf |
| Excel to PDF | .xls, .xlsx | .pdf |
| PDF to Excel | .pdf | .xlsx |
| Image to PDF | .jpg, .jpeg, .png, .gif | .pdf |
| PDF to Images | .pdf | .zip (containing .png files) |
| Merge PDFs | .pdf (multiple) | .pdf |
| Split PDF | .pdf | .zip (containing .pdf files) |
| Compress PDF | .pdf | .pdf |
| OCR | .jpg, .jpeg, .png, .pdf | Text output |

## 🌟 Technology Stack

- **Backend**: Node.js with Express.js
- **File Processing**: LibreOffice, PDF-lib, Tesseract.js
- **Frontend**: Vanilla JavaScript with CSS custom properties
- **Theming**: CSS variables with system theme detection
- **Security**: Rate limiting, file validation, automatic cleanup

## 📄 License

MIT License - Open source and free to use
