//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2; // required to accept structs as function parameters

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract FellazLightStickEnumerable is ERC721Enumerable, Ownable, ReentrancyGuard {
    using Strings for uint256;
    using SafeMath for uint256;

    mapping(uint256 => address) private _directions;
    mapping(uint256 => uint256) private _expired;
    mapping(address => mapping(address => uint256)) _price;
    mapping(address => mapping(address => uint256)) _fee;
    mapping(address => bool) private _allowERC20;

    string private baseURI;

    event Activate(address indexed direction, address indexed owner, uint256 indexed tokenId, uint256 expired, uint256 active, address payments, uint256 price, uint256 amount);
    event Price(address indexed direction, address indexed paymentAddress, uint256 indexed price);
    event Fee(address indexed direction, address indexed paymentAddress, uint256 indexed fee);
    event Withdraw(address indexed target, address indexed paymentAddress, uint256 indexed price);
    event AllowERC20(address indexed paymentAddress, bool indexed use);
    event SetBaseURI(address indexed sender, string indexed newUri);

    constructor() ERC721("FellazLightStick", "FLS") {
        _price[address(0)][address(0)] = 0.1 ether;
        _fee[address(0)][address(0)] = 0.01 ether;


        // ???
        _allowERC20[address(0)] = true;

        baseURI = "http://localhost:3000/lightstick/";
    }

    /*
    * @dev ERC20 Token Check Supported
    */
    modifier checkERC20(address ERCAddress) {
        require(_allowERC20[ERCAddress], "Unsupported ERC20 Token");
        _;
    }

    /*
    * @dev Gets the price according to the artist's payment method (internal function)
    */
    function getPrice(address paymentAddress, address directionAddress) internal view returns (uint256) {
        return _price[paymentAddress][directionAddress];
    }

    /*
    * @dev Get artist NFT's Ethereum price
    */
    function getPriceETH(address directionAddress) public view returns (uint256) {
        return getPrice(address(0), directionAddress) > 0 ? getPrice(address(0), directionAddress) : getPrice(address(0), address(0));
    }

    /*
    * Get ERC20 Token price supported by artist NFT
    */
    function getPriceERC20(address paymentAddress, address directionAddress) public view checkERC20(paymentAddress) returns(uint256) {
        return getPrice(paymentAddress, directionAddress) > 0 ? getPrice(paymentAddress, directionAddress) : getPrice(paymentAddress, address(0));
    }

    /*
    * @dev Set the price according to the artist's payment method.
    */
    function setPrice(address paymentAddress, address directionAddress, uint256 priceWei) public onlyOwner checkERC20(paymentAddress) {
        require(_fee[address(0)][address(0)] <= priceWei, "The price cannot be less than the fee.");

        _price[paymentAddress][directionAddress] = priceWei;
        emit Price(directionAddress, paymentAddress, priceWei);
    }

    /*
    * @dev Get fees based on the artist's payment method.
    */
    function getFee(address paymentAddress, address directionAddress) public view checkERC20(paymentAddress) returns (uint256) {
        return _fee[paymentAddress][directionAddress];
    }

    /*
    * @dev Set fees based on the artist's payment method.
    */
    function setFee(address paymentAddress, address directionAddress, uint256 feeWei) public onlyOwner checkERC20(paymentAddress) {
        // 코드가 길어지긴 하지만, 
        require(_fee[paymentAddress][directionAddress] != feeWei);

        _fee[paymentAddress][directionAddress] = feeWei;

        emit Fee(directionAddress, paymentAddress, feeWei);
    }

    /*
    * @dev Supported ERC20 Token Settings
    */
    function setAllowERC20(address paymentAddress, bool use) public onlyOwner {
        _allowERC20[paymentAddress] = use;

        emit AllowERC20(paymentAddress, use);
    }

    /*
    * @dev The artist sets his or her own price according to the payment method.
    */
    function setPriceByDirection(address paymentAddress, uint256 priceWei) public checkERC20(paymentAddress) {
        // 0 fee 일 경우... ??
        uint256 fee = _fee[paymentAddress][msg.sender] > 0 ? _fee[paymentAddress][msg.sender] : _fee[paymentAddress][address(0)];
        
        require(fee <= priceWei, "The price cannot be less than the fee.");

        _price[paymentAddress][msg.sender] = priceWei;
        emit Price(msg.sender, paymentAddress, priceWei);
    }

    /*
    * @dev Mint Light Stick with ETH
    */
    function mint(address directionAddress, uint256 amount) public payable nonReentrant{
        uint256 price = getPriceETH(directionAddress);

        require(amount > 0, "Amount is zero");
        require(msg.value >= price * amount, "insufficient value");
        require(directionAddress > address(0), "Invalid wallet address");
        
        uint256 tokenId = totalSupply();
        
        _directions[tokenId] = directionAddress;
        _expired[tokenId] = block.timestamp + ((amount*90) * 1 days);
        _mint(msg.sender, tokenId);

        withdrawETH(directionAddress, amount);

        emit Activate(directionAddress, msg.sender, tokenId, _expired[tokenId], 0, address(0), price, amount);
    }

    /*
    * @dev Extend the Light Stick's expiration with ETH
    */
    function extend(uint256 tokenId, uint256 amount) public payable nonReentrant{
        require(_exists(tokenId), "token not exist");
        address directionAddress = direction(tokenId);
        uint256 price = getPriceETH(directionAddress);

        require(amount > 0, "Amount is zero");
        require(msg.value >= price * amount, "insufficient value");
        
        _expired[tokenId] = _expired[tokenId] + ((amount*90) * 1 days);

        withdrawETH(directionAddress, amount);

        emit Activate(direction(tokenId), msg.sender, tokenId, _expired[tokenId], 1, address(0), price, amount);
    }

    /*
    * @dev Mint Light Stick with ERC20
    */
    function mintWithERC20(address directionAddress, address paymentAddress, uint256 amount)
        public
        nonReentrant
        checkERC20(paymentAddress)
    {
        uint256 price = getPriceERC20(paymentAddress, directionAddress);
        require(amount > 0, "Amount is zero");
        require(price > 0, "This Payments is Unsupported");
        require(directionAddress > address(0), "Invalid wallet address");

        require(IERC20(paymentAddress).allowance(msg.sender, address(this)) >= price * amount, "insufficient approve");
        require(IERC20(paymentAddress).balanceOf(msg.sender) >= price * amount, "insufficient value");

        uint256 tokenId = totalSupply();
        _directions[tokenId] = directionAddress;
        _expired[tokenId] = block.timestamp + ((amount * 90) * 1 days);
        _mint(msg.sender, tokenId);

        withdrawERC20(directionAddress, paymentAddress, amount);

        emit Activate(directionAddress, msg.sender, tokenId, _expired[tokenId], 0, paymentAddress, price, amount);
    }

    /*
    * @dev Extend the Light Stick's expiration with ERC20
    */
    function extendWithERC20(uint256 tokenId, address paymentAddress, uint256 amount)
        public
        nonReentrant
        checkERC20(paymentAddress)
    {
        require(_exists(tokenId), "token not exist");
        address directionAddress = direction(tokenId);
        uint256 price = getPriceERC20(paymentAddress, directionAddress);
        require(amount > 0, "Amount is zero");
        require(price > 0, "This Payments is Unsupported");
        
        require(IERC20(paymentAddress).allowance(msg.sender, address(this)) >= price * amount, "insufficient approve");
        require(IERC20(paymentAddress).balanceOf(msg.sender) >= price * amount, "insufficient value");

        _expired[tokenId] = _expired[tokenId] + ((amount*90) * 1 days);

        withdrawERC20(directionAddress, paymentAddress, amount);
        
        emit Activate(direction(tokenId), msg.sender, tokenId, _expired[tokenId], 1, paymentAddress, price, amount);
    }

    /*
    * @dev Gets the artist wallet address of the token.
    */
    function direction(uint256 tokenId) public view returns (address) {
        return _directions[tokenId];
    }

    /*
    * @dev Gets the expiration date of that token.
    */
    function expired(uint256 tokenId) public view returns (uint256) {
        return _expired[tokenId];
    }

    /*
    * @dev Get baseURI(internal function)
    */
    function _baseURI() internal view override virtual returns (string memory) {
        return baseURI;
    }

    /*
    * @dev Set baseURI
    */
    function setBaseURI(string memory _baseUri) public onlyOwner {
        baseURI = _baseUri;

        emit SetBaseURI(msg.sender, baseURI);
    }

    /*
    * @dev Get baseURI
    */
    function uri()
        public
        view
        virtual
        returns (string memory)
    {
        return _baseURI();
    }

    /*
    * @dev Returns the array of token id as address
    */
    function tokensOfOwner(address owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 count = balanceOf(owner);
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    /*
    * @dev Withdraw ETH as owner and artist
    */
    function withdrawETH(address directionAddress, uint256 amount) internal {
        uint256 fee = (getFee(address(0), directionAddress) > 0 ? getFee(address(0), directionAddress) : getFee(address(0), address(0))) * amount;
        (bool feeSuccess, ) = payable(owner()).call{value: fee}("");
        require(feeSuccess, "ETH fee withdraw fail");

        emit Withdraw(owner(), address(0), fee);
    
        uint256 price = getPriceETH(directionAddress) * amount;
        uint256 calculate = SafeMath.sub(price, fee, "SafeMath: subtraction overflow");
        (bool success, ) = payable(directionAddress).call{value: calculate}("");

        require(success, "ETH withdraw fail");

        emit Withdraw(directionAddress, address(0), calculate);
    }

    /*
    * @dev Withdraw ERC20 as owner and artist
    */
    function withdrawERC20(address directionAddress, address paymentAddress, uint256 amount) internal {

        uint256 fee = (getFee(paymentAddress, directionAddress) > 0 ? getFee(paymentAddress, directionAddress) : getFee(paymentAddress, address(0))) * amount;
        IERC20(paymentAddress).transferFrom(msg.sender, owner(), fee);

        emit Withdraw(owner(), paymentAddress, fee);

        uint256 price = getPriceERC20(paymentAddress, directionAddress) * amount;
        uint256 calculate = SafeMath.sub(price, fee, "SafeMath: subtraction overflow");
        IERC20(paymentAddress).transferFrom(msg.sender, directionAddress, calculate);

        emit Withdraw(directionAddress, paymentAddress, calculate);
    }

}