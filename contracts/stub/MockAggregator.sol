// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockAggregator is AggregatorV3Interface {
    int private _price;

    function decimals() external override view returns (uint8) {
        _price; // silence the compiler
        return 8;
    }

    function description() external override view returns (string memory) {
        _price; // silence the compiler
        return "BTC / USD";
    }

    function version() external override view returns (uint) {
        _price; // silence the compiler
        return 0;
    }

    function getRoundData(uint80 roundId) external override view returns (uint80, int, uint, uint, uint80) {
        roundId; // unused
        return (0, _price, 0, 0, 0);
    }

    function latestRoundData() external override view returns (uint80, int, uint, uint, uint80) {
        return (0, _price, 0, 0, 0);
    }

    function setPrice(int price) external {
        _price = price;
    }
}
