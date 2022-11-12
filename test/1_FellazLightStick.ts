import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import LazyMinter from "../libs/FellazFeedMinter";
import { FellazLightStick, Fellaz } from "../typechain";


let fellazLightStick: FellazLightStick;
let fellaz: Fellaz;

describe("FellazLightStick", function () {

  before("Deploy", async () => {
    const FellazLightStick = await ethers.getContractFactory("FellazLightStick")
    fellazLightStick = await FellazLightStick.deploy();

    const Fellaz = await ethers.getContractFactory("Fellaz")
    fellaz = await Fellaz.deploy();

    const [minter, address1, _] = await ethers.getSigners()
    await fellaz.connect(minter).transfer(address1.address, BigNumber.from("100000000000000000000"))
  })

  it("Should revert setPrice (ERC20) because Not Onwer FellazLightStick", async () => {
    const [minter, address1, _] = await ethers.getSigners()

    await expect(fellazLightStick.connect(address1).setPrice(fellaz.address, BigNumber.from("1000000000000000000"))).to.revertedWith("Ownable: caller is not the owner");
  })

  it("Should success setPrice ERC20", async () => {
    const [minter, address1, _] = await ethers.getSigners()
    await fellazLightStick.connect(minter).setPrice(fellaz.address, BigNumber.from("1000000000000000000"));
    expect(await fellazLightStick.price(fellaz.address) ).to.eq(BigNumber.from("1000000000000000000"));
  })

  it("Should revert setPrice (ETH) because Not Onwer FellazLightStick", async () => {
    const [minter, address1, _] = await ethers.getSigners()

    await expect(fellazLightStick.connect(address1).setPrice("0x0000000000000000000000000000000000000000", BigNumber.from("1000000000000000000"))).to.revertedWith("Ownable: caller is not the owner");
  })

  it("Should success setPrice ETH", async () => {
    const [minter, address1, _] = await ethers.getSigners()
    await fellazLightStick.connect(minter).setPrice("0x0000000000000000000000000000000000000000", BigNumber.from("1000000000000000000"));
    expect(await fellazLightStick.price("0x0000000000000000000000000000000000000000") ).to.eq(BigNumber.from("1000000000000000000"));
  })

  it("Should revert mint(ETH) because insufficient value", async () => {
    const [minter, address1, target,_] = await ethers.getSigners()
    await expect( fellazLightStick.connect(address1).mint(target.address, {
      from:address1.address,
      value:BigNumber.from("900000000000000000")
    })).to.revertedWith("insufficient value")
  })

  it("Should success mint(ETH)", async () => {
    const [minter, address1, target,_] = await ethers.getSigners()
    await expect( fellazLightStick.connect(address1).mint(target.address, {
      from:address1.address,
      value:BigNumber.from("1000000000000000000")
    })).to.emit(fellazLightStick, "Activate");
  })


  it("Should revert mint(ERC20) because insufficient approve", async () => {
    const [minter, address1, target,_] = await ethers.getSigners()
    await expect( fellazLightStick.connect(address1).mintWithERC20(target.address, fellaz.address)).to.revertedWith("insufficient approve")
  })

  it("Should success mint(ERC20)", async () => {
    const [minter, address1, target,_] = await ethers.getSigners()
    await fellaz.connect(address1).approve(fellazLightStick.address, BigNumber.from("1000000000000000000"));
    await expect( fellazLightStick.connect(address1).mintWithERC20(target.address, fellaz.address)).to.emit(fellazLightStick, "Activate");
  })

});
