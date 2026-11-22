const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
Promise.all([p.customer.count(), p.invoice.count(), p.bill.count(), p.billOccurrence.count()])
  .then(r => { console.log('customers,invoices,bills,occurrences=', r.join(',')); return p.$disconnect(); })
  .catch(e => { console.error(e); process.exit(1); });
