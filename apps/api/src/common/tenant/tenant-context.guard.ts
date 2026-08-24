import {CanActivate,ExecutionContext,ForbiddenException,Injectable} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {PrismaService} from '../../infra/prisma/prisma.service.js';
import type {AuthenticatedRequest} from '../auth/request-context.js';
import {IS_PUBLIC} from '../auth/public.decorator.js';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly prisma:PrismaService,private readonly reflector:Reflector){}

  async canActivate(context:ExecutionContext):Promise<boolean>{
    if(this.reflector.getAllAndOverride<boolean>(IS_PUBLIC,[context.getHandler(),context.getClass()]))return true;
    const request=context.switchToHttp().getRequest<AuthenticatedRequest>();
    if(!request.principal)throw new ForbiddenException('Authentication context missing');
    const workspaceSlug=String(request.params['workspaceSlug']??'');
    if(!workspaceSlug)return true;

    const membership=await this.prisma.membership.findFirst({
      where:{userId:request.principal.userId,status:'ACTIVE',tenant:{slug:workspaceSlug}},
      select:{id:true,tenantId:true,userId:true,tenant:{select:{slug:true,subscription:{select:{status:true}}}}}
    });
    if(!membership)throw new ForbiddenException('Workspace access denied');

    const scoped=await this.prisma.forTenant(membership.tenantId,tx=>tx.membership.findUniqueOrThrow({
      where:{id:membership.id},
      include:{
        branches:{select:{branchId:true}},
        roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}
      }
    }));

    const permissions=new Set<string>();
    for(const membershipRole of scoped.roles){
      for(const rolePermission of membershipRole.role.permissions)permissions.add(rolePermission.permission.key);
    }
    request.tenantContext={
      tenantId:membership.tenantId,
      tenantSlug:membership.tenant.slug,
      membershipId:membership.id,
      userId:membership.userId,
      branchIds:scoped.branches.map(branch=>branch.branchId),
      permissions:[...permissions],
      subscriptionState:membership.tenant.subscription?.status??'TRIAL'
    };
    return true;
  }
}
