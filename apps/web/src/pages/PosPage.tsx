import {useMemo,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {addDecimals,compareDecimals,multiplyDecimals,subtractDecimals} from '@mohammedsaas/accounting-engine';
import type {CustomerDto,PosRefundResultDto,PosSaleLookupDto,PosSaleReceiptDto,PosShiftSummaryDto,ProductDto,WorkspaceContextDto} from '@mohammedsaas/types';
import {ArrowRight,Minus,Pause,Plus,Printer,Search,Trash2,UserRound,X} from 'lucide-react';
import {Link,useParams} from 'react-router-dom';
import {api} from '../lib/api.js';

type PaymentMethod=PosSaleLookupDto['paymentMethod'];
type CartLine={product:ProductDto;quantity:number;discount:string};
type ReceiptView={result:PosSaleReceiptDto;customerName:string|null};
const heldKey=(slug:string)=>`mohammedsaas:held:${slug}`;
const decimalPattern=/^\d+(\.\d{0,4})?$/;
const validDecimal=(value:string)=>decimalPattern.test(value)&&value!=='';

export function PosPage(){
  const{workspaceSlug=''}=useParams();
  const queryClient=useQueryClient();
  const[search,setSearch]=useState('');
  const[cart,setCart]=useState<CartLine[]>([]);
  const[method,setMethod]=useState<PaymentMethod>('CASH');
  const[openingCash,setOpeningCash]=useState('0.0000');
  const[receipt,setReceipt]=useState<ReceiptView|null>(null);
  const[selectedCustomer,setSelectedCustomer]=useState<CustomerDto|null>(null);
  const[customerPanel,setCustomerPanel]=useState(false);
  const[customerSearch,setCustomerSearch]=useState('');
  const[newCustomerName,setNewCustomerName]=useState('');
  const[refundPanel,setRefundPanel]=useState(false);
  const[refundNumber,setRefundNumber]=useState('');
  const[refundSale,setRefundSale]=useState<PosSaleLookupDto|null>(null);
  const[refundQuantities,setRefundQuantities]=useState<Record<string,string>>({});
  const[refundReason,setRefundReason]=useState('');
  const[refundConfirm,setRefundConfirm]=useState(false);
  const[refundSuccess,setRefundSuccess]=useState('');
  const[closePanel,setClosePanel]=useState(false);
  const[countedCash,setCountedCash]=useState('');
  const[closeConfirm,setCloseConfirm]=useState(false);

  const context=useQuery({queryKey:['pos-context',workspaceSlug],queryFn:()=>api<WorkspaceContextDto>(`/workspaces/${workspaceSlug}/context`)});
  const branch=context.data?.branches[0];
  const warehouse=branch?.warehouses[0];
  const permissions=context.data?.permissions??[];
  const canSell=permissions.includes('pos.sell');
  const canOpenShift=permissions.includes('pos.open_shift');
  const canCloseShift=permissions.includes('pos.close_shift');
  const canDiscount=permissions.includes('pos.discount');
  const canRefund=permissions.includes('pos.refund');
  const canViewProducts=permissions.includes('products.view');
  const canViewCustomers=permissions.includes('customers.view');
  const canCreateCustomer=permissions.includes('customers.create');

  const products=useQuery({queryKey:['pos-products',workspaceSlug,search],enabled:canSell&&canViewProducts,queryFn:()=>api<ProductDto[]>(`/workspaces/${workspaceSlug}/products?q=${encodeURIComponent(search)}`)});
  const shift=useQuery({queryKey:['pos-shift',workspaceSlug,branch?.id],enabled:Boolean(branch)&&canOpenShift,queryFn:()=>api<PosShiftSummaryDto|null>(`/workspaces/${workspaceSlug}/pos/shifts/current?branchId=${branch!.id}`)});
  const customers=useQuery({queryKey:['pos-customers',workspaceSlug,customerSearch],enabled:customerPanel&&canViewCustomers,queryFn:()=>api<{data:CustomerDto[]}>(`/workspaces/${workspaceSlug}/customers?q=${encodeURIComponent(customerSearch)}`)});
  const closeSummary=useQuery({queryKey:['pos-shift-summary',workspaceSlug,shift.data?.id],enabled:closePanel&&canCloseShift&&Boolean(shift.data?.id),queryFn:()=>api<PosShiftSummaryDto>(`/workspaces/${workspaceSlug}/pos/shifts/${shift.data!.id}/summary`)});

  const totals=useMemo(()=>cart.reduce((sum,line)=>{
    const gross=multiplyDecimals(String(line.quantity),line.product.sellingPrice);
    const discount=validDecimal(line.discount)?line.discount:'0.0000';
    const net=compareDecimals(discount,gross)>0?'0.0000':subtractDecimals(gross,discount);
    const tax=multiplyDecimals(net,line.product.taxRate);
    return addDecimals(sum,addDecimals(net,tax));
  },'0.0000'),[cart]);

  const openShift=useMutation({mutationFn:()=>api<PosShiftSummaryDto>(`/workspaces/${workspaceSlug}/pos/shifts/open`,{method:'POST',body:JSON.stringify({branchId:branch!.id,openingCash})}),onSuccess:async()=>queryClient.invalidateQueries({queryKey:['pos-shift',workspaceSlug]})});
  const completeSale=useMutation({mutationFn:()=>api<PosSaleReceiptDto>(`/workspaces/${workspaceSlug}/pos/sales`,{method:'POST',body:JSON.stringify({branchId:branch!.id,warehouseId:warehouse!.id,shiftId:shift.data!.id,customerId:selectedCustomer?.id,paymentMethod:method,idempotencyKey:crypto.randomUUID(),items:cart.map(line=>({productId:line.product.id,quantity:String(line.quantity),discount:line.discount||'0.0000'}))})}),onSuccess:result=>{setReceipt({result,customerName:selectedCustomer?.name??null});setCart([]);setSelectedCustomer(null);void queryClient.invalidateQueries({queryKey:['pos-shift-summary',workspaceSlug]});}});
  const createCustomer=useMutation({mutationFn:()=>api<CustomerDto>(`/workspaces/${workspaceSlug}/customers`,{method:'POST',body:JSON.stringify({name:newCustomerName,creditLimit:'0.0000'})}),onSuccess:customer=>{setSelectedCustomer(customer);setNewCustomerName('');setCustomerPanel(false);void queryClient.invalidateQueries({queryKey:['pos-customers',workspaceSlug]});}});
  const lookupRefund=useMutation({mutationFn:()=>api<PosSaleLookupDto|null>(`/workspaces/${workspaceSlug}/pos/sales/lookup?number=${encodeURIComponent(refundNumber)}`),onSuccess:sale=>{setRefundSale(sale);setRefundQuantities({});setRefundConfirm(false);}});
  const refund=useMutation({mutationFn:()=>api<PosRefundResultDto>(`/workspaces/${workspaceSlug}/pos/sales/${refundSale!.invoiceId}/refund`,{method:'POST',body:JSON.stringify({shiftId:shift.data!.id,warehouseId:warehouse!.id,reason:refundReason,idempotencyKey:crypto.randomUUID(),items:Object.entries(refundQuantities).filter(([,quantity])=>validDecimal(quantity)&&compareDecimals(quantity,'0.0000')>0).map(([invoiceItemId,quantity])=>({invoiceItemId,quantity}))})}),onSuccess:result=>{setRefundSuccess(`تم تسجيل المرتجع بقيمة ${result.salesReturn.amount}`);setRefundConfirm(false);setRefundReason('');setRefundQuantities({});void lookupRefund.mutateAsync();void queryClient.invalidateQueries({queryKey:['pos-shift-summary',workspaceSlug]});}});
  const closeShift=useMutation({mutationFn:()=>api<PosShiftSummaryDto>(`/workspaces/${workspaceSlug}/pos/shifts/${shift.data!.id}/close`,{method:'POST',body:JSON.stringify({countedCash})}),onSuccess:async()=>{setClosePanel(false);setCloseConfirm(false);setCountedCash('');await queryClient.invalidateQueries({queryKey:['pos-shift',workspaceSlug]});}});

  const addProduct=(product:ProductDto)=>setCart(current=>{const existing=current.find(line=>line.product.id===product.id);return existing?current.map(line=>line.product.id===product.id?{...line,quantity:line.quantity+1}:line):[...current,{product,quantity:1,discount:'0.0000'}];});
  const holdCart=()=>{if(cart.length){localStorage.setItem(heldKey(workspaceSlug),JSON.stringify(cart));setCart([]);}};
  const resumeCart=()=>{try{const raw=JSON.parse(localStorage.getItem(heldKey(workspaceSlug)??'[]') as unknown;if(Array.isArray(raw)){const restored=raw as CartLine[];setCart(canDiscount?restored:restored.map(line=>({...line,discount:'0.0000'})));}}finally{localStorage.removeItem(heldKey(workspaceSlug));}};
  const refundableItems=Object.entries(refundQuantities).filter(([,quantity])=>validDecimal(quantity)&&compareDecimals(quantity,'0.0000')>0);
  const previewDifference=closeSummary.data&&validDecimal(countedCash)?subtractDecimals(countedCash,closeSummary.data.expectedCash):null;
  const startRefundLookup=()=>{setRefundSuccess('');setRefundSale(null);setRefundQuantities({});setRefundConfirm(false);lookupRefund.mutate();};

  if(context.isLoading)return <div className="screen-center"><div className="loader"/></div>;
  if(context.isError||!context.data)return <div className="screen-center"><div className="pos-state-card"><h2>تعذر تحميل نقطة البيع</h2><p>لم نتمكن من تحميل سياق مساحة العمل.</p><Link to="/workspaces">العودة لمساحات العمل</Link></div></div>;
  if(!branch||!warehouse)return <div className="screen-center"><div className="pos-state-card"><h2>إعداد نقطة البيع غير مكتمل</h2><p>يجب وجود فرع ومخزن نشطين قبل بدء البيع.</p><Link to={`/app/${workspaceSlug}`}>العودة للنظام</Link></div></div>;
  if(!canSell||!canViewProducts)return <div className="screen-center"><div className="pos-state-card"><h2>لا توجد صلاحية كافية</h2><p>نقطة البيع تتطلب صلاحية البيع وعرض المنتجات.</p><Link to={`/app/${workspaceSlug}`}>العودة للنظام</Link></div></div>;
  if(!canOpenShift)return <div className="screen-center"><div className="pos-state-card"><h2>صلاحية الوردية مطلوبة</h2><p>لا يمكن تشغيل POS بدون صلاحية عرض/فتح الوردية.</p><Link to={`/app/${workspaceSlug}`}>العودة للنظام</Link></div></div>;
  if(shift.isLoading)return <div className="screen-center"><div className="loader"/></div>;
  if(shift.isError)return <div className="screen-center"><div className="pos-state-card"><h2>تعذر التحقق من الوردية</h2><p>أعد المحاولة أو ارجع للنظام.</p><button className="primary-button" onClick={()=>void shift.refetch()}>إعادة المحاولة</button><Link to={`/app/${workspaceSlug}`}>العودة للنظام</Link></div></div>;
  if(shift.data===null)return <div className="pos-open" dir="rtl"><div className="pos-open-card"><h1>فتح الوردية</h1><p>سجل النقد الافتتاحي الفعلي قبل بدء البيع.</p><div className="shift-open-context"><strong>{context.data.tenant.name}</strong><span>{branch.name}</span></div><label>النقد الافتتاحي<input value={openingCash} onChange={event=>setOpeningCash(event.target.value)} inputMode="decimal"/></label><button className="primary-button" disabled={!validDecimal(openingCash)||openShift.isPending} onClick={()=>openShift.mutate()}>{openShift.isPending?'جارٍ الفتح…':'فتح الوردية'}</button>{openShift.isError&&<div className="form-error">تعذر فتح الوردية.</div>}<Link to={`/app/${workspaceSlug}`}>العودة للنظام</Link></div></div>;

  return <div className="pos-shell" dir="rtl">
    <header className="pos-header"><Link to={`/app/${workspaceSlug}`}><ArrowRight size={18}/></Link><div><strong>{context.data.tenant.name}</strong><small>{branch.name} · بدأت {new Date(shift.data.openedAt).toLocaleTimeString('ar')}</small></div><div className="pos-header-actions">{canRefund&&<button onClick={()=>{setRefundPanel(true);setRefundSuccess('');}}>مرتجع</button>}{canCloseShift&&<button onClick={()=>{setClosePanel(true);setCloseConfirm(false);setCountedCash('');}}>إغلاق الوردية</button>}</div></header>
    <main className="pos-main">
      <section className="pos-products"><div className="pos-search"><Search size={18}/><input autoFocus value={search} onChange={event=>setSearch(event.target.value)} placeholder="ابحث بالاسم أو SKU أو الباركود"/></div>{products.isLoading?<div className="pos-inline-state"><div className="loader"/></div>:products.isError?<div className="pos-inline-state form-error">تعذر تحميل المنتجات.</div>:products.data?.length?<div className="product-grid">{products.data.map(product=><button key={product.id} className="product-tile" onClick={()=>addProduct(product)}><div className="product-icon">{product.name.slice(0,1)}</div><strong>{product.name}</strong><small>{product.sku}</small><b>{product.sellingPrice} {context.data.tenant.baseCurrency}</b></button>)}</div>:<div className="pos-inline-state">لا توجد منتجات مطابقة.</div>}</section>
      <aside className="pos-cart">
        <div className="cart-title"><h2>السلة</h2><span>{cart.length}</span></div>
        {canViewCustomers?<><button className="customer-select" onClick={()=>setCustomerPanel(true)}><UserRound size={16}/><span>{selectedCustomer?selectedCustomer.name:'عميل نقدي / بدون حساب'}</span></button>{selectedCustomer&&<button className="customer-clear" onClick={()=>setSelectedCustomer(null)}><X size={14}/>إزالة العميل</button>}</>:<div className="customer-select static"><UserRound size={16}/><span>عميل نقدي / بدون حساب</span></div>}
        <div className="cart-lines">{cart.length===0?<div className="pos-cart-empty">أضف منتجًا لبدء الفاتورة.</div>:cart.map(line=>{const gross=multiplyDecimals(String(line.quantity),line.product.sellingPrice);return <div className="cart-line pos-cart-line" key={line.product.id}><div><strong>{line.product.name}</strong><small>{line.product.sku}</small>{canDiscount&&<label className="discount-field">خصم السطر<input inputMode="decimal" value={line.discount} onChange={event=>{const value=event.target.value;if(value===''||decimalPattern.test(value))setCart(current=>current.map(item=>item.product.id===line.product.id?{...item,discount:value}:item));}}/><span>من {gross}</span></label>}</div><div className="qty"><button onClick={()=>setCart(current=>current.map(item=>item.product.id===line.product.id?{...item,quantity:Math.max(1,item.quantity-1)}:item))}><Minus size={14}/></button><b>{line.quantity}</b><button onClick={()=>setCart(current=>current.map(item=>item.product.id===line.product.id?{...item,quantity:item.quantity+1}:item))}><Plus size={14}/></button></div><strong>{gross}</strong><button className="icon-danger" onClick={()=>setCart(current=>current.filter(item=>item.product.id!==line.product.id))}><Trash2 size={15}/></button></div>;})}</div>
        <div className="cart-tools"><button disabled={!cart.length} onClick={holdCart}><Pause size={15}/>تعليق</button><button onClick={resumeCart}>استئناف</button></div>
        <div className="payment-methods">{(['CASH','CARD','BANK_TRANSFER','OTHER'] as PaymentMethod[]).map(value=><button key={value} className={method===value?'active':''} onClick={()=>setMethod(value)}>{value==='CASH'?'نقد':value==='CARD'?'بطاقة':value==='BANK_TRANSFER'?'تحويل':'أخرى'}</button>)}</div>
        <div className="cart-total"><span>الإجمالي التقديري</span><strong>{totals} {context.data.tenant.baseCurrency}</strong></div><small className="server-total-note">القيمة النهائية والضريبة والمخزون يعاد احتسابها والتحقق منها على الخادم.</small>
        <button className="complete-sale" disabled={!cart.length||completeSale.isPending||cart.some(line=>!validDecimal(line.discount)||compareDecimals(line.discount,multiplyDecimals(String(line.quantity),line.product.sellingPrice))>0)} onClick={()=>completeSale.mutate()}>{completeSale.isPending?'جارٍ إتمام البيع…':'إتمام البيع'}</button>
        {completeSale.isError&&<div className="form-error">تعذر إتمام البيع. راجع الوردية والمخزون والصلاحيات.</div>}
      </aside>
    </main>

    {customerPanel&&canViewCustomers&&<div className="receipt-modal"><div className="pos-dialog"><div className="dialog-head"><h2>اختيار العميل</h2><button onClick={()=>setCustomerPanel(false)}><X/></button></div><button className="secondary-button" onClick={()=>{setSelectedCustomer(null);setCustomerPanel(false);}}>عميل نقدي / بدون حساب</button><div className="pos-search"><Search size={16}/><input value={customerSearch} onChange={event=>setCustomerSearch(event.target.value)} placeholder="ابحث بالاسم أو الهاتف"/></div><div className="customer-results">{customers.isLoading?<div className="pos-inline-state"><div className="loader"/></div>:customers.isError?<div className="form-error">تعذر تحميل العملاء.</div>:customers.data?.data.length?customers.data.data.map(customer=><button key={customer.id} onClick={()=>{setSelectedCustomer(customer);setCustomerPanel(false);}}><strong>{customer.name}</strong><small>{customer.phone??'بدون هاتف'}</small></button>):<div className="pos-inline-state">لا يوجد عملاء مطابقون.</div>}</div>{canCreateCustomer&&<form className="inline-form" onSubmit={event=>{event.preventDefault();if(newCustomerName.trim())createCustomer.mutate();}}><input value={newCustomerName} onChange={event=>setNewCustomerName(event.target.value)} placeholder="اسم عميل جديد"/><button className="primary-button compact" disabled={!newCustomerName.trim()||createCustomer.isPending}>{createCustomer.isPending?'جارٍ الإنشاء…':'إنشاء واختيار'}</button>{createCustomer.isError&&<div className="form-error">تعذر إنشاء العميل.</div>}</form>}</div></div>}

    {refundPanel&&canRefund&&<div className="receipt-modal"><div className="pos-dialog refund-dialog"><div className="dialog-head"><h2>مرتجع نقطة بيع</h2><button onClick={()=>{setRefundPanel(false);setRefundConfirm(false);}}><X/></button></div><div className="inline-form"><input value={refundNumber} onChange={event=>setRefundNumber(event.target.value)} placeholder="رقم الفاتورة INV-000001"/><button className="primary-button compact" disabled={!refundNumber.trim()||lookupRefund.isPending} onClick={startRefundLookup}>{lookupRefund.isPending?'جارٍ البحث…':'بحث'}</button></div>{lookupRefund.isError&&<div className="form-error">تعذر البحث عن الفاتورة.</div>}{lookupRefund.isSuccess&&!refundSale&&<div className="form-error">لم يتم العثور على فاتورة POS بهذا الرقم.</div>}{refundSale&&<><div className="refund-summary"><strong>{refundSale.number}</strong><span>{refundSale.customer?.name??'عميل نقدي'}</span><span>{refundSale.total} {refundSale.currency}</span></div>{refundSale.lines.some(line=>compareDecimals(line.refundableQuantity,'0.0000')>0)?<div className="refund-lines">{refundSale.lines.map(line=><div className="refund-line" key={line.invoiceItemId}><div><strong>{line.description}</strong><small>المباع {line.soldQuantity} · المرتجع سابقًا {line.refundedQuantity} · المتاح {line.refundableQuantity}</small></div><input disabled={compareDecimals(line.refundableQuantity,'0.0000')===0} inputMode="decimal" value={refundQuantities[line.invoiceItemId]??''} onChange={event=>{const value=event.target.value;if(value===''||decimalPattern.test(value))setRefundQuantities(current=>({...current,[line.invoiceItemId]:value}));}} placeholder="الكمية"/></div>)}</div>:<div className="pos-inline-state">تم إرجاع جميع كميات هذه الفاتورة.</div>}<label>سبب المرتجع<textarea value={refundReason} onChange={event=>setRefundReason(event.target.value)} placeholder="سبب واضح للمرتجع"/></label>{refundSuccess&&<div className="success-box">{refundSuccess}</div>}{refund.isError&&<div className="form-error">تعذر تنفيذ المرتجع. لم يتم اعتماد أي تغيير غير مكتمل.</div>}<button className="primary-button" disabled={refundableItems.length===0||refundReason.trim().length<2||refundableItems.some(([id,quantity])=>{const line=refundSale.lines.find(item=>item.invoiceItemId===id);return !line||compareDecimals(quantity,line.refundableQuantity)>0;})} onClick={()=>setRefundConfirm(true)}>مراجعة المرتجع</button></>}{refundConfirm&&refundSale&&<div className="confirm-layer"><div className="confirm-box"><h3>تأكيد المرتجع</h3><p>سيتم إعادة الكميات المحددة للمخزون وإنشاء قيد محاسبي عكسي مستقل. لا يمكن حذف التاريخ المالي بعد التنفيذ.</p><div className="confirm-actions"><button onClick={()=>setRefundConfirm(false)}>رجوع</button><button className="danger-button" disabled={refund.isPending} onClick={()=>refund.mutate()}>{refund.isPending?'جارٍ التنفيذ…':'تأكيد وتنفيذ المرتجع'}</button></div></div></div>}</div></div>}

    {closePanel&&canCloseShift&&<div className="receipt-modal"><div className="pos-dialog close-dialog"><div className="dialog-head"><h2>إغلاق الوردية</h2><button onClick={()=>{setClosePanel(false);setCloseConfirm(false);}}><X/></button></div>{closeSummary.isLoading?<div className="pos-inline-state"><div className="loader"/></div>:closeSummary.isError?<div className="form-error">تعذر تحميل ملخص الوردية.</div>:closeSummary.data&&<><div className="shift-summary-grid"><div><span>وقت البداية</span><strong>{new Date(closeSummary.data.openedAt).toLocaleString('ar')}</strong></div><div><span>النقد الافتتاحي</span><strong>{closeSummary.data.openingCash}</strong></div><div><span>المبيعات النقدية</span><strong>{closeSummary.data.cashSales}</strong></div><div><span>المبيعات غير النقدية</span><strong>{closeSummary.data.nonCashSales}</strong></div><div><span>المرتجعات</span><strong>{closeSummary.data.refunds}</strong></div><div><span>المرتجعات النقدية</span><strong>{closeSummary.data.cashRefunds}</strong></div><div className="summary-emphasis"><span>النقد المتوقع</span><strong>{closeSummary.data.expectedCash}</strong></div></div><label>النقد المعدود فعليًا<input autoFocus inputMode="decimal" value={countedCash} onChange={event=>setCountedCash(event.target.value)} placeholder="0.0000"/></label>{previewDifference!==null&&<div className="variance-preview"><span>الفرق</span><strong>{previewDifference}</strong></div>}{closeShift.isError&&<div className="form-error">تعذر إغلاق الوردية. لم يتم حفظ إغلاق جزئي.</div>}<button className="primary-button" disabled={!validDecimal(countedCash)} onClick={()=>setCloseConfirm(true)}>مراجعة الإغلاق</button>{closeConfirm&&<div className="confirm-layer"><div className="confirm-box"><h3>تأكيد إغلاق الوردية</h3><p>المتوقع: <strong>{closeSummary.data.expectedCash}</strong><br/>المعدود: <strong>{countedCash}</strong><br/>الفرق: <strong>{previewDifference}</strong></p><div className="confirm-actions"><button onClick={()=>setCloseConfirm(false)}>رجوع</button><button className="danger-button" disabled={closeShift.isPending} onClick={()=>closeShift.mutate()}>{closeShift.isPending?'جارٍ الإغلاق…':'تأكيد وإغلاق الوردية'}</button></div></div></div>}</>}</div></div>}

    {receipt&&<div className="receipt-modal"><div className="receipt-paper" id="receipt"><h2>{context.data.tenant.name}</h2><p>{receipt.result.invoice.number}</p>{receipt.customerName&&<p>{receipt.customerName}</p>}<h1>{receipt.result.invoice.total} {receipt.result.invoice.currency}</h1><button className="primary-button" onClick={()=>window.print()}><Printer size={16}/>طباعة الإيصال</button><button onClick={()=>setReceipt(null)}>إغلاق</button></div></div>}
  </div>;
}
