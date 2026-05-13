FROM rust:1.95-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.bun/bin:${PATH}"

RUN apt-get update -o Acquire::Check-Date=false && apt-get install -y --no-install-recommends \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    curl \
    unzip \
    protobuf-compiler \
    libprotobuf-dev \
&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install -o /tmp/bun-install.sh \
    && bash /tmp/bun-install.sh \
    && rm /tmp/bun-install.sh

RUN curl -L --proto '=https' --tlsv1.2 -sSf \
    https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh \
    -o /tmp/binstall-install.sh \
    && bash /tmp/binstall-install.sh \
    && rm /tmp/binstall-install.sh

RUN cargo binstall -y --disable-telemetry tauri-cli
