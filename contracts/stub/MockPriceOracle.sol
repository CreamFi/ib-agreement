// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IPriceOracle.sol";

contract MockPriceOralce is IPriceOracle {
    mapping(address => uint256) private _price;

    function getUnderlyingPrice(address cToken)
        external
        view
        override
        returns (uint256)
    {
        return _price[cToken];
    }

    function setUnderlyingPrice(address cToken, uint256 price) external {
        _price[cToken] = price;
    }
}
