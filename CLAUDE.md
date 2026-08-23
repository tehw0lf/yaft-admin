# YaFT Admin - CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the YaFT Admin Angular application.

## Project Overview

YaFT Admin is a standalone Angular application for managing feature toggles across different YaFT data sources. It provides a unified interface to connect to and manage feature toggles regardless of whether they're stored in a Go API backend, local storage, or other supported providers.

## Architecture

### Core Components

**App Component** (`src/app/app.ts`)
- Main application component with stepper-based UI
- Manages connection configuration and feature toggle operations
- Uses Angular Material components for modern UI
- Reactive forms for connection and feature management

**YaftProviderService** (`src/app/services/yaft-provider.service.ts`)
- Abstraction layer for different YaFT data sources
- Handles connection management and CRUD operations
- Supports multiple provider types (API Service, Local Storage, Boolean variants)
- Provides reactive streams for connection status and feature updates

**Feature Models** (`src/app/models/feature.model.ts`)
- Type definitions for features, connections, and provider types
- Interfaces for API responses and internal data structures

### Supported Provider Types

1. **API Service (Feature Objects)**: Full YaFT Go backend with Feature objects
2. **API Service (Boolean Values)**: YaFT Go backend with simple boolean values
3. **Local Storage (Feature Objects)**: Browser localStorage with Feature objects
4. **Local Storage (Boolean Values)**: Browser localStorage with boolean values

### Key Features

- **Multi-Provider Support**: Connect to different YaFT data sources
- **Stepper UI**: Guided workflow from connection to feature management
- **Real-time Updates**: Reactive streams for live feature status updates
- **Secret Management**: Handle YaFT API secrets for secure operations
- **Time-based Toggles**: Support for scheduled feature activation/deactivation
- **CRUD Operations**: Create, read, update, and delete feature toggles
- **Status Visualization**: Visual indicators for active/inactive/scheduled features

## Development Commands

### Building and Serving
```bash
npm start                    # Serve the application (default port 4200)
nx serve yaft-admin          # Alternative serve command
npm run build                # Build for production
nx build yaft-admin          # Alternative build command
```

### Testing
```bash
npm test                     # Run unit tests with Jest
nx test yaft-admin           # Alternative test command
npm run e2e                  # Run end-to-end tests
nx e2e yaft-admin-e2e        # Alternative E2E command
```

### Linting and Formatting
```bash
npm run lint                 # Lint the application
nx lint yaft-admin           # Alternative lint command
```

## Dependencies

### Core Angular Dependencies
- Angular 18+ with standalone components
- Angular Material for UI components
- Angular Animations for smooth transitions
- Angular Forms (Reactive Forms)
- Angular HTTP Client for API communication

### YaFT Integration
- `@tehw0lf/yaft` - Core YaFT TypeScript library
- HTTP client for API provider communication
- Browser localStorage for local storage providers

### Development Dependencies
- Nx build system and dev tools
- Jest for unit testing
- ESLint for code quality
- TypeScript for type safety

## Configuration

### Provider Configuration

**API Service Providers:**
- Require `apiUrl` (e.g., `http://localhost:8080`)
- Optional `baseUUID` for collection-based management
- Handle secrets for secure operations

**Local Storage Providers:**
- Use browser localStorage for persistence
- Optional `configPath` for configuration reference
- Generate mock secrets for testing

### Connection Flow

1. User selects provider type
2. Configures connection parameters (URL, UUID, etc.)
3. Application tests connection
4. If successful, loads existing features
5. Enables feature management operations

### Feature Management

**Creating Features:**
- Key (required): Unique identifier
- Value: Boolean string ('true'/'false')
- ActiveAt (optional): Scheduled activation time
- DisabledAt (optional): Scheduled deactivation time

**Updating Features:**
- Toggle enable/disable states
- Requires secret for API providers
- Updates reflected in real-time

**Deleting Features:**
- Permanent removal from data source
- Requires secret for API providers
- Confirmation dialog for safety

## Integration with YaFT Ecosystem

### YaFT Go Backend Integration
- Full REST API support
- Secret-based authentication
- Collection hash for efficient caching
- Time-based feature scheduling

### YaFT TypeScript Library Integration
- Uses same data models and interfaces
- Compatible with existing YaFT implementations
- Supports all YaFT provider patterns

### Local Development Integration
- Mock localStorage for testing
- Development server with hot reload
- CORS handling for API connections

## UI/UX Design Principles

### Material Design
- Consistent with Angular Material guidelines
- YaFT brand colors (purple primary, green accent)
- Responsive design for different screen sizes

### User Experience
- Step-by-step workflow with clear progression
- Visual feedback for all operations
- Error handling with user-friendly messages
- Loading states for async operations

### Accessibility
- ARIA labels for screen readers
- Keyboard navigation support
- High contrast mode compatibility
- Focus management for form interactions

## Pre-commit Validation Commands

```bash
npm run lint && npm test && npm run build
```

## Deployment Considerations

### Production Build
- Tree-shaking for minimal bundle size
- AOT compilation for performance
- Service worker support (if enabled)
- Environment-specific configurations

### Hosting Options
- Static hosting (Netlify, Vercel, GitHub Pages)
- Container deployment with nginx
- Integration with existing YaFT infrastructure
- CDN distribution for global performance

### Security Considerations
- HTTPS required for production API connections
- Secure secret storage and transmission
- CORS configuration for cross-origin requests
- Input validation and sanitization

## Troubleshooting

### Common Issues

**Connection Failures:**
- Verify API URL and accessibility
- Check CORS configuration on backend
- Ensure proper network connectivity
- Validate authentication credentials

**Feature Operations Not Working:**
- Confirm feature secrets are available
- Check provider permissions
- Verify API endpoint availability
- Review browser console for detailed errors

**Local Storage Issues:**
- Check browser localStorage availability
- Verify JSON format for stored data
- Clear localStorage cache if corrupted
- Ensure proper data structure

### Development Tips

- Use browser dev tools for debugging HTTP requests
- Check console logs for detailed error information
- Use Angular DevTools extension for component inspection
- Test with different provider types to ensure compatibility

## Future Enhancements

### Planned Features
- Bulk feature operations
- Feature toggle templates
- Advanced scheduling options
- Audit logging and history
- Feature flag analytics
- Multi-environment management

### API Extensions
- Additional provider types
- Custom data source connectors
- Advanced authentication methods
- Real-time collaboration features