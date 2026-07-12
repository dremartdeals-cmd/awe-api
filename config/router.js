const { ethers } = require("ethers");
require("dotenv").config();

const routerAbi = require("../abi/AWERouter.json");

const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL
);

const router = new ethers.Contract(
    process.env.ROUTER_ADDRESS,
    routerAbi,
    provider
);

module.exports = {
    provider,
    router
};
