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
    preserve: boolean = false;
}


export class ShareLot extends ShareTrackDataObject  {
    id!: EntityId;
    code!: string;
    holdingEntity!: string;
    unitCount!: number;
    unitOriginalCost!: number;
    unitCurrentCost!: number;
    isOpen?: boolean = true;
    buyTransactionId!: EntityId;
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
    finalized: boolean = false;
    fees?: number = 0;
    recordTimestamp!: number;
    transactionTimestamp!: number;
    documentRef!: string;
    notes?: string = '';
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
 