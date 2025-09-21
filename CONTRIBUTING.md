# Contributing to prisma-ksuid

Thank you for your interest in contributing to prisma-ksuid! This document provides guidelines for obtaining the software, providing feedback, and contributing to the project.

## Obtaining the Software

You can obtain prisma-ksuid through the following methods:

### Via npm
```bash
npm install @owpz/prisma-ksuid
```

### Via yarn
```bash
yarn add @owpz/prisma-ksuid
```

### Via pnpm
```bash
pnpm add @owpz/prisma-ksuid
```

### From Source
Clone the repository from GitHub:
```bash
git clone https://github.com/owpz/prisma-ksuid.git
cd prisma-ksuid
npm install
```

## Providing Feedback

We welcome all feedback to help improve prisma-ksuid. There are several ways to provide feedback:

### Bug Reports
If you encounter a bug, please report it by [creating a new issue](https://github.com/owpz/prisma-ksuid/issues/new) on GitHub. When reporting bugs, please include:
- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Your environment (Node.js version, Prisma version, OS)
- Any relevant error messages or logs

### Feature Requests and Enhancements
For feature requests or enhancement suggestions, please [create a new issue](https://github.com/owpz/prisma-ksuid/issues/new) on GitHub with:
- A clear description of the proposed feature
- Use cases and examples
- Why this feature would be valuable to the project

### Security Issues
**Important:** For security-related issues, please DO NOT create a public GitHub issue. Instead, follow the instructions in our [SECURITY.md](SECURITY.md) file for responsible disclosure.

## Contributing Code

We appreciate code contributions! All contributions to prisma-ksuid are made through **Pull Requests** on GitHub.

### Contribution Process

Our contribution process uses GitHub Pull Requests:

1. **Fork** the repository on GitHub at https://github.com/owpz/prisma-ksuid
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/prisma-ksuid.git
   cd prisma-ksuid
   ```
3. **Create a new branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
4. **Make your changes** following our coding standards (see Requirements below)
5. **Write or update tests** to cover your changes
6. **Run tests** to ensure everything passes:
   ```bash
   npm test
   ```
7. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "feat: add support for custom ID generation"
   # or
   git commit -m "fix: resolve KSUID collision issue"
   ```
8. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
9. **Submit a Pull Request** to the `main` branch at https://github.com/owpz/prisma-ksuid/pulls

### Contribution Requirements

All contributions must meet these requirements to be accepted:

#### Code Standards
- **TypeScript**: All code must be written in TypeScript with proper type annotations
- **Code Formatting**: All code must be formatted using Prettier
  - Run `npm run format` or `npx prettier --write .` before committing
  - Code style is automatically enforced via Prettier configuration
- **Linting**: All ESLint checks must pass with no errors or warnings
  - Run `npm run lint` to check for linting issues
  - Fix any linting errors before submitting your PR
- **Testing**: New features must include comprehensive tests
- **Documentation**: Update README.md and inline documentation as needed
- **Code Style**: Follow the existing code formatting and conventions
  - Use camelCase for variables and functions
  - Use PascalCase for types and classes
  - Add JSDoc comments for public APIs
  - Keep files focused and modular

#### Pull Request Requirements
1. **Pass all CI checks** - All automated tests, linting, and security checks must pass:
   - Unit tests and integration tests
   - ESLint checks (no errors or warnings)
   - Prettier formatting verification
   - SAST (Static Application Security Testing) checks
   - Code Fuzzing checks
   - TypeScript type checking
2. **Include tests** - Test coverage must not decrease
3. **Clean commit history** - Use descriptive commit messages
4. **Reference issues** - Link related issues with "Fixes #123"
5. **Up-to-date** - Rebase on latest main branch before submitting

#### Draft Pull Requests

If your contribution is not yet ready for review, you can open a **Draft Pull Request**:
- This allows you to run GitHub Actions CI checks early
- You can see and fix any failing tests, linting issues, or security concerns
- SAST and Code Fuzzing checks will run automatically
- Convert to "Ready for Review" once all checks pass

To create a draft PR:
1. Open your pull request as usual
2. Select "Create draft pull request" from the dropdown
3. Work on resolving any CI failures
4. Click "Ready for review" when complete

#### Development Setup
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/prisma-ksuid.git
cd prisma-ksuid

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Check types (if available)
npm run type-check

# Run linter
npm run lint

# Format code with Prettier
npm run format

# Check formatting without changing files
npm run format:check
```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary changes

Example: `feat: add support for composite primary keys`

## Questions and Discussions

For general questions or discussions about prisma-ksuid, feel free to:
- Open a [GitHub Discussion](https://github.com/owpz/prisma-ksuid/discussions) (if enabled)
- Create an issue with the "question" label
- Reach out through the project's communication channels

## License

By contributing to prisma-ksuid, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Thank You!

Your contributions help make prisma-ksuid better for everyone. We appreciate your time and effort in improving this project!