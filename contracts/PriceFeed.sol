// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IPriceFeed.sol";

contract PriceFeed is IPriceFeed {
    AggregatorV3Interface public priceFeed;

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    /**
     * @notice Return the latest price.
     * @return the price, scaled by 1e18
     */
    function getPrice() external override view returns (uint) {
        ( , int price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "invalid price");

        // Extend the decimals to 1e18.
        return uint(price) * 10**(18 - uint(priceFeed.decimals()));
    }
}
