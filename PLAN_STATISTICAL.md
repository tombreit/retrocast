# Statistical Median Weather Comparison - Implementation Plan

## Overview

This document outlines the implementation of a new feature that compares weather forecasts and actual observations against statistical median weather for a given month and location. This provides a "dumb" statistical baseline to evaluate forecast performance.

## API Feasibility

**Open-Meteo Historical Weather API** is the perfect solution:
- Provides historical weather data from 1940 to present
- Your app already uses `archive-api.open-meteo.com/v1/archive`
- No new libraries needed - pure vanilla ES6 JavaScript
- Free, no API key required
- ~600 requests/minute limit (more than sufficient)

## Implementation Plan

### Phase 1: API Service Enhancements (`scripts/api-service.js`)

#### 1. Add `fetchHistoricalWeatherForMonth(lat, lon, month, years = 10)`
- Fetch historical weather for a specific month across multiple years
- Uses existing `API.ARCHIVE` endpoint
- Date range: 10 years ago to yesterday
- Returns array of day objects with temperature, precipitation, weather codes

#### 2. Add `fetchMonthlyMedianWeather(lat, lon, month)`
- Calls `fetchHistoricalWeatherForMonth()` to get historical data
- Calculates median statistics:
  - Median temperature (avg, max, min)
  - Median precipitation (sum, hours)
  - Most common weather condition (mode)
- Returns object with all calculated medians and sample size

**Key Implementation Details:**
- Use existing `parseDayData()` and `DAILY_PARAMS_ARCHIVE` constants
- Implement simple median calculation: sort array → pick middle value
- Implement mode calculation for weather codes (most frequent value)
- Handle edge cases: missing data, API errors

### Phase 2: Comparison Engine Updates (`scripts/comparison-engine.js`)

#### 1. Add `compareForecastToMedian(forecast, median)`
- Compares forecast day against monthly median
- Returns:
  - Temperature comparison (warmer/cooler/typical based on ±1°C threshold)
  - Precipitation comparison (rainier/drier/typical based on ±1mm threshold)
  - Condition match (whether weather category matches median)

#### 2. Add `compareActualToMedian(actual, median)`
- Same structure as `compareForecastToMedian` but for actual weather
- Provides context on whether observed weather was typical

#### 3. Modify `fetchAndCompareAll(location)`
- Add third parallel API call: `fetchMonthlyMedianWeather(lat, lon, currentMonth)`
- Store median data in results: `monthlyMedian`, `forecastVsMedian`, `actualVsMedian`
- Handle case where median data is unavailable (graceful degradation)

### Phase 3: UI Enhancements (`scripts/ui-controller.js`)

#### 1. Modify `renderDayCard(day, index)`
- Add small badges below each column showing "vs median" status
- Examples: "Warmer", "Cooler", "Typical"
- Use Lucide icons for visual appeal

#### 2. Add new section to day card: Median Information
- Display monthly median statistics (10 years)
- Show typical temperature and precipitation
- Show comparison badges for both forecast and actual
- Use color coding: green = matches median, red = differs

**Design Considerations:**
- Keep existing layout unchanged
- Add median info as an additional section below existing footer
- Use existing color scheme and styling patterns
- Maintain responsiveness on mobile devices

### Phase 4: CSS Styling (`styles/main.css`)

**Add new CSS classes:**
- `.day-card__median-info` - Container for median section
- `.median-stat` - Individual statistic row
- `.median-label` - Label styling
- `.median-value` - Value styling
- `.median-badge` - Comparison badge styling
- `.median-badge.match` - Green styling for matches
- `.median-badge.mismatch` - Red styling for mismatches
- `.day-card__median-badge` - Small in-column badges
- `@keyframes fadeIn` - Smooth animation for median section

## Data Flow

```
User selects location
    ↓
_parallel fetch_ (3 concurrent API calls):
    ├─ fetchActualWeather()        [3 days]
    ├─ fetchHistoricalForecast()   [3 days]
    └─ fetchMonthlyMedianWeather() [10 years, current month]
    ↓
Calculate comparisons:
    ├─ compareForecastToActual()   [existing]
    ├─ compareForecastToMedian()   [new]
    └─ compareActualToMedian()     [new]
    ↓
Render day cards with all comparisons
```

## Comparison Logic

**Temperature:**
- `diff = observed_temp - median_temp`
- `warmer`: diff > +1°C
- `cooler`: diff < -1°C
- `typical`: -1°C ≤ diff ≤ +1°C

**Precipitation:**
- `diff = observed_precip - median_precip`
- `rainier`: diff > +1mm
- `drier`: diff < -1mm
- `typical`: |diff| ≤ 1mm

**Condition:**
- Compare weather categories (clear, cloudy, rain, snow, etc.)
- `match`: same category
- `mismatch`: different categories

## Benefits

1. **Contextual Understanding**: Users see if weather was typical for the season
2. **"Dumb" Baseline**: Median provides statistical reference without complex models
3. **No New Dependencies**: Uses existing Open-Meteo API
4. **Visual Clarity**: Color-coded badges make comparisons intuitive
5. **Historical Insight**: 10 years of data provides robust statistics

## Configuration & Considerations

### Historical Data Range
- **Current choice**: 10 years (good balance of sample size vs API performance)
- **Alternative**: 5 years (faster, but less robust)
- **Alternative**: 20 years (more robust, but slower)

### UI Placement
- **Current choice**: Add median info section below existing footer
- Maintains clean separation of concerns
- Preserves existing layout

### Performance Optimization
- **Current approach**: Fetch all data in parallel (3 total API calls)
- Historical data fetch for 10 years = ~3650 days of data
- Open-Meteo handles this efficiently
- No caching implemented initially (can be added later if needed)

### Error Handling
- If median API fails, gracefully display existing forecast vs actual
- Median data is optional - app continues without it
- Errors are logged to console for debugging

## File Changes Summary

1. **`scripts/api-service.js`**
   - Add `fetchHistoricalWeatherForMonth()` function
   - Add `fetchMonthlyMedianWeather()` function

2. **`scripts/comparison-engine.js`**
   - Add `compareForecastToMedian()` function
   - Add `compareActualToMedian()` function
   - Modify `fetchAndCompareAll()` to include median data

3. **`scripts/ui-controller.js`**
   - Modify `renderDayCard()` to display median comparisons
   - Add median information section to day cards

4. **`styles/main.css`**
   - Add all median-related CSS classes
   - Add fade-in animation for median section

## Testing

- Verified with Open-Meteo Historical Weather API
- Tested median calculation algorithms
- Confirmed UI rendering with median information
- Validated comparison logic with real data

## Future Enhancements (Optional)

- Add ability to compare against different statistical metrics (mean, mode)
- Show seasonal trends (e.g., how this month compares to previous months)
- Add precipitation probability comparisons
- Include wind speed and direction in comparisons
- Allow users to adjust the historical data range (5, 10, 20 years)
- Implement caching for improved performance

## API Details

**Endpoint**: `https://archive-api.open-meteo.com/v1/archive`

**Parameters Used**:
- `latitude`, `longitude` - Location coordinates
- `start_date` - Start of historical range (10 years ago)
- `end_date` - Yesterday
- `daily` - Weather parameters (temperature, precipitation, weather code)
- `timezone` - Auto-detect local timezone

**Rate Limits**: Open-Meteo allows ~600 requests per minute

**Data Availability**: Historical data from 1940 to present, with 9km resolution from 2017 onwards.