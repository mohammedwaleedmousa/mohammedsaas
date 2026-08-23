import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {decimalToUnits} from '@mohammedsaas/accounting-engine';
import type {TenantContext} from '@mohammedsaas/types';
import {PrismaService} from '../src/infra/prisma/prisma.service.js';
import {AccountingService} from '../src/modules/accounting/accounting.service.js';
import {ExpensesService} from '../src/modules/expenses/expenses.service.js';
import {InventoryService} from '../src/modules/inventory/inventory.service.js';
import {PurchasesService} from '../src/modules/purchases/purchases.service.js';
import {SalesService} from '../src/modules/sales/sales.service.js';

const run=process.env.RUN_DB_TESTS==='1'?describe:describe.skip;
const units=(value:{toString():string}|string)=>decimalToUnits(typeof value==='string'?value:value.toString());
const expectAmount=(actual:{toString():string}|string,expected:string)=>expect(units(actual)).toBe(units(expected));
const expectBalanced=(lines:Array<{debit:{toString():string};credit:{toString():string}}>)=>{
  const debit=lines.reduce((sum,line)=>sum+units(line.debit),0n);
  const credit=lines.reduce((sum,line)=>sum+units(line.credit),0n);
  expect(debit).toBe(credit);
};

run('vertical transaction flows',()=>{
  let prisma:PrismaService;
  let inventory:InventoryService;
  let accounting:AccountingService;
  let sales:SalesService;
  let purchases:PurchasesService;
  let expenses:ExpensesService;
  let context:TenantContext;
  let warehouseId:string;
  let productId:string;
  let supplierId:string;
  let categoryId:string;

  beforeAll(async()=>{
    prisma=new PrismaService();
    inventory=new InventoryService(prisma);
    accounting=new AccountingService(prisma);
    sales=new SalesService(prisma,inventory,accounting);
    purchases=new PurchasesService(prisma,accounting);
    expenses=new ExpensesService(prisma,accounting);

    const user=await prisma.user.create({data:{authUserId:crypto.randomUUID(),email:`flow-${crypto.randomUUID()}@example.test`}});
    const plan=await prisma.subscriptionPlan.upsert({where:{code:'TEST'},update:{},create:{code:'TEST',name:'Test',monthlyPrice:'1.0000',currency:'SAR',entitlements:{}}});
    const tenant=await prisma.tenant.create({data:{slug:`flow-${crypto.randomUUID()}`,name:'Flow Test',country:'YE',baseCurrency:'SAR',timezone:'Asia/Aden',subscription:{create:{planId:plan.id,status:'ACTIVE'}}}});

    await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      const branch=await tx.branch.create({data:{tenantId:tenant.id,name:'Main',code:'MAIN'}});
      const warehouse=await tx.warehouse.create({data:{tenantId:tenant.id,branchId:branch.id,name:'Main',code:'MAIN'}});
      warehouseId=warehouse.id;
      const product=await tx.product.create({data:{tenantId:tenant.id,sku:`SKU-${crypto.randomUUID()}`,name:'Test Product',costPrice:'40.0000',sellingPrice:'100.0000',taxRate:'0.1500',minimumStock:'2.0000'}});
      productId=product.id;
      const supplier=await tx.supplier.create({data:{tenantId:tenant.id,name:'Test Supplier'}});
      supplierId=supplier.id;
      const category=await tx.expenseCategory.create({data:{tenantId:tenant.id,name:'Operating',accountCode:'6000'}});
      categoryId=category.id;
      const fiscalYear=await tx.fiscalYear.create({data:{tenantId:tenant.id,name:'2026',startsOn:new Date('2026-01-01'),endsOn:new Date('2026-12-31')}});
      await tx.fiscalPeriod.create({data:{fiscalYearId:fiscalYear.id,name:'2026',startsOn:new Date('2026-01-01'),endsOn:new Date('2026-12-31')}});
      for(const[code,name,type]of[['1100','Cash','ASSET'],['1200','Bank','ASSET'],['1400','Inventory','ASSET'],['2100','AP','LIABILITY'],['2200','VAT','LIABILITY'],['2210','Input VAT','ASSET'],['4100','Sales','REVENUE'],['5000','COGS','EXPENSE'],['6000','Expense','EXPENSE']]as const){
        await tx.chartAccount.create({data:{tenantId:tenant.id,code,nameAr:name,type}});
      }
      context={tenantId:tenant.id,tenantSlug:tenant.slug,membershipId:crypto.randomUUID(),userId:user.id,branchIds:[branch.id],permissions:['pos.sell','pos.refund','pos.discount'],subscriptionState:'ACTIVE'};
    });

    await inventory.receive(context,{branchId:context.branchIds[0]!,warehouseId,productId,quantity:'10.0000'});
  });

  afterAll(async()=>prisma.$disconnect());

  it('keeps sale journal posted while partial refunds restore stock and create balanced compensating journals',async()=>{
    const shift=await sales.openShift(context,{branchId:context.branchIds[0]!,openingCash:'50.0000'});
    const sale=await sales.completePosSale(context,{branchId:context.branchIds[0]!,warehouseId,shiftId:shift.id,paymentMethod:'CASH',idempotencyKey:`sale-${crypto.randomUUID()}`,items:[{productId,quantity:'3.0000',discount:'5.0000'}]});
    const invoiceLine=sale.invoice.items[0]!;

    const afterSale=await inventory.stock(context,warehouseId);
    expectAmount(afterSale.find(row=>row.productId===productId)!.quantity,'7.0000');

    const saleJournal=await prisma.forTenant(context.tenantId,tx=>tx.journalEntry.findFirstOrThrow({where:{tenantId:context.tenantId,sourceType:'POS_SALE',sourceId:sale.invoice.id},include:{lines:true}}));
    expect(saleJournal.status).toBe('POSTED');
    expectBalanced(saleJournal.lines);

    const firstRefund=await sales.refundPosSale(context,sale.invoice.id,{shiftId:shift.id,warehouseId,reason:'partial return',idempotencyKey:`refund-${crypto.randomUUID()}`,items:[{invoiceItemId:invoiceLine.id,quantity:'1.0000'}]});
    expectAmount((await inventory.stock(context,warehouseId)).find(row=>row.productId===productId)!.quantity,'8.0000');

    const firstRefundJournal=await prisma.forTenant(context.tenantId,tx=>tx.journalEntry.findFirstOrThrow({where:{tenantId:context.tenantId,sourceType:'POS_REFUND',sourceId:firstRefund.salesReturn.id},include:{lines:true}}));
    expect(firstRefundJournal.status).toBe('POSTED');
    expectBalanced(firstRefundJournal.lines);
    expect((await prisma.forTenant(context.tenantId,tx=>tx.journalEntry.findUniqueOrThrow({where:{id:saleJournal.id}}))).status).toBe('POSTED');

    await expect(sales.refundPosSale(context,sale.invoice.id,{shiftId:shift.id,warehouseId,reason:'too much',idempotencyKey:`refund-${crypto.randomUUID()}`,items:[{invoiceItemId:invoiceLine.id,quantity:'3.0000'}]})).rejects.toThrow(/exceeds refundable quantity/i);
    expectAmount((await inventory.stock(context,warehouseId)).find(row=>row.productId===productId)!.quantity,'8.0000');

    const finalRefund=await sales.refundPosSale(context,sale.invoice.id,{shiftId:shift.id,warehouseId,reason:'final return',idempotencyKey:`refund-${crypto.randomUUID()}`,items:[{invoiceItemId:invoiceLine.id,quantity:'2.0000'}]});
    expectAmount((await inventory.stock(context,warehouseId)).find(row=>row.productId===productId)!.quantity,'10.0000');

    const finalRefundJournal=await prisma.forTenant(context.tenantId,tx=>tx.journalEntry.findFirstOrThrow({where:{tenantId:context.tenantId,sourceType:'POS_REFUND',sourceId:finalRefund.salesReturn.id},include:{lines:true}}));
    expect(finalRefundJournal.status).toBe('POSTED');
    expectBalanced(finalRefundJournal.lines);

    const financialState=await prisma.forTenant(context.tenantId,async tx=>({
      invoice:await tx.salesInvoice.findUniqueOrThrow({where:{id:sale.invoice.id}}),
      saleJournal:await tx.journalEntry.findUniqueOrThrow({where:{id:saleJournal.id}}),
      refunds:await tx.salesReturn.findMany({where:{tenantId:context.tenantId,invoiceId:sale.invoice.id},orderBy:{createdAt:'asc'}})
    }));
    expect(financialState.invoice.status).toBe('REFUNDED');
    expect(financialState.saleJournal.status).toBe('POSTED');
    expect(financialState.refunds).toHaveLength(2);
    expectAmount(financialState.refunds[0]!.amount,'113.0833');
    expectAmount(financialState.refunds[1]!.amount,'226.1667');
    expectAmount(financialState.refunds.reduce((sum,refund)=>(units(sum)+units(refund.amount)).toString(),'0'),'339.2500');

    const beforeClose=await sales.shiftSummary(context,shift.id);
    expectAmount(beforeClose.openingCash,'50.0000');
    expectAmount(beforeClose.cashSales,'339.2500');
    expectAmount(beforeClose.cashRefunds,'339.2500');
    expectAmount(beforeClose.expectedCash,'50.0000');

    const closed=await sales.closeShift(context,shift.id,'47.5000');
    expect(closed.status).toBe('CLOSED');
    expectAmount(closed.expectedCash,'50.0000');
    expectAmount(closed.countedCash!,'47.5000');
    expectAmount(closed.difference!,'-2.5000');

    const persisted=await prisma.forTenant(context.tenantId,tx=>tx.cashierShift.findUniqueOrThrow({where:{id:shift.id}}));
    expectAmount(persisted.expectedCash!,'50.0000');
    expectAmount(persisted.countedCash!,'47.5000');
    expectAmount(persisted.cashVariance!,'-2.5000');
  });

  it('purchase receipt and supplier payment update stock and journals',async()=>{
    const bill=await purchases.create(context,{branchId:context.branchIds[0]!,warehouseId,supplierId,items:[{productId,quantity:'3.0000'}]});
    await purchases.post(context,bill.id,warehouseId);
    expectAmount((await inventory.stock(context,warehouseId)).find(row=>row.productId===productId)!.quantity,'13.0000');
    await purchases.pay(context,bill.id,{amount:'60.0000',method:'CASH'});
    const posted=await prisma.forTenant(context.tenantId,tx=>tx.journalEntry.findMany({where:{tenantId:context.tenantId,status:'POSTED'},include:{lines:true}}));
    expect(posted.length).toBeGreaterThan(0);
    for(const journal of posted)expectBalanced(journal.lines);
  });

  it('expenses create balanced journals without floating-point assertions',async()=>{
    await expenses.create(context,{branchId:context.branchIds[0]!,categoryId,amount:'25.0000',tax:'0.0000',paymentMethod:'CASH',occurredAt:new Date('2026-08-22')});
    const journals=await prisma.forTenant(context.tenantId,tx=>tx.journalEntry.findMany({where:{tenantId:context.tenantId,status:'POSTED'},include:{lines:true}}));
    for(const journal of journals)expectBalanced(journal.lines);
  });
});
