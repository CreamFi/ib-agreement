const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IBAgreement", () => {
  const toWei = ethers.utils.parseEther;
  const usdAddress = '0x0000000000000000000000000000000000000348';

  let accounts;
  let executor, executorAddress;
  let borrower, borrowerAddress;
  let governor, governorAddress;
  let user, userAddress;

  let ibAgreement;
  let underlying;
  let cyToken;
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

    const ibAgreementFactory = await ethers.getContractFactory("IBAgreement");
    const tokenFactory = await ethers.getContractFactory("MockToken");
    const cyTokenFactory = await ethers.getContractFactory("MockCyToken");
    const priceOracleFactory = await ethers.getContractFactory("MockPriceOralce");
    const comptrollerFactory = await ethers.getContractFactory("MockComptroller");
    const registryFactory = await ethers.getContractFactory("MockRegistry");
    const priceFeedFactory = await ethers.getContractFactory("PriceFeed");
    const converterFactory = await ethers.getContractFactory("MockConverter");

    priceOracle = await priceOracleFactory.deploy();
    comptroller = await comptrollerFactory.deploy(priceOracle.address);
    underlying = await tokenFactory.deploy("USD Tether", "USDT", 6);
    cyToken = await cyTokenFactory.deploy(comptroller.address, underlying.address);
    collateral = await tokenFactory.deploy("Wrapped BTC", "WBTC", 8);
    registry = await registryFactory.deploy();
    priceFeed = await priceFeedFactory.deploy(registry.address, collateral.address, collateral.address, usdAddress);
    ibAgreement = await ibAgreementFactory.deploy(executorAddress, borrowerAddress, governorAddress, cyToken.address, collateral.address, priceFeed.address);

    token = await tokenFactory.deploy("Cream", "CREAM", 18);
    converter = await converterFactory.deploy(collateral.address, underlying.address);
    invalidConverter1 = await converterFactory.deploy(token.address, underlying.address);
    invalidConverter2 = await converterFactory.deploy(collateral.address, token.address);
  });

  describe('debt / debtUSD / hypotheticalDebtUSD', () => {
    const debt = 5000 * 1e6; // 5000 USDT
    const price = '1000000000000000000000000000000'; // 1e30

    beforeEach(async () => {
      await Promise.all([
        cyToken.setBorrowBalance(ibAgreement.address, debt),
        priceOracle.setUnderlyingPrice(cyToken.address, price)
      ]);
    });

    it('shows the debt', async () => {
      expect(await ibAgreement.debt()).to.eq(debt);
    });

    it('shows the debt in USD value', async () => {
      expect(await ibAgreement.debtUSD()).to.eq(toWei('5000'));
    });

    it('shows the hypothetical debt in USD value', async () => {
      const borrowAmount = 1000 * 1e6; // 1000 USDT
      expect(await ibAgreement.hypotheticalDebtUSD(borrowAmount)).to.eq(toWei('6000'));
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

  describe('borrow / withdraw / repay', () => {
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
      await ibAgreement.connect(borrower).borrow(borrowAmount);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));
    });

    it('failed to borrow for non-borrower', async () => {
      await expect(ibAgreement.borrow(borrowAmount)).to.be.revertedWith('caller is not the borrower');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to borrow for undercollateralized', async () => {
      const amount = 20001 * 1e6; // collateral is 20000
      await expect(ibAgreement.connect(borrower).borrow(amount)).to.be.revertedWith('undercollateralized');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to borrow for unknown reason', async () => {
      await cyToken.setBorrowFailed(true);
      await expect(ibAgreement.connect(borrower).borrow(borrowAmount)).to.be.revertedWith('borrow failed');
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('repays successfully', async () => {
      await ibAgreement.connect(borrower).borrow(borrowAmount);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));

      await underlying.connect(borrower).transfer(ibAgreement.address, borrowAmount);
      await ibAgreement.repay();
      expect(await ibAgreement.debtUSD()).to.eq(0);
    });

    it('failed to repay for unknown reason', async () => {
      await ibAgreement.connect(borrower).borrow(borrowAmount);
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));

      await underlying.connect(borrower).transfer(ibAgreement.address, borrowAmount);
      await cyToken.setRepayFailed(true);
      await expect(ibAgreement.repay()).to.be.revertedWith('repay failed');
      expect(await ibAgreement.debtUSD()).to.eq(toWei('100'));
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

    it('failed to seize collateral', async () => {
      await expect(ibAgreement.connect(executor).seize(collateral.address, amount)).to.be.revertedWith('cannot seize collateral');
      expect(await collateral.balanceOf(executorAddress)).to.eq(0);
    });
  });

  describe('liquidate', async () => {
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
      await ibAgreement.connect(borrower).borrow(borrowAmount);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000')); // CF: 50%
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('30000')); // LF: 75%
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });

    it('liquidates successfully', async () => {
      const newCollateralPrice = '2666600000000'; // 26666 * 1e8
      const amount = 0.1 * 1e8; // 0.1 wBTC
      await registry.setPrice(collateral.address, usdAddress, newCollateralPrice);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('13333')); // $26666, CF: 50%, $13333
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('19999.5')); // $26666, LF: 50%, $19999.5
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000')); // $20000 > $19999.5, liquidatable

      await ibAgreement.connect(governor).setConverter(converter.address);
      await ibAgreement.connect(executor).liquidate(amount);
      await registry.setPrice(collateral.address, usdAddress, collateralPrice);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('18000')); // 0.9 wBTC remain, $36000, CF: 50%, $18000
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('27000')); // 0.9 wBTC remain, $36000, LF: 75%, $27000
      expect(await ibAgreement.debtUSD()).to.eq(toWei('16000')); // liquidate 0.1 wBTC for $4000, debts: $20000 - $4000 = $16000
    });

    it('failed to liquidate for non-executor', async () => {
      const amount = 0.1 * 1e8; // 0.1 wBTC
      await expect(ibAgreement.liquidate(amount)).to.be.revertedWith('caller is not the executor');
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000'));
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });

    it('failed to liquidate for not liquidatable', async () => {
      const amount = 0.1 * 1e8; // 0.1 wBTC
      await expect(ibAgreement.connect(executor).liquidate(amount)).to.be.revertedWith('not liquidatable');
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000'));
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('30000')); // LF: 75%
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));

      const newCollateralPrice = '2666700000000'; // 26667 * 1e8
      await registry.setPrice(collateral.address, usdAddress, newCollateralPrice);
      await expect(ibAgreement.connect(executor).liquidate(amount)).to.be.revertedWith('not liquidatable');
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('13333.5')); // CF: 50%
      expect(await ibAgreement.liquidationThreshold()).to.eq(toWei('20000.25')); // LF: 75%
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });

    it('failed to liquidate for repay failed', async () => {
      await cyToken.setRepayFailed(true);

      const newCollateralPrice = '2666600000000'; // 26666 * 1e8
      const amount = 0.1 * 1e8; // 0.1 wBTC
      await registry.setPrice(collateral.address, usdAddress, newCollateralPrice);
      await ibAgreement.connect(governor).setConverter(converter.address);
      await expect(ibAgreement.connect(executor).liquidate(amount)).to.be.revertedWith('repay failed');
      await registry.setPrice(collateral.address, usdAddress, collateralPrice);
      expect(await ibAgreement.collateralUSD()).to.eq(toWei('20000'));
      expect(await ibAgreement.debtUSD()).to.eq(toWei('20000'));
    });
  });

  describe('setConverter', async () => {
    it('sets converter successfully', async () => {
      await ibAgreement.connect(governor).setConverter(converter.address);
      expect(await ibAgreement.converter()).to.eq(converter.address);
    });

    it('failed to set converter for non-governor', async () => {
      await expect(ibAgreement.setConverter(converter.address)).to.be.revertedWith('caller is not the governor');
    });

    it('failed to set converter for mismatch source token', async () => {
      await expect(ibAgreement.connect(governor).setConverter(invalidConverter1.address)).to.be.revertedWith('mismatch source token');
    });

    it('failed to set converter for mismatch destination token', async () => {
      await expect(ibAgreement.connect(governor).setConverter(invalidConverter2.address)).to.be.revertedWith('mismatch destination token');
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
});
