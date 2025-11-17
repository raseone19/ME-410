# Build & Deployment Guide

## Available Commands

### Development

```bash
# Development with hot reload
pnpm dev

# Development with mock WebSocket server (simulated data)
pnpm dev:mock

# Development with real ESP32 via serial
pnpm dev:serial
```

### Production

```bash
# Build for production
pnpm build

# Start production server (requires build first)
pnpm start

# Start production server with mock data
pnpm start:mock

# Build AND start with mock data (one command)
pnpm prod:mock
```

### Testing & Utilities

```bash
# Run mock WebSocket server only
pnpm mock-server

# Run serial bridge only
pnpm serial-bridge

# List available serial ports
pnpm list-ports

# Test simulator
pnpm test-simulator

# Test WebSocket client
pnpm test-ws-client
```

## Production Build & Test Workflow

### Quick Test (Recommended)

```bash
# Build and run production with mock data in one command
pnpm prod:mock
```

Then open http://localhost:3000 in your browser.

### Step by Step

```bash
# 1. Build the production version
pnpm build

# 2. Test with mock data
pnpm start:mock

# OR test with real ESP32
pnpm serial-bridge &
pnpm start
```

## What's the Difference?

### Development vs Production

| Aspect | Development (`pnpm dev`) | Production (`pnpm prod:mock`) |
|--------|-------------------------|------------------------------|
| Build Time | Instant | ~30-60 seconds |
| Performance | Slower (dev tools) | Optimized & Fast |
| Bundle Size | Large | Minified & Small |
| Hot Reload | ✅ Yes | ❌ No |
| Performance Monitor | ✅ Enabled | ❌ Disabled |
| Source Maps | ✅ Yes | ❌ No |
| Use Case | Development | Testing production build |

### Mock vs Serial

| Aspect | Mock (`pnpm dev:mock`) | Serial (`pnpm dev:serial`) |
|--------|----------------------|---------------------------|
| Hardware | ❌ Not needed | ✅ ESP32 required |
| Data | 🤖 Simulated | 📡 Real sensor data |
| Consistency | Predictable | Variable |
| Setup | Easy | Requires USB connection |

## Performance Testing

To test production performance:

1. **Build production:**
   ```bash
   pnpm prod:mock
   ```

2. **Open browser DevTools:**
   - Press F12
   - Go to "Performance" tab
   - Record for 5-10 seconds
   - Analyze FPS, long tasks, memory

3. **Check metrics:**
   - Target FPS: ≥55
   - Data Rate: ~50 msg/s
   - Message Interval: ~20ms

## Deployment

### Build for Deployment

```bash
# Clean build
rm -rf .next
pnpm build
```

### Deploy to Vercel/Netlify

```bash
# Vercel
vercel --prod

# Or use Vercel GitHub integration (automatic)
git push origin main
```

### Self-Hosted

```bash
# Build
pnpm build

# On server, start production
NODE_ENV=production pnpm start

# With PM2 (recommended for production)
pm2 start "pnpm start" --name motor-dashboard
pm2 save
pm2 startup
```

## Environment Variables

Create `.env.local` for custom configuration:

```bash
# WebSocket URL (default: ws://localhost:3001)
NEXT_PUBLIC_WS_URL=ws://your-esp32-ip:3001

# Enable performance monitor in production
NEXT_PUBLIC_ENABLE_PERF_MONITOR=true
```

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
pnpm install
pnpm build
```

### Port Already in Use

```bash
# Kill processes on port 3000-3001
lsof -ti:3000 | xargs kill
lsof -ti:3001 | xargs kill

# Or use different port
pnpm start -p 3002
```

### Mock Server Not Working

```bash
# Run mock server separately
pnpm mock-server

# In another terminal
pnpm start
```

## Production Checklist

Before deploying:

- [ ] `pnpm build` succeeds without errors
- [ ] Test with `pnpm prod:mock`
- [ ] Check FPS ≥55 in production build
- [ ] Verify all 4 motor cards render correctly
- [ ] Test fullscreen mode
- [ ] Test page navigation (sidebar)
- [ ] Verify data updates at 50 msg/s
- [ ] Check browser console for errors
- [ ] Test on mobile devices
- [ ] Verify WebSocket reconnects after disconnect

## Performance Optimization

If production build is slow:

1. **Check bundle size:**
   ```bash
   pnpm build
   # Look for large chunks in output
   ```

2. **Analyze bundle:**
   ```bash
   pnpm add -D @next/bundle-analyzer
   # Add to next.config.js
   ANALYZE=true pnpm build
   ```

3. **Monitor in production:**
   - Enable performance monitor in .env.local
   - Check Chrome DevTools Performance tab
   - Look for long tasks (>50ms)

## WebSocket Configuration

The app connects to WebSocket at:
- **Development:** `ws://localhost:3001` (mock server)
- **Production:** Set via `NEXT_PUBLIC_WS_URL` env variable

### Connect to Real ESP32

```bash
# Find ESP32 IP address
# On ESP32 serial monitor, it will print the IP

# Set environment variable
export NEXT_PUBLIC_WS_URL=ws://192.168.1.100:3001

# Build and run
pnpm prod:mock
```

## Quick Reference

```bash
# Most common workflow:

# Development (with hot reload & mock data)
pnpm dev:mock

# Test production build locally
pnpm prod:mock

# Production deployment
pnpm build
# Then deploy .next folder to hosting
```

---

**Need Help?**
- Check PERFORMANCE.md for optimization tips
- See README.md for general setup
- Check logs in browser console (F12)
