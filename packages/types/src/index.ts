export const CURRENCIES=['SAR','YER','USD','AED'] as const;
export type CurrencyCode=(typeof CURRENCIES)[number]|(string&{});
export const MEMBERSHIP_ROLES=['OWNER','ADMIN','ACCOUNTANT','CASHIER','SALES','INVENTORY','PURCHASING','BRANCH_MANAGER'] as const;
export type DefaultRoleName=(typeof MEMBERSHIP_ROLES)[number];
export const SUBSCRIPTION_STATES=['TRIAL','ACTIVE','PAST_DUE','GRACE_PERIOD','READ_ONLY','SUSPENDED','CANCELLED'] as const;
export type SubscriptionState=(typeof SUBSCRIPTION_STATES)[number];
export type Money=Readonly<{amount:string;currency:CurrencyCode}>;
export type Paginated<T>=Readonly<{data:T[];page:number;pageSize:number;total:number}>;
export type AuthenticatedPrincipal=Readonly<{userId:string;authUserId:string;email?:string}>;
export type TenantContext=Readonly<{tenantId:string;tenantSlug:string;membershipId:string;userId:string;branchIds:string[];permissions:string[];subscriptionState:SubscriptionState}>;

export type PlatformOverviewDto=Readonly<{
  totalCompanies:number;
  activeCompanies:number;
  trialCompanies:number;
  activeSubscriptions:number;
  activeUsers:number;
  mrrByCurrency:Readonly<Record<string,string>>;
}>;

export type NotificationDto=Readonly<{
  id:string;
  type:string;
  title:string;
  message:string|null;
  readAt:string|null;
  createdAt:string;
}>;

export type PosShiftSummaryDto=Readonly<{
  id:string;
  branchId:string;
  status:'OPEN'|'CLOSED';
  openingCash:string;
  cashSales:string;
  nonCashSales:string;
  refunds:string;
  cashRefunds:string;
  expectedCash:string;
  countedCash:string|null;
  difference:string|null;
  openedAt:string;
  closedAt:string|null;
}>;

export type PosRefundableLineDto=Readonly<{
  invoiceItemId:string;
  productId:string;
  description:string;
  soldQuantity:string;
  refundedQuantity:string;
  refundableQuantity:string;
  unitPrice:string;
  discount:string;
  tax:string;
  lineTotal:string;
}>;

export type PosSaleLookupDto=Readonly<{
  invoiceId:string;
  number:string;
  status:string;
  currency:string;
  total:string;
  customer:Readonly<{id:string;name:string}>|null;
  paymentMethod:'CASH'|'CARD'|'BANK_TRANSFER'|'OTHER';
  lines:ReadonlyArray<PosRefundableLineDto>;
}>;
