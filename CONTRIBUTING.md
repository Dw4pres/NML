# Contributing to NML

Thank you for your interest in contributing to NML! This document explains how to get started and our contribution guidelines.

## Project Philosophy

**NML is strictly zero-bloat.** Our core mission is to provide a component-first markup language that compiles to clean HTML with no client-side JavaScript runtime.

### What we accept
- Bug fixes and performance improvements
- Better error messages and developer experience
- Documentation and examples
- Tooling improvements (CLI, VS Code, etc.)

### What we generally reject
- Features that add significant compiler weight
- Client-side JavaScript runtime dependencies
- Complex abstractions that hide the HTML output
- Features that can be achieved with existing patterns

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Dw4pres/NML.git
   cd NML
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run tests**
   ```bash
   bun run test:all
   ```

4. **Type checking**
   ```bash
   bun run typecheck
   ```

5. **Build all packages**
   ```bash
   bun run build:all
   ```

## Project Structure

```
NML/
├── packages/
│   ├── compiler-ts/     # Core TypeScript compiler
│   ├── cli/             # Command-line interface
│   ├── vite-plugin/     # Vite integration
│   ├── router/          # File-based routing
│   ├── mcp-server/      # AI assistant integration
│   ├── bun-server/      # Bun HTTP server
│   └── playground/      # Browser playground
├── examples/            # Example applications
├── docs/               # Documentation
└── packages/vscode-nml/ # VS Code extension
```

## Running Tests Locally

All packages use Vitest for testing:

```bash
# Run all tests across packages
bun run test:all

# Run tests for a specific package
cd packages/compiler-ts
bun test

# Run tests with coverage
bun test --coverage
```

## Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature-name
   ```

2. **Make your changes**
   - Add tests for new functionality
   - Ensure all tests pass
   - Update documentation if needed

3. **Run the full test suite**
   ```bash
   bun run test:all
   bun run typecheck
   ```

4. **Commit your changes**
   ```bash
   git commit -m "feat: add new feature"
   ```

5. **Push and create a pull request**
   ```bash
   git push origin feature-name
   ```

## Code Style

- Use TypeScript for all new code
- Follow the existing code formatting
- Add JSDoc comments for public APIs
- Include tests for new functionality

## Submitting Issues

- Use the provided bug report template
- Include minimal reproduction examples
- Provide error messages and environment details
- Link to playground if applicable

## Feature Requests

Before submitting a feature request:

1. Check if it can be achieved with existing patterns
2. Consider the zero-bloat impact
3. Open an issue for discussion before implementation

## Release Process

Releases are handled by maintainers:

1. Update version numbers in package.json files
2. Update CHANGELOG.md
3. Create Git tag
4. Publish to npm
5. Create GitHub release

## Getting Help

- Check the [examples](../examples/) directory for usage patterns
- Read the [Project Roadmap](../docs/Project%20Roadmap.md)
- Join discussions in GitHub Issues
- Try the [interactive playground](https://nml-playground.pages.dev)

## License

By contributing to NML, you agree that your contributions will be licensed under the same license as the project.