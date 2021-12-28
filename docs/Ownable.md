# Ownable





## Contents
<!-- START doctoc -->
<!-- END doctoc -->



## Modifiers

### onlyOwner
No description


#### Declaration
```solidity
  modifier onlyOwner
```



## Functions

### constructor
No description


#### Declaration
```solidity
  function constructor(
  ) internal
```

#### Modifiers:
No modifiers



### owner
No description


#### Declaration
```solidity
  function owner(
  ) public returns (address)
```

#### Modifiers:
No modifiers



### renounceOwnership
No description


#### Declaration
```solidity
  function renounceOwnership(
  ) public onlyOwner
```

#### Modifiers:
| Modifier |
| --- |
| onlyOwner |



### transferOwnership
No description


#### Declaration
```solidity
  function transferOwnership(
  ) public onlyOwner
```

#### Modifiers:
| Modifier |
| --- |
| onlyOwner |



### _transferOwnership
No description


#### Declaration
```solidity
  function _transferOwnership(
  ) internal
```

#### Modifiers:
No modifiers





## Events

### OwnershipTransferred
No description

  


