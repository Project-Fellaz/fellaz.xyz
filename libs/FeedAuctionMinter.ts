import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, Bytes } from "ethers";
import { FellazFeed } from "../typechain";

const SIGNING_DOMAIN_NAME = "AuctionVoucher"
const SIGNING_DOMAIN_VERSION = "1"

export enum Platform {
    Ethereum = 1,
    Polygon = 137,
    Klaytn = 8217,
}

export default class FeedAuctionMinter {
    private _domain: any;

    constructor(private readonly contract: FellazFeed) {
    }

    createTokenId(address: string, playform: number, index: number) {
        return "0x"+Buffer.concat([Buffer.from(address.replace("0x", ""), "hex"), this.rightAllocBuffer(playform.valueOf(), 7)!, this.rightAllocBuffer(index, 5)!]).toString("hex")
    }

    rightAllocBuffer(number: number, size: number): Buffer | undefined {
        const buf = Buffer.alloc(size)
        const temp = Buffer.from(BigNumber.from(number).toHexString().replace("0x", ""), 'hex')
        if (buf.length - temp.length > 0) {
            temp.copy(buf, buf.length - temp.length)
            return buf
        } else {
            return undefined;
        }
    }
    //here is the main createAuction method that creates a signed Auction voucher.
    async createAuctionVoucher(signer: SignerWithAddress, index: number, playform: Platform, payments: string, price: BigNumberish,expired:BigNumberish) {
        const voucher = { 
            tokenId: this.createTokenId(signer.address, playform, index), 
            payments, 
            price, 
            expired
        }

        const domain = await this._signingDomain()
        const types = {
            AuctionVoucher: [
                { name: "tokenId", type: "uint256" },
                { name: "payments", type: "address" },
                { name: "price", type: "uint256" },
                { name:  "expired", type:  "uint256"}
            ]
        }
        const signature = await signer._signTypedData(domain, types, voucher)
        return {
            ...voucher,
            signature,
        }
    }

    async _signingDomain() {
        if (this._domain != null) {
            return this._domain
        }
        const chainId = await this.contract.getChainID()
        this._domain = {
            name: SIGNING_DOMAIN_NAME,
            version: SIGNING_DOMAIN_VERSION,
            verifyingContract: this.contract.address,
            chainId,
        }
        return this._domain
    }
}