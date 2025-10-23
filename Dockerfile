FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x music-fetcher.js
# Use a shell to keep the container running
CMD ["tail", "-f", "/dev/null"]