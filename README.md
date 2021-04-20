# Sample Stock App

A sample node.js simple server to calculate gains and losses for a stock portfolio. 



Requirements: (rewritten)

Goal: The project is a microservice to determine the total profit or loss of a user’s 
stock portfolio performance between 2 timestamps.


-- Tools Used: Node.js plus various modules, Express, mysql (not needed), Got for external api calls. 

-- The project is fairly straightforward, though I feel the requirements could be rewritten a little 
bit to be clearer. 


There are 2 components to this project:
1) System architecture. Describe how you would design the service(s) and how it would
be integrated with an existing system.

  --A basic REST service was created, mainly giving access to a /api/gains endpoint. 
The endpoint allows for a username, and two optional dates to be used.

http://localhost:3000/api/gains/tim_apple

http://localhost:3000/api/gains/tim_apple_senior?fromDate=2-2-2021&toDate=04-01-2021

A singular file was used for this small example, so all methods are in app.js, would 
normally be broken up into needed areas. 
No real modeling was needed for db part, but I included my work on a Users object, I am 
using for a series of tutorials.
 
Prep work files was done for AWS lambda deployment.   

a) You may assume that a service already exists that can provide data for all of the
stock transactions (buy or sell, number of shares, price per share, timestamp) for
all users.

  -- A mock method getMockStockTradesAPI(user, fromDate, toDate) is created and filled with 
  data for 6 or so users keyed on username. 
  
b) Your service may not access the data store containing the transaction data
directly. It’s up to you to decide how you’d like your service to get access to this
data.

  -- mocked in method above, could be replaced with an API service call. 
  
c) Don’t reinvent the wheel. We want you to leverage cloud services (AWS) as
much as possible.

  -- Due to my time constraints, I did not fully deploy it as a lambda service. 
  
d) Be specific. Visual architecture diagrams are nice, but we want to see your vision
for exactly how each piece of the system will work.


2) Write code. We don’t expect you to implement the entire service end-to-end, but we
want you to build the significant pieces.

a) Integrate a 3rd party API (such as https://finnhub.io/docs/api/quote) to get stock
price data.
  
  -- Current prices were gathered from the 3rd party finnhub to use in calculations.  
  This was NOT optimized to prevent multiple calls for data already in hand, but not
  necessary for this smaller project. 
  
  A multi quote call could also be used to speed up external requests. 
  
b) Mock up the transaction history for a few pretend, but realistic users. See below
for an example.
  
  -- Mock data in the getMockStockTradesAPI method, 
  JSON format as a text block which we parsed. 
```
      data['john_simple'] =
  `12345, buy, GME, 5, 20.99, 2020-12-21 15:45:24
  12345, sell, GME, 5, 145.04, 2021-01-26 18:34:12`;
```

c) Calculate the profit/loss of the portfolio from the above data.

-- This part was a bit vague as to expected returns, simplest version of this could be for a 
single user, a single float value representing total gains and losses over the period, or
the value for all users. 

I choose a simple and a more complex return value. 

Example output:

The simple return shows the date period, and a totalGainLoss value. 

The longer return shows each full trade, from buy to sell, with price and quantity, 
and gainLoss of that sale. 

```
Long:
{
  "user": "tim_apple_senior",
  "fromDate": "2-2-2021",
  "toDate": "04-01-2021",
  "totalGainLoss": "1024.14",
  "trades": [
    {
      "userId": "12345",
      "action": "buy",
      "symbol": "GME",
      "quantity": 5,
      "price": "20.99",
      "tradeTime": "2020-12-21 15:45:24",
      "quantitySell": 5,
      "priceSell": "145.04",
      "tradeTimeSell": "2021-01-26 18:34:12",
      "gainLoss": "620.25"
    },
    {
      "userId": "12345",
      "action": "buy",
      "symbol": "AAPL",
      "quantity": 5,
      "price": "76.60",
      "tradeTime": "2020-01-02 16:01:23",
      "quantitySell": 5,
      "priceSell": "90.00",
      "tradeTimeSell": "2020-06-08 12:12:51",
      "gainLoss": "67.00"
    },
    {
      "userId": "12345",
      "action": "buy",
      "symbol": "AAPL",
      "quantity": 1,
      "price": "95.11",
      "tradeTime": "2020-06-05 15:21:35",
      "quantitySell": 1,
      "priceSell": "90.00",
      "tradeTimeSell": "2020-06-08 12:12:51",
      "gainLoss": "-5.11"
    },
    {
      "userId": "12345",
      "action": "buy",
      "symbol": "AAPL",
      "quantity": 9,
      "price": "95.11",
      "tradeTime": "2020-06-05 15:21:35",
      "quantitySell": 9,
      "priceSell": 133.11,
      "tradeTimeSell": "2021-04-20 21:56:46",
      "gainLoss": "342.00"
    }
  ]
}
```

d) Integrate the cloud services used by your architecture.
  
  -- Time limit for myself did not allow for lamda full creation. 
  
e) Create the interface that will allow other parts of the system to access the data
calculated by your service.

  -- Api can be called externally 
  
  http://localhost:3000/api/gains/tim_apple
  
  And Json results parsed for front end display. 



I have created an maintained a personal simple stock market application that also shows 
grouping by industry of currently held stocks,  adding and removing stocks by ticker search, 
opening and closing prices, current price, daily and term gains, I have used this for over 
5 years now to help control my portfolio.  


Notes on project creation:

  The main thing to watch for in a project like this is that buy and sale quantity amounts may not 
match up exactly, and each case needs to be taken into account. 

  Simple Example 1: Buy 5 GME stocks and sell 5 GME stocks

  Ex 2: Buy multiple times, sell once. 

  Ex 3: Buy once, sell multiple times. 

  Ex 4: Buy once, never sell (use current stock price then)

  Buy x times Sell y times. 

  There is a case as well where there could be no buys during the date period, only Sells. 


  In this case there is no gain or loss calculated, as the initial price is considered unknown. 

Little error checking or data integrity is done in the sample project. 

A small debug section is left at the bottom of app.js to directly check several methods. 


Hours Used: 4.5 

James Ratcliff
April 20, 2021.