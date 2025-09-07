# Flow Desk Desktop Application

Flow Desk is a modern workspace management application built with Electron that allows users to organize and switch between different work contexts seamlessly. Each workspace can contain multiple services (like Slack, GitHub, Notion, etc.) with isolated browser environments for enhanced security and productivity.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Development](#development)
- [Contributing](#contributing)

## Architecture Overview

Flow Desk uses a multi-process Electron architecture with the following components:

- **Main Process**: Manages workspace data, browser views, and system integration
- **Renderer Process**: Handles the React-based user interface
- **Preload Scripts**: Provide secure IPC communication between main and renderer
- **Browser Views**: Isolated environments for each service within workspaces

## Key Features

### Workspace Management
- Create multiple workspaces for different contexts (work, personal, projects)
- Color-coded workspace identification with custom icons
- Browser isolation modes (shared or isolated) for data separation

### Service Integration
- Add popular services like Slack, GitHub, Notion, Jira, and more
- Custom service configuration with headers and security settings
- Isolated browser views for each service with proper security boundaries

### Security & Performance
- Context isolation and web security enabled by default
- Rate limiting on IPC communications
- Memory cleanup and performance monitoring
- Secure credential storage using system keychain

### User Experience
- Native desktop integration with system notifications
- Keyboard shortcuts for quick navigation
- Accessibility features with screen reader support
- Theme support (light, dark, system)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- macOS, Windows, or Linux

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd flowDesk/desktop-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## Documentation

- [**Architecture Guide**](./ARCHITECTURE.md) - Detailed system architecture and design decisions
- [**API Reference**](./API.md) - Complete API documentation for all modules
- [**Development Guide**](./DEVELOPMENT.md) - Setup, building, testing, and debugging
- [**Security Model**](./SECURITY.md) - Security measures and best practices
- [**Performance Guide**](./PERFORMANCE.md) - Performance optimization strategies
- [**Troubleshooting**](./TROUBLESHOOTING.md) - Common issues and solutions

## Development

### Project Structure

```
desktop-app/
├── src/
│   ├── main/           # Main process code
│   │   ├── main.ts     # Application entry point
│   │   ├── workspace.ts # Workspace management
│   │   └── ...
│   ├── renderer/       # Renderer process (React UI)
│   │   ├── App.tsx     # Main application component
│   │   ├── store/      # Redux store and slices
│   │   ├── components/ # React components
│   │   └── ...
│   ├── preload/        # Preload scripts
│   │   └── preload.ts  # IPC API definitions
│   └── types/          # TypeScript type definitions
├── docs/               # Documentation
├── assets/             # Static assets
└── build/              # Built application
```

### Key Technologies

- **Electron 37+**: Cross-platform desktop framework
- **React 18**: UI library with hooks and modern patterns
- **TypeScript**: Type-safe JavaScript development
- **Redux Toolkit**: State management with async thunks
- **Tailwind CSS**: Utility-first CSS framework
- **Vitest/Jest**: Testing frameworks
- **ESLint/Prettier**: Code quality and formatting

### Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Security audit
npm run security:audit
```

## Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct, development process, and how to submit pull requests.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with proper tests and documentation
4. Ensure all tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- [Documentation](./docs/)
- [Issue Tracker](../../issues)
- [Discussions](../../discussions)

---

**Flow Desk Team** - Building the future of workspace management