import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config/parse.js';
import { ZodError } from 'zod';
import type { Config } from '../src/config/schema.js';

describe('Config parser', () => {
  const expectIssue = (input: string | null, matcher: Record<string, unknown>) => {
    let caught: unknown;
    try { parseConfig(input); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ZodError);
    expect((caught as ZodError).issues).toEqual(
      expect.arrayContaining([expect.objectContaining(matcher)]),
    );
  }

  it('returns null for null input', () => {
    expect(parseConfig(null)).toBeNull();
  });

  it('rejects input that parses to a non-object', () => {
    expect(() => parseConfig('hello')).toThrow(ZodError);
  });

  it('rejects empty string input', () => {
    expect(() => parseConfig('')).toThrow(ZodError);
  });

  describe('checking valid config', () => {
    it('parses a minimal valid config (default budget only)', () => {
      const budgetId = '00000000-0000-4000-8000-000000000000';
      const yaml = ['budgets:', `  default: ${budgetId}`, 'accounts: {}', 'flags: {}', ''].join(
        '\n',
      );

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
  });

  describe('checking missing props', () => {
    it('rejects a config without a default budget', () => {
      const yamlNoDefault = [
        'budgets:',
        '  business: 00000000-0000-4000-8000-000000000001',
        'accounts: {}',
        'flags: {}',
        '',
      ].join('\n');

      expectIssue(yamlNoDefault, { path: ['budgets', 'default'] });
    });

    it('rejects a config missing the budgets section', () => {
      const yamlNoBudgets = ['accounts: {}', 'flags: {}', ''].join('\n');

      expectIssue(yamlNoBudgets, { path: ['budgets'] });
    });

    it('rejects a config missing the accounts section', () => {
      const yamlNoAccounts = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'flags: {}',
        '',
      ].join('\n');

      expectIssue(yamlNoAccounts, { path: ['accounts'] });
    });

    it('rejects a config missing the flags section', () => {
      const yamlNoFlags = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts: {}',
        '',
      ].join('\n');

      expectIssue(yamlNoFlags, { path: ['flags'] })
    });
  });

  // Referential integrity
  it('rejects when account.budget references an unknown budget alias', () => {
    const yamlBadRef = [
      'budgets:',
      '  default: 00000000-0000-4000-8000-000000000001',
      'accounts:',
      '  checking:',
      '    budget: business', // 'business' is syntactically valid but not in budgets
      '    ynab_name: Checking',
      'flags: {}',
      '',
    ].join('\n');

    expectIssue(yamlBadRef, { path: ['accounts', 'checking', 'budget'] });
  });

  // Strict mode
  describe('checking in strict mode', () => {
    it('rejects unknown top-level keys', () => {
      const extraKey = 'extras';
      const yamlUnknownTopLevel = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts: {}',
        'flags: {}',
        `${extraKey}: should-not-be-here`,
        '',
      ].join('\n');

      expectIssue(yamlUnknownTopLevel, {
        code: 'unrecognized_keys',
        path: [],
        keys: [extraKey],
      })
    });

    it('rejects unknown keys inside an account entry', () => {
      const extraAccountField = 'nickname';
      const yamlUnknownAccountField = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts:',
        '  checking:',
        '    budget: default',
        '    ynab_name: Checking',
        `    ${extraAccountField}: chk`,
        'flags: {}',
        '',
      ].join('\n');

      expectIssue(yamlUnknownAccountField, {
        code: 'unrecognized_keys',
        path: ['accounts', 'checking'],
        keys: [extraAccountField],
      })
    });

    it('rejects unknown keys inside a flag entry', () => {
      const extraFlagField = 'icon';
      const yamlUnknownFlagField = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts: {}',
        'flags:',
        '  shared:',
        '    color: red',
        '    name: Shared',
        `    ${extraFlagField}: star`,
        '',
      ].join('\n');

      expectIssue(yamlUnknownFlagField, {
        code: 'unrecognized_keys',
        path: ['flags', 'shared'],
        keys: [extraFlagField],
      })
    });
  });

  // Field validation
  describe('validating fields', () => {
    it('rejects malformed budget UUIDs', () => {
      const yamlBadUuid = [
        'budgets:',
        '  default: not-a-uuid',
        'accounts: {}',
        'flags: {}',
        '',
      ].join('\n');

      expectIssue(yamlBadUuid, {
        code: 'invalid_format',
        path: ['budgets', 'default'],
      })
    });

    it('rejects empty account ynab_name', () => {
      const yamlEmptyAccountName = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts:',
        '  checking:',
        '    budget: default',
        '    ynab_name: ""',
        'flags: {}',
        '',
      ].join('\n');

      expectIssue(yamlEmptyAccountName, {
        code: 'too_small',
        path: ['accounts', 'checking', 'ynab_name'],
      });
    });

    it('rejects unknown flag colors', () => {
      const yamlBadColor = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts: {}',
        'flags:',
        '  shared:',
        '    color: magenta',
        '    name: Shared',
        '',
      ].join('\n');

      expectIssue(yamlBadColor, {
        code: 'invalid_value',
        path: ['flags', 'shared', 'color'],
      })
    });

    it('rejects budget aliases that violate the naming regex', () => {
      const yamlBadBudgetAlias = [
        'budgets:',
        '  Default: 00000000-0000-4000-8000-000000000001', // capitalized — fails [a-z]... regex
        'accounts: {}',
        'flags: {}',
        '',
      ].join('\n');

      expectIssue(yamlBadBudgetAlias, {
        code: 'invalid_key',
        path: ['budgets', 'Default'],
      })
    });
    it('rejects account aliases that violate the naming regex', () => {
      const yamlBadAccountAlias = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts:',
        '  BadAccount:', // capitalized
        '    budget: default',
        '    ynab_name: Checking',
        'flags: {}',
        '',
      ].join('\n');

      expectIssue(yamlBadAccountAlias, {
        code: 'invalid_key',
        path: ['accounts', 'BadAccount'],
      })
    });

    it('rejects flag aliases that violate the naming regex', () => {
      const yamlBadFlagAlias = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts: {}',
        'flags:',
        '  Shared:', // capitalized
        '    color: red',
        '    name: Shared',
        '',
      ].join('\n');

      expectIssue(yamlBadFlagAlias, {
        code: 'invalid_key',
        path: ['flags', 'Shared'],
      });
    });
  });
});

