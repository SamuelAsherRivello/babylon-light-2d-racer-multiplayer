FROM node:24-bookworm-slim
WORKDIR /app
COPY ["2D Racer/package.json", "2D Racer/package-lock.json", "./"]
RUN npm ci
COPY ["2D Racer/", "./"]
RUN npm run build
ENV HOST=0.0.0.0
ENV PORT=2567
EXPOSE 2567
USER node
CMD ["npm", "start"]
