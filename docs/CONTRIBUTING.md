# Contributing to Pamela

Thank you for your interest in contributing to Pamela! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (use npm for PGLite compatibility)
- Git
- A Polygon wallet with USDC for testing
- OpenAI API key

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/theSchein/pamela
   cd pamela
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development**
   ```bash
   npm run dev
   ```

## 🎯 Areas for Contribution

### High Priority
- **Autonomous Trading Logic**: Improve decision-making algorithms
- **Risk Management**: Enhance safety systems and position controls
- **Testing**: Add comprehensive test coverage for all trading functions
- **Error Handling**: Improve robustness and error recovery

### Medium Priority
- **Market Analysis**: Enhance market intelligence and data processing
- **Performance**: Optimize API calls and database operations
- **Documentation**: Improve guides, tutorials, and API documentation
- **User Experience**: Better natural language processing for trading commands

### Future Features
- **News Integration**: Connect market events to trading decisions
- **Social Media**: Post positions and analysis to social platforms
- **Multi-Agent**: Support for multiple trading agents
- **Advanced Strategies**: Implement sophisticated trading algorithms

## 📋 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing code conventions and patterns
- Add comprehensive JSDoc comments for public APIs
- Use meaningful variable and function names

### Testing Requirements
- Write unit tests for all new functions
- Add integration tests for API interactions
- Include E2E tests for complete trading workflows
- Ensure all tests pass before submitting PR

### Commit Messages
Follow conventional commit format:
```
type(scope): description

feat(trading): add sell position functionality
fix(api): handle CLOB client timeout errors
docs(readme): update installation instructions
test(orders): add limit order placement tests
```

## 🔒 Security Guidelines

### Trading Safety
- Never commit private keys or sensitive credentials
- Always validate user inputs and API parameters
- Implement proper rate limiting for API calls
- Add comprehensive error handling for edge cases

### Code Security
- Use environment variables for all secrets
- Validate and sanitize all external inputs
- Follow secure coding practices
- Report security issues privately (see SECURITY.md)

## 🧪 Testing Strategy

### Unit Tests
```bash
npm run test:component
```
Test individual functions and components in isolation.

### Integration Tests
```bash
npm run test:e2e
```
Test complete workflows with real ElizaOS runtime and database.

### Manual Testing
- Test with small amounts ($1-5) on live markets
- Verify error handling with invalid inputs
- Test autonomous trading for extended periods

## 📝 Pull Request Process

### Before Submitting
1. **Code Quality**
   - Run `npm run lint` and fix any issues
   - Run `npm run type-check` and resolve TypeScript errors
   - Run `npm test` and ensure all tests pass

2. **Documentation**
   - Update README.md if adding new features
   - Add JSDoc comments for new public APIs
   - Update CHANGELOG.md with your changes

3. **Testing**
   - Add tests for new functionality
   - Test manually with small trading amounts
   - Verify backwards compatibility

### PR Guidelines
- **Title**: Use clear, descriptive titles
- **Description**: Explain what changes were made and why
- **Testing**: Describe how you tested the changes
- **Breaking Changes**: Clearly document any breaking changes

### PR Template
```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Tested with live trading (small amounts)

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or clearly documented)
```

## 🚨 Important Considerations

### Financial Risk
- This software handles real money transactions
- Always test with small amounts first
- Never trade more than you can afford to lose
- Implement proper risk management controls

### Legal Compliance
- Ensure compliance with local trading regulations
- Understand prediction market legal status in your jurisdiction
- Follow Polymarket terms of service
- Respect rate limits and API usage policies

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn and contribute
- Maintain professional communication

### Communication Channels
- **Issues**: Technical problems and bug reports
- **Discussions**: Feature requests and general questions
- **Pull Requests**: Code contributions and reviews

## 🎖️ Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special recognition for security improvements
- Maintainer status for consistent, high-quality contributions

## 📚 Resources

### Documentation
- [ElizaOS Framework](https://github.com/elizaos/eliza)
- [Polymarket API Documentation](https://docs.polymarket.com)
- [Polygon Network Guide](https://docs.polygon.technology)

### Testing Resources
- Use Polygon Mumbai testnet for development
- Test with small USDC amounts on mainnet
- Use the CLI testing framework: `elizaos test`

---

Thank you for contributing to Pamela! Together we're building the future of autonomous prediction market trading.