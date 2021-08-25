// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IConverter.sol";
import "./MockToken.sol";

contract MockConverter is IConverter {
    address private _source;
    address private _destination;

    constructor(address source_, address destination_) {
        _source = source_;
        _destination = destination_;
        MockToken(_destination).mint(
            address(this),
            1000000 * 10**MockToken(_destination).decimals()
        );
    }

    function source() external view override returns (address) {
        return _source;
    }

    function destination() external view override returns (address) {
        return _destination;
    }

    function convert(uint256 amount) external override {
        // For simplicity, trade with fixed price.
        uint256 price = 40000;
        uint256 amountOut = (amount *
            price *
            10**MockToken(_destination).decimals()) /
            10**MockToken(_source).decimals();
        MockToken(_destination).transfer(msg.sender, amountOut);
    }
}
