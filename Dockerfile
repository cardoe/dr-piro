# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22 AS frontend

WORKDIR /app/
ENV PATH=$PATH:/app/node_modules/.bin

COPY frontend/package.json ./
COPY frontend/package-lock.json ./

RUN npm clean-install

COPY frontend/ ./

RUN npm run build

# layer for building the rust code
FROM --platform=$BUILDPLATFORM rust:1.92-bullseye AS rust

WORKDIR /app
ARG TARGETPLATFORM

RUN apt update && \
    apt install -y \
        gcc-arm-linux-gnueabihf \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN rustup target add $(./scripts/platform-to-rust-target.sh)
RUN cargo build --release --target $(./scripts/platform-to-rust-target.sh)

# where we'll run this
FROM debian:trixie AS deploy

WORKDIR /opt/dr-piro

COPY --from=rust /app/target/*/release/dr-piro /opt/dr-piro
RUN mkdir -p /opt/dr-piro/frontend/build/
COPY --from=frontend /app/build /opt/dr-piro/frontend/build/

EXPOSE 8000

ENTRYPOINT ["/opt/dr-piro/dr-piro"]
