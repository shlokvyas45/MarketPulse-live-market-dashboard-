const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const searchResults = document.getElementById("search-results");
const marketGrid = document.getElementById("market-grid");
const statusText = document.getElementById("status-text");


// ==========================================
// WATCHLIST
// ==========================================

const watchlist = {};


// ==========================================
// SEARCH ASSETS
// ==========================================

async function searchAssets() {

    const query = searchInput.value.trim();

    if (!query) {
        searchResults.innerHTML = "";
        return;
    }

    try {

        searchResults.innerHTML =
            "<p class='empty-message'>Searching...</p>";

        const response = await fetch(
            `http://localhost:3000/search?q=${encodeURIComponent(query)}`
        );

        const results = await response.json();

        searchResults.innerHTML = "";

        if (!response.ok) {

            searchResults.innerHTML =
                "<p class='empty-message'>Search failed.</p>";

            return;
        }

        if (results.length === 0) {

            searchResults.innerHTML =
                "<p class='empty-message'>No assets found.</p>";

            return;
        }

        results.forEach((asset) => {

            const resultElement =
                document.createElement("div");

            resultElement.className =
                "search-result";

            resultElement.innerHTML = `
                <strong>
                    ${asset.description}
                </strong>

                <span>
                    (${asset.symbol})
                </span>

                <small>
                    ${asset.type || ""}
                </small>
            `;

            resultElement.addEventListener(
                "click",
                () => {
                    addToWatchlist(asset);
                }
            );

            searchResults.appendChild(
                resultElement
            );

        });

    } catch (error) {

        console.log(
            "Search error:",
            error
        );

        searchResults.innerHTML =
            "<p class='empty-message'>Could not connect to server.</p>";
    }
}


// ==========================================
// ADD TO WATCHLIST
// ==========================================

async function addToWatchlist(asset) {

    try {

        const response = await fetch(
            "http://localhost:3000/watchlist",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(asset)
            }
        );

        const data = await response.json();

        if (!response.ok) {

            console.log(
                "Watchlist error:",
                data
            );

            return;
        }

        watchlist[asset.symbol] = asset;

        createMarketCard(asset);

        loadChart(asset.symbol);

        searchResults.innerHTML = "";

        searchInput.value = "";

        console.log(
            "Added:",
            asset.symbol
        );

    } catch (error) {

        console.log(
            "Watchlist error:",
            error
        );

    }

}


// ==========================================
// CREATE MARKET CARD
// ==========================================

function createMarketCard(asset) {

    const existingCard =
        document.getElementById(
            `card-${asset.symbol}`
        );

    if (existingCard) {
        return;
    }

    const card =
        document.createElement("div");

    card.className =
        "market-card";

    card.id =
        `card-${asset.symbol}`;

    card.innerHTML = `

        <div class="asset-name">

            <h2>
                ${asset.description}
            </h2>

            <span>
                ${asset.symbol}
            </span>

        </div>


        <div
            class="asset-price"
            id="${asset.symbol}-price"
        >
            Loading price...
        </div>


        <div
            class="asset-change"
            id="${asset.symbol}-change"
        >
            --
        </div>


        <div
            class="chart-header"
            id="${asset.symbol}-chart-header"
        >
            <span>30 Day Price</span>

            <span
                id="${asset.symbol}-chart-high"
            >
                --
            </span>
        </div>


        <div
            class="price-chart"
            id="${asset.symbol}-chart"
        >
            Loading chart...
        </div>


        <button
            class="remove-btn"
            data-symbol="${asset.symbol}"
        >
            Remove
        </button>

    `;

    marketGrid.appendChild(card);


    const removeButton =
        card.querySelector(".remove-btn");

    removeButton.addEventListener(
        "click",
        () => {
            removeFromWatchlist(asset.symbol);
        }
    );
}


// ==========================================
// LOAD PRICE HISTORY / LINE CHART
// ==========================================

