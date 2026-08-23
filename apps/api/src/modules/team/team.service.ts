import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {createHash,randomBytes} from 'node:crypto';
import type {AuthenticatedPrincipal,TenantContext} from '@mohammedsaas/types';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {PrismaService} from '../../infra/prisma/prisma.service.js';

const invitationIdsSchema=z.array(z.string().uuid()).min(1);
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
type InvitationLookup={id:string;tenant_id:string;email:string;role_ids:unknown;branch_ids:unknown};

@Injectable()
export class TeamService{
  constructor(private readonly prisma:PrismaService){}

  list(context:TenantContext){
    return this.prisma.forTenant(context.tenantId,async tx=>({
      members:await tx.membership.findMany({where:{tenantId:context.tenantId},include:{user:true,roles:{include:{role:true}},branches:{include:{branch:true}}}}),
      roles:await tx.role.findMany({where:{tenantId:context.tenantId},orderBy:{name:'asc'}}),
      branches:await tx.branch.findMany({where:{tenantId:context.tenantId,active:true}})
    }));
  }

  invite(context:TenantContext,input:{email:string;roleIds:string[];branchIds:string[]}){
    return this.prisma.forTenant(context.tenantId,async tx=>{
      const subscription=await tx.subscription.findUnique({where:{tenantId:context.tenantId},include:{plan:true}});
      const count=await tx.membership.count({where:{tenantId:context.tenantId,status:{in:['ACTIVE','INVITED']}}});
      if(subscription?.plan.maxUsers!==null&&subscription?.plan.maxUsers!==undefined&&count>=subscription.plan.maxUsers)throw new BadRequestException('Plan user limit reached');
      if(await tx.role.count({where:{tenantId:context.tenantId,id:{in:input.roleIds}}})!==input.roleIds.length)throw new BadRequestException('Invalid role');
      if(await tx.branch.count({where:{tenantId:context.tenantId,id:{in:input.branchIds}}})!==input.branchIds.length)throw new BadRequestException('Invalid branch');
      const token=randomBytes(32).toString('base64url');
      const invitation=await tx.membershipInvitation.create({data:{tenantId:context.tenantId,email:input.email.toLowerCase(),tokenHash:hashToken(token),roleIds:input.roleIds,branchIds:input.branchIds,invitedById:context.userId,expiresAt:new Date(Date.now()+7*86400000)}});
      const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if(url&&key){
        const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
        const result=await supabase.auth.admin.inviteUserByEmail(input.email,{data:{invite_token:token}});
        if(result.error)throw new BadRequestException('Unable to send employee invitation');
      }
      await tx.auditLog.create({data:{tenantId:context.tenantId,actorId:context.userId,action:'team_invited',entityType:'membership_invitation',entityId:invitation.id,metadata:{email:input.email}}});
      return{id:invitation.id,email:invitation.email,expiresAt:invitation.expiresAt,...(process.env.NODE_ENV==='production'?{}:{token})};
    });
  }

  async accept(principal:AuthenticatedPrincipal,token:string){
    if(!principal.email)throw new ForbiddenException('Verified email required');
    const matches=await this.prisma.$queryRaw<InvitationLookup[]>`
      SELECT id,tenant_id,email,role_ids,branch_ids
      FROM resolve_membership_invitation(${hashToken(token)},${principal.email})
    `;
    const match=matches[0];
    if(!match)throw new NotFoundException('Invitation invalid or expired');
    const roleIds=invitationIdsSchema.parse(match.role_ids);
    const branchIds=invitationIdsSchema.parse(match.branch_ids);

    return this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT set_config('app.tenant_id',${match.tenant_id},true)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invite:${match.id}`},0))`;
      const invitation=await tx.membershipInvitation.findFirst({where:{id:match.id,tenantId:match.tenant_id,email:{equals:principal.email,mode:'insensitive'},acceptedAt:null,expiresAt:{gt:new Date()}}});
      if(!invitation)throw new NotFoundException('Invitation invalid or expired');
      if(await tx.membership.findFirst({where:{tenantId:match.tenant_id,userId:principal.userId}}))throw new BadRequestException('Already a member');
      if(await tx.role.count({where:{tenantId:match.tenant_id,id:{in:roleIds}}})!==roleIds.length)throw new BadRequestException('Invitation roles are no longer valid');
      if(await tx.branch.count({where:{tenantId:match.tenant_id,id:{in:branchIds},active:true}})!==branchIds.length)throw new BadRequestException('Invitation branches are no longer valid');
      const membership=await tx.membership.create({data:{tenantId:match.tenant_id,userId:principal.userId,status:'ACTIVE',invitedEmail:invitation.email}});
      await tx.membershipRole.createMany({data:roleIds.map(roleId=>({membershipId:membership.id,roleId}))});
      await tx.membershipBranch.createMany({data:branchIds.map(branchId=>({membershipId:membership.id,branchId}))});
      await tx.membershipInvitation.update({where:{id:invitation.id},data:{acceptedAt:new Date()}});
      await tx.notification.create({data:{tenantId:match.tenant_id,userId:principal.userId,type:'INVITATION_ACCEPTED',title:'تمت إضافة حسابك إلى الشركة'}});
      return membership;
    },{isolationLevel:'Serializable'});
  }
}
