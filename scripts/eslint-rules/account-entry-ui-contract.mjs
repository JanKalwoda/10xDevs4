import uiContract from "./timer-ui-contract.mjs";

export default {
    ...uiContract,
    meta: {
        ...uiContract.meta,
        docs: { description: "Keep account-entry UI on semantic color tokens and the system dimension scale" },
        messages: { contract: "Account-entry UI must use semantic tokens and system dimensions; found {{value}}." },
    },
};
