#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0c0734babd6eeb868fee1f281ca96963022475611560e9f170f465daa35f8599/contract';
import endContract from '../../snapshots/0c0734babd6eeb868fee1f281ca96963022475611560e9f170f465daa35f8599/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6c1272ffeba3f7afdfd28b3c94a0fa1934e138008d9af4c3613c9e87d8cf9cff/contract';
import startContract from '../../snapshots/6c1272ffeba3f7afdfd28b3c94a0fa1934e138008d9af4c3613c9e87d8cf9cff/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'Voucher' }),
      this.dropTable({ schema: 'public', table: 'VoucherRedemption' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
