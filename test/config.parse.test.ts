import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config/parse.js';
import { ZodError } from 'zod';

describe('Config parser', () => {
  it('returns null for null input', () => {
    expect(parseConfig(null)).toBeNull();
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


      expect(() => parseConfig(yamlNoDefault)).toThrow(ZodError);
      try { parseConfig(yamlNoDefault); }
      catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: ['budgets', 'default'] }),
          ]),
        );
      }
    });

    it('rejects a config missing the budgets section', () => {
      const yamlNoBudgets = ['accounts: {}', 'flags: {}', ''].join('\n');

      expect(() => parseConfig(yamlNoBudgets)).toThrow(ZodError);
      try { parseConfig(yamlNoBudgets); }
      catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: ['budgets'] }),
          ]),
        );
      }
    });

    it('rejects a config missing the accounts section', () => {
      const yamlNoAccounts = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'flags: {}',
        '',
      ].join('\n');

      expect(() => parseConfig(yamlNoAccounts)).toThrow(ZodError);
      try { parseConfig(yamlNoAccounts); }
      catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: ['accounts'] }),
          ]),
        );
      }
    });

    it('rejects a config missing the flags section', () => {
      const yamlNoFlags = [
        'budgets:',
        '  default: 00000000-0000-4000-8000-000000000001',
        'accounts: {}',
        '',
      ].join('\n');

      expect(() => parseConfig(yamlNoFlags)).toThrow(ZodError);
      try { parseConfig(yamlNoFlags); }
      catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: ['flags'] }),
          ]),
        );
      }
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

    expect(() => parseConfig(yamlBadRef)).toThrow(ZodError);
    try {
      parseConfig(yamlBadRef);
    } catch (err) {
      expect((err as ZodError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['accounts', 'checking', 'budget'] }),
        ]),
      );
    }
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

      expect(() => parseConfig(yamlUnknownTopLevel)).toThrow(ZodError);
      try {
        parseConfig(yamlUnknownTopLevel);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'unrecognized_keys',
              path: [],
              keys: [extraKey],
            }),
          ]),
        );
      }
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

      expect(() => parseConfig(yamlUnknownAccountField)).toThrow(ZodError);
      try {
        parseConfig(yamlUnknownAccountField);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'unrecognized_keys',
              path: ['accounts', 'checking'],
              keys: [extraAccountField],
            }),
          ]),
        );
      }
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

      expect(() => parseConfig(yamlUnknownFlagField)).toThrow(ZodError);
      try {
        parseConfig(yamlUnknownFlagField);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'unrecognized_keys',
              path: ['flags', 'shared'],
              keys: [extraFlagField],
            }),
          ]),
        );
      }
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

      expect(() => parseConfig(yamlBadUuid)).toThrow(ZodError);
      try {
        parseConfig(yamlBadUuid);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'invalid_format',
              path: ['budgets', 'default'],
            }),
          ]),
        );
      }
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

      expect(() => parseConfig(yamlBadColor)).toThrow(ZodError);
      try {
        parseConfig(yamlBadColor);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'invalid_value',
              path: ['flags', 'shared', 'color'],
            }),
          ]),
        );
      }
    });

    it('rejects budget aliases that violate the naming regex', () => {
      const yamlBadBudgetAlias = [
        'budgets:',
        '  Default: 00000000-0000-4000-8000-000000000001', // capitalized — fails [a-z]... regex
        'accounts: {}',
        'flags: {}',
        '',
      ].join('\n');

      expect(() => parseConfig(yamlBadBudgetAlias)).toThrow(ZodError);
      try {
        parseConfig(yamlBadBudgetAlias);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'invalid_key',
              path: ['budgets', 'Default'],
            }),
          ]),
        );
      }
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

      expect(() => parseConfig(yamlBadAccountAlias)).toThrow(ZodError);
      try {
        parseConfig(yamlBadAccountAlias);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'invalid_key',
              path: ['accounts', 'BadAccount'],
            }),
          ]),
        );
      }
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

      expect(() => parseConfig(yamlBadFlagAlias)).toThrow(ZodError);
      try {
        parseConfig(yamlBadFlagAlias);
      } catch (err) {
        expect((err as ZodError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'invalid_key',
              path: ['flags', 'Shared'],
            }),
          ]),
        );
      }
    });
  });

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
