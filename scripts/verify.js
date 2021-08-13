const { run } = require("hardhat");



async function main() {
  const ibAgreementAddress = "0x30f254104A8a7B7779483EEEf5560397A737f812";

  const executor = "0x6d5a7597896a703fe8c85775b23395a48f971305";
  const borrower = "0x6Af3D183d225725d975C5EaA08D442dd01Aad8fF";
  const governor = "0x545c18f845d6b37Ea06Bbc83bd9F8A54f4AAb075";
  const cy = "0xBE86e8918DFc7d3Cb10d295fc220F941A1470C5c";
  const collateral = "0x2ba592F78dB6436527729929AAf6c908497cB200";

  await run("verify:verify", {
    address: ibAgreementAddress,
    contract: "contracts/IBAgreement.sol:IBAgreement",
    constructorArguments: [
      executor, borrower, governor, cy, collateral
    ]
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
