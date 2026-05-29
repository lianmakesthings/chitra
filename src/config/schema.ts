import { z } from 'zod';

const ALIAS = z.string().regex(/^[a-z][a-z0-9_-]*$/);
const FLAG_COLOR = z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);

const AccountSchema = z.strictObject({
  budget: ALIAS,
  ynab_name: z.string().min(1),
});

const FlagSchema = z.strictObject({
  color: FLAG_COLOR,
  name: z.string().min(1),
});

export const ConfigSchema = z
  .strictObject({
    budgets: z.record(ALIAS, z.uuid()),
    accounts: z.record(ALIAS, AccountSchema),
    flags: z.record(ALIAS, FlagSchema),
  })
  .refine((cfg) => 'default' in cfg.budgets, {
    message: 'budgets must include a "default" entry',
    path: ['budgets', 'default'],
  })
  .superRefine((cfg, ctx) => {
    for (const [alias, acct] of Object.entries(cfg.accounts)) {
      if (!(acct.budget in cfg.budgets)) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', alias, 'budget'],
          message: `Account "${alias}" references unknown budget "${acct.budget}"`,
        });
      }
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
