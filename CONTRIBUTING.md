# Contributing to Real-Time Applications Complete

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/HermeticOrmus/claude-code-realtime-apps/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)
   - Code samples if applicable

### Suggesting Enhancements

1. Open an issue with the `enhancement` label
2. Describe the feature and its benefits
3. Provide examples of how it would be used

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Add tests if applicable
5. Run `npm test` and `npm run lint`
6. Commit with conventional commits (e.g., `feat: add new feature`)
7. Push to your fork
8. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/claude-code-realtime-apps.git
cd claude-code-realtime-apps

# Install dependencies
npm install

# Start development servers
npm run dev
```

## Code Standards

- Use TypeScript with strict mode
- Follow ESLint rules (`npm run lint`)
- Format code with Prettier (`npm run format`)
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation for new features

## Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- <test-file>

# Run with coverage
npm run test:coverage
```

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for functions and classes
- Create examples for new features
- Update guides in `docs/guides/` as needed

## Questions?

Open an issue with the `question` label or join our Discord community.

Thank you for contributing! 🎉
