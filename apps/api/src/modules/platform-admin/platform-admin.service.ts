import {BadRequestException,Injectable,NotFoundException} from '@nestjs/common';
import {addDecimals} from '@mohammedsaas/accounting-engine';
import type {PlatformOverviewDto,SubscriptionState} from '@mohammedsaas/types';
import {PrismaService} from '../../infra/prisma/prisma.service.js';

type SubscriptionAction=
  |{action:'ACTIVATE';planCode:string;months:number}
  |{action:'EXTEND';days:number}
  |{action:'START_TRIAL';days:number}
  |{action:'CHANGE_PLAN';planCode:string}
  |{action:'MARK_PAYMENT';amount:string;currency:string;externalRef?:string}
  |{action:'SET_STATUS';status:Extract<SubscriptionState,'PAST_DUE'|'GRACE_PERIOD'|'READ_ONLY'|'SUSPENDED'|'CANCELLED'>}
  |{action:'SUSPEND'};

@Injectable()
export class PlatformAdminService{
  constructor(private readonly prisma:PrismaService){}

  async overview():Promise<PlatformOverviewDto>{
    const[totalCompanies,activeCompanies,trialCompanies,activeSubscriptions,activeMemberships,subscriptions]=await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.subscription.count({where:{status:'ACTIVE'}}),
      this.prisma.subscription.count({where:{status:'TRIAL'}}),
      this.prisma.subscription.count({where:{status:'ACTIVE'}}),
      this.prisma.membership.findMany({where:{status:'ACTIVE'},select:{userId:true},distinct:['userId']}),
      this.prisma.subscription.findMany({where:{status:'ACTIVE'},include:{plan:true}})
    ]);
    const mrrByCurrency:Record<string,string>={};
    for(const subscription of subscriptions)mrrByCurrency[subscription.plan.currency]=addDecimals(mrrByCurrency[subscription.plan.currency]??'0.0000',subscription.plan.monthlyPrice.toString());
    return{totalCompanies,activeCompanies,trialCompanies,activeSubscriptions,activeUsers:activeMemberships.length,mrrByCurrency};
  }

  companies(){return this.prisma.tenant.findMany({select:{id:true,name:true,slug:true,createdAt:true,subscription:{include:{plan:true}},_count:{select:{memberships:true,branches:true}}},orderBy:{createdAt:'desc'},take:100});}

  subscriptionAction(actorId:string,tenantId:string,input:SubscriptionAction){
    return this.prisma.$transaction(async tx=>{
      const subscription=await tx.subscription.findUnique({where:{tenantId},include:{plan:true}});
      if(!subscription)throw new NotFoundException();
      await tx.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
      const now=new Date();
      if(input.action==='MARK_PAYMENT')await tx.billingPayment.create({data:{subscriptionId:subscription.id,provider:'MANUAL',amount:input.amount,currency:input.currency,receivedAt:now,...(input.externalRef?{externalRef:input.externalRef}:{})}});
      let data:{}={};
      if(input.action==='SUSPEND')data={status:'SUSPENDED' as const};
      else if(input.action==='SET_STATUS')data={status:input.status};
      else if(input.action==='START_TRIAL')data={status:'TRIAL' as const,trialEndsAt:new Date(now.getTime()+input.days*86400000)};
      else if(input.action==='EXTEND'){const base=subscription.currentPeriodEndsAt&&subscription.currentPeriodEndsAt>now?subscription.currentPeriodEndsAt:now;data={status:'ACTIVE' as const,currentPeriodEndsAt:new Date(base.getTime()+input.days*86400000)};}
      else if(input.action==='ACTIVATE'||input.action==='CHANGE_PLAN'){
        const plan=await tx.subscriptionPlan.findUnique({where:{code:input.planCode}});if(!plan)throw new BadRequestException('Plan not found');
        data={planId:plan.id,...(input.action==='ACTIVATE'?{status:'ACTIVE' as const,currentPeriodEndsAt:new Date(now.getTime()+input.months*30*86400000)}:{})};
      }else if(input.action==='MARK_PAYMENT')data={status:'ACTIVE' as const};
      const updated=await tx.subscription.update({where:{tenantId},data});
      await tx.subscriptionEvent.create({data:{subscriptionId:subscription.id,type:input.action,metadata:input}});
      await tx.auditLog.create({data:{tenantId,actorId,action:`platform_subscription_${input.action.toLowerCase()}`,entityType:'subscription',entityId:subscription.id,metadata:input}});
      return updated;
    });
  }
}
