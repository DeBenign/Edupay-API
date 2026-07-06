const normalizeVirtualAccount = (response) => {

    const va = response.data;

    return {

        accountNumber:
            va.bankAccountNumber,

        accountName:
            va.bankAccountName,

        bankName:
            va.bankName,

        bankCode:
            va.bankCode || null,

        accountRef:
            va.accountRef,

        accountHolderId:
            va.accountHolderId,

        createdAt:
            va.createdAt,

    };

};

module.exports = {
    normalizeVirtualAccount,
};