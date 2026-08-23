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

export type WorkspaceSummaryDto=Readonly<{
  id:string;
  tenant:Readonly<{
    id:string;
    slug:string;
    name:string;
    baseCurrency:string;
    timezone:string;
    subscription:Readonly<{status:SubscriptionState;trialEndsAt:string|null;plan:Readonly<{code:string;name:string}>}>|null;
  }>;
  roles:ReadonlyArray<Readonly<{role:Readonly<{name:string}>}>>;
}>;

export type WorkspaceContextDto=Readonly<{
  tenant:Readonly<{id:string;slug:string;name:string;baseCurrency:string;timezone:string;language:string}>;
  branches:ReadonlyArray<Readonly<{id:string;name:string;code:string;warehouses:ReadonlyArray<Readonly<{id:string;name:string;code:string}>>}>>;
  permissions:readonly string[];
  subscriptionState:SubscriptionState;
}>;

export type ProductDto=Readonly<{
  id:string;
  sku:string;
  barcode:string|null;
  name:string;
  sellingPrice:string;
  costPrice:string;
  taxRate:string;
  trackInventory:boolean;
}>;

export type CustomerDto=Readonly<{
  id:string;
  name:string;
  phone:string|null;
  email:string|null;
}>;

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

export type ProfitLossDto=Readonly<{
  revenue:ReadonlyArray<Readonly<{code:string;name:string;amount:string}>>;
  expenses:ReadonlyArray<Readonly<{code:string;name:string;amount:string}>>;
  totalRevenue:string;
  totalExpenses:string;
  netProfit:string;
}>;

export type BalanceSheetAccountDto=Readonly<{
  id:string;
  code:string;
  nameAr:string;
  nameEn:string|null;
  type:'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE';
  amount:string;
}>;

export type BalanceSheetDto=Readonly<{
  assets:ReadonlyArray<BalanceSheetAccountDto>;
  liabilities:ReadonlyArray<BalanceSheetAccountDto>;
  equity:ReadonlyArray<BalanceSheetAccountDto>;
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

export type PosSaleReceiptDto=Readonly<{
  invoice:Readonly<{id:string;number:string;total:string;currency:string}>;
  payment:Readonly<{id?:string;amount:string}>|null;
  idempotentReplay:boolean;
}>;

export type PosRefundResultDto=Readonly<{
  salesReturn:Readonly<{id:string;amount:string}>;
  idempotentReplay:boolean;
}>;