async function loadChart(symbol) {

    const chartElement =
        document.getElementById(
            `${symbol}-chart`
        );

    if (!chartElement) {
        return;
    }

    try {

        const response = await fetch(
            `http://localhost:3000/history/${encodeURIComponent(symbol)}`
        );

        const history = await response.json();

        if (
            !response.ok ||
            !Array.isArray(history) ||
            history.length === 0
        ) {

            chartElement.textContent =
                "No chart data available";

            return;
        }


        // Get valid data
        const data = history.filter(item =>
            Number.isFinite(Number(item.price))
        );

        if (data.length === 0) {

            chartElement.textContent =
                "No chart data available";

            return;
        }


        const prices = data.map(
            item => Number(item.price)
        );


        // -----------------------------------------
        // Determine positive / negative
        // -----------------------------------------

        const firstPrice = prices[0];

        const latestPrice =
            prices[prices.length - 1];

        const isPositive =
            latestPrice >= firstPrice;

        const lineColor =
            isPositive
                ? "#16a34a"
                : "#dc2626";


        // -----------------------------------------
        // Chart dimensions
        // -----------------------------------------

        const width = 600;
        const height = 180;

        const paddingLeft = 10;
        const paddingRight = 10;
        const paddingTop = 15;
        const paddingBottom = 25;

        const chartWidth =
            width -
            paddingLeft -
            paddingRight;

        const chartHeight =
            height -
            paddingTop -
            paddingBottom;


        // -----------------------------------------
        // Price range
        // -----------------------------------------

        const minPrice =
            Math.min(...prices);

        const maxPrice =
            Math.max(...prices);

        const priceRange =
            maxPrice - minPrice || 1;


        // -----------------------------------------
        // Create points
        // -----------------------------------------

        const points = prices.map(
            (price, index) => {

                const x =
                    paddingLeft +
                    (
                        index /
                        Math.max(
                            prices.length - 1,
                            1
                        )
                    ) *
                    chartWidth;

                const y =
                    paddingTop +
                    (
                        1 -
                        (
                            (price - minPrice) /
                            priceRange
                        )
                    ) *
                    chartHeight;

                return {
                    x,
                    y,
                    price
                };

            }
        );


        const pointString =
            points
                .map(point =>
                    `${point.x},${point.y}`
                )
                .join(" ");


        const lastPoint =
            points[points.length - 1];


        // -----------------------------------------
        // Date formatter
        // -----------------------------------------

        function formatDate(value) {

            if (!value) {
                return "";
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return String(value);
            }

            return date.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );
        }


        // -----------------------------------------
        // Create chart
        // -----------------------------------------

        chartElement.innerHTML = `

            <svg
                class="price-line-chart"
                viewBox="0 0 ${width} ${height}"
                preserveAspectRatio="none"
            >

                <!-- Grid lines -->

                <line
                    x1="0"
                    y1="25%"
                    x2="${width}"
                    y2="25%"
                    class="chart-grid-line"
                />

                <line
                    x1="0"
                    y1="50%"
                    x2="${width}"
                    y2="50%"
                    class="chart-grid-line"
                />

                <line
                    x1="0"
                    y1="75%"
                    x2="${width}"
                    y2="75%"
                    class="chart-grid-line"
                />


                <!-- Price line -->

                <polyline
                    points="${pointString}"
                    class="chart-line"
                    style="stroke: ${lineColor};"
                />


                <!-- Latest point -->

                <circle
                    cx="${lastPoint.x}"
                    cy="${lastPoint.y}"
                    r="5"
                    class="chart-point"
                    style="stroke: ${lineColor};"
                />

            </svg>

        `;


        // -----------------------------------------
        // Tooltip
        // -----------------------------------------

        const tooltip =
            document.createElement("div");

        tooltip.className =
            "chart-tooltip";

        chartElement.appendChild(
            tooltip
        );


        // -----------------------------------------
        // Mouse movement
        // -----------------------------------------

        const svg =
            chartElement.querySelector(
                ".price-line-chart"
            );


        svg.addEventListener(
            "mousemove",
            function(event) {

                const rect =
                    svg.getBoundingClientRect();


                const mouseX =
                    event.clientX -
                    rect.left;


                const ratio =
                    mouseX / rect.width;


                let index =
                    Math.round(
                        ratio *
                        (data.length - 1)
                    );


                index =
                    Math.max(
                        0,
                        Math.min(
                            index,
                            data.length - 1
                        )
                    );


                const item =
                    data[index];


                const price =
                    Number(item.price);


                const date =
                    formatDate(
                        item.date ||
                        item.timestamp
                    );


                // Tooltip content

                tooltip.innerHTML = `

                    <div class="chart-tooltip-date">
                        ${date}
                    </div>

                    <div class="chart-tooltip-price">
                        ₹${price.toFixed(2)}
                    </div>

                `;


                tooltip.style.display =
                    "block";


                // ---------------------------------
                // Position tooltip
                // ---------------------------------

                let left =
                    mouseX + 12;


                if (
                    left +
                    tooltip.offsetWidth >
                    chartElement.clientWidth
                ) {

                    left =
                        mouseX -
                        tooltip.offsetWidth -
                        12;

                }


                tooltip.style.left =
                    `${left}px`;

                tooltip.style.top =
                    "15px";

            }
        );


        // -----------------------------------------
        // Mouse leaves chart
        // -----------------------------------------

        svg.addEventListener(
            "mouseleave",
            function() {

                tooltip.style.display =
                    "none";

            }
        );


    } catch (error) {

        console.log(
            "Chart error:",
            error
        );

        chartElement.textContent =
            "Chart unavailable";
    }
}