describe('Config serializer', () => {
  it('is defined', () => {
    expect(typeof serializeConfig).toBe('function');
  });

  it('round-trips a minimal config: parseConfig(serializeConfig(x)) deep-equals x', () => {
    const minimalConfig: Config = {
      budgets: { default: '00000000-0000-4000-8000-000000000000' },
      accounts: {},
      flags: {},
    };

    const config = parseConfig(serializeConfig(minimalConfig));
    expect(config).toEqual(minimalConfig);
  });

  it('round-trips a full config with multiple budgets, accounts, and flags', () => {
    const fullConfig: Config = {
      budgets: {
        default: '00000000-0000-4000-8000-000000000001',
        business: '00000000-0000-4000-8000-000000000002',
      },
      accounts: {
        checking: { budget: 'default', ynab_name: 'Checking' },
        savings: { budget: 'default', ynab_name: 'Savings' },
        business_checking: { budget: 'business', ynab_name: 'Checking' },
      },
      flags: {
        shared: { color: 'red', name: 'Shared' },
        reimbursable: { color: 'orange', name: 'Reimbursable' },
      },
    };

    const config = parseConfig(serializeConfig(fullConfig));
    expect(config).toEqual(fullConfig);
  });

  it('round-trips special characters in ynab_name', () => {
    const config: Config = {
      budgets: { default: '00000000-0000-4000-8000-000000000001' },
      accounts: {
        checking: { budget: 'default', ynab_name: 'Joint: Café & 日本語' },
      },
      flags: {},
    };
    expect(parseConfig(serializeConfig(config))).toEqual(config);
  });

  it('preserves field order in a way that survives a parse/serialize cycle', () => {
    const orderedConfig: Config = {
      budgets: {
        default: '00000000-0000-4000-8000-000000000001',
        business: '00000000-0000-4000-8000-000000000002',
      },
      accounts: {
        checking: { budget: 'default', ynab_name: 'Checking' },
        savings: { budget: 'default', ynab_name: 'Savings' },
        business_checking: { budget: 'business', ynab_name: 'Checking' },
      },
      flags: {
        shared: { color: 'red', name: 'Shared' },
        reimbursable: { color: 'orange', name: 'Reimbursable' },
      },
    };

    const round = parseConfig(serializeConfig(orderedConfig))!;
    expect(Object.keys(round.budgets)).toEqual(['default', 'business']);
    expect(Object.keys(round.accounts)).toEqual(['checking', 'savings', 'business_checking']);
    expect(Object.keys(round.flags)).toEqual(['shared', 'reimbursable']);
  });

  describe('rejects invalid configs', () => {
    it('without a default budget', () => {
      const noDefault: Config = {
        budgets: { business: '00000000-0000-4000-8000-000000000001' },
        accounts: {},
        flags: {},
      };
      expect(() => serializeConfig(noDefault)).toThrow(ZodError);
    });

    it('when account.budget references an unknown budget alias', () => {
      const badRef: Config = {
        budgets: { default: '00000000-0000-4000-8000-000000000001' },
        accounts: {
          checking: { budget: 'nonexistent', ynab_name: 'Checking' },
        },
        flags: {},
      };
      expect(() => serializeConfig(badRef)).toThrow(ZodError);
    });
  });
});
