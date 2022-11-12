import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Fellaz, FellazFeed, FellazLightStickEnumerable } from "../typechain";


let fellazFeed:FellazFeed;
let fellazLightStick: FellazLightStickEnumerable;
let fellaz: Fellaz;


const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_ETHER = BigNumber.from(Math.pow(10, 10)).mul(Math.pow(10, 8)).toString();
const HALF_ETHER = BigNumber.from(ONE_ETHER).div(2).toString();
const FEE_ETHER = ethers.utils.parseEther("0.01");

const parseEther = (val:string) => ethers.utils.parseEther(val);
const formatEther = (val:string) => ethers.utils.formatEther(val);

describe("FellazLightStickEnumerable", function () {

    before("Deploy", async () => {
        const [minter, address1, address2, _] = await ethers.getSigners()
        const Fellaz = await ethers.getContractFactory("Fellaz");
        fellaz = await Fellaz.deploy();

        const FellazLightStickEnumerable = await ethers.getContractFactory("FellazLightStickEnumerable")
        fellazLightStick = await FellazLightStickEnumerable.deploy();

        const FellazFeed = await ethers.getContractFactory("FellazFeed");
        fellazFeed = await FellazFeed.deploy();

        fellaz.connect(minter).transfer(address1.address, BigNumber.from(ONE_ETHER).mul(1000));
        fellaz.connect(minter).transfer(address2.address, BigNumber.from(ONE_ETHER).mul(1000));

        console.log(`const FellazFeed = "${fellazFeed.address}"`)
        console.log(`const FellazLightStick = "${fellazLightStick.address}"`)
        console.log(`const Fellaz = "${fellaz.address}"`)
    })

    it("Should revert setAllowERC20, because Not owner FellazLightStick Contract", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();
        await expect(fellazLightStick.connect(address1).setAllowERC20(fellaz.address, false)).to.revertedWith("Ownable: caller is not the owner");
    });

    it("Should success setAllowERC20 set fellaz token false", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();
        await expect(await fellazLightStick.connect(minter).setAllowERC20(fellaz.address, false)).to.emit(fellazLightStick, "AllowERC20");
    });

    it("Should revert mintWithERC20, because Unsupported ERC20 Token", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();
        await expect(fellazLightStick.connect(address1).mintWithERC20(target.address, fellaz.address, 1)).to.revertedWith("Unsupported ERC20 Token");
    });

    it("Should success setAllowERC20 set Fellaz Token true", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();
        await expect(await fellazLightStick.connect(minter).setAllowERC20(fellaz.address, true)).to.emit(fellazLightStick, "AllowERC20");
    });

    it("Should revert setPrice, because Not owner FellazLightStick Contract", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(address1).setPrice(ZERO_ADDRESS, ZERO_ADDRESS, ONE_ETHER)).to.revertedWith("Ownable: caller is not the owner");
    })

    it("should revert setPrice for default ETH !< fee ",async()=>{
        const [minter,address1,_] = await ethers.getSigners()
        await expect(fellazLightStick.connect(minter).setPrice(ZERO_ADDRESS,ZERO_ADDRESS,parseEther("0"))).to.revertedWith("The price cannot be less than the fee")
    })

    it("Should success setPrice for default(ETH):no target address", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(minter).setPrice(ZERO_ADDRESS, ZERO_ADDRESS, ONE_ETHER)).to.emit(fellazLightStick, "Price").withArgs(ZERO_ADDRESS, ZERO_ADDRESS, ONE_ETHER);
        expect(await fellazLightStick.getPriceETH(ZERO_ADDRESS)).eq(ONE_ETHER);
    })

    it("Should success setPrice for default(ERC20):no target address", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(await fellazLightStick.connect(minter).setPrice(fellaz.address, ZERO_ADDRESS, ONE_ETHER)).to.emit(fellazLightStick, "Price");
        expect(await fellazLightStick.getPriceERC20(fellaz.address, ZERO_ADDRESS)).eq(ONE_ETHER);
    })

    it("Should revert setPriceByDirection for Ethereum, because The price cannot be less than the fee.", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(address1).setPriceByDirection(ZERO_ADDRESS, parseEther("0.001"))).to.revertedWith("The price cannot be less than the fee.");
    });

    it("Should success setPriceBydirection for Ethereum", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(address1).setPriceByDirection(ZERO_ADDRESS, parseEther("2.0"))).to.emit(fellazLightStick, "Price").withArgs(address1.address, ZERO_ADDRESS, parseEther("2.0"));
        expect(await fellazLightStick.getPriceETH(address1.address)).eq(parseEther("2.0"));
    })
    
    it("Should revert setFee(ETH), because Not owner FellazLightStick Contract", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(address1).setFee(ZERO_ADDRESS, ZERO_ADDRESS, FEE_ETHER)).to.revertedWith("Ownable: caller is not the owner"); 
    });

    it("Should success setFee for ETH", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(await fellazLightStick.connect(minter).setFee(ZERO_ADDRESS, ZERO_ADDRESS, FEE_ETHER)).to.emit(fellazLightStick, "Fee").withArgs(ZERO_ADDRESS, ZERO_ADDRESS, FEE_ETHER); 
    });

    it("Should revert setFee for ERC20, because Not owner FellazLightStick Contract", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(address1).setFee(fellaz.address, ZERO_ADDRESS, FEE_ETHER)).to.revertedWith("Ownable: caller is not the owner"); 
    });

    it("Should success setFee for default ERC20", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(minter).setFee(fellaz.address, ZERO_ADDRESS, FEE_ETHER)).to.emit(fellazLightStick, "Fee").withArgs(ZERO_ADDRESS, fellaz.address, FEE_ETHER);
        expect(await fellazLightStick.getFee(fellaz.address, ZERO_ADDRESS)).eq(FEE_ETHER);
    });

    it("Should success setFee for default ERC20:using target address", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(minter).setFee(fellaz.address, address1.address, FEE_ETHER)).to.emit(fellazLightStick, "Fee").withArgs(address1.address, fellaz.address, FEE_ETHER);
        expect(await fellazLightStick.getFee(fellaz.address, address1.address)).eq(FEE_ETHER);
    });

    it("Should revert setPriceBydirection for ERC20 Tokens!<fee",async()=>{
        const [minter,address1,_] = await ethers.getSigners()
        await expect(fellazLightStick.connect(address1).setPriceByDirection(fellaz.address,BigNumber.from("0"))).to.revertedWith("The price cannot be less than the fee");
    })


    it("Should success setPriceBydirection for ERC20 Tokens", async () => {
        const [minter, address1, _] = await ethers.getSigners()
        await expect(fellazLightStick.connect(address1).setPriceByDirection(fellaz.address, parseEther("1.2"))).to.emit(fellazLightStick, "Price").withArgs(address1.address, fellaz.address, parseEther("1.2"));
        expect(await fellazLightStick.getPriceERC20(fellaz.address, address1.address)).eq(parseEther("1.2"));
    })

    // Test For Mint only Ethereum
    it("Should revert mint(ETH), because amount is zero", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()
        
        const priceOfEth = await fellazLightStick.getPriceETH(ZERO_ADDRESS)

        await expect(
            fellazLightStick
                .connect(address1)
                .mint(target.address, 0, {
                    from: address1.address,
                    value: priceOfEth
                })).to.revertedWith("Amount is zero");
    })

    it("Should revert mint(ETH), because insufficient value", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()

        const priceOfEth = await fellazLightStick.getPriceETH(ZERO_ADDRESS)
        const priceForPay = BigNumber.from(priceOfEth).sub(1);

        await expect(
            fellazLightStick
                .connect(address1)
                .mint(target.address, 1, {
                    from: address1.address,
                    value: priceForPay
                })).to.revertedWith("insufficient value");
    })

    it("Should revert mint(ETH), because ZERO_ADDRESS", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()
        const priceOfEth = await fellazLightStick.getPriceETH(ZERO_ADDRESS)

        await expect(
            fellazLightStick
                .connect(address1)
                .mint(ZERO_ADDRESS, 1, {
                    from: address1.address,
                    value: priceOfEth
                })).to.revertedWith("Invalid wallet address");
    })

    it("Should success mint(ETH)", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()
        const priceOfEth = await fellazLightStick.getPriceETH(ZERO_ADDRESS)

        const beforeMinterBalance = await minter.getBalance();
        const beforeTargetBalance = await target.getBalance();

        await expect(
            fellazLightStick
                .connect(address1)
                .mint(target.address, 1, {
                    from: address1.address,
                    value: priceOfEth
                })).to.emit(fellazLightStick, "Activate");

        await expect(await minter.getBalance()).to.above(beforeMinterBalance);
        console.log(await minter.getBalance(), beforeMinterBalance);
        await expect(await target.getBalance()).to.above(beforeTargetBalance);
    })

    it("Should success mint(ETH) 2 Light Stick", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()

        const priceOfEth = await fellazLightStick.getPriceETH(ZERO_ADDRESS);

        const beforeMinterBalance = await minter.getBalance();
        const beforeTargetBalance = await target.getBalance();

        await expect(
            fellazLightStick
                .connect(address1)
                .mint(target.address, 2, {
                    from: address1.address,
                    value: priceOfEth.mul(2)
                })).to.emit(fellazLightStick, "Activate");

        console.log("owner", ethers.utils.formatEther(beforeMinterBalance.toString()), ethers.utils.formatEther(await minter.getBalance()));
        console.log("direction", ethers.utils.formatEther(beforeTargetBalance.toString()), ethers.utils.formatEther(await target.getBalance()));

        await expect(await minter.getBalance()).to.above(beforeMinterBalance);
        await expect(await target.getBalance()).to.above(beforeTargetBalance);
    })

    it("Should revert mint 2 Light Stick by direction(ETH), because not match price", async () => {
        const [minter, target, address2, _] = await ethers.getSigners();

        const priceOfEth = await fellazLightStick.getPriceETH(ZERO_ADDRESS);

        await expect(
            fellazLightStick
                .connect(address2)
                .mint(target.address, 2, {
                    from: address2.address,
                    value: priceOfEth.mul(2)
                })).to.revertedWith("insufficient value");
    });

    it("Should success mint 2 Light Stick by direction(ETH)", async () => {
        const [minter, target, address2, _] = await ethers.getSigners();

        const priceOfEth = await fellazLightStick.getPriceERC20(ZERO_ADDRESS, target.address);

        const beforeMinterBalance = await minter.getBalance();
        const beforeTargetBalance = await target.getBalance();
        console.log(ethers.utils.formatEther((await address2.getBalance()).toString()));
        console.log(ethers.utils.formatEther(priceOfEth.toString()));

        await expect(
            fellazLightStick
                .connect(address2)
                .mint(target.address, 2, {
                    from: address2.address,
                    value: priceOfEth.mul(2)
                })).to.emit(fellazLightStick, "Activate");
                console.log(ethers.utils.formatEther((await address2.getBalance()).toString()));
        console.log("owner", ethers.utils.formatEther(beforeMinterBalance.toString()), ethers.utils.formatEther(await minter.getBalance()));
        console.log("direction", ethers.utils.formatEther(beforeTargetBalance.toString()), ethers.utils.formatEther(await target.getBalance()));

        await expect(await minter.getBalance()).to.above(beforeMinterBalance);
        await expect(await target.getBalance()).to.above(beforeTargetBalance);
    });

    it("Should revert extend, because insufficient value", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();

        const myToken = await fellazLightStick.connect(address1).tokensOfOwner(address1.address);
        const priceOfEth = parseEther("0.1");

        await expect(
            fellazLightStick
            .connect(address1)
            .extend(myToken[0].toNumber(), 1, {
                from: address1.address,
                value: priceOfEth
            })
        ).to.revertedWith("insufficient value");

    });

    it("Should success extend(ETH)", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();

        const myToken = await fellazLightStick.connect(address1).tokensOfOwner(address1.address);
        const priceOfEth = await fellazLightStick.getPriceETH(target.address);

        const beforeMinterBalance = await minter.getBalance();
        const beforeTargetBalance = await target.getBalance();
        const beforeExpried = await fellazLightStick.expired(myToken[0]);

        await expect(
            fellazLightStick
            .connect(address1)
            .extend(myToken[0].toNumber(), 1, {
                from: address1.address,
                value: priceOfEth
            })
        ).to.emit(fellazLightStick, "Activate");
        const dateObj = new Date(beforeExpried.toNumber() * 1000);

        console.log(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate(), dateObj.getHours(), dateObj.getMinutes());

        const newDateObj = new Date((await fellazLightStick.expired(myToken[0])).toNumber() * 1000);
        console.log(newDateObj.getFullYear(), newDateObj.getMonth() + 1, newDateObj.getDate(), newDateObj.getHours(), newDateObj.getMinutes());
        await expect(await minter.getBalance()).to.above(beforeMinterBalance);
        await expect(await target.getBalance()).to.above(beforeTargetBalance);
        await expect(await fellazLightStick.expired(myToken[0])).to.above(beforeExpried);

    });

    it("Should success 2times extend(ETH)", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();

        const myToken = await fellazLightStick.connect(address1).tokensOfOwner(address1.address);
        const priceOfEth = await fellazLightStick.getPriceETH(target.address);

        const beforeMinterBalance = await minter.getBalance();
        const beforeTargetBalance = await target.getBalance();
        const beforeExpried = await fellazLightStick.expired(myToken[0]);

        await expect(
            fellazLightStick
            .connect(address1)
            .extend(myToken[0].toNumber(), 2, {
                from: address1.address,
                value: priceOfEth.mul(2)
            })
        ).to.emit(fellazLightStick, "Activate");

        await expect(await minter.getBalance()).to.above(beforeMinterBalance);
        await expect(await target.getBalance()).to.above(beforeTargetBalance);
        await expect(await fellazLightStick.expired(myToken[0])).to.above(beforeExpried);

    });

    it("Should success extend(ETH) differnce price", async () => {
        const [minter, target, address2, _] = await ethers.getSigners();

        const myToken = await fellazLightStick.connect(address2).tokensOfOwner(address2.address);
        const priceOfEth = await fellazLightStick.getPriceETH(target.address);

        const beforeMinterBalance = await minter.getBalance();
        const beforeTargetBalance = await target.getBalance();
        const beforeExpried = await fellazLightStick.expired(myToken[0]);

        await expect(
            fellazLightStick
            .connect(address2)
            .extend(myToken[0].toNumber(), 1, {
                from: address2.address,
                value: priceOfEth
            })
        ).to.emit(fellazLightStick, "Activate");

        await expect(await minter.getBalance()).to.above(beforeMinterBalance);
        await expect(await target.getBalance()).to.above(beforeTargetBalance);
        await expect(await fellazLightStick.expired(myToken[0])).to.above(beforeExpried);
    });


    // Test for Mint with ERC20
    it("Should revert mintWithERC20, because amount is zero", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()

        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, ZERO_ADDRESS)
        await fellaz.connect(address1).approve(fellazLightStick.address, priceOfErc20);

        await expect(
            fellazLightStick
                .connect(address1)
                .mintWithERC20(target.address, fellaz.address, 0)).to.revertedWith("Amount is zero");

        await fellaz.connect(address1).approve(fellazLightStick.address, 0);
    })

    it("Should revert mintWithERC20, because insufficient value", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()

        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, ZERO_ADDRESS)
        const priceForPay = BigNumber.from(priceOfErc20).sub(1);
        await fellaz.connect(address1).approve(fellazLightStick.address, priceForPay);

        await expect(
            fellazLightStick
                .connect(address1)
                .mintWithERC20(target.address, fellaz.address, 2)).to.revertedWith("insufficient approve");

        await fellaz.connect(address1).approve(fellazLightStick.address, 0);
    })

    it("Should success mintWithERC20", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()

        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, ZERO_ADDRESS)
        await fellaz.connect(address1).approve(fellazLightStick.address, priceOfErc20);

        console.log("balanceOf", (await fellaz.connect(address1).balanceOf(address1.address)).toString(), priceOfErc20.toString())


        await expect(
            fellazLightStick
                .connect(address1)
                .mintWithERC20(target.address, fellaz.address, 1)).to.emit(fellazLightStick, "Activate");

        await fellaz.connect(address1).approve(fellazLightStick.address, 0);
    })

    it("Should success mintWithERC20 2 LightStick", async () => {
        const [minter, address1, target, _] = await ethers.getSigners()

        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, ZERO_ADDRESS)
        await fellaz.connect(address1).approve(fellazLightStick.address, priceOfErc20.mul(2));

        await expect(
            fellazLightStick
                .connect(address1)
                .mintWithERC20(target.address, fellaz.address, 2)).to.emit(fellazLightStick, "Activate");

        await fellaz.connect(address1).approve(fellazLightStick.address, 0);
    })

    

    it("Should revert mintWithERC20 2 Light Stick by direction, because not match price", async () => {
        const [minter, target, address2, _] = await ethers.getSigners();

        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, ZERO_ADDRESS)
        await fellaz.connect(address2).approve(fellazLightStick.address, priceOfErc20.mul(2));

        console.log("balanceOf", (await fellaz.connect(address2).balanceOf(address2.address)).toString(), priceOfErc20.toString())


        await expect(
            fellazLightStick
                .connect(address2)
                .mintWithERC20(target.address, fellaz.address, 2)).to.revertedWith("insufficient approve");

        await fellaz.connect(address2).approve(fellazLightStick.address, 0);
    });

    it("Should revert mintWithERC20 by direction, because ZERO ADDRESS", async () => {
        const [minter, target, address2, _] = await ethers.getSigners();

        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, target.address)
        await fellaz.connect(address2).approve(fellazLightStick.address, priceOfErc20.mul(2));

        console.log("balanceOf", (await fellaz.connect(address2).balanceOf(address2.address)).toString(), priceOfErc20.toString())


        await expect(
            fellazLightStick
                .connect(address2)
                .mintWithERC20(ZERO_ADDRESS, fellaz.address, 2)).to.revertedWith("Invalid wallet address");

        await fellaz.connect(address2).approve(fellazLightStick.address, 0);
    });

    it("Should success mintWithERC20 2 Light Stick by direction", async () => {
        const [minter, target, address2, _] = await ethers.getSigners();
        const getMinterBalance = async () => await fellaz.connect(minter).balanceOf(minter.address);
        const getTargetBalance = async () => await fellaz.connect(target).balanceOf(target.address);
        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, target.address)
        await fellaz.connect(address2).approve(fellazLightStick.address, priceOfErc20.mul(2));

        console.log("balanceOf", formatEther((await fellaz.connect(address2).balanceOf(address2.address)).toString()), formatEther(priceOfErc20.toString()))
        const beforeMinterBalance = await getMinterBalance();
        const beforeTargetBalance = await getTargetBalance();

        await expect(
            fellazLightStick
                .connect(address2)
                .mintWithERC20(target.address, fellaz.address, 2)).to.emit(fellazLightStick, "Activate");

        await fellaz.connect(address2).approve(fellazLightStick.address, 0);
        console.log("owner", formatEther(beforeMinterBalance.toString()), formatEther((await getMinterBalance()).toString()));
        console.log("direction", formatEther(beforeTargetBalance.toString()), formatEther((await getTargetBalance()).toString()));

        await expect(await getMinterBalance()).to.above(beforeMinterBalance);
        await expect(await getTargetBalance()).to.above(beforeTargetBalance);
    });

    it("Should revert extendWithERC20, because insufficient approve", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();

        const myToken = await fellazLightStick.connect(address1).tokensOfOwner(address1.address);
        const priceOfErc20 = parseEther("0.1");
        await fellaz.connect(address1).approve(fellazLightStick.address, priceOfErc20);

        await expect(
            fellazLightStick
            .connect(address1)
            .extendWithERC20(myToken[0].toNumber(), fellaz.address, 1)
        ).to.revertedWith("insufficient approve");

    });

    it("Should success extend(ERC20)", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();

        const getMinterBalance = async () => await fellaz.connect(minter).balanceOf(minter.address);
        const getTargetBalance = async () => await fellaz.connect(target).balanceOf(target.address);

        const myToken = await fellazLightStick.connect(address1).tokensOfOwner(address1.address);
        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, target.address);
        await fellaz.connect(address1).approve(fellazLightStick.address, priceOfErc20);

        const beforeMinterBalance = await getMinterBalance();
        const beforeTargetBalance = await getTargetBalance();
        const beforeExpried = await fellazLightStick.expired(myToken[0]);

        await expect(
            fellazLightStick
            .connect(address1)
            .extendWithERC20(myToken[0].toNumber(), fellaz.address, 1)
        ).to.emit(fellazLightStick, "Activate");

        await expect(await getMinterBalance()).to.above(beforeMinterBalance);
        await expect(await getTargetBalance()).to.above(beforeTargetBalance);
        await expect(await fellazLightStick.expired(myToken[0])).to.above(beforeExpried);

    });

    it("Should success 2times extend(ERC20)", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();

        const getMinterBalance = async () => await fellaz.connect(minter).balanceOf(minter.address);
        const getTargetBalance = async () => await fellaz.connect(target).balanceOf(target.address);

        const myToken = await fellazLightStick.connect(address1).tokensOfOwner(address1.address);
        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, target.address);
        await fellaz.connect(address1).approve(fellazLightStick.address, priceOfErc20.mul(2));

        const beforeMinterBalance = await getMinterBalance();
        const beforeTargetBalance = await getTargetBalance();
        const beforeExpried = await fellazLightStick.expired(myToken[0]);

        await expect(
            fellazLightStick
            .connect(address1)
            .extendWithERC20(myToken[0].toNumber(), fellaz.address, 2)
        ).to.emit(fellazLightStick, "Activate");

        await expect(await getMinterBalance()).to.above(beforeMinterBalance);
        await expect(await getTargetBalance()).to.above(beforeTargetBalance);
        await expect(await fellazLightStick.expired(myToken[0])).to.above(beforeExpried);

    });

    it("Should success extend(ERC20) differnce price", async () => {
        const [minter, target, address2, _] = await ethers.getSigners();

        const getMinterBalance = async () => await fellaz.connect(minter).balanceOf(minter.address);
        const getTargetBalance = async () => await fellaz.connect(target).balanceOf(target.address);

        const myToken = await fellazLightStick.connect(address2).tokensOfOwner(address2.address);
        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, target.address);
        await fellaz.connect(address2).approve(fellazLightStick.address, priceOfErc20);

        const beforeMinterBalance = await getMinterBalance();
        const beforeTargetBalance = await getTargetBalance();
        const beforeExpried = await fellazLightStick.expired(myToken[0]);

        await expect(
            fellazLightStick
            .connect(address2)
            .extendWithERC20(myToken[0].toNumber(), fellaz.address, 1)
        ).to.emit(fellazLightStick, "Activate");

        await expect(await getMinterBalance()).to.above(beforeMinterBalance);
        await expect(await getTargetBalance()).to.above(beforeTargetBalance);
        await expect(await fellazLightStick.expired(myToken[0])).to.above(beforeExpried);

    });

    it("Should revert mint(ETH), becaouse SafeMath: subtraction overflow", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();
        await fellazLightStick.setFee(ZERO_ADDRESS, _.address, parseEther("1.2"));
        const priceOfEth = await fellazLightStick.getPriceETH(ZERO_ADDRESS)

        await expect(
            fellazLightStick
                .connect(address1)
                .mint(_.address, 1, {
                    from: address1.address,
                    value: priceOfEth.mul(3)
                })).to.revertedWith("SafeMath: subtraction overflow");
        
    });

    it("Should revert mintWithERC20, becaouse SafeMath: subtraction overflow", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();
        await fellazLightStick.setFee(fellaz.address, _.address, parseEther("1.2"));
        const priceOfErc20 = await fellazLightStick.getPriceERC20(fellaz.address, _.address)
        await fellaz.connect(address1).approve(fellazLightStick.address, priceOfErc20.mul(2));

        await expect(
            fellazLightStick
                .connect(address1)
                .mintWithERC20(_.address, fellaz.address, 1)).to.revertedWith("SafeMath: subtraction overflow");
        
    });

    it("Should revert setBaseURI, because Is not owner", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();
        await expect(fellazLightStick.connect(address1).setBaseURI("https://aaa.bb")).to.revertedWith("Ownable: caller is not the owner");
    });

    it("Should success setBaseURI And uri", async () => {
        const [minter, address1, target, _] = await ethers.getSigners();

        const uri = "https://aaa.bb";
        
        await expect(await (await fellazLightStick.connect(minter).setBaseURI(uri))).to.emit(fellazLightStick, "SetBaseURI");
        await expect(await fellazLightStick.uri()).to.equal(uri);
    });
});
