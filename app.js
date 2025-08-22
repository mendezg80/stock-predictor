(() => {
  const API_KEY = "Q49LMYC8Q9U3G1RS";
  const BASE_URL = "https://www.alphavantage.co/query";

  const els = {
    form: document.getElementById("ticker-form"),
    input: document.getElementById("ticker-input"),
    error: document.getElementById("form-error"),
    note: document.getElementById("form-note"),
    game: document.getElementById("game"),
    statusTicker: document.getElementById("status-ticker"),
    statusDate: document.getElementById("status-date"),
    statusScore: document.getElementById("status-score"),
    btnUp: document.getElementById("guess-up"),
    btnDown: document.getElementById("guess-down"),
    btnEnd: document.getElementById("end-game"),
    btnRestart: document.getElementById("restart"),
    chartCanvas: document.getElementById("price-chart"),
    roundResult: document.getElementById("round-result"),
  };

  /** @type {import('chart.js').Chart | null} */
  let priceChart = null;

  const initialState = () => ({
    ticker: null,
    seriesAsc: [], // [{ date: 'YYYY-MM-DD', close: number }], ascending by date
    startIndex: null, // index in seriesAsc of start date
    currentIndex: null, // index of the latest day shown (current date)
    score: 0,
    inRound: false,
    ended: false,
  });

  let state = initialState();

  function setLoading(isLoading) {
    els.input.disabled = isLoading;
    els.form.querySelector("button[type=submit]").disabled = isLoading;
    els.btnUp.disabled = isLoading || !state.ticker || state.ended;
    els.btnDown.disabled = isLoading || !state.ticker || state.ended;
    els.btnEnd.disabled = isLoading || !state.ticker || state.ended;
    els.btnRestart.disabled = isLoading;
  }

  function showError(msg) {
    els.error.textContent = msg || "";
  }

  function showNote(msg) {
    els.note.textContent = msg || "";
  }

  function updateStatusBar() {
    els.statusTicker.textContent = state.ticker || "—";
    els.statusDate.textContent = state.currentIndex != null ? state.seriesAsc[state.currentIndex].date : "—";
    els.statusScore.textContent = String(state.score);
  }

  async function fetchTimeSeriesDailyAdjusted(ticker) {
    const params = new URLSearchParams({
      function: "TIME_SERIES_DAILY_ADJUSTED",
      symbol: ticker,
      apikey: API_KEY,
      outputsize: "full",
    });
    const url = `${BASE_URL}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Network error: ${res.status}`);
    }
    const data = await res.json();
    if (data.Note) {
      const note = data.Note.includes("Thank you for using Alpha Vantage")
        ? "API limit reached. Please wait a minute and try again."
        : data.Note;
      const err = new Error(note);
      err.code = "RATE_LIMIT";
      throw err;
    }
    if (data.Information) {
      const err = new Error(data.Information);
      err.code = "INFORMATION";
      throw err;
    }
    if (data["Error Message"]) {
      const err = new Error("Invalid ticker symbol. Please try another.");
      err.code = "INVALID_TICKER";
      throw err;
    }
    const seriesObj = data["Time Series (Daily)"];
    if (!seriesObj || typeof seriesObj !== "object") {
      console.warn("Alpha Vantage unexpected response:", data);
      const err = new Error("Unexpected API response. Please try again in a moment.");
      err.code = "NO_SERIES";
      throw err;
    }
    const seriesDesc = Object.entries(seriesObj)
      .map(([date, ohlc]) => ({ date, close: parseFloat(ohlc["4. close"]) }))
      .filter(p => Number.isFinite(p.close))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return seriesDesc;
  }

  function dateToYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function pickStartIndexWithinWindow(seriesAsc) {
    const today = new Date();
    const minD = new Date(today);
    minD.setDate(minD.getDate() - 100);
    const maxD = new Date(today);
    maxD.setDate(maxD.getDate() - 7);

    const minStr = dateToYMD(minD);
    const maxStr = dateToYMD(maxD);

    const candidates = [];
    for (let i = 0; i < seriesAsc.length; i++) {
      const { date } = seriesAsc[i];
      if (date >= minStr && date <= maxStr) {
        if (i >= 6 && i + 1 < seriesAsc.length) {
          candidates.push(i);
        }
      }
    }

    if (candidates.length === 0) {
      const err = new Error("Not enough historical data within the required window for this ticker.");
      err.code = "INSUFFICIENT_DATA";
      throw err;
    }

    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  function initChart(labels, data) {
    if (priceChart) {
      priceChart.destroy();
    }
    priceChart = new Chart(els.chartCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Close",
            data,
            borderColor: "#58a6ff",
            backgroundColor: "rgba(88,166,255,0.15)",
            pointRadius: 3,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: "#9da7b3" },
            grid: { color: "#22262d" },
          },
          y: {
            ticks: { color: "#9da7b3" },
            grid: { color: "#22262d" },
          },
        },
        plugins: {
          legend: { labels: { color: "#c9d1d9" } },
          tooltip: { mode: "index", intersect: false },
        },
      },
    });
  }

  function updateChartAppendNext(date, price) {
    if (!priceChart) return;
    priceChart.data.labels.push(date);
    priceChart.data.datasets[0].data.push(price);
    priceChart.update();
  }

  function resetUIForNewGame() {
    state = initialState();
    showError("");
    showNote("");
    els.roundResult.textContent = "";
    els.game.hidden = true;
    updateStatusBar();
    if (priceChart) {
      priceChart.destroy();
      priceChart = null;
    }
  }

  async function startGame(ticker) {
    resetUIForNewGame();
    setLoading(true);
    try {
      const seriesAsc = await fetchTimeSeriesDailyAdjusted(ticker);
      state.ticker = ticker;
      state.seriesAsc = seriesAsc;

      const startIndex = pickStartIndexWithinWindow(seriesAsc);
      state.startIndex = startIndex;

      const windowStart = startIndex - 6;
      const initialSlice = seriesAsc.slice(windowStart, startIndex + 1);
      const labels = initialSlice.map(p => p.date);
      const data = initialSlice.map(p => p.close);

      initChart(labels, data);

      state.currentIndex = startIndex;
      state.score = 0;
      state.inRound = true;
      state.ended = false;

      els.game.hidden = false;
      updateStatusBar();
      els.roundResult.textContent = "Make a prediction for the next trading day.";

      els.btnUp.disabled = false;
      els.btnDown.disabled = false;
      els.btnEnd.disabled = false;
    } catch (err) {
      console.error(err);
      if (err.code === "RATE_LIMIT") {
        showError(err.message);
        showNote("Alpha Vantage limits 5 requests/minute on free tier.");
      } else if (err.code === "INVALID_TICKER") {
        showError("Ticker not found. Please try another.");
      } else if (err.code === "INFORMATION") {
        showError(err.message);
        if (/api key/i.test(err.message)) {
          showNote("Check your API key value and daily limits.");
        }
      } else if (err.code === "INSUFFICIENT_DATA") {
        showError("Not enough data in the last 100 days for this ticker.");
      } else {
        showError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function evaluateGuess(direction) {
    if (!state.inRound || state.ended) return;
    const i = state.currentIndex;
    const next = state.seriesAsc[i + 1];
    if (!next) {
      els.roundResult.textContent = "No more data available. The game has ended.";
      endGame();
      return;
    }
    const todayClose = state.seriesAsc[i].close;
    const nextClose = next.close;
    const movedUp = nextClose > todayClose;
    const movedDown = nextClose < todayClose;

    let correct = false;
    if (direction === "up" && movedUp) correct = true;
    if (direction === "down" && movedDown) correct = true;

    if (correct) {
      state.score += 1;
      els.roundResult.textContent = `Correct! ${next.date} close: ${nextClose.toFixed(2)}.`;
    } else {
      els.roundResult.textContent = `Wrong. ${next.date} close: ${nextClose.toFixed(2)}.`;
    }

    updateChartAppendNext(next.date, nextClose);
    state.currentIndex = i + 1;
    updateStatusBar();
  }

  function endGame() {
    state.ended = true;
    els.btnUp.disabled = true;
    els.btnDown.disabled = true;
    els.btnEnd.disabled = true;
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = (els.input.value || "").trim().toUpperCase();
    if (!raw) {
      showError("Please enter a stock ticker symbol.");
      return;
    }
    showError("");
    showNote("");
    startGame(raw);
  });

  els.btnUp.addEventListener("click", () => evaluateGuess("up"));
  els.btnDown.addEventListener("click", () => evaluateGuess("down"));
  els.btnEnd.addEventListener("click", () => {
    endGame();
    els.roundResult.textContent = `Game over. Final score: ${state.score}.`;
  });
  els.btnRestart.addEventListener("click", () => {
    resetUIForNewGame();
    els.input.focus();
  });
})();