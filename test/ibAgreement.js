const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IBAgreement", () => {
  const toWei = ethers.utils.parseEther;
  const usdAddress = '0x0000000000000000000000000000000000000348';

  const collateralFactor = toWei('0.5');
  const liquidationFactor = toWei('0.75');

  let accounts;
  let executor, executorAddress;
  let borrower, borrowerAddress;
  let governor, governorAddress;
  let user, userAddress;

  let ibAgreement;
  let underlying;
  let cyToken;
  let cyToken2;
  let priceOracle;
  let comptroller;
  let collateral;
  let registry;
  let priceFeed;
  let token;
  let converter;
  let invalidConverter1;
  let invalidConverter2;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    executor = accounts[1];
    executorAddress = await executor.getAddress();
    borrower = accounts[2];
    borrowerAddress = await borrower.getAddress();
    governor = accounts[3];
    governorAddress = await governor.getAddress();
    user = accounts[4];
    userAddress = await user.getAddress();

    const ibAgreementFactory = await ethers.getContractFactory("IBAgreementV2");
    const tokenFactory = await ethers.getContractFactory("MockToken");
    const cyTokenFactory = await ethers.getContractFactory("MockCyToken");
    const priceOracleFactory = await ethers.getContractFactory("MockPriceOralce");
    const comptrollerFactory = await ethers.getContractFactory("MockComptroller");
    const registryFactory = await ethers.getContractFactory("MockRegistry");
    const priceFeedFactory = await ethers.getContractFactory("ChainlinkPriceFeed");
    const converterFactory = await ethers.getContractFactory("MockConverter");

    priceOracle = await priceOracleFactory.deploy();
    comptroller = await comptrollerFactory.deploy(priceOracle.address);
    underlying = await tokenFactory.deploy("USD Tether", "USDT", 6);
    cyToken = await cyTokenFactory.deploy(comptroller.address, underlying.address);
    cyToken2 = await cyTokenFactory.deploy(comptroller.address, underlying.address);
    collateral = await tokenFactory.deploy("Wrapped BTC", "WBTC", 8);
    registry = await registryFactory.deploy();
    priceFeed = await priceFeedFactory.deploy(registry.address, collateral.address, collateral.address, usdAddress);
    ibAgreement = await ibAgreementFactory.deploy(executorAddress, borrowerAddress, governorAddress, comptroller.address, collateral.address, priceFeed.address, collateralFactor, liquidationFactor);
    await comptroller.setMarketListed(cyToken.address, true);
    await comptroller.pushAssetsIn(ibAgreement.address, cyToken.address);
    await ibAgreement.connect(executor).setAllowedMarkets([cyToken.address], [true]);

    token = await tokenFactory.deploy("Cream", "CREAM", 18);
    converter = await converterFactory.deploy(collateral.address, underlying.address);
    invalidConverter1 = await converterFactory.deploy(token.address, underlying.address);
    invalidConverter2 = await converterFactory.deploy(collateral.address, token.address);
  });

  describe('debtUSD / hypotheticalDebtUSD', () => {
    const debt = 5000 * 1e6; // 5000 USDT
    const price = '1000000000000000000000000000000'; // 1e30

    beforeEach(async () => {
      await Promise.all([
        cyToken.setBorrowBalance(ibAgreement.address, debt),
        priceOracle.setUnderlyingPrice(cyToken.address, price)
      ]);
    });

    it('shows the debt in USD value', async () => {
      expect(await ibAgreement.debtUSD()).to.eq(toWei('5000'));
    });

    it('shows the hypothetical debt in USD value', async () => {
      const borrowAmount = 1000 * 1e6; // 1000 USDT
      expect(await ibAgreement.hypotheticalDebtUSD(cyToken.address, borrowAmount)).to.eq(toWei('6000'));
    });
  });

  describe('collateralUSD / hypotheticalCollateralUSD / liquidationThreshold', () => {
    const amount = 1 * 1e8; // 1 wBTC
    const price = '4000000000000'; // 40000 * 1e8

    beforeEach(async () => {
      await Promise.all([
        collateral.mint(ibAgreement.address, amount),
        registry.setPrice(collateral.address, usdAddress, price),
        ibAgreement.connect(governor).setPriceFeed(priceFeed.address)
      ]);
    });

    it('shows the collateral in USD value', async () => {
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000')); // CF: 50%
    });

    it('shows the hypothetical debt in USD value', async () => {
      const withdrawAmount = 0.5 * 1e8; // 0.5 wBTC
      expect(await ibAgreement.hypotheticalCollateralUSD(withdrawAmount)).to.eq(toWei('10000')); // CF: 50%
    });

    it('show the liquidation threshold', async () => {
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('30000')); // LF: 75%
    });
  });

  describe('borrow / borrowMax / withdraw / repay', () => {
    const collateralAmount = 1 * 1e8; // 1 wBTC
    const collateralPrice = '4000000000000'; // 40000 * 1e8
    const borrowAmount = 100 * 1e6; // 100 USDT
    const borrowPrice = '1000000000000000000000000000000'; // 1e30

    beforeEach(async () => {
      await Promise.all([
        collateral.mint(ibAgreement.address, collateralAmount),
        registry.setPrice(collateral.address, usdAddress, collateralPrice),
        ibAgreement.connect(governor).setPriceFeed(priceFeed.address),
        priceOracle.setUnderlyingPrice(cyToken.address, borrowPrice)
      ]);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000')); // CF: 50%
    });

    it('borrows successfully', async () => {
      await ibAgreement.connect(borrower).borrow(cyToken.address, borrowAmount);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));
    });

    it('failed to borrow for non-borrower', async () => {
      await expect(ibAgreement.borrow(cyToken.address, borrowAmount)).to.be.revertedWith('caller is not the borrower');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to borrow for undercollateralized', async () => {
      const amount = 20001 * 1e6; // collateral is 20000
      await expect(ibAgreement.connect(borrower).borrow(cyToken.address, amount)).to.be.revertedWith('undercollateralized');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to borrow for unknown reason', async () => {
      await cyToken.setBorrowFailed(true);
      await expect(ibAgreement.connect(borrower).borrow(cyToken.address, borrowAmount)).to.be.revertedWith('borrow failed');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to borrow for market not allowed', async () => {
      await ibAgreement.connect(executor).setAllowedMarkets([cyToken.address], [false]);
      await expect(ibAgreement.connect(borrower).borrow(cyToken.address, borrowAmount)).to.be.revertedWith('market not allowed');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('borrows max successfully', async () => {
      await ibAgreement.connect(borrower).borrowMax(cyToken.address);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });

    it('borrows max successfully (rounding test)', async () => {
      const newCollateralPrice = '3999999999999'; // 39999.9 * 1e8
      await registry.setPrice(collateral.address, usdAddress, newCollateralPrice);

      await ibAgreement.connect(borrower).borrowMax(cyToken.address);
      expect(await ibAgreement.debtUSD()).to.gt(toWei('19999'));
      expect(await ibAgreement.debtUSD()).to.lt(await ibAgreement.collateralUSD());
    });

    it('failed to borrow max for non-borrower', async () => {
      await expect(ibAgreement.borrowMax(cyToken.address)).to.be.revertedWith('caller is not the borrower');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to borrow max for undercollateralized', async () => {
      await ibAgreement.connect(borrower).borrowMax(cyToken.address);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));

      const newCollateralPrice = '3999999999999'; // 39999.9 * 1e8
      await registry.setPrice(collateral.address, usdAddress, newCollateralPrice);

      await expect(ibAgreement.connect(borrower).borrowMax(cyToken.address)).to.be.revertedWith('undercollateralized');
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });

    it('failed to borrow max for market not allowed', async () => {
      await ibAgreement.connect(executor).setAllowedMarkets([cyToken.address], [false]);
      await expect(ibAgreement.connect(borrower).borrowMax(cyToken.address)).to.be.revertedWith('market not allowed');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('repays successfully', async () => {
      await ibAgreement.connect(borrower).borrow(cyToken.address, borrowAmount);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));

      await underlying.connect(borrower).approve(ibAgreement.address, borrowAmount);
      await ibAgreement.connect(borrower).repay(cyToken.address, borrowAmount);
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to repay for non-borrower', async () => {
      await expect(ibAgreement.repay(cyToken.address, borrowAmount)).to.be.revertedWith('caller is not the borrower');
    });

    it('failed to repay for unknown reason', async () => {
      await ibAgreement.connect(borrower).borrow(cyToken.address, borrowAmount);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));

      await underlying.connect(borrower).approve(ibAgreement.address, borrowAmount);
      await cyToken.setRepayFailed(true);
      await expect(ibAgreement.connect(borrower).repay(cyToken.address, borrowAmount)).to.be.revertedWith('repay failed');
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));
    });

    it('failed to repay for market not allowed', async () => {
      await ibAgreement.connect(executor).setAllowedMarkets([cyToken.address], [false]);
      await expect(ibAgreement.connect(borrower).repay(cyToken.address, borrowAmount)).to.be.revertedWith('market not allowed');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('withdraws successfully', async () => {
      await ibAgreement.connect(borrower).withdraw(collateralAmount);
      expect(await ibAgreement.collateralUSD()).to.eq(0);
    });

    it('failed to withdraw for non-borrower', async () => {
      await expect(ibAgreement.withdraw(collateralAmount)).to.be.revertedWith('caller is not the borrower');
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000')); // CF: 50%
    });

    it('failed to withdraw for undercollateralized', async () => {
      const amount = 2 * 1e8; // 2 wBTC
      await expect(ibAgreement.withdraw(amount)).to.be.revertedWith('caller is not the borrower');
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000')); // CF: 50%
    });
  });

  describe('seize', async () => {
    const collateralAmount = 1 * 1e8; // 1 wBTC
    const amount = toWei('1'); // 1 CREAM

    beforeEach(async () => {
      await Promise.all([
        collateral.mint(ibAgreement.address, collateralAmount),
        token.mint(ibAgreement.address, amount)
      ]);
    });

    it('seizes successfully', async () => {
      await ibAgreement.connect(executor).seize(token.address, amount);
      expect(await token.balanceOf(executorAddress)).to.eq(amount);
    });

    it('failed to seize for non-executor', async () => {
      await expect(ibAgreement.seize(token.address, amount)).to.be.revertedWith('caller is not the executor');
      expect(await token.balanceOf(executorAddress)).to.eq(0);
    });
  });

  describe('seize collateral', async () => {
    const collateralAmount = 1 * 1e8; // 1 wBTC
    const collateralPrice = '4000000000000'; // 40000 * 1e8
    const borrowAmount = 20000 * 1e6; // 100 USDT
    const borrowPrice = '1000000000000000000000000000000'; // 1e30

    beforeEach(async () => {
      await Promise.all([
        collateral.mint(ibAgreement.address, collateralAmount),
        registry.setPrice(collateral.address, usdAddress, collateralPrice),
        ibAgreement.connect(governor).setPriceFeed(priceFeed.address),
        priceOracle.setUnderlyingPrice(cyToken.address, borrowPrice)
      ]);
      await ibAgreement.connect(borrower).borrow(cyToken.address, borrowAmount);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000')); // CF: 50%
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('30000')); // LF: 75%
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });

    it('seizes collateral successfully', async () => {
      const newCollateralPrice = '2666600000000'; // 26666 * 1e8
      const amount = 0.1 * 1e8; // 0.1 wBTC
      await registry.setPrice(collateral.address, usdAddress, newCollateralPrice);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('13333')); // $26666, CF: 50%, $13333
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('19999.5')); // $26666, LF: 50%, $19999.5
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000')); // $20000 > $19999.5, collateral seizable

      await ibAgreement.connect(executor).seize(collateral.address, amount);
      await registry.setPrice(collateral.address, usdAddress, collateralPrice);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('18000')); // 0.9 wBTC remain, $36000, CF: 50%, $18000
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('27000')); // 0.9 wBTC remain, $36000, LF: 75%, $27000
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });

    it('failed to seize collateral for not liquidatable', async () => {
      const amount = 0.1 * 1e8; // 0.1 wBTC
      await expect(ibAgreement.connect(executor).seize(collateral.address, amount)).to.be.revertedWith('not liquidatable');
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000'));
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('30000')); // LF: 75%
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));

      const newCollateralPrice = '2666700000000'; // 26667 * 1e8
      await registry.setPrice(collateral.address, usdAddress, newCollateralPrice);
      await expect(ibAgreement.connect(executor).seize(collateral.address, amount)).to.be.revertedWith('not liquidatable');
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('13333.5')); // CF: 50%
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('20000.25')); // LF: 75%
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });
  });

  describe('setPriceFeed', async () => {
    it('sets price feed successfully', async () => {
      await ibAgreement.connect(governor).setPriceFeed(priceFeed.address);
      expect(await ibAgreement.priceFeed()).to.eq(priceFeed.address);
    });

    it('failed to set price feed for non-governor', async () => {
      await expect(ibAgreement.setPriceFeed(priceFeed.address)).to.be.revertedWith('caller is not the governor');
    });
  });

  describe('setAllowedMarkets', async () => {
    it('sets allowed markets successfully', async () => {
      await comptroller.setMarketListed(cyToken2.address, true);
      await ibAgreement.connect(executor).setAllowedMarkets([cyToken2.address], [true]);
      expect(await ibAgreement.allowedMarkets(cyToken2.address)).to.true;
    });

    it('failed to allow markets for length mismatch', async () => {
      await expect(ibAgreement.connect(executor).setAllowedMarkets([cyToken2.address], [true, true])).to.be.revertedWith('length mismatch');
      expect(await ibAgreement.allowedMarkets(cyToken2.address)).to.false;
    });

    it('failed to allow markets for non-executor', async () => {
      await expect(ibAgreement.setAllowedMarkets([cyToken2.address], [true])).to.be.revertedWith('caller is not the executor');
      expect(await ibAgreement.allowedMarkets(cyToken2.address)).to.false;
    });

    it('failed to allow markets for market not listed', async () => {
      await expect(ibAgreement.connect(executor).setAllowedMarkets([cyToken2.address], [true])).to.be.revertedWith('market not listed');
      expect(await ibAgreement.allowedMarkets(cyToken2.address)).to.false;
    });
  });
});
