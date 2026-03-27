# Task runner for pprof-viz

# Show the available tasks
[group('Utilities')]
default:
	@just --list

# Build docker images
[group('Build')]
build:
    - docker buildx bake -f ./docker/docker-bake.hcl default

# Run tests with code coverage
[group('Quality')]
cover:
    - bun test --coverage --coverage-dir=.test

# Run the SvelteKit type and config checkss
[group('Quality')]
check:
	- bun run check

# Run Biome's code quality checks
[group('Quality')]
lint:
	- bunx biome check ./src

# Run Biome's code quality checks and write fixes
[group('Quality')]
lint-fix:
	- bunx biome check --write ./src

# Format the codebase with Biome
[group('Quality')]
format:
	- bunx biome format --write --css-parse-tailwind-directives=true  ./src

# Verify formatting without changing files
[group('Quality')]
format-check:
    - bunx biome format --css-parse-tailwind-directives=true ./src

# Run the main verification pipeline
[group('Quality')]
verify: check lint format-check

# Check dependencies for known vulnerabilities or if they are outdated
[group('Maintenance')]
vuln:
    - bun audit
    - bun outdated

# Remove build and dependency artifacts
[group('Maintenance')]
clean:
    - rm -rf .svelte-kit build node_modules