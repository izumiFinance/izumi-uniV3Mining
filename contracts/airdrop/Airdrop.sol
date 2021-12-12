// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "../multicall.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Airdrop is Ownable, Multicall, ReentrancyGuard {
    using SafeERC20 for IERC20;
    mapping(address => address) public tokenProviders;
    function setProvider(address token, address provider) external onlyOwner {
        tokenProviders[token] = provider;
    }
    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    function airdrop(address token, address receiver, uint256 amount) external onlyOwner nonReentrant {
        if (token != address(0)) {
            address provider = tokenProviders[token];
            // require(provider != address(0), "No Provider");
            IERC20(token).safeTransferFrom(provider, receiver, amount);
        } else {
            (bool success, ) = receiver.call{value: amount}(new bytes(0));
            require(success, 'ETH STE');
        }
    }
    
}