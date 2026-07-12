const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { ethers } = require("ethers");
const routerAbi = require("./abi/AWERouter.json");
const { router } = require("./config/router");

const iface = new ethers.Interface(routerAbi);

const app = express();
app.use(cors());
app.options("*", cors());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});
app.get("/", (req, res) => {
    res.send("AppsWebStore API");
});

app.get("/quote", async (req, res) => {

    try {

        const tokenIn = req.query.tokenIn;
        const tokenOut = req.query.tokenOut;
        const amountIn = req.query.amountIn;

        if (!tokenIn || !tokenOut || !amountIn) {
            return res.json({
                success: false,
                error: "Missing parameters"
            });
        }

        const path = [tokenIn, tokenOut];

        const amounts = await router.getAmountsOut(
            BigInt(amountIn),
            path
        );

res.json({
    success: true,
    buyAmount: amounts[1].toString(),
    minBuyAmount: amounts[1].toString(),
    to: process.env.ROUTER_ADDRESS,
    data: "0x",
    value: "0"
});

    } catch (err) {

        res.json({
            success: false,
            error: err.message
        });

    }

});

app.get("/swap", async (req, res) => {

    try {

const sellToken = req.query.sellToken;
const buyToken = req.query.buyToken;
const amountIn = req.query.sellAmount;
const account = req.query.taker;

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

        const path = [sellToken, buyToken];

        const amounts = await router.getAmountsOut(
            BigInt(amountIn),
            path
        );

        const minOut = amounts[1] * 995n / 1000n;

        const data = iface.encodeFunctionData(
            "swapExactTokensForTokens",
            [
                BigInt(amountIn),
                minOut,
                path,
                account,
                deadline
            ]
        );

        res.json({
            success: true,
            to: process.env.ROUTER_ADDRESS,
            data,
            value: "0",
            buyAmount: amounts[1].toString(),
            minBuyAmount: minOut.toString()
        });

    } catch (e) {

        res.json({
            success: false,
            error: e.message
        });

    }

});

app.listen(3000, () => {
    console.log("API running...");
});
