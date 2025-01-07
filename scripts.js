// Import the WebSocketClient class
import { WebSocketClient } from './websocket.js';

// Define the WebSocket URI
const websocketURI = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

// Initialize the WebSocket client
const wsClient = new WebSocketClient(websocketURI);

// Data structure to track hashtags
const hashtagTracker = {
    counts: new Map(),
    timestamps: [],
};

// Tracked words list
let trackedWords = [];

// Time window in milliseconds (5 minutes)
const ROLLING_WINDOW = 5 * 60 * 1000; // 5 minutes

// Limit for chat messages
const MAX_CHAT_MESSAGES = 100;

// Profanity blocklist
let blocklist = [];

// Load the profanity blocklist from JSON
fetch('./profanity-list.json')
    .then((response) => response.json())
    .then((data) => {
        blocklist = data.map((word) => word.toLowerCase().trim());
        console.log('Profanity blocklist loaded:', blocklist);
    })
    .catch((error) => console.error('Error loading blocklist:', error));

// Function to check if a message contains a tracked word
const containsTrackedWord = (text) => {
    const words = text.toLowerCase().split(/\b/); // Split by word boundaries
    return trackedWords.some((word) => words.includes(word));
};

// Function to handle incoming WebSocket messages
const handleWebSocketMessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        const text = data.commit?.record?.text;

        if (!text) return;

        // Check if the message contains any tracked words
        if (!containsTrackedWord(text)) return;

        // Display the message in the chat window
        displayChatMessage(text);

        // Extract hashtags from the message
        const hashtagRegex = /#\w+/g;
        const hashtags = text.match(hashtagRegex);

        if (hashtags) {
            const normalizedHashtags = hashtags
                .map((tag) => tag.toLowerCase())
                .filter((hashtag) => !blocklist.includes(hashtag)); // Exclude inappropriate hashtags

            console.log('Processed Hashtags:', normalizedHashtags);

            const now = Date.now();
            normalizedHashtags.forEach((hashtag) => {
                hashtagTracker.counts.set(
                    hashtag,
                    (hashtagTracker.counts.get(hashtag) || 0) + 1
                );
                hashtagTracker.timestamps.push({ hashtag, time: now });
            });

            cleanOldHashtags();
            updateHashtagChart();
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
};

// Function to clean up old hashtags outside the 5-minute window
const cleanOldHashtags = () => {
    const now = Date.now();
    while (
        hashtagTracker.timestamps.length > 0 &&
        now - hashtagTracker.timestamps[0].time > ROLLING_WINDOW
    ) {
        const { hashtag } = hashtagTracker.timestamps.shift();
        const currentCount = hashtagTracker.counts.get(hashtag);
        if (currentCount === 1) {
            hashtagTracker.counts.delete(hashtag);
        } else {
            hashtagTracker.counts.set(hashtag, currentCount - 1);
        }
    }
};

// Function to display a message in the chat window
const displayChatMessage = (text) => {
    const container = document.querySelector('#chat-container');

    // Create a new div for the message
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('p-2', 'mb-2', 'rounded', 'shadow', 'chat-message');

    // Highlight tracked words
    const words = text.split(/\b/); // Split text into words using word boundaries
    const highlightedText = words
        .map((word) => {
            const lowerWord = word.toLowerCase();
            if (trackedWords.includes(lowerWord)) {
                // Wrap the tracked word with a span for styling
                return `<span class="highlight">${word}</span>`;
            }
            return word; // Keep untracked words as they are
        })
        .join(''); // Join the words back into a single string

    // Set the inner HTML of the message with highlighted words
    messageDiv.innerHTML = highlightedText;

    // Append the message to the chat container
    container.appendChild(messageDiv);

    // Limit to the most recent 100 messages
    if (container.childNodes.length > MAX_CHAT_MESSAGES) {
        container.removeChild(container.firstChild);
    }

    // Scroll to the bottom of the container automatically
    container.scrollTop = container.scrollHeight;
};


// Function to initialize the SVG chart
const initializeHashtagChart = () => {
    const svg = d3.select('#hashtag-chart svg');

    // Add a group element for the chart
    const chartGroup = svg.append('g').attr('transform', 'translate(150,20)');

    // Add x-axis and y-axis groups
    chartGroup.append('g').attr('class', 'x-axis').attr('transform', 'translate(0,280)');
    chartGroup.append('g').attr('class', 'y-axis');
};

// Function to update the hashtag chart
const updateHashtagChart = () => {
    // Get the top 10 hashtags
    const sortedHashtags = [...hashtagTracker.counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const labels = sortedHashtags.map(([hashtag]) => hashtag);
    const data = sortedHashtags.map(([, count]) => count);

    // Set up scales
    const xScale = d3.scaleLinear().range([0, 300]).domain([0, d3.max(data) || 1]);
    const yScale = d3.scaleBand().range([0, 280]).domain(labels).padding(0.1);

    // Select the SVG group for the chart
    const svg = d3.select('#hashtag-chart svg g');

    // Update x-axis
    svg.select('.x-axis')
        .transition()
        .duration(500)
        .call(d3.axisBottom(xScale).ticks(5));

    // Update y-axis
    svg.select('.y-axis')
        .transition()
        .duration(500)
        .call(d3.axisLeft(yScale));

    // Bind data to bars
    const bars = svg.selectAll('.bar').data(sortedHashtags, ([hashtag]) => hashtag);

    // Enter: Add new bars
    bars.enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', ([hashtag]) => yScale(hashtag))
        .attr('height', yScale.bandwidth())
        .attr('width', 0) // Start with width 0 for animation
        .style('fill', '#006400') // Dark green fill
        .style('stroke', '#00ff00') // Neon green border
        .style('stroke-width', '1px')
        .transition()
        .duration(500)
        .attr('width', ([, count]) => xScale(count));

    // Update: Modify existing bars
    bars.transition()
        .duration(500)
        .attr('y', ([hashtag]) => yScale(hashtag))
        .attr('height', yScale.bandwidth())
        .attr('width', ([, count]) => xScale(count));

    // Exit: Remove bars no longer in the data
    bars.exit()
        .transition()
        .duration(500)
        .attr('width', 0) // Shrink width to 0 before removing
        .remove();
};

// Handle form submission for tracking words
document.querySelector('#word-tracker-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const input = document.querySelector('#word-input');
    const word = input.value.trim().toLowerCase();

    if (word && !trackedWords.includes(word)) {
        trackedWords.push(word);
        updateTrackedWordsUI();
    }

    input.value = '';
});

// Display tracked word boxes
const updateTrackedWordsUI = () => {
    const wordList = document.querySelector('#tracked-words');
    wordList.innerHTML = '';

    trackedWords.forEach((word) => {
        const wordBox = document.createElement('div');
        wordBox.classList.add(
            'px-3',
            'py-1',
            'rounded',
            'flex',
            'items-center',
            'gap-2',
            'shadow',
            'word-box'
        );

        const wordText = document.createElement('span');
        wordText.textContent = word;
        wordText.classList.add('text-green-400', 'font-bold');

        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.classList.add(
            'text-green-500',
            'hover:text-green-400',
            'font-bold',
            'cursor-pointer'
        );
        closeButton.addEventListener('click', () => {
            trackedWords = trackedWords.filter((trackedWord) => trackedWord !== word);
            updateTrackedWordsUI();
        });

        wordBox.appendChild(wordText);
        wordBox.appendChild(closeButton);
        wordList.appendChild(wordBox);
    });
};

// Initialize the chart when the page loads
initializeHashtagChart();

// Connect WebSocket and process messages
wsClient.connect(handleWebSocketMessage);
