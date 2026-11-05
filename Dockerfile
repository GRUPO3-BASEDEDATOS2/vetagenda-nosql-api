FROM node:22-alpine
ENV NODE_ENV=production
RUN npm install -g npm@11.21.1 --ignore-scripts
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev
COPY . .
USER node
EXPOSE 3000
CMD ["node", "src/app.js"]
