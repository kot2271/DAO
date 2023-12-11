# DAO

## Installation

Clone the repository using the following command:
Install the dependencies using the following command:
```shell
npm i
```

## Deployment

Fill in all the required environment variables(copy .env-example to .env and fill it). 

Deploy contract to the chain (polygon-mumbai):
```shell
npx hardhat run scripts/deploy/deploy.ts --network polygonMumbai
```

## Verify

Verify the installation by running the following command:
```shell
npx hardhat verify --network polygonMumbai {CONTRACT_ADDRESS}
```

## Tasks

Create a new task(s) and save it(them) in the folder "tasks". Add a new task_name in the file "tasks/index.ts"

Running a addProposal task:
```shell
npx hardhat addProposal --dao {DAO_CONTRACT_ADDRESS} --description {STRING_DESCRIPTION} --recipient {RECIPIENT_ADDRESS} --network polygonMumbai
```

Running a deposit task:
```shell
npx hardhat deposit --dao {DAO_CONTRACT_ADDRESS} --token {DAO_TOKEN_ADDRESS} --amount {AMOUNT_IN_ETHER} --network polygonMumbai
```

Running a vote task:
```shell
npx hardhat vote --dao {DAO_CONTRACT_ADDRESS} --proposal-id {PROPOSAL_ID} --support {TRUE/FALSE} --network polygonMumbai
```

Running a finishProposal task:
```shell
npx hardhat finishProposal --dao {DAO_CONTRACT_ADDRESS} --proposal-id {PROPOSAL_ID} --network polygonMumbai
```

Running a withdraw task:
```shell
npx hardhat withdraw --dao {DAO_CONTRACT_ADDRESS} --network polygonMumbai
```

Running a setMinimalQuorum task:
```shell
npx hardhat setMinimalQuorum --dao {DAO_CONTRACT_ADDRESS} --quorum {NEW_QUORUM_NUMBER} --network polygonMumbai
```

Running a setDebatingPeriod task:
```shell
npx hardhat setDebatingPeriod --dao {DAO_CONTRACT_ADDRESS} --period {NEW_PERIOD_IN_SECONDS} --network polygonMumbai
```


