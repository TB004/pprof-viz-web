FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.cargo/bin:/root/.bun/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    libappindicator3-dev \
    libprotobuf-dev \
    librsvg2-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    patchelf \
    pkg-config \
    protobuf-compiler \
    unzip

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain 1.95.0 --no-modify-path

RUN curl -fsSL https://bun.sh/install -o /tmp/bun-install.sh \
    && bash /tmp/bun-install.sh \
    && rm /tmp/bun-install.sh

RUN curl -L --proto '=https' --tlsv1.2 -sSf \
    https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh \
    -o /tmp/binstall-install.sh \
    && bash /tmp/binstall-install.sh \
    && rm /tmp/binstall-install.sh

RUN cargo binstall -y --disable-telemetry tauri-cli
