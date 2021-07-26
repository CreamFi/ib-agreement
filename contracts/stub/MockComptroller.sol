// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IComptroller.sol";

contract MockComptroller is IComptroller {
    address private _oracle;

    constructor(address oracle_) {
        _oracle = oracle_;
    }

    function oracle() external override view returns (address) {
        return _oracle;
    }
}
