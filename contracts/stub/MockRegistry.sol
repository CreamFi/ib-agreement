// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";

contract MockRegistry {
    uint8 private _decimals = 8;
    mapping(address => mapping(address => int)) private _price;

    function decimals(address base, address quote) external view returns (uint8) {
        // Shh
        base;
        quote;

        return _decimals;
    }

     function getFeed(address base, address quote) external view returns (AggregatorV2V3Interface) {
        // Shh
         _price;
        base;
        quote;

        return AggregatorV2V3Interface(address(0));
    }

    function isFeedEnabled(address aggregator) external view returns (bool) {
        // Shh
        _price;
        aggregator;

        return true;
    }

    function latestRoundData(address base, address quote) external view returns (uint80, int, uint, uint, uint80) {
        // Shh
        base;
        quote;

        return (0, _price[base][quote], 0, 0, 0);
    }

    function setPrice(address base, address quote, int price) external {
        _price[base][quote] = price;
    }

    function setDecimals(uint8 d) external {
        _decimals = d;
    }
}
