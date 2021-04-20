const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const mysql = require('mysql');
const port = 3000;
const got = require('got');


const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

const pool = mysql.createPool(config);

const app = express();
app.use(bodyParser.json());

app.get("/api/gains/:username", (req, res) => {

    console.log(' query = ', req.query);
    console.log(' query fromDate = ', req.query.fromDate);

    let fromDate = req.query.fromDate;
    let toDate = req.query.toDate;  // NOTE: no error handling, defaults in method.

    // calculateStockResults(req.params['username'], '2021-01-01', '2021-05-01', 1)
    calculateStockResults(req.params['username'], fromDate, toDate, 1)
        .then(function (results) {
            // handle data
            res.setHeader('Content-Type', 'application/json');
            res.send(results);
        });

});


// Given a user and a start date, go request all their trades, and calculate their gains/losses.
// For current stock prices, call over to finnhub.io
// Note: this will not add in any values for sells where the matching buy is before the time period.
// A long and short version of this report are available.
// longresults flag will include buy.sell trades.
async function calculateStockResults(user, fromDate, toDate, longResults) {
    let currDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!fromDate) fromDate = '2021-01-01 01:00:00';
    if (!toDate) toDate = currDate;

    let data = getMockStockTradesAPI(user, fromDate, toDate);
    // console.log('DEBUG data = ', data);
    let trades = parseCSVData(data);

    // console.log('DEBUG parsed trades = ', trades);

    // Step 1:
    // Get a total of all stock quantities bought.
    let t = 0;
    let stockQuantities = {};
    while (trades[t]) {
        if (trades[t].action === "buy") {
            if (!stockQuantities[trades[t].symbol]) stockQuantities[trades[t].symbol] = 0;
            stockQuantities[trades[t].symbol] += trades[t].quantity;
        }
        t++;
    }
    // console.log('DEBUG stockQuantities = ', stockQuantities);


    // Step 2:
    // Loop over each trade, get buy and sell dates and amounts if known.
    let totalGainLoss = 0;
    let fullTrades = [];
    t = 0;
    while (trades[t]) {

        let sellTrade = trades[t];
        if (sellTrade.action === "sell") {
            // Match to a buy if possible.
            // Note could be multiples... purchases for a single sell. and mult sells.
            let u = 0;
            while (trades[u] && u < t && stockQuantities[sellTrade.symbol] > 0) {
                if (trades[u].symbol === sellTrade.symbol && trades[u].action === "buy") {
                    let fullTrade = {...trades[u]};  // clone our object.
                    let maxQuantity = Math.min(sellTrade.quantity, trades[u].quantity);  // dont sell or buy more than we have.  hmmm right?

                    fullTrade.quantity = maxQuantity;
                    fullTrade.quantitySell = maxQuantity;
                    fullTrade.priceSell = sellTrade.price;
                    fullTrade.tradeTimeSell = sellTrade.tradeTime;

                    stockQuantities[sellTrade.symbol] -= maxQuantity;  // update our index.

                    trades[t].quantity -= maxQuantity;  // update our sells.
                    trades[u].quantity -= maxQuantity;  // subtract out our old buy trade one.

                    // Calc our gain loss for this set.
                    fullTrade.gainLoss = (fullTrade.quantity * (fullTrade.priceSell - fullTrade.price)).toFixed(2);
                    totalGainLoss += parseFloat(fullTrade.gainLoss);
                    // console.log('totalGainLoss = ', totalGainLoss);

                    fullTrades.push(fullTrade)
                }
                u++;
            }
        }
        t++;
    }
    // console.log('fullTrades = ', fullTrades);


    // Step 3: Fill in any final current amounts on trades.
    t = 0;
    while (trades[t]) {
        if (trades[t].action === "buy" && trades[t].quantity > 0) {
            let fullTrade = {...trades[t]};  // clone our object.

            fullTrade.quantitySell = fullTrade.quantity;

            // External api call to get current price.
            let currPrice = await getCurrentStockPrice(fullTrade.symbol);
            fullTrade.priceSell = currPrice;
            fullTrade.tradeTimeSell = currDate;

            stockQuantities[fullTrade.symbol] -= fullTrade.quantity;  // update our index.

            trades[t].quantity -= fullTrade.quantity;  // subtract out our old buy trade one.

            // Calc our gain loss for this set.
            fullTrade.gainLoss = (fullTrade.quantity * (fullTrade.priceSell - fullTrade.price)).toFixed(2);
            totalGainLoss += parseFloat(fullTrade.gainLoss);

            fullTrades.push(fullTrade)
        }

        t++;
    }

    console.log('fullTrades = ', fullTrades);

    // Full report.
    let output = {
        user: user,
        fromDate: fromDate,
        toDate: toDate,
        totalGainLoss: totalGainLoss.toFixed(2),
    };

    // If we want full data include this flag
    if (longResults) output.trades = fullTrades;

    return JSON.stringify(output);
}

// Asks for api current price from stock service.
// No real error catching here.
async function getCurrentStockPrice(symbol) {
    let apiToken = "c1vjtst37jkpmefgjjvg"; // Hard coded
    let url = "https://finnhub.io/api/v1/quote?symbol=" + symbol + "&token=" + apiToken;

    try {
        const response = await got(url);
        // console.log('DEBUG api response = ', response.body);
        let json = JSON.parse(response.body);
        // console.log('response.body c = ', json.c);

        return json.c;
    } catch (error) {
        console.log(error.response.body);
    }

    return null;
}


