import {Body,Controller,Get,Param,Post,Req,UseGuards} from '@nestjs/common';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../../common/auth/request-context.js';
import {PlatformAdminGuard} from './platform-admin.guard.js';
import {PlatformAdminService} from './platform-admin.service.js';

const subscriptionAction=z.discriminatedUnion('action',[
  z.object({action:z.literal('ACTIVATE'),planCode:z.string(),months:z.number().int().min(1).max(24)}),
  z.object({action:z.literal('EXTEND'),days:z.number().int().min(1).max(730)}),
  z.object({action:z.literal('START_TRIAL'),days:z.number().int().min(1).max(90)}),
  z.object({action:z.literal('CHANGE_PLAN'),planCode:z.string()}),
  z.object({action:z.literal('MARK_PAYMENT'),amount:z.string().regex(/^\d+(\.\d{1,4})?$/),currency:z.string().length(3),externalRef:z.string().optional()}),
  z.object({action:z.literal('SET_STATUS'),status:z.enum(['PAST_DUE','GRACE_PERIOD','READ_ONLY','SUSPENDED','CANCELLED'])}),
  z.object({action:z.literal('SUSPEND')})
]);

@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController{
  constructor(private readonly platform:PlatformAdminService){}
  @Get('overview') overview(){return this.platform.overview();}
  @Get('companies') companies(){return this.platform.companies();}
  @Post('companies/:tenantId/subscription')
  subscription(@Req()request:AuthenticatedRequest,@Param('tenantId')tenantId:string,@Body()body:unknown){return this.platform.subscriptionAction(request.principal!.userId,tenantId,subscriptionAction.parse(body));}
}
