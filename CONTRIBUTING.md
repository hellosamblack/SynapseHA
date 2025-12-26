# Contributing to SynapseHA

Thank you for your interest in contributing to SynapseHA!

## Development Setup

1. Clone the repository
```bash
git clone https://github.com/hellosamblack/SynapseHA.git
cd SynapseHA
```

2. Install dependencies
```bash
npm install
```

3. Set up your Home Assistant connection
```bash
cp .env.example .env
# Edit .env with your HA_URL and HA_TOKEN
```

4. Build the project
```bash
npm run build
```

5. Run in development mode
```bash
npm run watch  # In one terminal
npm run start  # In another terminal
```

## Project Structure

```
SynapseHA/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── lib/                  # Core libraries
│   │   ├── ha-client.ts      # Home Assistant API client
│   │   ├── cache.ts          # Caching system
│   │   └── fuzzy-search.ts   # Fuzzy search engine
│   ├── tools/                # MCP tool implementations
│   │   └── index.ts          # All tool definitions
│   └── types/                # TypeScript type definitions
│       └── index.ts
├── dist/                     # Compiled JavaScript output
└── cache/                    # Runtime cache storage
```

## Adding a New Tool

To add a new tool to SynapseHA:

1. Open `src/tools/index.ts`
2. Add a new tool object to the array returned by `registerTools()`

```typescript
{
  definition: {
    name: 'your_tool_name',
    description: 'Clear description of what the tool does',
    inputSchema: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'Parameter description',
        },
        // Add more parameters as needed
      },
      required: ['param1'],
    },
  },
  handler: async (args) => {
    // Implement your tool logic here
    // You have access to: haClient, cache, search
    
    return {
      // Return structured data
    };
  },
},
```

3. Update documentation in `API.md`
4. Rebuild and test

## Code Style

- Use TypeScript strict mode
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Use async/await (no callbacks)
- Handle errors gracefully

## Testing Your Changes

1. Build the project: `npm run build`
2. Set up Claude Desktop with your local build
3. Test your changes through Claude
4. Verify no TypeScript errors
5. Check console output for issues

## Submitting Changes

1. Create a feature branch
2. Make your changes
3. Ensure the project builds without errors
4. Update documentation as needed
5. Submit a pull request with:
   - Clear description of changes
   - Why the change is needed
   - Any breaking changes

## Best Practices

### Performance
- Use the cache for frequently accessed data
- Avoid unnecessary API calls to Home Assistant
- Consider pagination for large result sets

### Error Handling
- Always wrap API calls in try-catch
- Return meaningful error messages
- Don't expose sensitive information in errors

### Security
- Never log tokens or sensitive data
- Validate user input
- Use parameterized queries/requests

### Compatibility
- Test with different Home Assistant versions
- Consider backward compatibility
- Document any version requirements

## Adding New Dependencies

Only add dependencies that are:
- Well-maintained
- Have good TypeScript support
- Are necessary for the functionality
- Have acceptable licenses

Run `npm install <package>` and commit package.json and package-lock.json.

## Documentation

When adding features:
- Update README.md for user-facing changes
- Update API.md for new or changed tools
- Add inline comments for complex logic
- Update IMPLEMENTATION.md if architecture changes

## Release Process

Releases are managed by maintainers:
1. Version bump in package.json
2. Update CHANGELOG
3. Tag release
4. Publish to npm (if applicable)

## Getting Help

- Check existing issues
- Review documentation
- Ask in discussions
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).
