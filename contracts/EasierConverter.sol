// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

contract EasyConverter {
    using SafeERC20 for IERC20;

    address public uniswapV2Router;
    address public wrappedNativeAddress;
    address public sourceToken;
    address public destinationToken;

    constructor(
        address _uniswapV2Router,
        address _wrappedNativeAddress,
        address _sourceToken,
        address _destinationToken
    ) {
        uniswapV2Router = _uniswapV2Router;
        wrappedNativeAddress = _wrappedNativeAddress;
        sourceToken=_sourceToken;
        destinationToken=_destinationToken;
    }

    /* User functions */

    /*
     * @notice Burn token for targetToken
     * @notice This function assumes there exists a token-wrappedNative LP and a wrappedNative-targetToken LP in the dex
     * @param token The token to be burned
     * @return Total targetToken sent to receiver after successfully executing this function
     */
    function convert(uint256 amount) external {
        require(IERC20(sourceToken).balanceOf(address(this)) >= amount, "amount not enough");
        console.log("before approve");
        IERC20(sourceToken).safeApprove(uniswapV2Router, amount);
        console.log("after approve");
        address[] memory paths;
        paths = new address[](3);
        paths[0] = sourceToken;
        paths[1] = wrappedNativeAddress;
        paths[2] = destinationToken;
        console.log("before swap");
        IUniswapV2Router(uniswapV2Router).swapExactTokensForTokens(
                    amount,
                    0,
                    paths,
                    msg.sender,
                    block.timestamp);
        console.log("after swap");
    }
}
