import {Injectable,NotFoundException} from '@nestjs/common';
import type {NotificationDto,TenantContext} from '@mohammedsaas/types';
import {PrismaService} from '../../infra/prisma/prisma.service.js';

@Injectable()
export class NotificationsService{
  constructor(private readonly prisma:PrismaService){}
  list(context:TenantContext):Promise<NotificationDto[]>{
    return this.prisma.forTenant(context.tenantId,async tx=>{
      const notifications=await tx.notification.findMany({where:{tenantId:context.tenantId,OR:[{userId:null},{userId:context.userId}]},orderBy:{createdAt:'desc'},take:50});
      return notifications.map(notification=>({id:notification.id,type:notification.type,title:notification.title,message:notification.body,readAt:notification.readAt?.toISOString()??null,createdAt:notification.createdAt.toISOString()}));
    });
  }
  read(context:TenantContext,id:string):Promise<NotificationDto>{
    return this.prisma.forTenant(context.tenantId,async tx=>{
      const notification=await tx.notification.findFirst({where:{id,tenantId:context.tenantId,OR:[{userId:null},{userId:context.userId}]}});
      if(!notification)throw new NotFoundException();
      const updated=await tx.notification.update({where:{id},data:{readAt:new Date()}});
      return{id:updated.id,type:updated.type,title:updated.title,message:updated.body,readAt:updated.readAt?.toISOString()??null,createdAt:updated.createdAt.toISOString()};
    });
  }
}
