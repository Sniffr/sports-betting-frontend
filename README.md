# Super Bet - Sports Betting Demo Frontend

A modern React + Vite + TypeScript demo sports betting application with live odds from The Odds API. Features multiple betting markets (1X2, Spread, Totals), Real vs Sim betting modes, per-league caching, and full Docker support.

## Features

- **Live Sports Odds**: Real-time odds from The Odds API for football/soccer leagues
- **Multiple Markets**: 1X2 (Home/Draw/Away), Spread (Handicap), and Totals (Over/Under)
- **Dual Betting Modes**:
  - **Real Mode**: Place bets with manual settlement after match results
  - **Sim Mode**: Run instant simulations with immediate results
- **Smart Caching**: localStorage-based caching with 5-minute TTL to reduce API calls
- **League Tabs**: Switch between 10 major football leagues
- **API Quota Tracking**: Display remaining API requests in real-time
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- React 18 + TypeScript
- Vite for fast development and optimized builds
- Tailwind CSS for styling
- shadcn/ui for UI components
- The Odds API for live sports data
- Docker + nginx for production deployment

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Docker Deployment

### Using Docker

```bash
# Build the Docker image
docker build -t super-bet .

# Run the container
docker run -p 8080:80 super-bet

# Access the app at http://localhost:8080
```

### Using Docker Compose

```bash
# Build and start the container
docker compose up --build -d

# View logs
docker compose logs -f

# Stop the container
docker compose down

# Access the app at http://localhost:8080
```

## Configuration

### API Key

The Odds API key is currently hardcoded in `src/App.tsx` for demo purposes:

```typescript
const API_KEY = 'a3b186794403af630516172e9184ef1f'
```

For production use, consider using environment variables:

1. Update `src/App.tsx`:
```typescript
const API_KEY = import.meta.env.VITE_ODDS_API_KEY
```

2. Create `.env` file:
```
VITE_ODDS_API_KEY=your_api_key_here
```

3. For Docker, pass as build argument:
```dockerfile
ARG VITE_ODDS_API_KEY
ENV VITE_ODDS_API_KEY=$VITE_ODDS_API_KEY
```

### Cache TTL

Adjust cache time-to-live in `src/App.tsx`:

```typescript
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes (default)
```

## Project Structure

```
sports-betting-demo/
├── public/              # Static assets
├── src/
│   ├── components/ui/   # shadcn/ui components
│   ├── lib/            # Utility functions
│   ├── App.tsx         # Main application component
│   ├── App.css         # Global styles
│   └── main.tsx        # Entry point
├── Dockerfile          # Multi-stage Docker build
├── docker-compose.yml  # Docker Compose configuration
├── nginx.conf          # nginx SPA routing configuration
├── ARCHITECTURE.md     # Detailed architecture documentation
└── package.json        # Dependencies and scripts
```

## How It Works

### Betting Flow

1. **Select League**: Choose from 10 football leagues in the tabs
2. **Browse Matches**: View upcoming matches with live odds
3. **Add Selections**: Click on odds to add to betslip
4. **Choose Mode**: Toggle between Real and Sim mode
5. **Place Bet**: 
   - **Sim Mode**: Run instant simulations with configurable trials
   - **Real Mode**: Place bet and settle manually after match results

### Markets

- **1X2 (Green)**: Home win (1), Draw (X), Away win (2)
- **Spread (Blue)**: Handicap betting with point spreads
- **Totals (Purple)**: Over/Under total goals

### Caching

The app caches league data in localStorage for 5 minutes to reduce API calls:
- Switching between recently viewed leagues is instant
- Force refresh available via Refresh button
- Cache persists across page reloads

## API Usage

The app uses The Odds API (free tier: 500 requests/month):
- Each league fetch costs 3 requests (h2h + spreads + totals)
- Caching significantly reduces API usage
- Remaining requests displayed in header

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding New Features

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation on:
- Component structure
- State management
- API integration
- Caching strategy
- Betting logic
- And more...

## Troubleshooting

### Odds Not Loading

- Check API key is valid
- Verify API quota not exhausted (check header)
- Try force refresh button

### Markets Not Showing

- Some leagues/bookmakers don't provide all markets
- "Not available" indicates missing market data
- Try switching to a different league

### Docker Build Issues

- Ensure `package-lock.json` exists
- Check Docker daemon is running
- Verify all files are present

### SPA Routing 404s

- Ensure `nginx.conf` is properly configured
- Check `try_files` directive includes `/index.html` fallback

## License

This is a demo application for educational purposes.

## Credits

- Built with [React](https://react.dev/)
- Powered by [The Odds API](https://the-odds-api.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

## Support

For detailed architecture and implementation details, see [ARCHITECTURE.md](./ARCHITECTURE.md).

For issues or questions, please open an issue on GitHub.
