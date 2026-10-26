"""Builds fake bank statements for testing Sweep's import. All names, numbers
and accounts are made up. Run: python3 practice-kit/generate.py"""
import json, os
from datetime import date, timedelta

OUT = os.path.dirname(os.path.abspath(__file__))
START, END = date(2026, 4, 1), date(2026, 10, 20)
tx = []  # (date, narration, amount, is_debit)

def monthly(day, narr, amt, months=range(4, 11), price=None):
    for m in months:
        d = date(2026, m, day)
        if START <= d <= END:
            a = price(m) if price else amt
            tx.append((d, narr.format(n=m * 1000 + day), a, True))

# Subscriptions that must be found
monthly(5, 'ACH D- TP ACH NETFLIX-NFX{n}', 0, price=lambda m: 499 if m < 8 else 649)  # price went up in Aug
monthly(3, 'UPI/DR/41{n}/SPOTIFY INDIA/ICIC/spotify.bdsi@icici/UPI Mandate', 139)
monthly(12, 'POS 4591XXXXXX1234 YOUTUBE PREMIUM GOOGLE', 129)
monthly(18, 'UPI-GOOGLE PLAY-playstore@axisbank-UTIB0000553-{n}-Google One', 130)
monthly(9, 'NACH DR PIXELHOST CLOUD HOSTING PLAN {n}', 299)
d = date(2026, 4, 2)
while d <= END:  # prepaid mobile, every 28 days
    tx.append((d, f'UPI-RELIANCE JIO-jio@ybl-YESB0YBLUPI-{d.toordinal()}-Recharge', 349, True))
    d += timedelta(days=28)
tx.append((date(2026, 6, 12), 'POS 4591XXXXXX1234 AMAZON PRIME MEMBERSHIP', 1499, True))  # yearly, once

# Things that must NOT show up as subscriptions
monthly(1, 'NEFT DR-HDFC0001234-LANDLORD RENT-{n}', 9000)
monthly(7, 'LOAN EMI 00{n} BAJAJ FINANCE', 2150)
monthly(15, 'UPI-RAHUL VERMA-9876543210@ybl-YESB0YBLUPI-{n}-split', 500)
monthly(20, 'BIL/ONL/00{n}/BESCOM ELECTRICITY', 0, price=lambda m: 600 + m * 37)
for i, (dd, amt) in enumerate([(2, 189.5), (9, 412), (13, 265.25), (21, 330), (27, 198)] * 7):
    m = 4 + i // 5
    if m <= 10:
        tx.append((date(2026, m, dd), f'UPI-SWIGGY-swiggy.stores@axb-UTIB0000100-{m}{dd}-Order', amt + m, True))
monthly(25, 'UPI-UBER INDIA-uber@axisbank-{n}-Ride', 0, price=lambda m: 140 + m * 11)
# Money in: must be ignored
monthly(1, 'NEFT CR-SBIN0001234-ACME LABS SALARY-{n}', 25000, )
tx[:] = [(a, b, c, False) if 'SALARY' in b else (a, b, c, e) for a, b, c, e in tx]
tx.append((date(2026, 8, 6), 'NETFLIX REFUND-NFX99', 649, False))

tx.sort(key=lambda t: t[0])
fmt = lambda v: f'{v:,.2f}'
q = lambda s: f'"{s}"'

def write(name, lines):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='') as f:
        f.write('\n'.join(lines) + '\n')

# 1. HDFC style: DD/MM/YY, Withdrawal/Deposit, account block on top, summary at the bottom
bal, rows = 50000.0, []
for d, n, a, debit in tx:
    bal += -a if debit else a
    rows.append(','.join([d.strftime('%d/%m/%y'), q(n), '0000' + str(d.toordinal())[-8:], d.strftime('%d/%m/%y'),
                          q(fmt(a)) if debit else '', '' if debit else q(fmt(a)), q(fmt(bal))]))
