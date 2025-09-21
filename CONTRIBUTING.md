# Contributing to Prisma KSUID

Thank you for your interest in contributing to Prisma KSUID! We welcome contributions from the community and are excited to work with you.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Contribution Process](#contribution-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate in all interactions.

## How to Contribute

We accept contributions via GitHub Pull Requests. Here are the ways you can contribute:

- **Bug Fixes**: Found a bug? Create an issue first, then submit a PR with the fix
- **New Features**: Open an issue to discuss the feature before implementing
- **Documentation**: Help improve our docs, fix typos, or add examples
- **Tests**: Add missing tests or improve existing test coverage
- **Performance**: Submit optimizations with benchmarks showing improvements

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/prisma-ksuid.git
   cd prisma-ksuid
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

5. Set up Prisma:
   ```bash
   npm run prisma:generate
   ```

## Contribution Process

1. **Check Existing Issues**: Before starting work, check if there's an existing issue or PR for your contribution
2. **Create/Claim an Issue**: If no issue exists, create one describing what you plan to work on
3. **Fork and Branch**: Fork the repository and create a feature branch
4. **Develop**: Make your changes following our coding standards
5. **Test**: Ensure all tests pass and add new tests for your changes
6. **Document**: Update documentation if needed
7. **Commit**: Follow our commit message guidelines
8. **Push**: Push your changes to your fork
9. **Pull Request**: Submit a PR to the main repository

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Enable strict mode in TypeScript configuration
- Provide proper type annotations (avoid `any` type)
- Use interfaces for object shapes
- Export types that might be useful for consumers

### Code Style

- Follow the existing code style in the project
- Use ESLint configuration provided:
  ```bash
  npm run lint
  ```
- Format your code consistently
- Use meaningful variable and function names
- Keep functions small and focused (single responsibility)
- Add comments for complex logic

### File Structure

```
src/
├── index.ts           # Main entry point
├── prisma-extension.ts # Prisma extension implementation
└── util/              # Utility functions
    └── ksuid.ts       # KSUID generation logic
```

## Testing Requirements

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e

# Run fuzzing tests
npm run test:fuzz
```

### Test Coverage

- All new features must include tests
- Bug fixes should include a test that would have caught the bug
- Maintain or improve code coverage (minimum 70%)
- Include both unit tests and integration tests where applicable

### Writing Tests

- Place test files in `__tests__/` directory
- Name test files with `.test.ts` suffix
- Use descriptive test names
- Test edge cases and error conditions
- Include fuzzing tests for critical functions using fast-check

Example test structure:
```typescript
describe('Feature Name', () => {
  describe('specific functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## Commit Guidelines

We follow conventional commit messages for clarity and automation:

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates
- `ci`: CI/CD configuration changes

### Examples

```bash
feat(extension): add support for custom ID generators
fix(ksuid): correct timestamp generation in edge cases
docs(readme): update installation instructions
test(fuzz): add property-based testing for KSUID generation
```

### Commit Best Practices

- Keep commits atomic (one logical change per commit)
- Write clear, concise commit messages
- Reference issue numbers when applicable: `fix(extension): resolve race condition #123`
- Use present tense: "add feature" not "added feature"

## Pull Request Process

### Before Submitting

1. **Update your branch**: Rebase on the latest main branch
2. **Run tests**: Ensure all tests pass locally
   ```bash
   npm test
   npm run lint
   npm run build
   ```
3. **Check coverage**: Verify test coverage hasn't decreased
4. **Update documentation**: Include any necessary documentation changes
5. **Self-review**: Review your own changes for issues

### PR Template

When creating a PR, please include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #(issue number)

## Testing
- [ ] All tests pass
- [ ] Added new tests
- [ ] Updated documentation

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests pass locally
- [ ] My changes generate no new warnings
```

### Review Process

1. **Automated Checks**: Your PR will run through CI/CD checks
2. **Code Review**: Maintainers will review your code
3. **Feedback**: Address any feedback or requested changes
4. **Approval**: Once approved, your PR will be merged

### After Merge

- Delete your feature branch
- Pull the latest changes to your local main branch
- Celebrate your contribution! 🎉

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Description**: Clear description of the bug
- **Reproduction Steps**: Minimal steps to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Node version, Prisma version, OS
- **Code Sample**: Minimal reproducible example
- **Error Messages**: Complete error messages and stack traces

### Feature Requests

For feature requests, please provide:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: Your suggested implementation
- **Alternatives**: Other solutions you've considered
- **Additional Context**: Any other relevant information

## Security Issues

For security vulnerabilities, please **DO NOT** create a public issue. Instead, email the maintainers directly or use GitHub's security advisory feature.

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion in GitHub Discussions
- Ask in an issue (label it as a question)
- Review existing issues and PRs for examples

## License

By contributing to Prisma KSUID, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors are recognized in our README and in the project's contributors list. Thank you for helping make Prisma KSUID better!

---

Thank you for contributing to Prisma KSUID! Your efforts help make this project better for everyone.