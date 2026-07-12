const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { ethers } = require("ethers");
const routerAbi = require("./abi/AWERouter.json");
const { router } = require("./config/router"); // Ensure this exports an ethers v6 Contract instance

// Ethers v6 Interface
const iface = new ethers.Interface(routerAbi);

const app = express();

// 1. Clean CORS setup (Removed the duplicate manual middleware)
app.use(cors({
    origin: true,
    credentials: false
}));

app.options("*", cors());

app.get("/", (req, res) => {
    res.send("AppsWebStore API");
});

app.get("/quote", async (req, res) => {
    try {
        const tokenIn = req.query.tokenIn;
        const tokenOut = req.query.tokenOut;
        const amountIn = req.query.amountIn;

        if (!tokenIn || !tokenOut || !amountIn) {
            return res.status(400).json({
                success: false,
                error: "Missing parameters"
            });
        }

        // Validate amountIn
        if (isNaN(amountIn) || BigInt(amountIn) <= 0n) {
            return res.status(400).json({
                success: false,
                error: "Invalid amountIn"
            });
        }

        const path = [tokenIn, tokenOut];
        const amounts = await router.getAmountsOut(BigInt(amountIn), path);

        const buyAmount = BigInt(amounts[1]).toString();

        res.json({
            success: true,
            buyAmount: buyAmount,
            minBuyAmount: buyAmount,
            to: process.env.ROUTER_ADDRESS,
            data: "0x",
            value: "0",
            // Add this for ERC20 token approvals
            allowanceTarget: process.env.ROUTER_ADDRESS
        });

    } catch (err) {
        console.error("Quote error:", err);
        res.status(500).json({
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

        if (!sellToken || !buyToken || !amountIn || !account) {
            return res.status(400).json({
                success: false,
                error: "Missing parameters"
            });
        }

        if (isNaN(amountIn) || BigInt(amountIn) <= 0n) {
            return res.status(400).json({
                success: false,
                error: "Invalid amount"
            });
        }

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
        const path = [sellToken, buyToken];
        const amounts = await router.getAmountsOut(BigInt(amountIn), path);
        const minOut = (BigInt(amounts[1]) * 995n) / 1000n;

        const data = iface.encodeFunctionData("swapExactTokensForTokens", [
            BigInt(amountIn),
            minOut,
            path,
            account,
            deadline
        ]);

        res.json({
            success: true,
            to: process.env.ROUTER_ADDRESS,
            data: data,
            value: "0",
            buyAmount: amounts[1].toString(),
            minBuyAmount: minOut.toString(),
            allowanceTarget: process.env.ROUTER_ADDRESS // Add this
        });

    } catch (e) {
        console.error("Swap error:", e);
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}...`);
});
