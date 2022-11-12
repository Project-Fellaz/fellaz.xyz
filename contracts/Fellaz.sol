//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Fellaz is ERC20 {
    constructor() ERC20("Fellaz", "FLZ") {
        _mint(msg.sender, 1000 ether);
    }
}
