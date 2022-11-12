//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2; // required to accept structs as function parameters

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract FellazLightStick is ERC721A, Ownable, ReentrancyGuard {
    using Strings for uint256;

    mapping(uint256 => address) private _directions;
    mapping(uint256 => uint256) private _expired;
    mapping(address => uint256) private priceOfErc20;
    uint256 private _priceOfEth = 0.1 ether;

    event Activate(address direction, address owner, uint256 tokenId, uint256 expired);

    constructor() ERC721A("FellazLightStick", "FLS") {}

    function price(address paymentAddress) public view returns (uint256){
        if( paymentAddress == address(0) ){
            return _priceOfEth;
        }
        return priceOfErc20[paymentAddress];
    }

    function setPrice(address paymentAddress, uint256 _price) public onlyOwner{
        if( paymentAddress == address(0) ){
            _priceOfEth = _price;
        }else{
            priceOfErc20[paymentAddress] = _price;
        }
    }

    function mint(address targetAddress) public payable nonReentrant{
        require(msg.value >= _priceOfEth, "insufficient value");
        uint256 tokenId = _nextTokenId();
        _directions[tokenId] = targetAddress;
        _expired[tokenId] = block.timestamp + 90 days;
        _mint(msg.sender, 1);
        emit Activate(targetAddress, msg.sender, tokenId, _expired[tokenId]);
    }

    function inject(uint256 tokenId) public payable nonReentrant{
        require(msg.value >= _priceOfEth, "insufficient value");
        _expired[tokenId] = _expired[tokenId] + 90 days;
        emit Activate(direction(tokenId), msg.sender, tokenId, _expired[tokenId]);
    }

    function mintWithERC20(address targetAddress, address paymentAddress)
        public
        nonReentrant
    {
        require(priceOfErc20[paymentAddress] > 0, "not registry payments");
        require(IERC20(paymentAddress).allowance(msg.sender, address(this)) >= priceOfErc20[paymentAddress], "insufficient approve");
        require(IERC20(paymentAddress).balanceOf(msg.sender) >= priceOfErc20[paymentAddress], "insufficient value");
        uint256 tokenId = _nextTokenId();
        _directions[tokenId] = targetAddress;
        _expired[tokenId] = block.timestamp + 90 days;
        _mint(msg.sender, 1);
        emit Activate(targetAddress, msg.sender, tokenId, _expired[tokenId]);
    }

    function injectWithERC20(uint256 tokenId, address paymentAddress)
        public
        nonReentrant
    {
        require(priceOfErc20[paymentAddress] > 0, "not registry payments");
        require(IERC20(paymentAddress).allowance(msg.sender, address(this)) >= priceOfErc20[paymentAddress], "insufficient approve");
        require(IERC20(paymentAddress).balanceOf(msg.sender) >= priceOfErc20[paymentAddress], "insufficient value");
        _expired[tokenId] = _expired[tokenId] + 90 days;
        emit Activate(direction(tokenId), msg.sender, tokenId, _expired[tokenId]);
    }

    function direction(uint256 tokenId) public view returns (address) {
        return _directions[tokenId];
    }

    function _baseURI() internal view override virtual returns (string memory) {
        return "http://localhost:3000/lightstick/";
    }

}
