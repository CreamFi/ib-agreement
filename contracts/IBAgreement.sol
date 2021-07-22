// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IComptroller.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/ICToken.sol";
import "./interfaces/IPriceFeed.sol";
import "./interfaces/IPriceOracle.sol";

contract IBAgreement {
    using SafeERC20 for IERC20;

    address public immutable executor;
    address public immutable borrower;
    ICToken public immutable cy;
    IERC20 public immutable underlying;
    IERC20 public immutable collateral;
    IConverter public converter;
    IPriceFeed public priceFeed;

    uint public constant collateralFactor = 5e17;

    modifier onlyBorrower() {
        require(msg.sender == borrower, "caller is not the borrower");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor, "caller is not the executor");
        _;
    }

    constructor(address _executor, address _borrower, address _cy, address _collateral) {
        executor = _executor;
        borrower = _borrower;
        cy = ICToken(_cy);
        underlying = IERC20(ICToken(_cy).underlying());
        collateral = IERC20(_collateral);
    }

    function debt() external view returns (uint) {
        (,,uint borrowBalance,) = cy.getAccountSnapshot(address(this));
        return borrowBalance;
    }

    function debtUSD() external view returns (uint) {
        IPriceOracle oracle = IPriceOracle(IComptroller(cy.comptroller()).oracle());
        return this.debt() * oracle.getUnderlyingPrice(address(cy)) / 1e18;
    }

    function hypotheticalDebtUSD(uint borrowAmount) external view returns (uint) {
        IPriceOracle oracle = IPriceOracle(IComptroller(cy.comptroller()).oracle());
        return (this.debt() + borrowAmount) * oracle.getUnderlyingPrice(address(cy)) / 1e18;
    }

    function collateralUSD() external view returns (uint) {
        uint normalizedAmount = collateral.balanceOf(address(this)) * 10**(18 - IERC20Metadata(address(collateral)).decimals());
        return normalizedAmount * priceFeed.getPrice() / 1e18 * collateralFactor / 1e18;
    }

    function hypotheticalCollateralUSD(uint withdrawAmount) external view returns (uint) {
        uint normalizedAmount = (collateral.balanceOf(address(this)) - withdrawAmount) * 10**(18 - IERC20Metadata(address(collateral)).decimals());
        return normalizedAmount * priceFeed.getPrice() / 1e18 * collateralFactor / 1e18;
    }

    function borrow(uint _amount) external onlyBorrower {
        require(this.hypotheticalDebtUSD(_amount) < this.collateralUSD(), "undercollateralized");
        require(cy.borrow(_amount) == 0, "borrow failed");
        underlying.safeTransfer(borrower, _amount);
    }

    function withdraw(uint _amount) external onlyBorrower {
        require(this.debtUSD() < this.hypotheticalCollateralUSD(_amount), "undercollateralized");
        collateral.safeTransfer(borrower, _amount);
    }

    function repay() external {
        uint _balance = underlying.balanceOf(address(this));
        underlying.safeApprove(address(cy), _balance);
        require(cy.repayBorrow(_balance) == 0, "reapy failed");
    }

    function seize(IERC20 token, uint amount) external onlyExecutor {
        require(token != collateral, "cannot seize collateral");
        token.safeTransfer(executor, amount);
    }

    function liquidate(uint amount) external onlyExecutor {
        require(this.debtUSD() > this.collateralUSD(), "overcollateralized");
        require(address(converter) != address(0), "empty converter");
        require(converter.source() == address(collateral), "mismatch source token");
        require(converter.destination() == address(underlying), "mismatch destination token");

        // Convert the collateral to the underlying for repayment.
        collateral.safeTransfer(address(converter), amount);
        converter.convert(amount);

        // Repay the debts
        this.repay();
    }

    function setConverter(address _converter) external onlyExecutor {
        converter = IConverter(_converter);
    }

    function setPriceFeed(address _priceFeed) external onlyExecutor {
        priceFeed = IPriceFeed(_priceFeed);
    }
}
