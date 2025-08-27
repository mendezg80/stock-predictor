# Stock Market Prediction Game

A static web app that lets you guess whether a stock's closing price will go up or down, using real historical market data from Alpha Vantage. It also shows a simple model's next-day suggestion and tracks the model's score alongside yours.

## How it works
- Enter any stock ticker (e.g., `MSFT`, `COF`).
- The app fetches real daily price data from Alpha Vantage.
- It selects a random trading start date between 7 and 100 days before today.
- The chart initially shows the 6 prior trading days plus the start date (7 points total).
- You guess whether the next trading day's close will go up or down.
- The app reveals the next day's close, updates the chart, and your score.
- Continue until you end the game.
 - The built-in model (SMA(5) slope) provides a suggested direction and its own score.

## Local development
Just open `index.html` in a browser. It is a static site and requires no server.

## GitHub Pages deployment
You can host this directly on GitHub Pages:

1. Create a new repository and add these files (`index.html`, `styles.css`, `app.js`, `README.md`).
2. Commit and push to GitHub.
3. In the repository settings, go to Pages and set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or `gh-pages`) and folder `/root` (the default)
4. Save. Wait for the site to build, then open the provided Pages URL.

## Configuration
- The app uses Alpha Vantage's `TIME_SERIES_DAILY_ADJUSTED` API with `outputsize=full` to ensure enough historical data. A free API key is included in `app.js` as provided for this exercise.
- Note that Alpha Vantage free tier limits to 5 requests per minute and 100 per day.

## Caching
- Time series responses are cached in `localStorage` per-ticker for 12 hours to reduce API calls and avoid rate limits. If the cache is older than 12 hours, the data is re-fetched.

## Model details
- The model computes a 5-day Simple Moving Average (SMA) each day and uses the SMA slope (today vs. yesterday) to suggest the next day's direction:
  - Slope up → suggest Up
  - Slope down or flat → suggest Down
- The model score increments when its suggestion matches the actual next day's move.

## Privacy note
The Alpha Vantage API key is embedded client-side, which is acceptable for this exercise. For production use, consider proxying requests via a server to avoid exposing private keys.