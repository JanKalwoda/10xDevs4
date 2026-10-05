export interface DrillRunIdentityState {
    begin(): number;
    isCurrent(identity: number): boolean;
    retire(identity: number): boolean;
    complete(identity: number, onComplete: () => void): boolean;
}

export function createDrillRunIdentityState(): DrillRunIdentityState {
    let nextIdentity = 0;
    let currentIdentity: number | null = null;

    function isCurrent(identity: number): boolean {
        return currentIdentity === identity;
    }

    return {
        begin() {
            currentIdentity = ++nextIdentity;
            return currentIdentity;
        },
        isCurrent,
        retire(identity) {
            if (!isCurrent(identity)) return false;
            currentIdentity = null;
            return true;
        },
        complete(identity, onComplete) {
            if (!isCurrent(identity)) return false;
            currentIdentity = null;
            onComplete();
            return true;
        },
    };
}
