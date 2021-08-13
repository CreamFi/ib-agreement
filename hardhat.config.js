/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 require("dotenv").config();
 require("@nomiclabs/hardhat-waffle");
 require("@nomiclabs/hardhat-etherscan");

 module.exports = {
   solidity: {
     version: "0.8.2" ,
     settings: {
       optimizer: {
         enabled: true,
         runs: 200
       }
     }
   },
   mocha: {
     timeout: 600000
   },
   networks: {
     mainnet: {
       url: "https://mainnet.infura.io/v3/" + process.env.INFURA_TOKEN,
       accounts: [`0x${process.env.DEPLOY_PRIVATE_KEY}`]
     },
     goerli: {
       url: "https://goerli.infura.io/v3/" + process.env.INFURA_TOKEN,
       accounts: [`0x${process.env.DEPLOY_PRIVATE_KEY}`]
     },
     bsc: {
       url: "https://bsc-dataseed1.ninicoin.io/",
       accounts: [`0x${process.env.BSC_DEPLOY_PRIVATE_KEY}`]
     }
   },
   etherscan: {
     apiKey: process.env.ETHERSCAN_API_KEY
   }
 };
