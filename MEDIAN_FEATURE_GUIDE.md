# Statistical Median Weather Feature - Quick Reference

## What is it?

A new feature that compares weather forecasts and actual observations against **statistical historical medians** for the current month. This helps you understand if the weather was "typical" or unusual for that time of year.

## How to Use

1. **Search for a city** or **detect your location** (same as before)
2. **View the day cards** - You'll now see new median weather information:

### New UI Elements

**1. Small badges below forecast/actual columns:**
- `"vs median: Warmer"` - Temperature was above the historical median
- `"vs median: Cooler"` - Temperature was below the historical median
- `"vs median: Typical"` - Temperature was close to the historical median

**2. Median information section (bottom of each card):**
```
📊 Monthly median (10 years)
  ☀️ 10.5° avg | 2.3 mm rain

[✓] Forecast vs median Clear sky
[✓] Actual vs median Clear sky
```

**3. Color coding:**
- 🟢 **Green badge**: Matches the historical median (typical weather)
- 🔴 **Red badge**: Differs from historical median (unusual weather)

## What It Compares

### Temperature
- **Warmer**: More than +1°C above the historical median
- **Cooler**: More than -1°C below the historical median
- **Typical**: Within ±1°C of the historical median

### Precipitation
- **Rainier**: More than +1mm above the historical median
- **Drier**: More than -1mm below the historical median
- **Typical**: Within ±1mm of the historical median

### Weather Condition
- **Match**: Same weather category as most common historically
- **Mismatch**: Different weather category (e.g., clear vs cloudy)

## How It Works

1. **Fetch historical data**: Gets 10 years of historical weather for the current month
2. **Calculate medians**: Computes the statistical median for temperature, precipitation, and weather conditions
3. **Compare**: Checks if today's forecast/actual weather is typical compared to the median
4. **Display**: Shows visual indicators and statistics

## Technical Details

- **Data Source**: Open-Meteo Historical Weather API (same API you're already using!)
- **Historical Range**: 10 years of data (approximately 3,650 days)
- **No New Dependencies**: Pure vanilla JavaScript, no new libraries
- **Performance**: Fetches all data in parallel for fast loading

## Example Scenario

**March 1st in Berlin:**

Historical median for March (10 years):
- Temperature: 10.5°C average
- Precipitation: 2.3 mm
- Most common condition: Overcast

**Forecast:** Clear sky, 15°C, 0mm rain
- **vs median badge**: Warmer (15°C is 4.5°C above median)
- **Condition badge**: ✗ vs median Overcast (mismatch)

**Actual:** Clear sky, 14°C, 0mm rain
- **vs median badge**: Warmer (14°C is 3.5°C above median)
- **Condition badge**: ✗ vs median Overcast (mismatch)

**Result**: Both forecast and actual predicted warmer, clearer weather than typical for March in Berlin!

## Benefits

1. **Context**: Know if weather was normal or unusual for the season
2. **Baseline**: Compare forecast accuracy against a "dumb" statistical baseline
3. **Insight**: Understand seasonal patterns and typical weather
4. **Decision Making**: Helps plan activities based on typical conditions

## FAQ

**Q: Does this slow down the app?**
A: No! The data is fetched in parallel, so there's no additional delay.

**Q: What if the API fails?**
A: The app gracefully degrades - you'll still see forecast vs actual comparison, just without median data.

**Q: Why 10 years?**
A: It's a good balance between having enough data for robust statistics and keeping performance fast. This can be adjusted if needed.

**Q: Can I change the historical range?**
A: Currently it's set to 10 years, but this can be easily modified in the code.

**Q: Is this using a different API?**
A: No! It uses the same Open-Meteo Historical Weather API your app already uses.

## Troubleshooting

**Median info not showing:**
- Check browser console for errors
- Verify internet connection
- The feature requires an additional API call, so it might take a moment to load

**Inaccurate medians:**
- The medians are calculated from actual historical data
- They represent what's "typical" based on 10 years of observations
- Some locations may have highly variable weather

**Performance issues:**
- The median calculation is efficient and happens in real-time
- No data is cached, so each request is fresh
- If issues persist, consider adjusting the historical years range

## Future Enhancements

- Adjustable historical range (5, 10, 20 years)
- Caching for improved performance
- Additional statistical metrics
- Seasonal trend visualizations
- Wind speed and direction comparisons

---

**Questions?** Check the full documentation in `PLAN_STATISTICAL.md` and `IMPLEMENTATION_SUMMARY.md`