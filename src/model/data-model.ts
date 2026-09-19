export class ShareTrackDataObject {
    constructor(init?: Partial<ShareSecurity>) {
        Object.assign(this, init);
    }
}

export type EntityId = string | number;

export class ShareSecurity extends ShareTrackDataObject {
    id!: EntityId;
    code!: string;
    market!: string;
    lastPrice?: number;
    lastPriceTimeStamp?: number;
}

export class ShareSecurityPriceRecord extends ShareTrackDataObject  {
    id!: EntityId;
    code!: string;
    price!: number;
    timeStamp!: number;
    preserve!: boolean;

    // note: defaults are applied here (not via field initializers) so they don't clobber
    // values already assigned from `init` by the base constructor's Object.assign call.
    constructor(init?: Partial<ShareSecurityPriceRecord>) {
        super(init);
        this.preserve ??= false;
    }
}


export class ShareLot extends ShareTrackDataObject  {
    id!: EntityId;
    code!: string;
    holdingEntity!: string;
    unitCount!: number;
    unitOriginalCost!: number;
    unitCurrentCost!: number;
    isOpen?: boolean;
    buyTransactionId!: EntityId;

    constructor(init?: Partial<ShareLot>) {
        super(init);
        this.isOpen ??= true;
    }
}

export class ShareTransaction extends ShareTrackDataObject  {
    id!: EntityId;
    code!: string;
    type!: string;
    holdingEntity!: string;
    unitCount!: number;
    unitPrice!: number;
    unitCostDelta?: number;
    unitCountDelta?: number;
    dividendPerShare?: number;
    numberOfSecurities?: number;
    totalFrankedAmount?: number;
    totalUnfrankedAmount?: number;
    totalFrankingCredit?: number;
    originalCurrency?: string;
    cutOffDate?: number;
    finalized!: boolean;
    fees?: number;
    recordTimestamp!: number;
    transactionTimestamp!: number;
    documentRef!: string;
    notes?: string;

    constructor(init?: Partial<ShareTransaction>) {
        super(init);
        this.finalized ??= false;
        this.fees ??= 0;
        this.notes ??= '';
    }
}   
   

export class ShareLotTransaction extends ShareTrackDataObject  {
    id!: EntityId;
    shareTransaction!: EntityId;
    shareLot!: EntityId;
    unitCount!: number;
    unitCostDelta?: number;
}

export class HoldingEntity  extends ShareTrackDataObject {
    id!: EntityId;
    name!: string;
    market!: string;
} 
 