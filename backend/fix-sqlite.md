# Fixing SQLite3 Module Issues

## Problem
The sqlite3 module may have compilation issues in WSL environments, causing the error:
```
Error: /path/to/node_modules/sqlite3/build/Release/node_sqlite3.node: invalid ELF header
```

## Solutions

### Option 1: Reinstall sqlite3 (Recommended)
```bash
cd backend
rm -rf node_modules/sqlite3
rm package-lock.json
npm install
```

### Option 2: Use the test server (for development)
If you continue to have issues, you can use the test server for development:
```bash
cd backend
node test-server.js
```

### Option 3: Move to native Linux environment
```bash
# Copy project to home directory
cp -r /mnt/c/Projects2/HelensKitchen ~/HelensKitchen-native
cd ~/HelensKitchen-native/backend
npm install
node server.js
```

### Option 4: Use Docker
Create a Dockerfile in the backend directory:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

Then run:
```bash
docker build -t helens-kitchen-backend .
docker run -p 4000:4000 helens-kitchen-backend
```

## Verification
Once the server is running, test the endpoints:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/admin/feedback
```

The test server provides mock data and all the same endpoints as the real server, so you can use it to test the frontend functionality.