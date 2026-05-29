import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config/parse.js';

describe('parseConfig', () => {
  it('returns null for null input', () => {
    expect(parseConfig(null)).toBeNull();
  });

  it('parses a minimal valid config (default budget only)', () => {
    const budgetId = '00000000-0000-4000-8000-000000000000';
    const yaml = ['budgets:', `  default: ${budgetId}`, 'accounts: {}', 'flags: {}', ''].join('\n');

    expect(parseConfig(yaml)).toEqual({
      budgets: { default: budgetId },
      accounts: {},
      flags: {},
    });
  });

  it('parses a config with multiple budgets, accounts, and flags', () => {
    const defaultBudgetId = '00000000-0000-4000-8000-000000000001';
    const bizBudgetId = '00000000-0000-4000-8000-000000000002';
    const checkingAccount = 'Checking';
    const savingsAccount = 'Savings';
    const sharedFlag = 'Shared';
    const reimburseFlag = 'Reimbursable';

    const yaml = [
      'budgets:',
      `  default: ${defaultBudgetId}`,
      `  business: ${bizBudgetId}`,
      'accounts:',
      '  checking:',
      '    budget: default',
      `    ynab_name: ${checkingAccount}`,
      '  savings:',
      '    budget: default',
      `    ynab_name: ${savingsAccount}`,
      '  business_checking:',
      '    budget: business',
      `    ynab_name: ${checkingAccount}`,
      'flags:',
      '  shared:',
      '    color: red',
      `    name: ${sharedFlag}`,
      '  reimbursable:',
      '    color: orange',
      `    name: ${reimburseFlag}`,
      '',
    ].join('\n');

    expect(parseConfig(yaml)).toEqual({
      budgets: {
        default: defaultBudgetId,
        business: bizBudgetId,
      },
      accounts: {
        checking: { budget: 'default', ynab_name: checkingAccount },
        savings: { budget: 'default', ynab_name: savingsAccount },
        business_checking: { budget: 'business', ynab_name: checkingAccount },
      },
      flags: {
        shared: { color: 'red', name: sharedFlag },
        reimbursable: { color: 'orange', name: reimburseFlag },
      },
    });
  });

  // Required-field rules
  it.todo('rejects a config without a default budget');
  it.todo('rejects a config missing the budgets section');
  it.todo('rejects a config missing the accounts section');
  it.todo('rejects a config missing the flags section');

  // Referential integrity
  it.todo('rejects when account.budget references an unknown budget alias');

  // Strict mode
  it.todo('rejects unknown top-level keys');
  it.todo('rejects unknown keys inside an account entry');
  it.todo('rejects unknown keys inside a flag entry');

  // Field validation
  it.todo('rejects malformed budget UUIDs');
  it.todo('rejects unknown flag colors');
  it.todo('rejects budget aliases that violate the naming regex');
  it.todo('rejects account aliases that violate the naming regex');
  it.todo('rejects flag aliases that violate the naming regex');

  // Error quality
  it.todo('error messages include the offending field path');
});

describe('serializeConfig', () => {
  it('is defined', () => {
    expect(typeof serializeConfig).toBe('function');
  });

  it.todo('round-trips a minimal config: parseConfig(serializeConfig(x)) deep-equals x');
  it.todo('round-trips a full config with multiple budgets, accounts, and flags');
  it.todo('preserves field order in a way that survives a parse/serialize cycle');
});
