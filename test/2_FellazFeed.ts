import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Signer, providers } from "ethers";
import { ethers, waffle } from "hardhat";
import FellazFeedMinter from "../libs/FellazFeedMinter";
import { FellazFeed, Fellaz, Ownable } from "../typechain";
import { MockProvider, solidity } from 'ethereum-waffle';
import FeedAuctionMinter from "../libs/FeedAuctionMinter";
import FeedBidMinter from "../libs/FeedBidMinter";




describe("FellazFeed", function () {
  let fellazFeed: FellazFeed;
  let fellaz: Fellaz;
  let deployer: SignerWithAddress;
  let minter: SignerWithAddress;
  let redeemer: SignerWithAddress;
  let redeemer2: SignerWithAddress;



  beforeEach("Deploy", async () => {
    [deployer, minter, redeemer, redeemer2] = await ethers.getSigners()

    const FellazFeed = await ethers.getContractFactory("FellazFeed")
    fellazFeed = await FellazFeed.deploy();

    const Fellaz = await ethers.getContractFactory("Fellaz")
    fellaz = await Fellaz.deploy();


  })

  describe("SIGNER", () => {
    it("Should revert Signer is not creator", async function () {
      const lazyMinter = new FellazFeedMinter(fellazFeed);
      const voucher = await lazyMinter.createVoucher(minter, 1, 1, "0x0000000000000000000000000000000000000000", 1, 1)
      await expect(

        fellazFeed.connect(redeemer).redeem({
          creator: redeemer.address,
          payments: "0x0000000000000000000000000000000000000000",
          price: 1,
          quantity: 1,
          tokenId: voucher.tokenId,
          signature: voucher.signature
        }, {
          from: redeemer.address,
          value: 1
        })

      ).to.revertedWith("signer is not creator");

    });

  })

  describe("Funds", () => {
    it("Should Revert Insufficient funds to redeem", async function () {

      const lazyMinter = new FellazFeedMinter(fellazFeed);

      const voucher = await lazyMinter.createVoucher(minter, 1, 1, "0x0000000000000000000000000000000000000000", 1, 1)
      await expect(

        fellazFeed.connect(redeemer).redeem({
          creator: minter.address,
          payments: "0x0000000000000000000000000000000000000000",
          price: 1,
          quantity: 1,
          tokenId: voucher.tokenId,
          signature: voucher.signature
        }, {
          from: redeemer.address,
          value: 0
        })

      ).to.revertedWith("Insufficient amount");

    });

  })

  describe("MINT", () => {
    it("Should mint successfully and set royalties", async function () {
      await fellazFeed.deployed()
      const lazyMinter = new FellazFeedMinter(fellazFeed);

      const BeforeRedeemerbalance = await redeemer.getBalance()
      const BeforeMinterbalance = await minter.getBalance()
      const BeforeDeployerbalance = await deployer.getBalance()

      const voucher = await lazyMinter.createVoucher(minter, 1, 1, "0x0000000000000000000000000000000000000000", BigNumber.from("10000000000000000000"), 1)

      await fellazFeed.connect(redeemer).redeem({
        creator: minter.address,
        payments: "0x0000000000000000000000000000000000000000",
        price: BigNumber.from("10000000000000000000"),
        quantity: 1,
        tokenId: voucher.tokenId,
        signature: voucher.signature
      }, {
        from: redeemer.address,
        value: BigNumber.from("10000000000000000000")
      })
      expect(await fellazFeed.balanceOf(redeemer.address, voucher.tokenId)).to.equal(1);
      const AfterRedeemerbalance = await redeemer.getBalance()
      expect(AfterRedeemerbalance).to.lt(BeforeRedeemerbalance)
      const AfterMinterbalance = await minter.getBalance()
      expect(AfterMinterbalance).to.gt(BeforeMinterbalance)
      const AfterDeployerbalance = await deployer.getBalance()
      expect(AfterDeployerbalance).to.gt(BeforeDeployerbalance)

    });
  })


  describe("Supply", () => {
    it("Should revert if there is too many supply", async function () {
      const lazyMinter = new FellazFeedMinter(fellazFeed);
      const voucher = await lazyMinter.createVoucher(minter, 1, 1, "0x0000000000000000000000000000000000000000", 1, 1)

      await expect(fellazFeed.connect(redeemer).redeem({
        creator: minter.address,
        payments: "0x0000000000000000000000000000000000000000",
        price: 1,
        quantity: 2,
        tokenId: voucher.tokenId,
        signature: voucher.signature
      }, {
        from: redeemer.address,
        value: 1
      })).to.reverted
    });

  })

  describe("Auction", () => {
    it("should revert only auction creator can accept bids ", async function () {
      await fellaz.connect(deployer).transfer(redeemer.address, BigNumber.from("100000000000000000000"));
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      expect(await fellaz.balanceOf(redeemer.address)).to.equal(BigNumber.from("100000000000000000000"));
      await fellaz.connect(redeemer).approve(fellazFeed.address, "10000000000000000000")
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter, 1, 1, "0x0000000000000000000000000000000000000000", 1, 1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter, 1, 1, "0x0000000000000000000000000000000000000000", 1, 1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder: minter.address,
        payments: "0x0000000000000000000000000000000000000000",
        price: 1,
        tokenId: BidVoucher.tokenId,
        signature: BidVoucher.signature,
        expired: "",
      },{
        creator: minter.address,
        payments: "0x0000000000000000000000000000000000000000",
        price: 1,
        tokenId: AuctionVoucher.tokenId,
        signature: AuctionVoucher.signature,
        expired: ""
      })).to.revertedWith("Unauthorized")

    })
    it("Should revert Bidder is not the signer of Bidvoucher",async function(){
      await fellaz.connect(deployer).transfer(redeemer.address, BigNumber.from("100000000000000000000"));
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      await fellaz.connect(redeemer).approve(fellazFeed.address,"10000000000000000000")
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:redeemer2.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:BidVoucher.tokenId,
        signature:BidVoucher.signature,
        expired:""
      },{
        creator:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:AuctionVoucher.tokenId,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.revertedWith("Unauthorized")

    })

    it("Should revert signer is not Auction creator",async function(){
      await fellaz.connect(deployer).transfer(redeemer.address,BigNumber.from("100000000000000000000"));
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      await fellaz.connect(redeemer).approve(fellazFeed.address,"10000000000000000000")
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:BidVoucher.tokenId,
        signature:BidVoucher.signature,
        expired:""
      },{
        creator:redeemer.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:AuctionVoucher.tokenId,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.revertedWith("Unauthorized")
      
    })

    it("Should revert AuctionVoucher tokenId is != BidVoucher tokenId",async function (){
      await fellaz.connect(deployer).transfer(redeemer.address,BigNumber.from("100000000000000000000"));
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      await fellaz.connect(redeemer).approve(fellazFeed.address,"10000000000000000000")
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:1,
        signature:BidVoucher.signature,
        expired:""
      },{
        creator:redeemer.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:2,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.reverted

    })

    it("Should revert AuctionVoucher payment address is != BidVoucher payment address",async function (){
      await fellaz.connect(deployer).transfer(redeemer.address,BigNumber.from("100000000000000000000"));
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      await fellaz.connect(redeemer).approve(fellazFeed.address,"10000000000000000000")
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:minter.address,
        payments:"0xAB00000000000000000000000000000000000000",
        price:1,
        tokenId:1,
        signature:BidVoucher.signature,
        expired:""
      },{
        creator:redeemer.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:2,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.reverted

    })

    it("Should revert Bid price is < Auction price",async function (){
      await fellaz.connect(deployer).transfer(redeemer.address,BigNumber.from("100000000000000000000"));
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      await fellaz.connect(redeemer).approve(fellazFeed.address,"10000000000000000000")
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",2,1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",1,1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:1,
        tokenId:1,
        signature:BidVoucher.signature,
        expired:""
      },{
        creator:redeemer.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:2,
        tokenId:1,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.reverted

    })

    it("Should revert payment is not Ether",async function (){
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",BigNumber.from("10000000000000000000"),1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",ethers.utils.parseEther("1"),1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:ethers.utils.parseEther("1"),
        tokenId:1,
        signature:BidVoucher.signature,
        expired:""
      },
      {
        creator:redeemer.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:BigNumber.from("10000000000000000000"),
        tokenId:1,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.reverted

    })

    it("should revert balance of Bidder is less than AuctionVoucher price",async function (){
      await fellaz.deployed();
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",BigNumber.from("10000000000000000000"),1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",BigNumber.from("1"),1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:BigNumber.from("1"),
        tokenId:1,
        signature:BidVoucher.signature,
        expired:""
      },
      {
        creator:redeemer.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:BigNumber.from("10000000000000000000"),
        tokenId:1,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.reverted

    })

    it("should revert Allowance of Bidder is less than AuctionVoucher price",async function (){
      await fellaz.connect(deployer).transfer(redeemer.address, BigNumber.from("100000000000000000000"))
      await fellaz.deployed();
      await fellaz.connect(redeemer).approve(fellazFeed.address, "1000");
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",BigNumber.from("10000000000000000000"),1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",BigNumber.from("1000"),1,0)

      expect(fellazFeed.connect(redeemer).acceptBid({
        bidder:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:BigNumber.from("1000"),
        tokenId:1,
        signature:BidVoucher.signature,
        expired:""
      },
      {
        creator:redeemer.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:BigNumber.from("10000000000000000000"),
        tokenId:1,
        signature:AuctionVoucher.signature,
        expired:""
      })).to.reverted

    })

    it("should successfully match BidVoucher and AuctionVoucher and set royalties ",async function (){
      await fellaz.connect(deployer).transfer(redeemer.address, BigNumber.from("100000000000000000000"))
      await fellaz.deployed();
      await fellaz.connect(redeemer).approve(fellazFeed.address, "100000000000000000000");
      const lazyMinter1 = new FeedAuctionMinter(fellazFeed);
      const lazyMinter2 = new FeedBidMinter(fellazFeed);
      const AuctionVoucher = await lazyMinter1.createAuctionVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",BigNumber.from("10000000000000000000"),1)
      const BidVoucher = await lazyMinter2.createBidVoucher(minter,1,1,"0x0000000000000000000000000000000000000000",BigNumber.from("100000000000000000000"),1,0)

      expect(fellazFeed.connect(redeemer2).acceptBid({
        bidder:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:BigNumber.from("100000000000000000000"),
        tokenId:1,
        signature:BidVoucher.signature,
        expired:""
      },
      {
        creator:minter.address,
        payments:"0x0000000000000000000000000000000000000000",
        price:BigNumber.from("100000000000000000000"),
        tokenId:1,
        signature:AuctionVoucher.signature,
        expired:""
      }))



    })
  })

  describe("REDEEM WITH ERC20", () => {
    it("Should succeed minting with ERC20 and set Royalties", async function () {
      await fellaz.connect(deployer).transfer(redeemer.address, BigNumber.from("100000000000000000000"))
      await fellaz.deployed()
      const lazyMinter = new FellazFeedMinter(fellazFeed);
      expect(await fellaz.balanceOf(redeemer.address)).to.equal(BigNumber.from("100000000000000000000"))
      await fellaz.connect(redeemer).approve(fellazFeed.address, "10000000000000000000");
      await fellaz.connect(redeemer).allowance(redeemer.address, fellazFeed.address)
      const voucher = await lazyMinter.createVoucher(minter, 2, 1, fellaz.address, BigNumber.from("10000000000000000000"), 1)
      await fellazFeed.connect(redeemer).redeem({
        creator: minter.address,
        payments: fellaz.address,
        price: BigNumber.from("10000000000000000000"),
        quantity: 1,
        tokenId: voucher.tokenId,
        signature: voucher.signature
      }, {
        from: redeemer.address,
      })
      expect(await fellazFeed.balanceOf(redeemer.address, voucher.tokenId)).to.equal(1);
      expect(await fellaz.balanceOf(redeemer.address)).to.equal(BigNumber.from("90000000000000000000"))
      expect(await fellaz.balanceOf(minter.address)).to.equal(BigNumber.from("9000000000000000000"))
    });

    it("should revert balance of redeemer is less than Voucher price", async function () {
      await fellaz.deployed()
      const lazyMinter = new FellazFeedMinter(fellazFeed);
      await fellaz.connect(redeemer).approve(fellazFeed.address, "10000000000000000000");
      await fellaz.connect(redeemer).allowance(redeemer.address, fellazFeed.address)
      const voucher = await lazyMinter.createVoucher(minter, 2, 1, fellaz.address, BigNumber.from("10000000000000000000"), 1)
      await expect(fellazFeed.connect(redeemer).redeem({
        creator: minter.address,
        payments: fellaz.address,
        price: BigNumber.from("1000"),
        quantity: 1,
        tokenId: voucher.tokenId,
        signature: voucher.signature
      }, {
        from: redeemer.address,
      })).to.revertedWith("Insufficient amount");

    })
    it("should revert allowance of Redeemer less than Voucher price", async function () {
      await fellaz.deployed()
      const lazyMinter = new FellazFeedMinter(fellazFeed);
      await fellaz.connect(redeemer).approve(fellazFeed.address, "1000");
      await fellaz.connect(redeemer).allowance(redeemer.address, fellazFeed.address)
      const voucher = await lazyMinter.createVoucher(minter, 2, 1, fellaz.address, BigNumber.from("10000000000000000000"), 1)
      await expect(fellazFeed.connect(redeemer).redeem({
        creator: minter.address,
        payments: fellaz.address,
        price: BigNumber.from("1000"),
        quantity: 1,
        tokenId: voucher.tokenId,
        signature: voucher.signature
      }, {
        from: redeemer.address,
      })).to.revertedWith("Insufficient amount")

    })

  })

});
function value(to: any, address: string, value: any, arg3: number) {
  throw new Error("Function not implemented.");
}
