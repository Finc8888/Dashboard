FROM node:20-alpine

WORKDIR /app

# Copy test package and config
COPY tests/package.json tests/jest.config.js ./

# Install dependencies
RUN npm install

# Copy test source
COPY tests/src/ src/

# Copy Dashboard JS source for testing
COPY www/js/ www/js/

# Default: run tests
CMD ["npm", "test"]