// ==========================================
// REMOVE FROM WATCHLIST
// ==========================================

async function removeFromWatchlist(symbol) {

    try {

        const response = await fetch(
            `http://localhost:3000/watchlist/${encodeURIComponent(symbol)}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {

            console.log(
                "Could not remove asset"
            );

            return;
        }

        delete watchlist[symbol];

        const card =
            document.getElementById(
                `card-${symbol}`
            );

        if (card) {
            card.remove();
        }

        console.log(
            "Removed:",
            symbol
        );

    } catch (error) {

        console.log(
            "Remove error:",
            error
        );

    }
}


// ==========================================
// UPDATE MARKET CARD
// ==========================================

function updateMarketCard(symbol, data) {

    const priceElement =
        document.getElementById(
            `${symbol}-price`
        );

    const changeElement =
        document.getElementById(
            `${symbol}-change`
        );

    if (!priceElement) {
        return;
    }


    // ======================================
    // PRICE
    // ======================================

    priceElement.textContent =
        "₹" +
        Number(data.price).toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );


    // ======================================
    // CHANGE
    // ======================================

    if (
        data.changePercent !== null &&
        data.changePercent !== undefined
    ) {

        const percent =
            Number(data.changePercent);

        changeElement.textContent =
            `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;

        changeElement.className =
            "asset-change " +
            (
                percent >= 0
                    ? "positive"
                    : "negative"
            );
    }
}


// ==========================================
// SEARCH BUTTON
// ==========================================

searchBtn.addEventListener(
    "click",
    searchAssets
);


// ==========================================
// ENTER KEY SEARCH
// ==========================================

searchInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {
            searchAssets();
        }

    }
);


// ==========================================
// WEBSOCKET
// ==========================================

const socket =
    new WebSocket(
        "ws://localhost:3000"
    );


// ==========================================
// CONNECTED
// ==========================================

socket.addEventListener(
    "open",
    () => {

        console.log(
            "Connected to market WebSocket"
        );

        if (statusText) {

            statusText.textContent =
                "Market data is live";

        }

    }
);


// ==========================================
// MESSAGE
// ==========================================

socket.addEventListener(
    "message",
    (event) => {

        try {

            const data =
                JSON.parse(event.data);


            if (data.type === "connected") {

                console.log(
                    data.message
                );

                return;
            }


            Object.keys(data).forEach(
                (symbol) => {

                    updateMarketCard(
                        symbol,
                        data[symbol]
                    );

                }
            );


        } catch (error) {

            console.log(
                "WebSocket message error:",
                error
            );

        }

    }
);


// ==========================================
// CLOSED
// ==========================================

socket.addEventListener(
    "close",
    () => {

        if (statusText) {

            statusText.textContent =
                "Market server disconnected";

        }

    }
);


// ==========================================
// ERROR
// ==========================================

socket.addEventListener(
    "error",
    (error) => {

        console.log(
            "WebSocket error:",
            error
        );

        if (statusText) {

            statusText.textContent =
                "Connection error";

        }

    }
);