# Statistical Median Weather Comparison Feature Plan

## Overview
This document outlines the implementation plan for adding a statistical median weather comparison feature to the RetroCast application. This feature will compare current weather forecasts against historical statistical medians for the given month and location.

## Current Architecture
The application currently:
- Fetches actual observed weather using `fetchActualWeather` from Archive API
- Fetches historical forecasts using `fetchHistoricalForecast` from Historical Forecast API
- Compares forecast vs actual weather with accuracy metrics
- Displays results in a UI grid

## Implementation Plan

### 1. Data Collection Extension
We'll extend the historical data fetching to support monthly aggregations:

#### New Function: `fetchMonthlyHistoricalData(lat, lon, month)`
- Fetches daily weather data for a specific month across multiple years (2010-2023)
- Uses the existing Archive API endpoint
- Returns array of daily weather records for the month

### 2. Statistical Calculation Functions
#### New Functions:
- `calculateTemperatureMedian(dailyData)` - Computes median temperature for the month
- `calculatePrecipitationMedian(dailyData)` - Computes median precipitation for the month
- `calculateWeatherConditionMedian(dailyData)` - Computes most frequent weather condition for the month

### 3. Integration with Comparison Engine
#### Modified Function: `compareForecastToActual(forecast, actual, statisticalMedian)`
- Extends the existing comparison to include statistical median data
- Adds new accuracy metrics comparing forecast vs statistical median

### 4. UI Enhancement
#### Modified Components:
- Update `renderDayCard` to show median comparison alongside accuracy scores
- Add new UI element displaying statistical baseline for comparison
- Include visual indicators showing how forecast performs vs statistical approach

### 5. Implementation Details

#### Data Fetching Logic:
The Archive API allows retrieving historical data for specific date ranges, so we can:
1. Query for a specific month (e.g., July) across multiple years
2. Collect all available daily records for that month
3. Calculate medians from this dataset

#### Statistical Calculations:
- **Temperature**: Median of daily maximum temperatures
- **Precipitation**: Median of daily precipitation sums
- **Weather Conditions**: Most frequent weather code/category

#### Comparison Metrics:
- Display statistical median alongside forecast and actual
- Show percentage difference between forecast and median
- Visual indicators showing how forecast performance compares to statistical baseline

### 6. Technical Approach
- Leverages existing Open-Meteo APIs (no new API keys required)
- Maintains consistency with current architecture
- Minimal performance impact through efficient data gathering
- Uses existing data structures and comparison algorithms

### 7. API Usage
- Uses `archive-api.open-meteo.com/v1/archive` endpoint
- Same parameters and structure as existing `fetchActualWeather`
- No changes to authentication or rate limiting