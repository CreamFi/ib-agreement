const { ethers, waffle } = require("hardhat");

const impersonateAccount = async (address) => {
  const signer = await ethers.provider.getSigner(address);
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return signer;
};

const stopImpersonateAccount = async (address) => {
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address],
  });
};

const signLenderMessage = async (
  loanPrincipalAmount,
  nftCollateralId,
  loanDuration,
  loanInterestRate,
  lenderNonce,
  lenderSignatureExpiry,
  nftCollateralContract,
  loanERC20Denomination,
  signer,
  acceptAnyNFTInCollection,
  chainId
) => {
  message = ethers.utils.solidityKeccak256(
    [
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "address",
      "address",
      "address",
      "bool",
      "uint256",
    ],
    [
      loanPrincipalAmount,
      nftCollateralId,
      loanDuration,
      loanInterestRate,
      lenderNonce,
      lenderSignatureExpiry,
      nftCollateralContract,
      loanERC20Denomination,
      await signer.getAddress(),
      acceptAnyNFTInCollection,
      chainId,
    ]
  );

  signedMessage = await signer.signMessage(ethers.utils.arrayify(message));
  return signedMessage;
};

const resetChain = async (blockNumber) => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: "https://mainnet-eth.compound.finance/",
          blockNumber: blockNumber,
        },
      },
    ],
  });
};

module.exports = {
  impersonateAccount: impersonateAccount,
  stopImpersonateAccount: stopImpersonateAccount,
  signLenderMessage: signLenderMessage,
  resetChain: resetChain,
};
