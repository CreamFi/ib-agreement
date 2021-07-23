# IronBank Agreement

## Concept

The IBAgreement provides a standard contract to achieve DAO-to-DAO loans. It currently only works on IronBank since it should leverage the credit limit.

## Roles

There are three roles in this agreement.

* The borrower: The loan applicant
* The executor: The loaner, C.R.E.A.M. Finance
* The governor: The joint admin from both the borrower and the loaner.

> The governor can be a 2-2 Gnosis multisig contract and each party has one of the signer. It could set the new price feed of the collateral or the new converter when it comes to liquidation. Changing this will require both parties to agree on.
