const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");

const YahooFinance =
    require("yahoo-finance2").default;

const yahooFinance =
    new YahooFinance();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;


// ==========================================
// WATCHLIST
// ==========================================

const watchlist = {};


// ==========================================
// SEARCH ASSETS
// ==========================================

app.get(
    "/search",
    async (req, res) => {

        const query =
            req.query.q?.trim();

        if (!query) {
            return res.json([]);
        }

        console.log(
            "Searching:",
            query
        );

        try {

            const result =
                await yahooFinance.search(
                    query
                );

            const quotes =
                result.quotes || [];

            const stocks =
                quotes
                    .filter(
                        (asset) =>
                            asset.symbol
                    )
                    .slice(0, 10)
                    .map(
                        (asset) => ({

                            symbol:
                                asset.symbol,

                            description:
                                asset.longname ||
                                asset.shortname ||
                                asset.symbol,

                            type:
                                asset.quoteType ||
                                "EQUITY"

                        })
                    );

            console.log(
                "Search results:",
                stocks
            );

            res.json(stocks);

        } catch (error) {

            console.log(
                "Search error:",
                error.message
            );

            res.status(500).json({

                error:
                    error.message

            });

        }
    }
);


// ==========================================
// ADD TO WATCHLIST
// ==========================================

app.post(
    "/watchlist",
    (req, res) => {

        const asset =
            req.body;

        if (
            !asset ||
            !asset.symbol
        ) {

            return res.status(400).json({

                error:
                    "Invalid asset"

            });

        }

        watchlist[
            asset.symbol
        ] = asset;

        console.log(
            "Added to watchlist:",
            asset.symbol
        );

        res.json({

            message:
                "Asset added",

            asset:
                asset

        });

    }
);


// ==========================================
// GET WATCHLIST
// ==========================================

app.get(
    "/watchlist",
    (req, res) => {

        res.json(
            Object.values(watchlist)
        );

    }
);


// ==========================================
// REMOVE FROM WATCHLIST
// ==========================================

app.delete(
    "/watchlist/:symbol",
    (req, res) => {

        const symbol =
            req.params.symbol;

        delete watchlist[
            symbol
        ];

        console.log(
            "Removed:",
            symbol
        );

        res.json({

            message:
                "Asset removed"

        });

    }
);


// ==========================================
// GET STOCK PRICE
// ==========================================

async function getStockPrice(
    symbol
) {

    const quote =
        await yahooFinance.quote(
            symbol
        );

    if (
        !quote ||
        quote.regularMarketPrice ===
            undefined
    ) {

        throw new Error(
            `No price available for ${symbol}`
        );

    }

    return {

        price:
            quote.regularMarketPrice,

        change:
            quote.regularMarketChange,

        changePercent:
            quote.regularMarketChangePercent

    };

}

// ==========================================
// HISTORICAL PRICE DATA
// ==========================================

app.get("/history/:symbol", async (req, res) => {

    const symbol = req.params.symbol;

    try {

        const period2 = new Date();

        const period1 = new Date();

        period1.setDate(period1.getDate() - 30);

        const result = await yahooFinance.chart(symbol, {
            period1: period1,
            period2: period2,
            interval: "1d"
        });

        const data = (result.quotes || [])
            .filter(item =>
                item.close !== null &&
                item.close !== undefined
            )
            .map(item => ({
                date: new Date(item.date)
                    .toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short"
                    }),

                price: item.close
            }));

        res.json(data);

    } catch (error) {

        console.log(
            "History error:",
            error.message
        );

        res.status(500).json({
            error: error.message
        });

    }

});
// ==========================================
// PRICE ENDPOINT
// ==========================================

app.get(
    "/price/:symbol",
    async (req, res) => {

        const symbol =
            req.params.symbol;

        const asset =
            watchlist[symbol];

        if (!asset) {

            return res.status(404).json({

                error:
                    "Asset not found"

            });

        }

        try {

            const result =
                await getStockPrice(
                    symbol
                );

            res.json({

                symbol:
                    symbol,

                ...result

            });

        } catch (error) {

            console.log(
                "Price error:",
                error.message
            );

            res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// ==========================================
// HTTP SERVER
// ==========================================

const server =
    app.listen(
        PORT,
        () => {

            console.log(
                `Server running on http://localhost:${PORT}`
            );

        }
    );


// ==========================================
// WEBSOCKET SERVER
// ==========================================

const wss =
    new WebSocket.Server({
        server
    });


wss.on(
    "connection",
    (socket) => {

        console.log(
            "Browser connected through WebSocket"
        );

        socket.send(
            JSON.stringify({

                type:
                    "connected",

                message:
                    "Market WebSocket connected"

            })
        );

        socket.on(
            "close",
            () => {

                console.log(
                    "Browser disconnected"
                );

            }
        );

    }
);


// ==========================================
// BROADCAST PRICES
// ==========================================

async function broadcastPrices() {

    const assets =
        Object.values(watchlist);

    if (
        assets.length === 0
    ) {

        return;

    }

    const prices = {};

    for (
        const asset of assets
    ) {

        try {

            const result =
                await getStockPrice(
                    asset.symbol
                );

            prices[
                asset.symbol
            ] = {

                price:
                    result.price,

                change:
                    result.change,

                changePercent:
                    result.changePercent

            };

            console.log(
                `${asset.symbol}: ₹${result.price}`
            );

        } catch (error) {

            console.log(

                `Could not get ${asset.symbol}:`,
                error.message

            );

        }

    }

    wss.clients.forEach(
        (client) => {

            if (
                client.readyState ===
                WebSocket.OPEN
            ) {

                client.send(
                    JSON.stringify(
                        prices
                    )
                );

            }

        }
    );

}


// ==========================================
// FIRST PRICE UPDATE
// ==========================================

setTimeout(
    broadcastPrices,
    1000
);


// ==========================================
// UPDATE EVERY 30 SECONDS
// ==========================================

setInterval(
    broadcastPrices,
    30000
);