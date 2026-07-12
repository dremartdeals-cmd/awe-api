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
        const { tokenIn, tokenOut, amountIn } = req.query;

        if (!tokenIn || !tokenOut || !amountIn) {
            return res.status(400).json({
                success: false,
                error: "Missing parameters: tokenIn, tokenOut, amountIn"
            });
        }

        // Validate amountIn is a valid number before converting to BigInt
        if (isNaN(amountIn) || BigInt(amountIn) <= 0n) {
            return res.status(400).json({
                success: false,
                error: "Invalid amountIn. Must be a positive number."
            });
        }

        const path = [tokenIn, tokenOut];

        const amounts = await router.getAmountsOut(BigInt(amountIn), path);

        // Ensure it's treated as a BigInt (in case your provider returns strings)
        const buyAmount = BigInt(amounts[1]).toString();

        res.json({
            success: true,
            buyAmount: buyAmount,
            minBuyAmount: buyAmount, 
            to: process.env.ROUTER_ADDRESS,
            data: "0x",
            value: "0"
        });

    } catch (err) {
        console.error("Quote error:", err);
        // Return proper 500 status code on server errors
        res.status(500).json({
            success: false,
            error: err.message || "Internal server error"
        });
    }
});

app.get("/swap", async (req, res) => {
    try {
        const { sellToken, buyToken, sellAmount, taker } = req.query;

        // Added 'taker' to the validation check
        if (!sellToken || !buyToken || !sellAmount || !taker) {
            return res.status(400).json({
                success: false,
                error: "Missing parameters: sellToken, buyToken, sellAmount, taker"
            });
        }

        if (isNaN(sellAmount) || BigInt(sellAmount) <= 0n) {
            return res.status(400).json({
                success: false,
                error: "Invalid sellAmount. Must be a positive number."
            });
        }

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        const path = [sellToken, buyToken];

        const amounts = await router.getAmountsOut(BigInt(sellAmount), path);

        // Calculate minOut with 0.5% slippage (99.5%)
        const amountOut = BigInt(amounts[1]);
        const minOut = (amountOut * 995n) / 1000n;

        const data = iface.encodeFunctionData("swapExactTokensForTokens", [
            BigInt(sellAmount),
            minOut,
            path,
            taker,
            deadline
        ]);

        res.json({
            success: true,
            to: process.env.ROUTER_ADDRESS,
            data: data,
            value: "0",
            buyAmount: amountOut.toString(),
            minBuyAmount: minOut.toString()
        });

    } catch (e) {
        console.error("Swap error:", e);
        res.status(500).json({
            success: false,
            error: e.message || "Internal server error"
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}...`);
});
