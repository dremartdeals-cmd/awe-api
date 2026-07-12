const { ethers } = require("ethers");
require("dotenv").config();

const routerAbi = require("../abi/AWERouter.json");
const feeRouterAbi = require("../abi/AWEFeeRouter.json");

if (!process.env.RPC_URL) throw new Error("RPC_URL is not set");
if (!process.env.ROUTER_ADDRESS) throw new Error("ROUTER_ADDRESS is not set");
if (!process.env.FEE_ROUTER_ADDRESS) throw new Error("FEE_ROUTER_ADDRESS is not set");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const router = new ethers.Contract(process.env.ROUTER_ADDRESS, routerAbi, provider);
const feeRouter = new ethers.Contract(process.env.FEE_ROUTER_ADDRESS, feeRouterAbi, provider);

let cachedWbnb = null;
async function getWbnbAddress() {
    if (cachedWbnb) return cachedWbnb;
    cachedWbnb = (process.env.WBNB_ADDRESS && process.env.WBNB_ADDRESS !== "")
        ? process.env.WBNB_ADDRESS
        : await feeRouter.WBNB();
    return cachedWbnb;
}

module.exports = { provider, router, feeRouter, getWbnbAddress };
