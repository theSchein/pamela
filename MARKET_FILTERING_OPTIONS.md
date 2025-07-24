# Market Filtering Options

## Current Implementation (7-day minimum)
- Filters out all markets ending within 7 days
- Should eliminate most 2024 markets but might be too restrictive

## Alternative: Year-based filtering
```typescript
// Only allow markets ending in 2025 or later
const endDate = new Date(market.end_date_iso);
const marketYear = endDate.getFullYear();
const currentYear = new Date().getFullYear();
const isCurrentYearOrLater = marketYear >= currentYear;
```

## Alternative: Month-based filtering  
```typescript
// Only allow markets ending this month or later
const endDate = new Date(market.end_date_iso);
const currentDate = new Date();
const isThisMonthOrLater = (
  endDate.getFullYear() > currentDate.getFullYear() ||
  (endDate.getFullYear() === currentDate.getFullYear() && 
   endDate.getMonth() >= currentDate.getMonth())
);
```

## Test the current 7-day approach first
The current implementation should:
1. Block all 2024 markets
2. Block markets ending in the next 7 days
3. Only allow markets with substantial future runway
4. Allow markets with no end date (perpetual)