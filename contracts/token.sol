//SPDX-License-Identifier: AML
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Izume", "IZM") {
        _mint(msg.sender, initialSupply);
    }
}