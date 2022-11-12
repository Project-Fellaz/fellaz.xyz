//SPDX-License-Identifier: Unlicense
pragma  solidity^0.8.0;
pragma abicoder v2; // required to accept structs as function parameters

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

contract FellazFeed is ERC1155Supply, EIP712, Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using Strings for uint256;

    string private _baseURI = "https://metadata.fellaz.xyz/";
    string private constant SIGNING_DOMAIN = "FellazFeedVoucher";
    string private constant SIGNATURE_VERSION = "1";
 
    // The current nonce for the creator represents the only valid nonce that can be signed by the creator
    // If a signature was signed with a nonce that's different from the one stored in nonces, it
    // will fail validation.
    mapping(address => uint256) public nonces;
    
    // Increment a particular creators nonce, thereby invalidating all orders that were not signed
    //  with the original nonce.
     
    function _incrementNonce(address sender) internal {
          ++nonces[sender];
       // emit NonceIncremented(msg.sender, newNonce);
    }
   
    /// @notice represents an unminted voucher, which has not yet been recorded into the blockchain
    /// @notice a signed voucher can be redeemed for a real NFT using the redeem function.
    struct FellazFeedVoucher {
        address creator;
        uint256 tokenId; //only this on the blockchain
        address payments;
        uint256 price;
        uint256 quantity;
        bytes signature;
    }
   /// @notice represents an unminted Bidvoucher, which has not yet been recorded into the blockchain
   /// @notice a signed Bid can be matched with accepted Bid for a real nft using match Bids function
    struct BidVoucher{
        address bidder;
        uint256 tokenId;
        address payments;
        uint256 price;
        bytes signature;
        uint256 expired;
    }
   /// @notice represents an unminted accept bid which needs to be signed and match with Bid voucher
    struct AuctionVoucher{
        address creator;
        uint256 tokenId;
        address payments;
        uint256 price;
        bytes  signature;
        uint256 expired;
    }

   /// @notice hash the bids voucher
    function _hashBid(BidVoucher calldata bVoucher,uint256 nonce) internal pure returns (bytes32){
         return
                keccak256(
                    abi.encode(
                        keccak256(
                            "BidVoucher(address bidder,uint256 tokenId,address payments,uint256 price,uint256 nonce)"
                        ),
                        bVoucher.bidder,
                        bVoucher.tokenId,
                        bVoucher.payments,
                        bVoucher.price,
                        nonce
                    )
                );    
    }

       ///@notice verify the hash of bid voucher
 function _verifyhashBid(BidVoucher calldata bVoucher,uint256 nonce) internal pure returns (address) {//required valid order
      // create hash
        bytes32 digest = _hashBid(bVoucher,nonce);
        // get the address of the signer
        return ECDSA.recover(digest,bVoucher.signature); 
}


   /// @notice hash the accepting bid voucher
    function _hashAcceptBid(AuctionVoucher calldata aVoucher,uint256 nonce) internal pure returns (bytes32){
         return
                keccak256(
                    abi.encode(
                        keccak256(
                            "BidVoucher(address bidder,uint256 tokenId,address payments,uint256 price,uint256 nonce)"
                        ),
                        aVoucher.creator,
                        aVoucher.tokenId,
                        aVoucher.payments,
                        aVoucher.price,
                        nonce  
                    )
                );    
    }
     ///@notice verify the hash of the accepted bid voucher
    function _verifyAcceptBidHash(AuctionVoucher calldata aVoucher,uint256 nonce) internal pure returns (address) {
      // create hash
        bytes32 digest = _hashAcceptBid(aVoucher,nonce);
     // get the address of the signer
        return ECDSA.recover(digest, aVoucher.signature);
}
 
    constructor() ERC1155("") EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    /// @notice returns a hash of the given NFT Voucher,prepared using EIP712 typed data hashing rules.
    /// @param voucher an NFTVoucher to hash
    function _hash(FellazFeedVoucher calldata voucher)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "FellazFeedVoucher(uint256 tokenId,address payments,uint256 price,uint256 quantity)"
                        ),
                        voucher.tokenId,
                        voucher.payments,
                        voucher.price,
                        voucher.quantity
                    )
                )
            );
    }

    /// @notice Verifies the signature for a given NFTVoucher, returning the address of the signer.
    /// @dev Will revert if the signature is invalid. Does not verify that the signer is authorized to mint NFTs.
    /// @param voucher An NFTVoucher describing an unminted NFT.
    function _verify(FellazFeedVoucher calldata voucher)
        internal
        view
        returns (address)
    {
        // create hash
        bytes32 digest = _hash(voucher);
        // get the address of the signer
        return ECDSA.recover(digest, voucher.signature);
    }

    /// @notice Redeems an NFTVoucher for an actual NFT, creating it in the process.
    /// @param voucher A signed NFTVoucher that describes the NFT to be redeemed.
    function redeem(FellazFeedVoucher calldata voucher) external payable nonReentrant returns (uint256) {
        // make sure signature is valid and get the address of the signer
        address signer = _verify(voucher);
        //get creator address from tokenID
        address creator = getAddressFromTokenId(voucher.tokenId);

        if (voucher.payments == address(0)) {
            require(msg.value >= voucher.price, "Insufficient amount");
            //casting owner to payable address
            address payable owner = payable(owner());
            //Set the fellaz platform royalty fee
            uint256 cut = (voucher.price.mul(10)).div(100);
            //deduct platform fee
            uint256 transferAmt = voucher.price.sub(cut);
            //transfer cut/fee to fellaz account
            owner.transfer(cut);
            //transfer the rest to the creator
            payable(voucher.creator).transfer(transferAmt);
        } else {
            require(msg.value == 0, "Payments is not ethereum");
            require( IERC20(voucher.payments).balanceOf(msg.sender) >= voucher.price && IERC20(voucher.payments).allowance( msg.sender, address(this) ) >= voucher.price, "Insufficient amount" );
            //Set the platform royalty fee
            uint256 cut = (voucher.price.mul(10)).div(100);
            //deduct platform fee
            uint256 transferAmt = voucher.price.sub(cut);
            //give cut to fellazplatform account
            IERC20(voucher.payments).transferFrom(msg.sender, owner(), cut);
            //transfer the rest to the creator
            IERC20(voucher.payments).transferFrom(
                msg.sender,
                voucher.creator,
                transferAmt
            );
        }
        // check if the signer is same as the creator
        require( signer == creator && signer == voucher.creator, "signer is not creator" );
        // check the amount of token redeemer can redeem should be less than the total quantity
        require( totalSupply(voucher.tokenId) + 1 <= voucher.quantity, "more than totalSupply");
        // first assign the token to the signer, to establish provenance on-chain
        _mint(signer, voucher.tokenId, 1, "");
        // transfer the token to the redeemer
        _safeTransferFrom(signer, msg.sender, voucher.tokenId, 1, "");

        return voucher.tokenId;
    }

    function acceptBid(BidVoucher calldata bVoucher,AuctionVoucher calldata aVoucher) public nonReentrant returns (uint256){
        
        require(msg.sender == aVoucher.creator,"not auction creator");    
        if(bVoucher.bidder == msg.sender){
             //Ensure bidder voucher validity and calculate hash if necessary
             //verify the address of the account the prepared the signature
        address bidSigner = _verifyhashBid(bVoucher,nonces[bVoucher.bidder]);
         //get bidder address from tokenID
        address bidder = getAddressFromTokenId(bVoucher.tokenId);

         require(bidSigner == bidder && bidSigner == bVoucher.bidder,"Signer is not Bidder");
        }
        //Ensure Auction voucher validity and calculate hash if necessary
        address acceptBidSigner = _verifyAcceptBidHash(aVoucher,nonces[aVoucher.creator]);
        address creator = getAddressFromTokenId(aVoucher.tokenId);
        if(aVoucher.creator == msg.sender){
         require(acceptBidSigner == creator && acceptBidSigner == aVoucher.creator,"Signer is not creator");

        }
        require(bVoucher.tokenId == aVoucher.tokenId,"can't be matched");
        require(bVoucher.payments == aVoucher.payments,"can't be matched");        
        // Add Check Expired Time
        require(block.timestamp > bVoucher.expired, "Expired");

        require(bVoucher.price >= aVoucher.price,"Bid is less than existing price");
        
       //require(msg.value == 0, "Payments is not ethereum");
        require( IERC20(bVoucher.payments).balanceOf(bVoucher.bidder) >= aVoucher.price && IERC20(bVoucher.payments).allowance(bVoucher.bidder, address(this) ) >= aVoucher.price, "Insufficient amount" );
        //Set the platform royalty fee
        uint256 cut = (bVoucher.price.mul(10)).div(100);
        //deduct platform fee
        uint256 transferAmt = bVoucher.price.sub(cut);
        //give cut to fellazplatform account
        IERC20(bVoucher.payments).transferFrom(bVoucher.bidder, owner(), cut);
        //transfer the rest to the creator
        IERC20(bVoucher.payments).transferFrom(bVoucher.bidder,aVoucher.creator,transferAmt);
        // first assign the token to the signer, to establish provenance on-chain
        _mint(acceptBidSigner,aVoucher.tokenId, 1, "");
        // transfer the token to the redeemer
        _safeTransferFrom(acceptBidSigner,bVoucher.bidder,aVoucher.tokenId, 1, "");
        
        _incrementNonce(msg.sender);

        return aVoucher.tokenId;
    }

    /// @notice returns the name of the token
    function name() public pure returns (string memory) {
        return "FellazFeed";
    }

    /// @notice returns the symbol of the token
    function symbol() public pure returns (string memory) {
        return "FF";
    }
    /// @notice returns the chain id of the current blockchain the user wants to use for lazyminting
    /// @dev This is used to workaround an issue with ganache returning different values from the on-chain chainid() function and
    ///  the eth_chainId RPC method. See https://github.com/protocol/nft-website/issues/121 for context.
    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /// @notice returns the creator address of the tokenID
    function getAddressFromTokenId(uint256 tokenId)
        private
        pure
        returns (address creator)
    {
        return address(bytes20(bytes32(tokenId)));
    }

    /// @notice returns the creator,platform and index of the current tokenID
    function _typedTokenId(bytes32 tokenId)
        private
        pure
        returns (
            address creator,
            bytes7 platform,
            bytes5 index
        )
    {
        creator = address(bytes20(tokenId));
        platform = bytes7(tokenId << 160);
        index = bytes5(tokenId << 272);
    }
    /// @notice sets the baseURI of the token
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseURI = baseURI;
    }
    /// @notice checks if the current tokenId exists
    function uri(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(exists(tokenId), "Not exist token Id");
        return string(abi.encodePacked(_baseURI, tokenId.toString()));
    }

}
