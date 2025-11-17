# Performance Optimization Guide

## Current Performance Monitoring

### Built-in Performance Monitor
Press **Ctrl+Shift+P** to toggle the performance monitor overlay (development only).

**Metrics displayed:**
- **FPS**: Frames per second (target: ≥55 FPS)
- **Data Rate**: WebSocket messages per second (expected: 50 msg/s)
- **WS Latency**: Time between data generation and reception (target: ≤50ms)
- **Processing Time**: Time to process each data update
- **Memory Usage**: JavaScript heap size
- **Total Renders**: Component render count

### Browser DevTools Performance Profiling

1. **Chrome DevTools Performance Tab:**
   ```
   1. Open DevTools (F12)
   2. Go to "Performance" tab
   3. Click Record (●)
   4. Use the app for 5-10 seconds
   5. Stop recording
   6. Analyze:
      - Long Tasks (>50ms) - highlighted in red
      - Frame drops - gaps in frame bar
      - Memory leaks - increasing memory over time
   ```

2. **React DevTools Profiler:**
   ```
   1. Install React DevTools extension
   2. Open "Profiler" tab
   3. Click Record (●)
   4. Interact with the app
   5. Stop and analyze:
      - Component render times
      - Why components re-rendered
      - Commit durations
   ```

3. **Chrome Memory Profiler:**
   ```
   1. DevTools > Memory tab
   2. Take heap snapshot
   3. Use app for a while
   4. Take another snapshot
   5. Compare to find memory leaks
   ```

## Current Optimizations (Already Implemented)

✅ **Data Management:**
- Bounded history (50 points = 1 second at 50Hz)
- Efficient array trimming with slice() instead of shift()
- Scan history limited to 120 points

✅ **React Optimizations:**
- React.memo on all components
- useMemo for expensive calculations
- useCallback for event handlers
- Chart animations disabled

✅ **Chart Optimizations:**
- Throttled updates from 50Hz to 20Hz
- Metrics still update at full 50Hz

✅ **Transition Optimizations:**
- Auto-pause during page navigation (250ms)
- Auto-pause during fullscreen toggle (250ms)

## Additional Optimization Opportunities

### 1. WebSocket Message Batching
**Current:** Processing every message individually (50 msg/s)
**Improvement:** Batch multiple messages and process in requestAnimationFrame

```typescript
// In websocket-store.ts
const messageBatch: MotorData[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'data') {
    messageBatch.push(message.payload);

    if (!batchTimeout) {
      batchTimeout = setTimeout(() => {
        // Process all batched messages at once
        processBatch(messageBatch);
        messageBatch.length = 0;
        batchTimeout = null;
      }, 20); // Process every 20ms (50Hz → effectively 50 updates/s but batched)
    }
  }
};
```

**Benefit:** Reduces state updates from 50/s to ~50/s but with better batching

### 2. Web Worker for Data Processing
**Current:** All processing on main thread
**Improvement:** Offload heavy calculations to Web Worker

```typescript
// worker/data-processor.ts
self.onmessage = (e) => {
  const { data, type } = e.data;

  if (type === 'process') {
    // Heavy calculations here
    const processed = {
      chartData: transformChartData(data),
      metrics: calculateMetrics(data),
    };

    self.postMessage({ type: 'processed', payload: processed });
  }
};
```

**Benefit:** Keeps main thread free for rendering, improves FPS

### 3. Virtual Scrolling for Large Data Sets
If you add a data history viewer:

```bash
pnpm add react-window
```

**Benefit:** Only renders visible rows, handles millions of data points

### 4. Selective Component Updates
Create a custom equality function for React.memo:

```typescript
export const ModeBMotorCard = memo(
  function ModeBMotorCard({ motorNumber, dataHistory, currentData }) {
    // Component code
  },
  (prevProps, nextProps) => {
    // Only re-render if relevant data changed
    return (
      prevProps.motorNumber === nextProps.motorNumber &&
      prevProps.dataHistory.length === nextProps.dataHistory.length &&
      prevProps.currentData?.time_ms === nextProps.currentData?.time_ms
    );
  }
);
```

