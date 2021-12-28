# Staking





## Contents
<!-- START doctoc -->
<!-- END doctoc -->

## Globals

> Note this contains internal vars as well due to a bug in the docgen procedure

| Var | Type |
| --- | --- |
| token | address |
| tokenProvider | address |
| tokenPerBlock | uint256 |
| startBlock | uint256 |
| accTokenPerShare | uint256 |
| lastRewardBlock | uint256 |
| BONUS_MULTIPLIER | uint256 |
| stakeAmount | uint256 |
| accrualAmount | uint256 |
| userInfo | mapping(address => struct Staking.UserInfo) |



## Functions

### constructor
No description


#### Declaration
```solidity
  function constructor(
  ) public
```

#### Modifiers:
No modifiers



### updateMultiplier
No description


#### Declaration
```solidity
  function updateMultiplier(
  ) public onlyOwner
```

#### Modifiers:
| Modifier |
| --- |
| onlyOwner |



### getMultiplier
No description


#### Declaration
```solidity
  function getMultiplier(
  ) public returns (uint256)
```

#### Modifiers:
No modifiers



### updatePool
No description


#### Declaration
```solidity
  function updatePool(
  ) public
```

#### Modifiers:
No modifiers



### deposit
No description


#### Declaration
```solidity
  function deposit(
  ) external
```

#### Modifiers:
No modifiers



### withdraw
No description


#### Declaration
```solidity
  function withdraw(
  ) external
```

#### Modifiers:
No modifiers



### collect
No description


#### Declaration
```solidity
  function collect(
  ) external returns (uint256)
```

#### Modifiers:
No modifiers





## Events

### Deposit
No description

  


### Withdraw
No description

  


