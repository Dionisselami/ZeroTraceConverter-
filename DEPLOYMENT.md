# Deployment Guide

This guide covers deploying the File Converter Web Application to various platforms.

## 🔧 Environment Variables

The application uses the following environment variables:

- `PORT` - The port number to run the server (default: 3001)
- `NODE_ENV` - Set to "production" for production deployment

## 🚀 Local Production Deployment

1. Install dependencies:
   ```bash
   npm install --production
   ```

2. Set environment variables:
   ```bash
   export NODE_ENV=production
   export PORT=3001
   ```

3. Start the application:
   ```bash
   npm start
   ```

## 🐳 Docker Deployment

### Create Dockerfile

```dockerfile
FROM node:18-alpine

# Install LibreOffice
RUN apk add --no-cache libreoffice

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Start the application
CMD ["npm", "start"]
```

### Build and Run

```bash
# Build the image
docker build -t file-converter .

# Run the container
docker run -p 3001:3001 file-converter
```

## ☁️ Cloud Platform Deployment

### Heroku

1. Create a Heroku app:
   ```bash
   heroku create your-app-name
   ```

2. Add LibreOffice buildpack:
   ```bash
   heroku buildpacks:add --index 1 https://github.com/Iuppa/heroku-buildpack-libreoffice
   heroku buildpacks:add --index 2 heroku/nodejs
   ```

3. Deploy:
   ```bash
   git push heroku main
   ```

### Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

Note: LibreOffice functionality may be limited on serverless platforms.

### VPS/Server Deployment

1. Install Node.js and LibreOffice on your server
2. Clone the repository
3. Install dependencies: `npm install --production`
4. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "file-converter"
   pm2 startup
   pm2 save
   ```

## 🔒 Production Security

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # File upload size limit
        client_max_body_size 10M;
    }
}
```

### SSL Certificate

Use Let's Encrypt for free SSL certificates:
```bash
sudo certbot --nginx -d your-domain.com
```

## 📊 Monitoring

### Health Check Endpoint

The application runs on `/` which can be used for health checks.

### Logs

Application logs can be monitored using:
- PM2: `pm2 logs file-converter`
- Docker: `docker logs container_name`
- Systemd: `journalctl -u your-service-name`

## 🔧 Environment-Specific Configuration

### Production Optimizations

1. Enable compression:
   ```bash
   npm install compression
   ```

2. Add to server.js:
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

3. Set appropriate headers for security:
   ```javascript
   app.use((req, res, next) => {
     res.setHeader('X-Frame-Options', 'DENY');
     res.setHeader('X-Content-Type-Options', 'nosniff');
     res.setHeader('X-XSS-Protection', '1; mode=block');
     next();
   });
   ```

## 📋 Pre-deployment Checklist

- [ ] LibreOffice installed and accessible
- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] File upload limits set appropriately
- [ ] Rate limiting configured
- [ ] Error logging implemented
- [ ] Health check endpoint tested
- [ ] SSL certificate configured (production)
- [ ] Backup strategy in place
- [ ] Monitoring solution active
