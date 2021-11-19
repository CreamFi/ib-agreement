const { ethers, run } = require("hardhat");

// async function priceFeed() {
//   const feedAddress = '';

//   const registry = '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf';
//   const token = '0x2ba592F78dB6436527729929AAf6c908497cB200';
//   const quote = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

//   await run('verify:verify', {
//     address: feedAddress
//   });
// }

async function main() {
  const ibAgreementAddress = "0x9ae50BD64e45fd87dD05c768ff314b8FE246B3fF";

  const executor = "0x6d5a7597896a703fe8c85775b23395a48f971305";
  const borrower = "0x431e81E5dfB5A24541b5Ff8762bDEF3f32F96354";
  const governor = "0x037fb55cfA48994Ed020eD5Be63c2770FB725e7B";
  const comptroller = "0xAB1c342C7bf5Ec5F02ADEA1c2270670bCa144CbB";
  const collateral = "0x4E15361FD6b4BB609Fa63C81A2be19d873717870";
  const priceFeed = "0xBfC408229184c3e800c065445295878f915599a9";
  const collateralFactor = ethers.utils.parseEther('0.75');
  const liquidationFactor = ethers.utils.parseEther('0.85');

  await run("verify:verify", {
    address: ibAgreementAddress,
    contract: "contracts/IBAgreement.sol:IBAgreementV2",
    constructorArguments: [
      executor, borrower, governor, comptroller, collateral, priceFeed, collateralFactor, liquidationFactor
    ]
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
