// src/services/nomba.mapper.js

const normalizeVirtualAccount = (va) => ({
    accountNumber: va.bankAccountNumber,
    accountName: va.bankAccountName,
    bankName: va.bankName,
    bankCode: va.bankCode || null,

    accountRef: va.accountRef,
    accountHolderId: va.accountHolderId,

    provisionedAt: new Date(va.createdAt),
});

module.exports = {
    normalizeVirtualAccount,
};