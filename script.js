const uri = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";
const chatOutput = document.getElementById("chat-output");
const hashtagInput = document.getElementById("hashtag-input");
const startButton = document.getElementById("start-button");
const clearButton = document.getElementById("clear-button");
const ctx1 = document.getElementById("letter-frequency-chart").getContext("2d");
const ctx2 = document.getElementById("hashtag-comparison-chart").getContext("2d");
const ctx3 = document.getElementById("hashtag-donut-chart").getContext("2d");

let websocket = null;
let filterHashtags = [];
let messageCount = 0;

// Letter frequency storage
const cumulativeFrequency = {};
for (let charCode = 97; charCode <= 122; charCode++) {
  cumulativeFrequency[String.fromCharCode(charCode)] = 0; // Initialize a-z with 0
}

// Hashtag comparison storage
let hashtagCounts = {};
let hashtagTimestamps = [];
let interval = 5000; // Initial interval: 5 seconds
const maxInterval = 60000; // Switch to 1-minute intervals after 2 minutes
let currentIntervalData = {};

// Create Chart.js bar chart (Chart 1)
const letterFrequencyChart = new Chart(ctx1, {
  type: "bar",
  data: {
    labels: Object.keys(cumulativeFrequency),
    datasets: [{
      label: "Letter Frequency",
      data: Object.values(cumulativeFrequency),
      backgroundColor: "#007bff",
    }],
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: "#e0e0e0" },
        grid: { color: "#333" },
      },
      y: {
        ticks: { color: "#e0e0e0" },
        grid: { color: "#333" },
      },
    },
  },
});

// Create Chart.js line chart (Chart 2)
const hashtagComparisonChart = new Chart(ctx2, {
  type: "line",
  data: {
    labels: [],
    datasets: [],
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: "top", labels: { color: "#e0e0e0" } },
    },
    scales: {
      x: {
        ticks: { color: "#e0e0e0" },
        grid: { color: "#333" },
      },
      y: {
        ticks: { color: "#e0e0e0" },
        grid: { color: "#333" },
      },
    },
  },
});

// Create Chart.js donut chart (Chart 3)
const hashtagDonutChart = new Chart(ctx3, {
  type: "doughnut",
  data: {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
    }],
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: "top", labels: { color: "#e0e0e0" } },
    },
  },
});

function updateCharts(changedLetters) {
  // Update Letter Frequency Chart
  letterFrequencyChart.data.datasets[0].data = Object.values(cumulativeFrequency);
  letterFrequencyChart.update();

  // Update Hashtag Comparison Chart
  hashtagComparisonChart.data.labels = hashtagTimestamps;
  filterHashtags.forEach((hashtag, i) => {
    const dataset = hashtagComparisonChart.data.datasets.find(ds => ds.label === hashtag);
    if (!dataset) {
      hashtagComparisonChart.data.datasets.push({
        label: hashtag,
        data: hashtagCounts[hashtag] || [],
        borderColor: `hsl(${(i * 60) % 360}, 100%, 50%)`,
        backgroundColor: "transparent",
      });
    } else {
      dataset.data = hashtagCounts[hashtag];
    }
  });
  hashtagComparisonChart.update();

  // Update Hashtag Donut Chart (Chart 3)
  const cumulativeTotals = filterHashtags.map(ht => hashtagCounts[ht].reduce((a, b) => a + b, 0));
  const totalSum = cumulativeTotals.reduce((a, b) => a + b, 0);
  hashtagDonutChart.data.labels = filterHashtags;
  hashtagDonutChart.data.datasets[0].data = cumulativeTotals.map(ct => ((ct / totalSum) * 100).toFixed(2));
  hashtagDonutChart.data.datasets[0].backgroundColor = filterHashtags.map((_, i) => `hsl(${(i * 60) % 360}, 100%, 50%)`);
  hashtagDonutChart.update();
}

function handleTimeInterval() {
  const timestamp = new Date().toLocaleTimeString();
  hashtagTimestamps.push(timestamp);
  filterHashtags.forEach(hashtag => {
    hashtagCounts[hashtag] = hashtagCounts[hashtag] || [];
    hashtagCounts[hashtag].push(currentIntervalData[hashtag] || 0);
    currentIntervalData[hashtag] = 0; // Reset for the next interval
  });

  if (hashtagTimestamps.length > 20) {
    hashtagTimestamps.shift();
    filterHashtags.forEach(hashtag => hashtagCounts[hashtag].shift());
  }

  updateCharts([]);
}

setInterval(handleTimeInterval, interval);

function startWebSocket() {
  const input = hashtagInput.value.trim();
  if (!input) {
    alert("Please enter at least one hashtag to start.");
    return;
  }

  filterHashtags = input.split(",").map(ht => ht.trim().toLowerCase());
  filterHashtags.forEach(hashtag => {
    hashtagCounts[hashtag] = [];
    currentIntervalData[hashtag] = 0;
  });

  chatOutput.innerHTML = "<p class='text-muted'>Listening for messages...</p>";
  hashtagInput.disabled = true;
  startButton.disabled = true;

  websocket = new WebSocket(uri);

  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const record = data?.commit?.record || {};
    const text = record?.text || "";

    if (filterHashtags.some(ht => text.toLowerCase().includes(ht))) {
      const changedLetters = [];
      for (const char of text.toLowerCase()) {
        if (char >= "a" && char <= "z") {
          cumulativeFrequency[char]++;
          changedLetters.push(char);
        }
      }

      currentIntervalData[filterHashtags.find(ht => text.toLowerCase().includes(ht))]++;

      const messageDiv = document.createElement("div");
      messageDiv.className = "message";
      messageDiv.innerHTML = `
        <p><span>Text:</span> ${text}</p>
        <p><span>Created At:</span> ${record?.createdAt || "N/A"}</p>
      `;
      chatOutput.appendChild(messageDiv);
      chatOutput.scrollTop = chatOutput.scrollHeight;

      updateCharts(changedLetters);
    }
  };
}

startButton.addEventListener("click", startWebSocket);
clearButton.addEventListener("click", () => location.reload());
