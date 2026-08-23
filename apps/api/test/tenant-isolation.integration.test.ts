import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import type {TenantContext} from '@mohammedsaas/types';
import {PrismaService} from '../src/infra/prisma/prisma.service.js';
import {AccountingService} from '../src/modules/accounting/accounting.service.js';
import {InventoryService} from '../src/modules/inventory/inventory.service.js';
import {SalesService} from '../src/modules/sales/sales.service.js';

const run=process.env.RUN_DB_TESTS==='1'?describe:describe.skip;
const protectedTables=['customers','products','sales_invoices','pos_transactions','warehouses','inventory_movements','journal_entries'] as const;
const quoteIdentifier=(value:string)=>`"${value.replaceAll('"','""')}"`;
const quoteLiteral=(value:string)=>`'${value.replaceAll("'","''")}'`;

type Fixture={
  context:TenantContext;
  customerId:string;
  productId:string;
  invoiceId:string;
  posTransactionId:string;
  warehouseId:string;
  inventoryMovementId:string;
  journalEntryId:string;
};

run('PostgreSQL tenant RLS',()=>{
  let prisma:PrismaService;
  let adminPool:Pool;
  let rlsPool:Pool|undefined;
  let roleName:string;
  let rolePassword:string;
  let tenantA:Fixture;
  let tenantB:Fixture;

  async function createFixture(label:'A'|'B'):Promise<Fixture>{
    const inventory=new InventoryService(prisma);
    const accounting=new AccountingService(prisma);
    const sales=new SalesService(prisma,inventory,accounting);
    const plan=await prisma.subscriptionPlan.upsert({where:{code:'RLS_TEST'},update:{},create:{code:'RLS_TEST',name:'RLS Test',monthlyPrice:'1.0000',currency:'SAR',entitlements:{}}});
    const user=await prisma.user.create({data:{authUserId:randomUUID(),email:`rls-${label.toLowerCase()}-${randomUUID()}@example.test`}});
    const tenant=await prisma.tenant.create({data:{slug:`rls-${label.toLowerCase()}-${randomUUID()}`,name:`Tenant ${label}`,country:'YE',baseCurrency:'SAR',timezone:'Asia/Aden',subscription:{create:{planId:plan.id,status:'ACTIVE'}}}});
    let context!:TenantContext;
    let customerId='';
    let productId='';
    let warehouseId='';

    await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      const branch=await tx.branch.create({data:{tenantId:tenant.id,name:'Main',code:'MAIN'}});
      const warehouse=await tx.warehouse.create({data:{tenantId:tenant.id,branchId:branch.id,name:'Main',code:'MAIN'}});
      warehouseId=warehouse.id;
      const product=await tx.product.create({data:{tenantId:tenant.id,sku:`RLS-${label}-${randomUUID()}`,name:`Product ${label}`,costPrice:'10.0000',sellingPrice:'20.0000',taxRate:'0.1500'}});
      productId=product.id;
      const customer=await tx.customer.create({data:{tenantId:tenant.id,name:`Customer ${label}`}});
      customerId=customer.id;
      const fiscalYear=await tx.fiscalYear.create({data:{tenantId:tenant.id,name:`FY-${label}-${randomUUID()}`,startsOn:new Date('2026-01-01'),endsOn:new Date('2026-12-31')}});
      await tx.fiscalPeriod.create({data:{fiscalYearId:fiscalYear.id,name:'2026',startsOn:new Date('2026-01-01'),endsOn:new Date('2026-12-31')}});
      for(const[code,name,type]of[['1100','Cash','ASSET'],['1400','Inventory','ASSET'],['2200','VAT','LIABILITY'],['4100','Sales','REVENUE'],['5000','COGS','EXPENSE']]as const){
        await tx.chartAccount.create({data:{tenantId:tenant.id,code,nameAr:name,type}});
      }
      context={tenantId:tenant.id,tenantSlug:tenant.slug,membershipId:randomUUID(),userId:user.id,branchIds:[branch.id],permissions:['pos.sell'],subscriptionState:'ACTIVE'};
    });

    await inventory.receive(context,{branchId:context.branchIds[0]!,warehouseId,productId,quantity:'5.0000'});
    const shift=await sales.openShift(context,{branchId:context.branchIds[0]!,openingCash:'10.0000'});
    const sale=await sales.completePosSale(context,{branchId:context.branchIds[0]!,warehouseId,shiftId:shift.id,customerId,paymentMethod:'CASH',idempotencyKey:`rls-sale-${randomUUID()}`,items:[{productId,quantity:'1.0000',discount:'0.0000'}]});
    const records=await prisma.forTenant(context.tenantId,async tx=>({
      pos:await tx.posTransaction.findUniqueOrThrow({where:{invoiceId:sale.invoice.id}}),
      movement:await tx.inventoryMovement.findFirstOrThrow({where:{tenantId:context.tenantId,referenceType:'SALES_INVOICE',referenceId:sale.invoice.id}}),
      journal:await tx.journalEntry.findFirstOrThrow({where:{tenantId:context.tenantId,sourceType:'POS_SALE',sourceId:sale.invoice.id}})
    }));
    return{context,customerId,productId,invoiceId:sale.invoice.id,posTransactionId:records.pos.id,warehouseId,inventoryMovementId:records.movement.id,journalEntryId:records.journal.id};
  }

  async function withTenant<T>(tenantId:string,work:(client:PoolClient)=>Promise<T>):Promise<T>{
    if(!rlsPool)throw new Error('RLS pool not initialized');
    const client=await rlsPool.connect();
    try{
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      const result=await work(client);
      await client.query('COMMIT');
      return result;
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{
      client.release();
    }
  }

  beforeAll(async()=>{
    if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required for RLS integration tests');
    prisma=new PrismaService();
    adminPool=new Pool({connectionString:process.env.DATABASE_URL});
    tenantA=await createFixture('A');
    tenantB=await createFixture('B');

    roleName=`mohammedsaas_rls_${process.pid}_${Date.now()}`;
    rolePassword=`rls-${randomUUID()}`;
    const database=(await adminPool.query<{name:string}>('SELECT current_database() AS name')).rows[0]!.name;
    await adminPool.query(`CREATE ROLE ${quoteIdentifier(roleName)} LOGIN PASSWORD ${quoteLiteral(rolePassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await adminPool.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(database)} TO ${quoteIdentifier(roleName)}`);
    await adminPool.query(`GRANT USAGE ON SCHEMA public TO ${quoteIdentifier(roleName)}`);
    await adminPool.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${quoteIdentifier(roleName)}`);
    await adminPool.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdentifier(roleName)}`);

    const connectionUrl=new URL(process.env.DATABASE_URL);
    connectionUrl.username=roleName;
    connectionUrl.password=rolePassword;
    connectionUrl.searchParams.delete('schema');
    rlsPool=new Pool({connectionString:connectionUrl.toString()});
  });

  afterAll(async()=>{
    await rlsPool?.end();
    if(adminPool&&roleName){
      await adminPool.query(`DROP OWNED BY ${quoteIdentifier(roleName)}`);
      await adminPool.query(`DROP ROLE IF EXISTS ${quoteIdentifier(roleName)}`);
    }
    await adminPool?.end();
    await prisma?.$disconnect();
  });

  it('uses a non-superuser, non-bypass, non-owner database role',async()=>{
    if(!rlsPool)throw new Error('RLS pool not initialized');
    const role=(await rlsPool.query<{rolname:string;rolsuper:boolean;rolbypassrls:boolean}>("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0]!;
    expect(role.rolname).toBe(roleName);
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);

    const databaseOwner=(await rlsPool.query<{owner:string}>('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()')).rows[0]!.owner;
    expect(databaseOwner).not.toBe(roleName);

    const owners=await rlsPool.query<{tablename:string;tableowner:string}>("SELECT tablename,tableowner FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])",[protectedTables]);
    expect(owners.rows).toHaveLength(protectedTables.length);
    for(const row of owners.rows)expect(row.tableowner).not.toBe(roleName);

    const rls=await rlsPool.query<{tablename:string;enabled:boolean;forced:boolean}>("SELECT c.relname AS tablename,c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])",[protectedTables]);
    expect(rls.rows).toHaveLength(protectedTables.length);
    for(const row of rls.rows){expect(row.enabled).toBe(true);expect(row.forced).toBe(true);}
  });

  it('allows Tenant A to read only Tenant A rows across sensitive business tables',async()=>{
    const expectedA:Record<(typeof protectedTables)[number],string>={
      customers:tenantA.customerId,
      products:tenantA.productId,
      sales_invoices:tenantA.invoiceId,
      pos_transactions:tenantA.posTransactionId,
      warehouses:tenantA.warehouseId,
      inventory_movements:tenantA.inventoryMovementId,
      journal_entries:tenantA.journalEntryId
    };
    const forbiddenB:Record<(typeof protectedTables)[number],string>={
      customers:tenantB.customerId,
      products:tenantB.productId,
      sales_invoices:tenantB.invoiceId,
      pos_transactions:tenantB.posTransactionId,
      warehouses:tenantB.warehouseId,
      inventory_movements:tenantB.inventoryMovementId,
      journal_entries:tenantB.journalEntryId
    };

    await withTenant(tenantA.context.tenantId,async client=>{
      for(const table of protectedTables){
        const result=await client.query<{id:string;tenant_id:string}>(`SELECT id,tenant_id FROM ${table}`);
        expect(result.rows.some(row=>row.id===expectedA[table])).toBe(true);
        expect(result.rows.some(row=>row.id===forbiddenB[table])).toBe(false);
        expect(result.rows.every(row=>row.tenant_id===tenantA.context.tenantId)).toBe(true);
      }
    });
  });

  it('denies Tenant A cross-tenant reads and sensitive writes against Tenant B',async()=>{
    await withTenant(tenantA.context.tenantId,async client=>{
      for(const[table,id]of Object.entries({customers:tenantB.customerId,products:tenantB.productId,sales_invoices:tenantB.invoiceId,pos_transactions:tenantB.posTransactionId,warehouses:tenantB.warehouseId,inventory_movements:tenantB.inventoryMovementId,journal_entries:tenantB.journalEntryId})){
        const read=await client.query(`SELECT id FROM ${table} WHERE id=$1`,[id]);
        expect(read.rowCount).toBe(0);
      }

      await expect(client.query('INSERT INTO customers(id,tenant_id,name,credit_limit,active,created_at) VALUES($1,$2,$3,0,true,now())',[randomUUID(),tenantB.context.tenantId,'Forbidden Customer'])).rejects.toMatchObject({code:'42501'});

      const productUpdate=await client.query('UPDATE products SET name=$1 WHERE id=$2 RETURNING id',['tampered',tenantB.productId]);
      expect(productUpdate.rowCount).toBe(0);
      const invoiceUpdate=await client.query('UPDATE sales_invoices SET notes=$1 WHERE id=$2 RETURNING id',['tampered',tenantB.invoiceId]);
      expect(invoiceUpdate.rowCount).toBe(0);
      const posUpdate=await client.query('UPDATE pos_transactions SET total=0 WHERE id=$1 RETURNING id',[tenantB.posTransactionId]);
      expect(posUpdate.rowCount).toBe(0);
      const journalUpdate=await client.query('UPDATE journal_entries SET description=$1 WHERE id=$2 RETURNING id',['tampered',tenantB.journalEntryId]);
      expect(journalUpdate.rowCount).toBe(0);

      await expect(client.query("INSERT INTO inventory_movements(id,tenant_id,branch_id,warehouse_id,product_id,quantity,direction,type,occurred_at) VALUES($1,$2,$3,$4,$5,1,'IN','ADJUSTMENT_IN',now())",[randomUUID(),tenantB.context.tenantId,tenantB.context.branchIds[0]!,tenantB.warehouseId,tenantB.productId])).rejects.toMatchObject({code:'42501'});
    });
  });

  it('exposes no tenant rows when app.tenant_id is absent',async()=>{
    if(!rlsPool)throw new Error('RLS pool not initialized');
    for(const table of protectedTables){
      const result=await rlsPool.query<{count:string}>(`SELECT count(*)::text AS count FROM ${table}`);
      expect(result.rows[0]!.count).toBe('0');
    }
  });
});
