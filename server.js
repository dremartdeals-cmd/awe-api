const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { ethers } = require("ethers");
const feeRouterAbi = require("./abi/AWEFeeRouter.json");
const { feeRouter, getWbnbAddress } = require("./config/router");

const iface = new ethers.Interface(feeRouterAbi);

const app = express();

app.use(cors({
    origin: true,
    credentials: false
}));

app.use(express.json());

const NATIVE = "BNB";
const isNative = (addr) => typeof addr === "string" && addr.toUpperCase() === NATIVE;

async function resolvePath(tokenIn, tokenOut) {
    const wbnb = await getWbnbAddress();
    const from = isNative(tokenIn) ? wbnb : tokenIn;
    const to = isNative(tokenOut) ? wbnb : tokenOut;
    return [from, to];
}

app.get("/", (req, res) => {
    res.send("AWE DEX API — own quotes, own swaps, own fee collection. No third-party aggregator involved.");
});

app.get("/health", async (req, res) => {
    try {
        const [owner, treasury, feeBps, routerAddr] = await Promise.all([
            feeRouter.owner(),
            feeRouter.treasury(),
            feeRouter.feeBps(),
            feeRouter.router()
        ]);
        res.json({
            success: true,
            feeRouter: await feeRouter.getAddress(),
            underlyingRouter: routerAddr,
            owner,
            treasury,
            feeBps: feeBps.toString()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/quote", async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn } = req.query;

        if (!tokenIn || !tokenOut || !amountIn) {
            return res.status(400).json({ success: false, error: "Missing parameters" });
        }
        if (isNaN(amountIn) || BigInt(amountIn) <= 0n) {
            return res.status(400).json({ success: false, error: "Invalid amountIn" });
        }

        const path = await resolvePath(tokenIn, tokenOut);
        if (path[0].toLowerCase() === path[1].toLowerCase()) {
            return res.status(400).json({ success: false, error: "tokenIn and tokenOut must differ" });
        }

        const [fee, amountInAfterFee, amounts] = await feeRouter.getAmountsOutWithFee(BigInt(amountIn), path);
        const buyAmount = amounts[amounts.length - 1].toString();
        const feeBps = await feeRouter.feeBps();
        const feeRouterAddress = await feeRouter.getAddress();

        res.json({
            success: true,
            sellToken: tokenIn,
            buyToken: tokenOut,
            sellAmount: amountIn.toString(),
            buyAmount,
            minBuyAmount: buyAmount,
            fee: fee.toString(),
            feeBps: feeBps.toString(),
            amountInAfterFee: amountInAfterFee.toString(),
            to: feeRouterAddress,
            data: "0x",
            value: isNative(tokenIn) ? amountIn.toString() : "0",
            allowanceTarget: isNative(tokenIn) ? null : feeRouterAddress
        });
    } catch (err) {
        console.error("Quote error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/swap", async (req, res) => {
    try {
        const sellToken = req.query.sellToken;
        const buyToken = req.query.buyToken;
        const amountIn = req.query.sellAmount;
        const account = req.query.taker;
        const slippageBps = req.query.slippageBps ? BigInt(req.query.slippageBps) : 50n;

        if (!sellToken || !buyToken || !amountIn || !account) {
            return res.status(400).json({ success: false, error: "Missing parameters" });
        }
        if (isNaN(amountIn) || BigInt(amountIn) <= 0n) {
            return res.status(400).json({ success: false, error: "Invalid amount" });
        }
        if (!ethers.isAddress(account)) {
            return res.status(400).json({ success: false, error: "Invalid taker address" });
        }
        if (slippageBps < 0n || slippageBps > 5000n) {
            return res.status(400).json({ success: false, error: "slippageBps must be between 0 and 5000" });
        }

        const path = await resolvePath(sellToken, buyToken);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

        const [fee, , amounts] = await feeRouter.getAmountsOutWithFee(BigInt(amountIn), path);
        const buyAmount = amounts[amounts.length - 1];
        const minOut = (buyAmount * (10000n - slippageBps)) / 10000n;

        const sellingNative = isNative(sellToken);
        const buyingNative = isNative(buyToken);
        const feeRouterAddress = await feeRouter.getAddress();

        let data;
        let value = "0";

        if (sellingNative) {
            data = iface.encodeFunctionData("swapExactETHForTokensWithFee", [minOut, path, account, deadline]);
            value = amountIn.toString();
        } else if (buyingNative) {
            data = iface.encodeFunctionData("swapExactTokensForETHWithFee", [
                BigInt(amountIn), minOut, path, account, deadline
            ]);
        } else {
            data = iface.encodeFunctionData("swapExactTokensForTokensWithFee", [
                BigInt(amountIn), minOut, path, account, deadline
            ]);
        }

        res.json({
            success: true,
            to: feeRouterAddress,
            data,
            value,
            buyAmount: buyAmount.toString(),
            minBuyAmount: minOut.toString(),
            fee: fee.toString(),
            allowanceTarget: sellingNative ? null : feeRouterAddress
        });
    } catch (e) {
        console.error("Swap error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AWE DEX API running on port ${PORT}`);
});
