// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IMultipriceOracle.sol";

contract MockMultiPriceOracle is IMultipriceOracle {
    uint256 private _price;

    function setPrice(uint256 price) external {
        _price = price;
    }

    function uniV3TwapAssetToAsset(
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut,
        uint32 _twapPeriod
    ) external view override returns (uint256) {
        // unused
        _tokenIn;
        _amountIn;
        _tokenOut;
        _twapPeriod;
        return _price;
    }
}
