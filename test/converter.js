const { expect } = require("chai");
const { ethers } = require("hardhat");
const { impersonateAccount } = require("./testUtil.js");

describe("IBAgreement", () => {
  const toWei = ethers.utils.parseEther;
  const creamWhaleAddress = '0x000000000000000000000000000000000000dead';
  const routerAddress = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
  const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const creamAddress ='0x2ba592F78dB6436527729929AAf6c908497cB200';
  const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

  const collateralFactor = toWei('0.5');
  const liquidationFactor = toWei('0.75');

  let accounts;
  let executor, executorAddress;
  let borrower, borrowerAddress;
  let governor, governorAddress;
  let user, userAddress;
  let cream, usdc;
  let creamWhale;

  
  let converter;
  

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    // console.log(accounts)
    executor = accounts[0];    
    executorAddress = await executor.getAddress();
    creamWhale = await impersonateAccount(creamWhaleAddress);
    const tokenFactory = await ethers.getContractFactory("MockToken");
    const converterFactory = await ethers.getContractFactory("EasyConverter");

    cream = tokenFactory.attach(creamAddress)
    usdc = tokenFactory.attach(usdcAddress);
    
    converter = await converterFactory.deploy(routerAddress, wethAddress, creamAddress, usdcAddress);

  });
  it('convert cream', async () => {
    let swapAmount = ethers.utils.parseEther('10')
    let receiverCreamReceivable = ethers.utils.parseEther('9.9')
    let whaleBalance =  await cream.balanceOf(creamWhaleAddress)
    let initialUSDCBalance = await usdc.balanceOf(creamWhaleAddress)
    console.log(whaleBalance.toString(), swapAmount.toString())
    await cream.connect(creamWhale).transfer(converter.address, swapAmount);
    await converter.connect(creamWhale).convert(swapAmount);
    let postUSDCBalance = await usdc.balanceOf(creamWhaleAddress)
    let receiverAddress = '0x065c947CcF2c8244DEF2E400c91C9e6511A12D25';
    let postCreamBalanceReceiver = await cream.balanceOf(receiverAddress);
    expect(postCreamBalanceReceiver).to.eq(receiverCreamReceivable);
    expect(postUSDCBalance.gt(initialUSDCBalance)).to.be.true
  });
});
