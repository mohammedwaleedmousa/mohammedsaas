import {Body,Controller,Get,Param,Post,Query} from '@nestjs/common';
import {z} from 'zod';
import {PERMISSIONS} from '@mohammedsaas/permissions';
import type {TenantContext} from '@mohammedsaas/types';
import {CurrentTenant} from '../../common/tenant/tenant-context.decorator.js';
import {RequirePermissions} from '../../common/permissions/permissions.decorator.js';
import {SalesService} from './sales.service.js';

const decimal=z.string().regex(/^\d+(\.\d{1,4})?$/);
const saleSchema=z.object({
  branchId:z.string().uuid(),warehouseId:z.string().uuid(),shiftId:z.string().uuid(),customerId:z.string().uuid().optional(),
  paymentMethod:z.enum(['CASH','CARD','BANK_TRANSFER','OTHER']).default('CASH'),idempotencyKey:z.string().min(8).max(120),
  items:z.array(z.object({productId:z.string().uuid(),quantity:decimal,discount:decimal.default('0.0000')})).min(1).max(100)
});
const openSchema=z.object({branchId:z.string().uuid(),openingCash:decimal});
const closeSchema=z.object({countedCash:decimal});
const refundSchema=z.object({
  shiftId:z.string().uuid(),warehouseId:z.string().uuid(),reason:z.string().min(2).max(500),idempotencyKey:z.string().min(8).max(120),
  items:z.array(z.object({invoiceItemId:z.string().uuid(),quantity:decimal})).min(1).max(100)
});

@Controller('workspaces/:workspaceSlug')
export class SalesController{
  constructor(private readonly sales:SalesService){}
  @Get('sales/invoices') @RequirePermissions(PERMISSIONS.INVOICES_VIEW)
  invoices(@CurrentTenant()context:TenantContext,@Query('page')page='1'){return this.sales.invoices(context,Number(page));}

  @Get('pos/shifts/current') @RequirePermissions(PERMISSIONS.POS_OPEN_SHIFT)
  currentShift(@CurrentTenant()context:TenantContext,@Query('branchId')branchId?:string){return this.sales.currentShift(context,branchId);}
  @Get('pos/shifts/:shiftId/summary') @RequirePermissions(PERMISSIONS.POS_CLOSE_SHIFT)
  shiftSummary(@CurrentTenant()context:TenantContext,@Param('shiftId')shiftId:string){return this.sales.shiftSummary(context,shiftId);}
  @Post('pos/shifts/open') @RequirePermissions(PERMISSIONS.POS_OPEN_SHIFT)
  open(@CurrentTenant()context:TenantContext,@Body()body:unknown){return this.sales.openShift(context,openSchema.parse(body));}
  @Post('pos/shifts/:shiftId/close') @RequirePermissions(PERMISSIONS.POS_CLOSE_SHIFT)
  close(@CurrentTenant()context:TenantContext,@Param('shiftId')shiftId:string,@Body()body:unknown){return this.sales.closeShift(context,shiftId,closeSchema.parse(body).countedCash);}

  @Get('pos/sales/lookup') @RequirePermissions(PERMISSIONS.POS_REFUND)
  lookup(@CurrentTenant()context:TenantContext,@Query('number')number=''){return this.sales.findPosInvoice(context,number);}
  @Post('pos/sales') @RequirePermissions(PERMISSIONS.POS_SELL)
  sale(@CurrentTenant()context:TenantContext,@Body()body:unknown){return this.sales.completePosSale(context,saleSchema.parse(body));}
  @Post('pos/sales/:invoiceId/refund') @RequirePermissions(PERMISSIONS.POS_REFUND)
  refund(@CurrentTenant()context:TenantContext,@Param('invoiceId')invoiceId:string,@Body()body:unknown){return this.sales.refundPosSale(context,invoiceId,refundSchema.parse(body));}
}