function parseCSVData(data) {
    if (!data) return [];

    let lines = data.split(/\n/);

    // console.log('DEBUG lines = ', lines);

    let trades = [];
    lines.forEach(function (line) {
        // console.log('DEBUG line = ', line);
        let [userId, action, symbol, quantity, price, tradeTime] = line.split(/, */);

        let trade = {
            userId: userId,
            action: action,
            symbol: symbol,
            quantity: quantity,
            price: price,
            tradeTime: tradeTime
        };
        trades.push(trade);
    });

    return trades;
}

// Grab all trades for this user and time period.
// Assumption: trades are in date order correctly.
// Can use userid instead of a username.
function getMockStockTradesAPI(user, fromDate, toDate) {
    // user_id, buy/sell, stock symbol, quantity, price, timestamp (UTC)
    // 12345, buy, AAPL, 10, 76.60, 2020-01-02 16:01:23
    // 12345, buy, AAPL, 5, 95.11, 2020-06-05 15:21:65
    // 12345, buy, GME, 5, 20.99, 2020-12-21 15:45:24
    // 12345, sell, GME, 5, 145.04, 2021-01-26 18:34:12

    // MOCK USERS, would come from another external api later.

    let data = [];

    // Simple example buy sell exact same amount.
    data['john_simple'] =
        `12345, buy, GME, 5, 20.99, 2020-12-21 15:45:24
12345, sell, GME, 5, 145.04, 2021-01-26 18:34:12`;

    // one sell spans over two buys.
    data['tim_apple'] =
        `12345, buy, AAPL, 5, 76.60, 2020-01-02 16:01:23
12345, buy, AAPL, 10, 95.11, 2020-06-05 15:21:35
12345, sell, AAPL, 6, 90.00, 2020-06-08 12:12:51`;

    // Example, sells way more than he really owns.
    data['peter_sellers'] =
        `12345, buy, AAPL, 5, 76.60, 2020-01-02 16:01:23
12345, sell, AAPL, 10, 95.11, 2020-06-05 15:21:35
12345, sell, AAPL, 6, 90.00, 2020-06-08 12:12:51`;

    // Example, sells only in range.
    data['jackie_cellars'] =
        `12345, sell, AAPL, 10, 95.11, 2020-06-05 15:21:35
12345, sell, AAPL, 6, 90.00, 2020-06-08 12:12:51`;

    // Example, single buy action only.
    data['johnny_single'] =
        `12345, buy, AAPL, 5, 95.11, 2020-06-05 15:21:35`;

    // Example, double buy action.
    data['johnny_double'] =
        `12345, buy, AAPL, 5, 95.11, 2020-06-05 15:21:35
12345, buy, AAPL, 5, 90.00, 2020-06-08 12:12:51`;

    // one sell spans over two buys plus a second stock
    data['tim_apple_senior'] =
        `12345, buy, GME, 5, 20.99, 2020-12-21 15:45:24
12345, sell, GME, 5, 145.04, 2021-01-26 18:34:12
12345, buy, AAPL, 5, 76.60, 2020-01-02 16:01:23
12345, buy, AAPL, 10, 95.11, 2020-06-05 15:21:35
12345, sell, AAPL, 6, 90.00, 2020-06-08 12:12:51`;

    // If no user known, return empty [] and handles fine.
    return data[user];
}


app.get("/api/users", (req, res) => {
    pool.getConnection((err, conn) => {
        if (err) throw err;
        conn.query("SELECT * from users", (error, results, fields) => {
            conn.release();
            if (error) throw error;
            res.send(results);
        });
    });
});

app.post("/api/users", (req, res) => {
    let body = req.body;
    let user = {
        "fullname": body["fullname"],
        "email": body["email"]
    };
    pool.getConnection((err, conn) => {
        if (err) throw err;
        conn.query("INSERT INTO users SET ?", user, (error, results, fields) => {
            conn.release();
            if (error) throw error;
            res.send(results);
        });
    });
});

app.patch("/api/users/:user_id", (req, res) => {
    let body = req.body;
    let userid = req.params["user_id"];
    let fullname = body["fullname"];
    let email = body["email"];
    let query = `UPDATE users SET fullname='${fullname}',email='${email}' WHERE id=${userid}`;
    pool.getConnection((err, conn) => {
        if (err) throw err;
        conn.query(query, (error, results, fields) => {
            conn.release();
            if (error) throw error;
            res.send(results);
        });
    });
});

app.delete("/api/users/:user_id", (req, res) => {
    let userid = req.params["user_id"];
    let query = `DELETE FROM users WHERE id=${userid}`;
    pool.getConnection((err, conn) => {
        if (err) throw err;
        conn.query(query, (error, results, fields) => {
            conn.release();
            if (error) throw error;
            res.send(results);
        });
    })
});

// For local development.
app.listen(port, () => {
    console.log("server started to listen on " + port);
});


// DEBUG TEST
// calculateStockResults('tim_apple_senior', '2021-01-01', '2021-05-01', true)
//     .then(function (results) {
//         console.log('results = ', results);
//     });


// let price = getCurrentStockPrice("AAPL")
// console.log('price = ', price);
// let price2 = getCurrentStockPrice("GOOG")
// console.log('price2 = ', price2);




