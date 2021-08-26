//SPDX-License-Identifier: AML
pragma solidity ^0.8.0;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract LPToken is StandardToken, Ownable {
    constructor() public {
        
    }
}