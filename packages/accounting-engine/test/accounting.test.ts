import {describe,expect,it} from 'vitest';
import {assertBalanced,cashSaleJournal,creditSaleJournal,customerPaymentJournal,decimalToUnits,expenseJournal,prorateDecimal,purchaseOnCreditJournal,saleRefundJournal,supplierPaymentJournal} from '../src/index.js';

const total=(lines:ReadonlyArray<{debit:string;credit:string}>,side:'debit'|'credit')=>lines.reduce((sum,line)=>sum+decimalToUnits(line[side]),0n);

describe('accounting engine',()=>{
  it('rejects unbalanced journals',()=>expect(()=>assertBalanced([{accountCode:'1',debit:'1.0000',credit:'0.0000'},{accountCode:'2',debit:'0.0000',credit:'0.9000'}])).toThrow(/Unbalanced/));

  it.each([
    ['cash sale',cashSaleJournal({net:'100.0000',tax:'15.0000',cost:'55.0000',currency:'SAR'})],
    ['credit sale',creditSaleJournal({net:'100.0000',tax:'15.0000',cost:'55.0000',currency:'SAR'})],
    ['customer payment',customerPaymentJournal({amount:'115.0000',currency:'SAR'})],
    ['purchase',purchaseOnCreditJournal({inventory:'50.0000',tax:'7.5000',currency:'SAR'})],
    ['supplier payment',supplierPaymentJournal({amount:'57.5000',currency:'SAR'})],
    ['expense',expenseJournal({amount:'20.0000',tax:'3.0000',currency:'SAR'})],
    ['sale refund',saleRefundJournal({net:'50.0000',tax:'7.5000',cost:'27.5000',currency:'SAR'})]
  ])('%s produces a balanced journal',(_name,journal)=>{
    expect(()=>assertBalanced(journal.lines)).not.toThrow();
    expect(total(journal.lines,'debit')).toBe(total(journal.lines,'credit'));
  });

  it('prorates money with fixed-scale integer arithmetic',()=>{
    expect(prorateDecimal('95.0000','1.0000','2.0000')).toBe('47.5000');
    expect(prorateDecimal('15.0000','1.0000','3.0000')).toBe('5.0000');
  });
});
