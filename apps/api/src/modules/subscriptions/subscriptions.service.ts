import {Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../../infra/prisma/prisma.service.js';
import {resolveEntitlements} from './entitlements.js';

@Injectable()
export class SubscriptionsService{
  constructor(private readonly prisma:PrismaService){}
  async get(tenantId:string){
    return this.prisma.forTenant(tenantId,async tx=>{
      const subscription=await tx.subscription.findUnique({where:{tenantId},include:{plan:true}});
      if(!subscription)throw new NotFoundException();
      const overrides=await tx.tenantFeatureFlag.findMany({where:{tenantId},include:{flag:true}});
      return{
        id:subscription.id,
        status:subscription.status,
        trialEndsAt:subscription.trialEndsAt,
        currentPeriodEndsAt:subscription.currentPeriodEndsAt,
        plan:{
          code:subscription.plan.code,
          name:subscription.plan.name,
          monthlyPrice:subscription.plan.monthlyPrice.toString(),
          currency:subscription.plan.currency
        },
        entitlements:resolveEntitlements(subscription.plan.entitlements,overrides.map(override=>({key:override.flag.key,enabled:override.enabled})))
      };
    });
  }
  async can(tenantId:string,key:string){return(await this.get(tenantId)).entitlements[key]===true;}
}