**Benefit:** Prevents unnecessary re-renders when props haven't meaningfully changed

### 5. Reduce Zustand Updates
**Current:** Every WebSocket message triggers store update
**Improvement:** Use Zustand's shallow comparison

```typescript
// In components
const { currentData, dataHistory } = useWebSocketStore(
  (state) => ({
    currentData: state.currentData,
    dataHistory: state.dataHistory,
  }),
  shallow // Only re-render if values change
);
```

### 6. Chart Data Windowing
**Current:** Slicing data on every render
**Improvement:** Pre-slice in store

```typescript
// In websocket-store.ts
interface WebSocketStore {
  // ...
  chartData: ChartDataPoint[]; // Pre-processed for charts
}

// When adding new data
set({
  currentData: newData,
  dataHistory: updatedHistory,
  chartData: updatedHistory.slice(-100).map(transformToChartData),
});
```

**Benefit:** Components receive ready-to-use data, no processing on render

## Performance Debugging Checklist

When the app feels slow:

1. **Open Performance Monitor** (Ctrl+Shift+P)
   - Is FPS < 55? → Check which component is rendering too much
   - Is WS Latency > 100ms? → Network issue or server overload
   - Is Data Rate ≠ 50 msg/s? → WebSocket connection issue

2. **Check Chrome DevTools Performance:**
   - Look for Long Tasks (>50ms)
   - Identify which functions are taking too long
   - Check for layout thrashing (forced reflows)

3. **React DevTools Profiler:**
   - Which components render most frequently?
   - Are they rendering unnecessarily?
   - Check "why did this render?"

4. **Memory Leaks:**
   - Take heap snapshot before and after
   - Look for increasing object counts
   - Check for detached DOM nodes

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| FPS | ≥55 | <45 |
| WS Latency | ≤50ms | >200ms |
| Data Rate | 50 msg/s | <40 or >60 |
| Processing Time | <5ms | >20ms |
| Memory Growth | <10MB/min | >50MB/min |

## Quick Wins for Performance

1. **Disable animations during development:**
   ```css
   /* globals.css */
   * { transition: none !important; animation: none !important; }
   ```

2. **Reduce chart history:**
   ```typescript
   // websocket-store.ts
   const DEFAULT_MAX_HISTORY = 25; // Instead of 50
   ```

3. **Increase throttle time:**
   ```typescript
   // ModeBMotorCard.tsx
   if (now - lastChartUpdateRef.current > 100) // Instead of 50ms
   ```

4. **Hide tooltips during updates:**
   - Tooltips cause extra DOM calculations
   - Consider disabling during high-frequency updates

## Experimental: requestIdleCallback

For non-critical updates (like statistics):

```typescript
useEffect(() => {
  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(() => {
      // Update non-critical UI elements
      updateStatistics();
    });
    return () => cancelIdleCallback(id);
  }
}, [data]);
```

## Monitoring in Production

To enable performance monitoring in production:

```typescript
// src/app/page.tsx
// Change this:
{process.env.NODE_ENV === 'development' && <PerformanceMonitor />}

// To this (with permission):
<PerformanceMonitor />
```

Or add an environment variable:
```bash
NEXT_PUBLIC_ENABLE_PERF_MONITOR=true
```

## Summary

**To measure performance:**
1. Use built-in Performance Monitor (Ctrl+Shift+P)
2. Chrome DevTools Performance tab for detailed profiling
3. React DevTools Profiler for component analysis
4. Memory tab for leak detection

**To improve performance:**
1. Current optimizations already handle most cases
2. Consider Web Workers for heavy processing
3. Batch WebSocket messages if needed
4. Use selective component updates
5. Monitor FPS and latency in real-time

**Red flags:**
- FPS drops below 45
- Latency exceeds 200ms
- Memory grows >50MB/min
- Processing time >20ms per update
