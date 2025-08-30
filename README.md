# YaFT Admin

A modern Angular web application for managing feature toggles across different YaFT data sources. This admin interface provides a unified way to connect to and manage feature toggles regardless of whether they're stored in a Go API backend, local storage, or other supported YaFT providers.

![YaFT Admin](https://img.shields.io/badge/YaFT-Admin-purple?style=for-the-badge)
![Angular](https://img.shields.io/badge/Angular-18+-red?style=for-the-badge&logo=angular)
![Material](https://img.shields.io/badge/Material-Design-blue?style=for-the-badge&logo=material-design)

## Features

- **Multi-Provider Support**: Connect to different YaFT data sources (API Service, Local Storage, Boolean variants)
- **Stepper UI**: Guided workflow from connection configuration to feature management
- **Real-time Updates**: Live feature status updates with reactive streams
- **CRUD Operations**: Create, read, update, and delete feature toggles with proper validation
- **Secret Management**: Secure handling of YaFT API secrets for authenticated operations
- **Time-based Toggles**: Support for scheduled feature activation/deactivation
- **Responsive Design**: Modern Material Design interface that works on all screen sizes
- **Status Visualization**: Clear visual indicators for active/inactive/scheduled features

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- YaFT Go backend (optional, for API providers)
- Modern web browser

### Installation

```bash
# Clone or download the project
cd yaft-admin

# Install dependencies
npm install

# Start development server
npm start
```

Open your browser to `http://localhost:4200` to access the admin interface.

### Production Build

```bash
# Build for production
npm run build

# Serve static files (example with Python)
cd dist/yaft-admin
python -m http.server 8080
```

## Supported Provider Types

### 1. API Service (Feature Objects)

Connect to a full YaFT Go backend that supports Feature objects with time-based scheduling.

**Configuration:**
- **API Base URL**: `http://localhost:8080` (your YaFT API endpoint)
- **Base UUID**: Optional UUID for collection-based feature management

**Features:**
- Full CRUD operations with secrets
- Time-based activation/deactivation
- Collection hash for efficient caching
- Secure authentication

### 2. API Service (Boolean Values)

Connect to a simplified YaFT API that only handles boolean values.

**Configuration:**
- **API Base URL**: Your simplified YaFT API endpoint
- **Base UUID**: Optional UUID for feature grouping

**Features:**
- Basic enable/disable operations
- Lightweight API communication
- Simple boolean toggle management

### 3. Local Storage (Feature Objects)

Store feature toggles in browser localStorage with full Feature object support.

**Configuration:**
- **Configuration Path**: Reference path for documentation (e.g., `./config.json`)

**Features:**
- Client-side feature management
- Full Feature object support
- Persistent browser storage
- Offline capability

### 4. Local Storage (Boolean Values)

Simplified localStorage provider for basic boolean feature flags.

**Configuration:**
- **Configuration Path**: Reference path for configuration structure

**Features:**
- Simple boolean toggles
- Browser persistence
- Lightweight client-side management

## Usage Guide

### Step 1: Connect to Data Source

1. Select your provider type from the dropdown
2. Configure connection parameters:
   - **For API providers**: Enter API URL and optional Base UUID
   - **For localStorage providers**: Specify configuration path reference
3. Click "Connect" to test and establish the connection
4. Wait for the success confirmation

### Step 2: Manage Feature Toggles

Once connected, you can:

#### Create New Features
- Enter a unique feature key (e.g., `dark-mode`, `beta-features`)
- Set initial value (enabled/disabled)
- Optionally schedule activation/deactivation times
- Click "Create Feature Toggle"
- **Important**: Save the secret provided for API-created features!

#### View and Filter Features
- Browse all features in the sortable table
- View status indicators:
  - 🟢 **Active**: Feature is currently enabled
  - 🔴 **Inactive**: Feature is currently disabled
  - 🟡 **Scheduled**: Feature has future activation/deactivation scheduled

#### Toggle Features
- Use the slide toggle to quickly enable/disable features
- Changes apply immediately (requires secret for API providers)
- Status updates reflect in real-time

#### Advanced Operations
- **Edit**: Load feature data into the create form for modification
- **Delete**: Permanently remove features (with confirmation)
- **Copy Secret**: Copy feature secret to clipboard for external use

### Working with Secrets

For API-based providers, secrets are required for most operations:

- **New features**: Secret is generated and displayed once during creation
- **Existing features**: Secrets must be stored externally (not displayed for security)
- **Operations requiring secrets**: Toggle, update, delete
- **Security**: Secrets are never stored in the admin interface

### Time-based Scheduling

Schedule automatic feature activation/deactivation:

- **Active At**: When the feature should become active
- **Disabled At**: When the feature should be disabled
- **Behavior**: Time-based rules override manual value settings
- **Status**: Features show "Scheduled" status when future dates are set

## Development

### Available Commands

```bash
# Development server
npm start                    # Start dev server on port 4200
nx serve yaft-admin          # Alternative serve command

# Building
npm run build                # Production build
nx build yaft-admin          # Alternative build command

# Testing
npm test                     # Run unit tests
nx test yaft-admin           # Alternative test command
npm run e2e                  # Run E2E tests

# Code Quality
npm run lint                 # Lint the code
nx lint yaft-admin           # Alternative lint command
```

### Project Structure

```
src/
├── app/
│   ├── models/              # TypeScript interfaces and types
│   │   └── feature.model.ts # Core feature and provider models
│   ├── services/            # Angular services
│   │   └── yaft-provider.service.ts # Main provider abstraction
│   ├── app.ts              # Main application component
│   ├── app.html            # Application template
│   └── app.scss            # Component styles
├── styles.scss             # Global styles
└── main.ts                 # Application bootstrap
```

### Architecture

- **Component-based**: Single main component with Material UI
- **Service-oriented**: Provider abstraction for different data sources
- **Reactive**: RxJS streams for real-time updates
- **Type-safe**: Full TypeScript support with strict types

## Deployment

### Static Hosting

YaFT Admin is a single-page application that can be deployed to any static hosting service:

```bash
# Build for production
npm run build

# Deploy dist/yaft-admin folder to:
# - Netlify
# - Vercel
# - GitHub Pages
# - AWS S3 + CloudFront
# - Any web server
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM nginx:alpine
COPY dist/yaft-admin /usr/share/nginx/html
EXPOSE 80
```

```bash
# Build and run
docker build -t yaft-admin .
docker run -p 8080:80 yaft-admin
```

### Environment Configuration

For production deployments, consider:

- **HTTPS**: Required for API connections and clipboard operations
- **CORS**: Configure your YaFT API to allow admin interface origins
- **Base Href**: Set `<base href="/path/">` for subdirectory deployments
- **Security**: Use secure hosting and HTTPS for secret management

## Integration Examples

### With YaFT Go Backend

1. Start your YaFT Go API server:
   ```bash
   cd /path/to/yaft-go
   DB_DSN="your-postgres-connection" go run main.go
   ```

2. Configure YaFT Admin:
   - Provider: "API Service (Feature Objects)"
   - API URL: `http://localhost:8080`
   - Base UUID: (optional) `550e8400-e29b-41d4-a716-446655440000`

3. Create and manage features with full secret support

### With Local Storage

1. Configure YaFT Admin:
   - Provider: "Local Storage (Feature Objects)"
   - Configuration Path: `./features.json`

2. Features are stored in browser localStorage
3. Perfect for client-side applications and demos

### With Custom Providers

Extend `YaftProviderService` to add new provider types:

```typescript
// Add new provider type
export enum ProviderType {
  CUSTOM_API = 'custom-api',
  // ... existing types
}

// Implement in YaftProviderService
private connectToCustomApi(connection: ProviderConnection): Observable<boolean> {
  // Custom connection logic
}
```

## Troubleshooting

### Connection Issues

- **API not reachable**: Verify URL and network connectivity
- **CORS errors**: Configure API server to allow admin origin
- **SSL errors**: Use HTTPS for both admin and API in production

### Feature Operations Failing

- **Missing secrets**: Ensure you have the feature secret for API operations
- **Permission errors**: Verify API authentication and authorization
- **Local storage full**: Clear browser storage if using localStorage providers

### Build/Runtime Errors

- **Module not found**: Run `npm install` to install dependencies
- **Version conflicts**: Use Node.js 18+ and compatible Angular version
- **Memory issues**: Increase Node.js memory limit: `export NODE_OPTIONS=--max_old_space_size=8192`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow Angular coding standards
- Use TypeScript strict mode
- Add unit tests for new features
- Update documentation for API changes
- Test with multiple provider types

## License

MIT License - see LICENSE file for details.

## Related Projects

- **[YaFT TypeScript Library](https://www.npmjs.com/package/@tehw0lf/yaft)**: Core TypeScript library for feature toggles
- **[YaFT Go Backend](../Go/YaFT/)**: REST API backend with PostgreSQL storage
- **YaFT Examples**: Implementation examples and patterns

## Support

- 📖 **Documentation**: See [CLAUDE.md](./CLAUDE.md) for detailed development guide
- 🐛 **Bug Reports**: Open issues on GitHub
- 💡 **Feature Requests**: Discussion and enhancement proposals
- 💬 **Questions**: Create discussions for help and support

## Changelog

### v1.0.0
- Initial release with multi-provider support
- Angular Material UI with stepper workflow
- Full CRUD operations for feature toggles
- Secret management for API providers
- Time-based scheduling support
- Responsive design with status visualization

---

**Built with ❤️ using Angular, Material Design, and the YaFT ecosystem.**
