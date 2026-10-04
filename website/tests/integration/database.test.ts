import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("PostgreSQL transaction and row locking", () => {
  const pool = new Pool({ connectionString, max: 4 });
  const tableName = `foundation_lock_${randomUUID().replaceAll("-", "")}`;

  beforeAll(async () => {
    await pool.query(`create table ${tableName} (id integer primary key, value integer not null)`);
    await pool.query(`insert into ${tableName} (id, value) values (1, 0)`);
  });

  afterAll(async () => {
    await pool.query(`drop table if exists ${tableName}`);
    await pool.end();
  });

  it("serializes conflicting updates behind SELECT FOR UPDATE", async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query("begin");
      await first.query(`select * from ${tableName} where id = 1 for update`);
      await second.query("begin");
      await second.query("set local lock_timeout = '100ms'");
      await expect(
        second.query(`update ${tableName} set value = 1 where id = 1`),
      ).rejects.toMatchObject({
        code: "55P03",
      });
      await second.query("rollback");
      await first.query("commit");
      await expect(
        pool.query(`update ${tableName} set value = 2 where id = 1`),
      ).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      first.release();
      second.release();
    }
  });
});
