import {ForbiddenException,type ExecutionContext} from '@nestjs/common';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {decimalToUnits} from '@mohammedsaas/accounting-engine';
import type {SubscriptionState,TenantContext} from '@mohammedsaas/types';
import {SubscriptionWriteGuard} from '../src/common/subscription/subscription-write.guard.js';
import {PrismaService} from '../src/infra/prisma/prisma.service.js';
import {AccountingService} from '../src/modules/accounting/accounting.service.js';
import {CustomersService} from '../src/modules/customers/customers.service.js';
import {PlatformAdminService} from '../src/modules/platform-admin/platform-admin.service.js';
import {ReportsService} from '../src/modules/reports/reports.service.js';

const run=process.env.RUN_DB_TESTS==='1'?describe:describe.skip;
const units=(value:{toString():string}|string)=>decimalToUnits(typeof value==='string'?value:value.toString());

run('subscription lifecycle acceptance',()=>{
  let prisma:PrismaService;
  let platform:PlatformAdminService;
  let accounting:AccountingService;
  let reports:ReportsService;
  let customers:CustomersService;
  let writeGuard:SubscriptionWriteGuard;
  let tenantId:string;
  let subscriptionId:string;
  let actorId:string;
  let baseContext:Omit<TenantContext,'subscriptionState'>;
  let financialFingerprint:string;

  const contextFor=(subscriptionState:SubscriptionState):TenantContext=>({...baseContext,subscriptionState});
  const httpContext=(method:string,tenantContext:TenantContext)=>({switchToHttp:()=>({getRequest:()=>({method,tenantContext})})}) as unknown as ExecutionContext;
  const guardedWrite=async<T>(tenantContext:TenantContext,work:()=>Promise<T>):Promise<T>=>{
    writeGuard.canActivate(httpContext('POST',tenantContext));
    return work();
  };

  const status=async()=>{
    const subscription=await prisma.subscription.findUniqueOrThrow({where:{tenantId}});
    return subscription.status as SubscriptionState;
  };

  const snapshotFinancials=async()=>prisma.forTenant(tenantId,async tx=>{
    const journals=await tx.journalEntry.findMany({where:{tenantId},include:{lines:true},orderBy:{createdAt:'asc'}});
    return JSON.stringify(journals.map(journal=>({
      id:journal.id,
      number:journal.number,
      status:journal.status,
      sourceType:journal.sourceType,
      sourceId:journal.sourceId,
      lines:journal.lines.map(line=>({id:line.id,accountId:line.accountId,debit:line.debit.toString(),credit:line.credit.toString()})).sort((a,b)=>a.id.localeCompare(b.id))
    })));
  });

  beforeAll(async()=>{
    prisma=new PrismaService();
    platform=new PlatformAdminService(prisma);
    accounting=new AccountingService(prisma);
    reports=new ReportsService(prisma);
    customers=new CustomersService(prisma);
    writeGuard=new SubscriptionWriteGuard();

    const actor=await prisma.user.create({data:{authUserId:crypto.randomUUID(),email:`subscription-actor-${crypto.randomUUID()}@example.test`}});
    actorId=actor.id;
    const plan=await prisma.subscriptionPlan.upsert({where:{code:'LIFECYCLE_TEST'},update:{},create:{code:'LIFECYCLE_TEST',name:'Lifecycle Test',monthlyPrice:'25.0000',currency:'SAR',entitlements:{basic_reports:true}}});
    const tenant=await prisma.tenant.create({data:{slug:`subscription-${crypto.randomUUID()}`,name:'Subscription Lifecycle',country:'YE',baseCurrency:'SAR',timezone:'Asia/Aden',subscription:{create:{planId:plan.id,status:'TRIAL',trialEndsAt:new Date(Date.now()+14*86400000)}}}});
    tenantId=tenant.id;
    subscriptionId=(await prisma.subscription.findUniqueOrThrow({where:{tenantId}})).id;

    await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
      const branch=await tx.branch.create({data:{tenantId,name:'Main',code:'MAIN'}});
      const fiscalYear=await tx.fiscalYear.create({data:{tenantId,name:'2026',startsOn:new Date('2026-01-01'),endsOn:new Date('2026-12-31')}});
      await tx.fiscalPeriod.create({data:{fiscalYearId:fiscalYear.id,name:'2026',startsOn:new Date('2026-01-01'),endsOn:new Date('2026-12-31')}});
      await tx.chartAccount.create({data:{tenantId,code:'1100',nameAr:'Cash',type:'ASSET'}});
      await tx.chartAccount.create({data:{tenantId,code:'4100',nameAr:'Sales',type:'REVENUE'}});
      baseContext={tenantId,tenantSlug:tenant.slug,membershipId:crypto.randomUUID(),userId:actorId,branchIds:[branch.id],permissions:['reports.financial','customers.create'],};
    });

    await prisma.forTenant(tenantId,tx=>accounting.postJournal(tx,{tenantId,sourceType:'LIFECYCLE_BASELINE',sourceId:crypto.randomUUID(),entryDate:new Date('2026-08-23'),draft:{description:'Lifecycle baseline',currency:'SAR',lines:[{accountCode:'1100',debit:'100.0000',credit:'0.0000'},{accountCode:'4100',debit:'0.0000',credit:'100.0000'}]}}));
    financialFingerprint=await snapshotFinancials();
  });

  afterAll(async()=>prisma.$disconnect());

  it('moves TRIAL through read-only and renewal while preserving financial history and auditability',async()=>{
    expect(await status()).toBe('TRIAL');
    expect(writeGuard.canActivate(httpContext('POST',contextFor('TRIAL')))).toBe(true);

    await platform.subscriptionAction(actorId,tenantId,{action:'ACTIVATE',planCode:'LIFECYCLE_TEST',months:1});
    expect(await status()).toBe('ACTIVE');
    expect(writeGuard.canActivate(httpContext('POST',contextFor('ACTIVE')))).toBe(true);

    await platform.subscriptionAction(actorId,tenantId,{action:'SET_STATUS',status:'PAST_DUE'});
    expect(await status()).toBe('PAST_DUE');
    expect(writeGuard.canActivate(httpContext('POST',contextFor('PAST_DUE')))).toBe(true);

    await platform.subscriptionAction(actorId,tenantId,{action:'SET_STATUS',status:'GRACE_PERIOD'});
    expect(await status()).toBe('GRACE_PERIOD');
    expect(writeGuard.canActivate(httpContext('POST',contextFor('GRACE_PERIOD')))).toBe(true);

    await platform.subscriptionAction(actorId,tenantId,{action:'SET_STATUS',status:'READ_ONLY'});
    expect(await status()).toBe('READ_ONLY');
    const readOnly=contextFor('READ_ONLY');
    expect(()=>writeGuard.canActivate(httpContext('POST',readOnly))).toThrow(ForbiddenException);
    expect(writeGuard.canActivate(httpContext('GET',readOnly))).toBe(true);

    const customersBefore=await prisma.forTenant(tenantId,tx=>tx.customer.count({where:{tenantId}}));
    await expect(guardedWrite(readOnly,()=>customers.create(readOnly,{name:'Blocked Customer',creditLimit:'0.0000'}))).rejects.toThrow(/read-only/i);
    expect(await prisma.forTenant(tenantId,tx=>tx.customer.count({where:{tenantId}}))).toBe(customersBefore);

    const reportDuringReadOnly=await reports.profitLoss(readOnly);
    expect(units(reportDuringReadOnly.totalRevenue)).toBe(units('100.0000'));
    expect(units(reportDuringReadOnly.netProfit)).toBe(units('100.0000'));
    expect(await snapshotFinancials()).toBe(financialFingerprint);

    await platform.subscriptionAction(actorId,tenantId,{action:'EXTEND',days:30});
    expect(await status()).toBe('ACTIVE');
    const renewed=contextFor('ACTIVE');
    expect(writeGuard.canActivate(httpContext('POST',renewed))).toBe(true);
    const created=await guardedWrite(renewed,()=>customers.create(renewed,{name:'Renewed Customer',creditLimit:'0.0000'}));
    expect(created.name).toBe('Renewed Customer');
    expect(await snapshotFinancials()).toBe(financialFingerprint);

    const reportAfterRenewal=await reports.profitLoss(renewed);
    expect(units(reportAfterRenewal.totalRevenue)).toBe(units(reportDuringReadOnly.totalRevenue));
    expect(units(reportAfterRenewal.netProfit)).toBe(units(reportDuringReadOnly.netProfit));

    const audit=await prisma.forTenant(tenantId,tx=>tx.auditLog.findMany({where:{tenantId,entityType:'subscription',entityId:subscriptionId},orderBy:{createdAt:'asc'}}));
    expect(audit.map(entry=>entry.action)).toEqual([
      'platform_subscription_activate',
      'platform_subscription_set_status',
      'platform_subscription_set_status',
      'platform_subscription_set_status',
      'platform_subscription_extend'
    ]);
    expect(audit).toHaveLength(5);

    const events=await prisma.subscriptionEvent.findMany({where:{subscriptionId},orderBy:{createdAt:'asc'}});
    expect(events.map(event=>event.type)).toEqual(['ACTIVATE','SET_STATUS','SET_STATUS','SET_STATUS','EXTEND']);
    expect(events).toHaveLength(audit.length);
  });
});
