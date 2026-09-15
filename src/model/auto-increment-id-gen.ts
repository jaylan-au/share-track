export class AutoIncrementIdGen {
    private currentId: number;

    constructor(initialId = 0) {
        this.currentId = initialId;
    }

    public setNextId(nextId: number): void {
        this.currentId = Math.max(0, Math.floor(nextId) - 1);
    }

    public getId(): number {
        return ++this.currentId;
    }
}