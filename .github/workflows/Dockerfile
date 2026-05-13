FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/root/.bun
ENV RUSTUP_HOME=/root/.rustup
ENV CARGO_HOME=/root/.cargo
ENV PATH="/root/.cargo/bin:/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libwebkit2gtk-4.1-dev \
    curl \
    gcc \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    unzip \
    protobuf-compiler \
    libprotobuf-dev \
&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install -o /tmp/bun-install.sh \
    && bash /tmp/bun-install.sh \
    && rm /tmp/bun-install.sh

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh \
    && sh /tmp/rustup-init.sh -y --no-modify-path \
    && rm /tmp/rustup-init.sh

RUN curl -L --proto '=https' --tlsv1.2 -sSf \
    https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh \
    -o /tmp/binstall-install.sh \
    && bash /tmp/binstall-install.sh \
    && rm /tmp/binstall-install.sh

RUN cargo binstall -y --disable-telemetry tauri-cli
