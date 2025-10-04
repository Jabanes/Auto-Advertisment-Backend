# Use official Node.js image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "index.js"]
