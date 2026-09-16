/**
 * English message catalog — the source of truth and the full key set.
 *
 * Every user-facing string (tier 2: shown in the UI, keyed in code) lives here.
 * Other languages are layered on top at runtime: repo `messages/<locale>.ts` then
 * `translations` DB rows edited from the /languages admin screen. Any key missing
 * downstream falls back to this file.
 *
 * Keep this file the union of all keys. Do not delete a key that code still reads.
 */
const en = {
  common: {
    save: 'Save',
    create: 'Create',
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    close: 'Close',
    saving: 'Saving…',
    saveChanges: 'Save changes',
    remove: 'Remove',
    rename: 'Rename',
  },

  nav: {
    section: {
      groups: 'Groups',
      divorce: 'Divorce',
      admin: 'Admin',
    },
    dashboard: 'Dashboard',
    transactions: 'Credit Account',
    recurring: 'Recurrings',
    budgets: 'Budget',
    goals: 'Goals',
    simulations: 'Simulations',
    groups: 'Groups',
    reimbursements: 'Reimbursements',
    taxStatus: 'Tax Status',
    accounts: 'Accounts',
    merchants: 'Merchants',
    categories: 'Categories',
    languages: 'Languages',
    settings: 'Settings',
  },

  dialogs: {
    alertTitle: 'Something went wrong',
    confirmTitle: 'Are you sure?',
    confirmLabel: 'Confirm',
    chooseTitle: 'Choose an option',
    promptTitle: 'Enter a value',
    ok: 'OK',
    cancel: 'Cancel',
  },

  errors: {
    generic: 'An error occurred',
    invalidInput: 'Invalid input',
    missingId: 'Missing id',
    nameRequired: 'Name is required',
    dateFormat: 'Expected a YYYY-MM-DD date',
    monthFormat: 'Expected a YYYY-MM month',
    amountNumber: 'Amount must be a number',
    amountPositive: 'Amount must be positive',
    amountNonNegative: 'Amount cannot be negative',
    percentNumber: 'Percent must be a number',
  },

  fallbacks: {
    uncategorized: 'Uncategorized',
    other: 'Other',
    otherNamed: 'Other {name}',
    creditAccount: 'Credit account',
    noMerchant: 'No merchant',
    noCategory: 'No category',
    savingAccount: 'Saving account',
    sharedExpense: 'Shared expense',
    sharedRevenue: 'Shared revenue',
  },

  modules: {
    core: {
      label: 'Core',
      description: 'Dashboard, Movements, Merchants, Categories — always on',
    },
    recurring: {
      label: 'Recurrings',
      description: 'Bills and income that repeat on a schedule',
    },
    budgets: {
      label: 'Budget',
      description: 'Monthly spending limits per category',
    },
    objectives: {
      label: 'Goals',
      description: 'Savings goals with progress rings',
    },
    simulations: {
      label: 'Simulations',
      description: 'What-if scenarios for future income and expenses',
    },
    groups: {
      label: 'Groups',
      description: 'Shared expenses split with other people',
    },
    divorce: {
      label: 'Divorce',
      description: 'Reimbursements and tax status',
    },
  },

  reimbursements: {
    kicker: 'Reimbursements',
    title: 'Track reimbursements.',
    filterAll: 'All',
    filterOpen: 'Open',
    filterSettled: 'Closed',
    clearedOnly: 'Cleared only',
    showAll: 'All',
    empty: 'No reimbursable expenses.',
    ratesToggle: 'Reimbursement rates',
    noExpenses: 'No expenses.',
    noClearedExpenses: 'No cleared expenses.',
    claimDateLabel: 'Claim date',
    dateInputPlaceholder: 'DD/MM/YYYY',
    notCleared: 'Not cleared',
    customAmount: 'Custom amount',
    editAmount: 'Edit amount',
    enterClaimDatePrompt: 'Enter a claim date to track the reimbursement',
    reopen: 'Reopen',
    settleAction: 'Close',
    close: 'Close',
    add: 'Add',
    detachAll: 'Detach all',
    incomeReceivedAfter: 'Reimbursements received after {date}',
    noIncomeAvailable: 'No reimbursement available.',
    linked: 'Linked',
    linkSelection: 'Link {count, plural, one {# selection} other {# selections}}',
    reimbursableToggle: 'Reimbursable',
    reimbursableToggleHint: 'To be recorded in the Reimbursements view',
    status: {
      closed: 'Closed',
      awaitingPayment: 'Awaiting payment',
      noPayment1: 'No payment — 1 month overdue',
      noPayment2: 'No payment — over 1 month overdue',
      paidOnTime: 'Paid on time',
      paidLateUnder1: 'Paid late (< 1 month)',
      paidLateOver1: 'Paid late (> 1 month)',
      closedPrefix: 'Closed — {label}',
    },
    overrideModal: {
      title: 'Edit reimbursable amount',
      rate: 'Rate: {rate}%',
      amount: 'Amount ({symbol})',
      comment: 'Comment (optional)',
      commentPlaceholder: 'Reason for the change…',
      reset: 'Reset to calculation',
    },
    rates: {
      count: '{count, plural, one {# rate configured} other {# rates configured}}',
      new: 'New rate',
      percent: 'Rate (%)',
      percentPlaceholder: 'e.g. 75',
      effectiveFrom: 'Effective from',
      current: 'Current rate',
      historical: 'Historical rate',
      since: 'from {date}',
    },
  },

  taxStatus: {
    kicker: 'Tax',
    title: 'Yearly Status',
    intro: 'Allocate reimbursements and child support to Audrey or Lucie for tax declaration.',
    unallocated: 'Unallocated',
    empty: 'No reimbursements or child support found for {year}.',
    reimbursementsSection: 'Reimbursements',
    pensionsSection: 'Child support',
    expensesSection: 'Reimbursable expenses',
    colDate: 'Date',
    colAmount: 'Amount',
    colDescription: 'Description',
    colAllocation: 'Allocation',
    colFor: 'For',
    reimbShort: 'Reimb.',
    pensionShort: 'Support',
  },

  languagesAdmin: {
    kicker: 'Admin',
    title: 'Languages',
    intro: 'English is the source language and always available. Add other languages here and translate the interface; anything left blank falls back to English.',
    listHeading: 'Languages',
    englishRow: 'English — default',
    addHeading: 'Add a language',
    codeField: 'Language',
    labelField: 'Display name',
    addButton: 'Add',
    deleteConfirm: 'Delete {label}? Its translations will be removed.',
    deleteLabel: 'Delete',
    noLanguages: 'No languages yet.',
    editorHeading: 'Translations',
    editorPrompt: 'Select a language to edit its translations.',
    searchPlaceholder: 'Search keys…',
    sourceColumn: 'English',
    translationColumn: 'Translation',
    translatedCount: '{done} of {total} translated',
    noMatches: 'No keys match your search.',
  },

  dashboard: {
    range: {
      ytd: 'YTD',
      '1m': '1M',
      '6m': '6M',
      '1y': '1Y',
      '2y': '2Y',
      '5y': '5Y',
    },
    rangeLong: {
      ytd: 'Year to date',
      '1m': 'Last month',
      '6m': 'Last 6 months',
      '1y': 'Last year',
      '2y': 'Last 2 years',
      '5y': 'Last 5 years',
    },
  },

  enums: {
    movementKind: {
      expense: 'Expense',
      income: 'Income',
      saving: 'Saving',
      interest: 'Interest',
    },
    movementKindPlural: {
      all: 'All',
      expense: 'Expenses',
      income: 'Income',
      saving: 'Savings',
      interest: 'Interest',
    },
    paymentMethod: {
      card: 'Card',
      transfer: 'Transfer',
      cash: 'Cash',
      check: 'Check',
      debit: 'Direct debit',
      paypal: 'PayPal',
    },
    frequency: {
      monthly: 'Monthly',
      yearly: 'Yearly',
    },
    budgetLineType: {
      adhoc: 'Ad-hoc',
      recurring: 'Recurring',
    },
    simulationOrigin: {
      manual: 'Manual',
      recurring: 'Recurring',
      average: 'Average',
      rollup: 'Rollup',
    },
    simulationPriority: {
      must: 'Must',
      should: 'Should',
      nice: 'Nice',
    },
    amountSource: {
      manual: 'MANUAL',
      calc: 'CALC',
    },
    recurringInstanceStatus: {
      expected: 'Expected',
      linked: 'Linked',
      not_applicable: 'Not applicable',
    },
    reimbursementExpenseStatus: {
      manually_settled: 'Manually settled',
      reimbursed: 'Reimbursed',
      partially_reimbursed: 'Partially reimbursed',
      no_rate: 'No rate',
      not_reimbursed: 'Not reimbursed',
    },
    reimbursementIncomeStatus: {
      fully_allocated: 'Fully allocated',
      partially_allocated: 'Partially allocated',
      claim_linked: 'Claim linked',
      unmapped: 'Unmapped',
    },
    taxAllocation: {
      audrey: 'Audrey',
      lucie: 'Lucie',
      split: '50/50',
    },
  },
} as const

export default en
