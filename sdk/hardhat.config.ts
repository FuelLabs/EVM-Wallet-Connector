import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    defaultNetwork: {
      url: 'hardhat',
    },
  }
};

export default config;
