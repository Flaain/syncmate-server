FROM node:22.14 as base

RUN mkdir -p app

WORKDIR /app

COPY package.json npm-shrinkwrap.json ./

RUN npm install

FROM base as build

COPY . .

RUN npm run build

FROM build as production

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/package.json /app/npm-shrinkwrap.json

RUN npm i --production

COPY --from=build /app/dist ./dist

CMD ["node", "dist/main"]