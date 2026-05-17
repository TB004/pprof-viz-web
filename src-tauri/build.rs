fn main() {
    connectrpc_build::Config::new()
        .files(&["./proto/agent.proto"])
        .includes(&["./proto"])
        .include_file("_connectrpc.rs")
        .compile()
        .expect("failed to compile agent.proto with connectrpc-build");

    tauri_build::build();
}
