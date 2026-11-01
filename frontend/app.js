(() => {
  const config = window.YATRA_CONFIG || {};
  const apiBaseUrl = String(config.apiBaseUrl || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const form = document.querySelector("#trip-form");
  const destinationInput = document.querySelector("#destination");
  const startDateInput = document.querySelector("#start-date");
  const endDateInput = document.querySelector("#end-date");
  const currencyInput = document.querySelector("#base-currency");
  const planButton = document.querySelector("#plan-button");
  const formError = document.querySelector("#form-error");
  const tripLength = document.querySelector("#trip-length");
  const results = document.querySelector("#trip-results");
  const progressBar = document.querySelector("#progress-bar");
  const progressMessage = document.querySelector("#progress-message");
  const progressSteps = document.querySelector("#progress-steps");
  const planStatus = document.querySelector("#plan-status");
  const weatherList = document.querySelector("#weather-list");
  const placesList = document.querySelector("#places-list");
  const placesCount = document.querySelector("#places-count");
  const resultsError = document.querySelector("#results-error");
  const connectionIndicator = document.querySelector("#connection-indicator");
  const connectionLabel = document.querySelector("#connection-label");
  const themeToggle = document.querySelector("#theme-toggle");
  const themeIcon = document.querySelector("#theme-icon");
  const themeLabel = document.querySelector("#theme-label");
  const convertAmount = document.querySelector("#convert-amount");
  const convertTarget = document.querySelector("#convert-target");
  const convertedAmount = document.querySelector("#converted-amount");
  const toast = document.querySelector("#toast");
  const savedTrips = document.querySelector("#saved-trips");

  const progressByEvent = {
    start: { percent: 5, message: "Getting the good bits together…" },
    weather: { percent: 15, message: "Checking what the skies have planned…" },
    weather_complete: { percent: 38, message: "Weather forecast is in. Looking for local favourites…" },
    options: { percent: 44, message: "Finding places worth slowing down for…" },
    options_complete: { percent: 66, message: "Local favourites are in. Checking exchange rates…" },
    currency: { percent: 72, message: "Getting the latest exchange rates…" },
    currency_complete: { percent: 92, message: "Your essentials are ready. Putting it all together…" },
    complete: { percent: 100, message: "Your trip is ready. Let the daydreaming begin." }
  };
  const stageForEvent = {
    weather: "weather",
    weather_complete: "weather",
    options: "places",
    options_complete: "places",
    currency: "currency",
    currency_complete: "currency"
  };
  let latestRates = null;
  let latestBaseCurrency = "INR";
  let toastTimer;

  function applyTheme(theme) {
    const isNight = theme === "night";
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute("aria-pressed", String(isNight));
    themeToggle.setAttribute("aria-label", `Switch to ${isNight ? "day" : "night"} mode`);
    themeToggle.title = `Switch to ${isNight ? "day" : "night"} mode`;
    themeIcon.textContent = isNight ? "☀" : "☾";
    themeLabel.textContent = isNight ? "Day" : "Night";
    document.querySelector('meta[name="theme-color"]').content = isNight ? "#17231e" : "#f6f7f1";
  }

  function getSavedTheme() {
    try {
      const savedTheme = localStorage.getItem("yatra-theme");
      if (savedTheme === "day" || savedTheme === "night") return savedTheme;
    } catch {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
  }

  function toDateInputValue(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function setDefaultDates() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const returnDate = new Date(tomorrow);
    returnDate.setDate(returnDate.getDate() + 4);
    startDateInput.min = toDateInputValue(new Date());
    startDateInput.value = toDateInputValue(tomorrow);
    endDateInput.min = startDateInput.value;
    endDateInput.value = toDateInputValue(returnDate);
    updateTripLength();
  }

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function updateTripLength() {
    if (!startDateInput.value || !endDateInput.value) {
      tripLength.textContent = "Pick your dates to see trip length";
      tripLength.classList.remove("has-days");
      return;
    }

    const days = Math.round((parseDate(endDateInput.value) - parseDate(startDateInput.value)) / 86400000);
    if (days < 0) {
      tripLength.textContent = "Your return date comes before departure";
      tripLength.classList.remove("has-days");
      return;
    }

    tripLength.textContent = `${days} ${days === 1 ? "night" : "nights"} away`;
    tripLength.classList.toggle("has-days", days >= 1 && days <= 14);
  }

  function setConnection(connected, configured = true) {
    connectionIndicator.classList.toggle("connected", connected && configured);
    connectionIndicator.classList.toggle("needs-config", connected && !configured);
    connectionIndicator.classList.toggle("disconnected", !connected);
    connectionLabel.textContent = !connected
      ? "API offline"
      : configured
        ? "API online"
        : "Setup needed";
  }

  async function checkConnection() {
    try {
      const response = await fetch(`${apiBaseUrl}/health`, { method: "GET" });
      if (!response.ok) {
        setConnection(false);
        return;
      }
      const health = await response.json();
      setConnection(true, health.status === "ok");
    } catch {
      setConnection(false);
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function validateTrip() {
    const destination = destinationInput.value.trim();
    if (!destination) return "Add a destination to get started.";
    if (!startDateInput.value || !endDateInput.value) return "Choose both dates for your getaway.";
    const days = Math.round((parseDate(endDateInput.value) - parseDate(startDateInput.value)) / 86400000);
    if (days < 1) return "Your return date needs to be at least one day after departure.";
    if (days > 14) return "For now, we can plan getaways up to 14 days. The longer trip can wait.";
    return "";
  }

  function resetResults() {
    results.hidden = false;
    resultsError.hidden = true;
    progressBar.style.width = "4%";
    progressMessage.textContent = "Getting the good bits together…";
    progressSteps.querySelectorAll("span").forEach((step) => step.classList.remove("active", "complete"));
    planStatus.classList.remove("done", "needs-config", "error", "offline");
    planStatus.innerHTML = '<span class="live-dot"></span> Planning your trip';
    weatherList.innerHTML = '<p class="empty-state">Weather will show up here.</p>';
    placesList.innerHTML = '<p class="empty-state">Local favourites will show up here.</p>';
    placesCount.textContent = "";
    latestRates = null;
    updateConverter();
  }

  function updateProgress(eventName) {
    const progress = progressByEvent[eventName];
    if (!progress) return;
    progressBar.style.width = `${progress.percent}%`;
    progressMessage.textContent = progress.message;
    const activeStage = stageForEvent[eventName];
    if (activeStage) {
      const order = ["weather", "places", "currency"];
      const activeIndex = order.indexOf(activeStage);
      progressSteps.querySelectorAll("span").forEach((step) => {
        const index = order.indexOf(step.dataset.step);
        step.classList.toggle("complete", index < activeIndex || (index === activeIndex && eventName.endsWith("_complete")));
        step.classList.toggle("active", index === activeIndex && !eventName.endsWith("_complete"));
      });
    } else if (eventName === "complete") {
      progressSteps.querySelectorAll("span").forEach((step) => {
        step.classList.remove("active");
        step.classList.add("complete");
      });
    }

    if (eventName === "complete") {
      planStatus.classList.add("done");
      planStatus.innerHTML = '<span class="live-dot"></span> Ready when you are';
    }
  }

  function formatDate(value, options = { month: "short", day: "numeric" }) {
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDate(value) : new Date(value);
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(date);
  }

  function renderWeather(data) {
    if (!Array.isArray(data) || data.length === 0) {
      weatherList.innerHTML = '<p class="empty-state">No forecast was returned for these dates.</p>';
      return;
    }

    weatherList.replaceChildren(...data.map((day) => {
      const card = document.createElement("article");
      card.className = "weather-day";
      const date = document.createElement("div");
      date.className = "weather-date";
      date.textContent = formatDate(day.date, { weekday: "short", month: "short", day: "numeric" });
      const condition = document.createElement("div");
      condition.className = "weather-condition";
      condition.textContent = day.condition || "Forecast";
      const temperature = document.createElement("div");
      temperature.className = "weather-temp";
      temperature.textContent = `${Math.round(day.temperature_high)}° / ${Math.round(day.temperature_low)}°`;
      const detail = document.createElement("div");
      detail.className = "weather-detail";
      detail.textContent = `${Math.round(day.rain_chance)}% rain · ${Math.round(day.humidity)}% humidity`;
      card.append(date, condition, temperature, detail);
      return card;
    }));
  }

  function renderPlaces(data) {
    if (!Array.isArray(data) || data.length === 0) {
      placesList.innerHTML = '<p class="empty-state">We don’t have local favourites for this destination yet. The weather and currency details are still here for you.</p>';
      placesCount.textContent = "A new place to add";
      return;
    }

    placesCount.textContent = `${data.length} local ${data.length === 1 ? "favourite" : "favourites"}`;
    placesList.replaceChildren(...data.map((place) => {
      const card = document.createElement("article");
      card.className = "place-card";
      const category = document.createElement("span");
      category.className = "place-category";
      category.textContent = place.category || "Local spot";
      const name = document.createElement("h4");
      name.textContent = place.name || "A place to explore";
      const description = document.createElement("p");
      description.textContent = place.description || "";
      const meta = document.createElement("div");
      meta.className = "place-meta";
      const rating = document.createElement("span");
      rating.className = "place-rating";
      rating.textContent = place.rating ? `★ ${Number(place.rating).toFixed(1)}` : "Local pick";
      const time = document.createElement("span");
      time.textContent = place.estimated_time_hours ? `${place.estimated_time_hours} hr visit` : "";
      meta.append(rating, time);
      card.append(category, name, description, meta);
      return card;
    }));
  }

  function renderCurrency(data, baseCurrency) {
    latestRates = data && typeof data === "object" ? data : {};
    latestBaseCurrency = baseCurrency;
    document.querySelector("#from-currency").textContent = baseCurrency;
    const target = convertTarget.value === baseCurrency
      ? [...convertTarget.options].find((option) => option.value !== baseCurrency)?.value
      : convertTarget.value;
    if (target) convertTarget.value = target;
    updateConverter();
  }

  function updateConverter() {
    if (!latestRates) {
      convertedAmount.textContent = "—";
      document.querySelector("#rate-caption").textContent = "Rates update with your plan";
      return;
    }
    const target = convertTarget.value;
    const amount = Number(convertAmount.value);
    const rate = target === latestBaseCurrency ? 1 : Number(latestRates[target]);
    if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
      convertedAmount.textContent = "Not available";
      document.querySelector("#rate-caption").textContent = "This rate wasn’t returned";
      return;
    }
    convertedAmount.textContent = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(amount * rate);
    document.querySelector("#rate-caption").textContent = `1 ${latestBaseCurrency} = ${rate.toFixed(4)} ${target}`;
  }

  function saveRecentTrip(trip) {
    try {
      const saved = JSON.parse(localStorage.getItem("yatra-recent-trips") || "[]");
      const trips = [trip, ...saved.filter((item) => item.destination !== trip.destination || item.start_date !== trip.start_date)]
        .slice(0, 4);
      localStorage.setItem("yatra-recent-trips", JSON.stringify(trips));
      renderSavedTrips(trips);
    } catch {
      showToast("Trip ready, but this browser couldn’t save it to your trip shelf.");
    }
  }

  function renderSavedTrips(trips) {
    if (!trips.length) {
      savedTrips.innerHTML = '<div class="shelf-empty"><span>✳</span><p>Your next favourite trip could go here.</p></div>';
      return;
    }

    savedTrips.replaceChildren(...trips.map((trip) => {
      const button = document.createElement("button");
      button.className = "saved-trip";
      button.type = "button";
      const icon = document.createElement("span");
      icon.className = "saved-trip-icon";
      icon.textContent = "↗";
      const details = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = trip.destination;
      const dates = document.createElement("small");
      dates.textContent = `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`;
      details.append(name, dates);
      button.append(icon, details);
      button.addEventListener("click", () => {
        destinationInput.value = trip.destination;
        startDateInput.value = trip.start_date;
        endDateInput.value = trip.end_date;
        currencyInput.value = trip.base_currency || "INR";
        endDateInput.min = trip.start_date;
        updateTripLength();
        document.querySelector("#planner").scrollIntoView({ behavior: "smooth", block: "center" });
        showToast("Trip dates are back. Ready for another look?");
      });
      return button;
    }));
  }

  async function readEventStream(response, onEvent) {
    if (!response.body) throw new Error("Streaming is not supported by this browser.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        let eventName = "message";
        const dataLines = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length) {
          let data;
          try {
            data = JSON.parse(dataLines.join("\n"));
          } catch {
            throw new Error("The planner returned an unreadable progress update.");
          }
          onEvent(eventName, data);
        }
      }

      if (done) break;
    }
  }

  async function createTrip(trip) {
    resetResults();
    document.querySelector("#results-title").textContent = `A little look at ${trip.destination}`;
    document.querySelector("#results-subtitle").textContent = `${formatDate(trip.start_date, { month: "long", day: "numeric", year: "numeric" })} – ${formatDate(trip.end_date, { month: "long", day: "numeric", year: "numeric" })}`;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
    planButton.disabled = true;
    planButton.querySelector("span:first-child").textContent = "Putting it together…";
    let completed = false;
    let requestReachedServer = false;
    let needsConfiguration = false;

    try {
      const response = await fetch(`${apiBaseUrl}/stream/travel-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify(trip)
      });
      requestReachedServer = true;
      needsConfiguration = response.status === 503;
      setConnection(true, !needsConfiguration);
      if (!response.ok) {
        let detail = `The planner returned an error (${response.status}).`;
        try {
          const errorBody = await response.json();
          if (typeof errorBody.detail === "string") detail = errorBody.detail;
        } catch {
          // Keep the HTTP status message when the server does not return JSON.
        }
        throw new Error(detail);
      }
      await readEventStream(response, (eventName, data) => {
        updateProgress(eventName);
        if (eventName === "weather_complete") renderWeather(data.data);
        if (eventName === "options_complete") renderPlaces(data.data);
        if (eventName === "currency_complete") renderCurrency(data.data, trip.base_currency);
        if (eventName === "complete") completed = true;
      });
      if (!completed) throw new Error("The progress stream ended before the trip was complete. Please try again.");
      saveRecentTrip(trip);
    } catch (error) {
      if (!requestReachedServer) setConnection(false);
      planStatus.classList.toggle("needs-config", needsConfiguration);
      planStatus.classList.toggle("offline", !requestReachedServer);
      planStatus.classList.toggle("error", requestReachedServer && !needsConfiguration);
      planStatus.innerHTML = needsConfiguration
        ? '<span class="live-dot"></span> Setup needed'
        : requestReachedServer
          ? '<span class="live-dot"></span> Could not plan'
          : '<span class="live-dot"></span> API offline';
      resultsError.textContent = requestReachedServer
        ? error.message
        : "Can’t reach the planner. Check that the API is running, then try again.";
      resultsError.hidden = false;
      progressMessage.textContent = needsConfiguration
        ? "The planner needs a quick setup before it can continue."
        : requestReachedServer
          ? "One of the trip services couldn’t finish the request."
          : "We couldn’t reach the planner.";
      showToast(needsConfiguration ? "The planner needs setup." : "We couldn’t finish that trip.");
    } finally {
      planButton.disabled = false;
      planButton.querySelector("span:first-child").textContent = "Plan my getaway";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const validationMessage = validateTrip();
    showFormError(validationMessage);
    if (validationMessage) return;
    const trip = {
      destination: destinationInput.value.trim().toLowerCase(),
      start_date: startDateInput.value,
      end_date: endDateInput.value,
      base_currency: currencyInput.value
    };
    createTrip(trip);
  });

  startDateInput.addEventListener("change", () => {
    endDateInput.min = startDateInput.value;
    if (endDateInput.value && endDateInput.value < startDateInput.value) {
      endDateInput.value = startDateInput.value;
    }
    updateTripLength();
  });
  endDateInput.addEventListener("change", updateTripLength);
  convertAmount.addEventListener("input", updateConverter);
  convertTarget.addEventListener("change", updateConverter);
  destinationInput.addEventListener("input", () => showFormError(""));
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "night" ? "day" : "night";
    applyTheme(nextTheme);
    try {
      localStorage.setItem("yatra-theme", nextTheme);
    } catch {
      showToast("Theme changed. This browser can’t save your preference.");
    }
  });

  applyTheme(getSavedTheme());
  setDefaultDates();
  updateConverter();
  checkConnection();
  window.setInterval(checkConnection, 60000);
  try {
    renderSavedTrips(JSON.parse(localStorage.getItem("yatra-recent-trips") || "[]"));
  } catch {
    renderSavedTrips([]);
  }
})();
