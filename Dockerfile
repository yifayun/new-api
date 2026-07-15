FROM node:20-alpine AS builder

WORKDIR /build
COPY web/default/package.json .
RUN npm config set registry https://registry.npmjs.org \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000
RUN npm install --legacy-peer-deps --no-audit --no-fund
RUN npm install antd @lobehub/ui es-toolkit --legacy-peer-deps --no-audit --no-fund
COPY ./web/default .
COPY ./VERSION .
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) npm run build

FROM node:20-alpine AS builder-classic

WORKDIR /build
COPY web/classic/package.json .
RUN npm config set registry https://registry.npmjs.org \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY ./web/classic .
COPY ./VERSION .
RUN VITE_REACT_APP_VERSION=$(cat VERSION) npm run build

FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder2
ENV GO111MODULE=on CGO_ENABLED=0
ENV GOPROXY=https://proxy.golang.org,https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.org
ENV GOSUMDB=${GOSUMDB}

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=builder /build/dist ./web/default/dist
COPY --from=builder-classic /build/dist ./web/classic/dist
RUN go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$(cat VERSION)'" -o app

FROM yifayun/yfyapi:authfix-20260429-realname-relogin-toast-filter-v2

COPY --from=builder2 /build/app /usr/local/bin/new-api