write('hdfc-practice.csv', ['HDFC BANK Ltd.', 'Account Name : PRACTICE USER (FAKE)', 'Statement From : 01/04/2026 To : 20/10/2026', '',
      'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance', *rows, '',
      'Opening Balance,Dr Count,Cr Count,Debits,Credits,Closing Bal', '"50,000.00",0,0,0,0,"0.00"'])

# 2. SBI style: "1 Apr 2026" dates, Debit/Credit, header repeated mid file like page breaks
bal, rows = 50000.0, []
for i, (d, n, a, debit) in enumerate(tx):
    bal += -a if debit else a
    if i and i % 40 == 0:
        rows.append('Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance')
    rows.append(','.join([d.strftime('%-d %b %Y'), d.strftime('%-d %b %Y'), q(n), '',
                          q(fmt(a)) if debit else '', '' if debit else q(fmt(a)), q(fmt(bal))]))
write('sbi-practice.csv', ['Account Name       :,PRACTICE USER (FAKE)', 'Account Number     :,00000000000', '',
      'Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance', *rows, '',
      '**This is a computer generated statement and does not require a signature.'])

# 3. ICICI style: BOM, DD/MM/YYYY, 0.00 in the empty side
bal, rows = 50000.0, []
for i, (d, n, a, debit) in enumerate(tx, 1):
    bal += -a if debit else a
    rows.append(','.join([str(i), d.strftime('%d/%m/%Y'), d.strftime('%d/%m/%Y'), '-', q(n),
                          q(fmt(a) if debit else '0.00'), q('0.00' if debit else fmt(a)), q(fmt(bal))]))
write('icici-practice.csv', ['﻿DETAILED STATEMENT', 'Transactions List - PRACTICE USER (FAKE)', '',
      'S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR ),Balance (INR )',
      *rows, '', 'Legends Used in Account Statement'])

# 4. Axis style: DD-MM-YYYY, one Amount column plus a DR/CR column
rows = [','.join([d.strftime('%d-%m-%Y'), '', q(n), q(fmt(a)), 'DR' if debit else 'CR', '', 'SOL001'])
        for d, n, a, debit in tx]
write('axis-practice.csv', ['Name :- PRACTICE USER (FAKE)', '',
      'Tran Date,CHQNO,PARTICULARS,AMOUNT,DR/CR,BAL,SOL', *rows, '', 'Unless the constituent notifies the bank...'])

# 5. Card style: semicolon separated, "05 Oct 26" dates, "1,499.00 Dr" amounts
rows = [';'.join([d.strftime('%d %b %y'), n, f'{fmt(a)} {"Dr" if debit else "Cr"}']) for d, n, a, debit in tx]
write('card-practice.csv', ['Card Statement;PRACTICE USER (FAKE)', ';;', 'Date;Transaction Details;Amount (INR)', *rows])

expected = {
    'debits': [[d.isoformat(), a] for d, n, a, debit in tx if debit],
    'must_find': {
        'Netflix': {'amount': 649, 'cycle': 'monthly'},
        'Spotify': {'amount': 139, 'cycle': 'monthly'},
        'YouTube Premium': {'amount': 129, 'cycle': 'monthly'},
        'Google One': {'amount': 130, 'cycle': 'monthly'},
        'Jio': {'amount': 349, 'cycle': 'custom', 'days': 28},
        'Amazon Prime': {'amount': 1499, 'cycle': 'yearly'},
        'Pixelhost Cloud': {'amount': 299, 'cycle': 'monthly'},
    },
    'must_not_find': ['rent', 'landlord', 'emi', 'bajaj', 'rahul', 'bescom', 'swiggy', 'uber', 'salary', 'refund'],
}
with open(os.path.join(OUT, 'expected.json'), 'w') as f:
    json.dump(expected, f, indent=1)
print(len(tx), 'transactions,', len(expected['debits']), 'money out')
