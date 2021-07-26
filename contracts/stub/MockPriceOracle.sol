// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IPriceOracle.sol";

contract MockPriceOralce is IPriceOracle {
    mapping(address => uint) private _price;

    function getUnderlyingPrice(address cToken) external override view returns (uint) {
        return _price[cToken];
    }

    function setUnderlyingPrice(address cToken, uint price) external {
        _price[cToken] = price;
    }
}
