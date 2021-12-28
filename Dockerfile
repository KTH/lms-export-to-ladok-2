# Stage 0. Compile the frontend code
FROM kthse/kth-nodejs:14.0.0
WORKDIR /tmp/lms-export-to-ladok-2/
RUN apk update && \
  apk add --no-cache --virtual .gyp \
  python3 \
  make \
  g++
# Copying only package.json to avoid reinstalling dependencies if only code has changed
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 1. Build the actual image
FROM kthse/kth-nodejs:14.0.0
WORKDIR /usr/src/app
RUN apk update && \
  apk add --no-cache --virtual .gyp \
  python3 \
  make
COPY . .
COPY --from=0 /tmp/lms-export-to-ladok-2/dist ./dist
RUN node -v
RUN npm ci --only=production

EXPOSE 3001
CMD ["node", "app.js"]
