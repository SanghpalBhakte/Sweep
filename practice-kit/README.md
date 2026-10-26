# Practice kit

Fake bank statements for trying Sweep's import. Every name, account and number is made up.

| File | Looks like | Tricky bits |
|---|---|---|
| hdfc-practice.csv | HDFC | DD/MM/YY dates, account details on top, summary at the bottom |
| sbi-practice.csv | SBI | "1 Apr 2026" dates, header repeated in the middle like page breaks |
| icici-practice.csv | ICICI | BOM, DD/MM/YYYY, 0.00 in the empty column |
| axis-practice.csv | Axis | one Amount column plus a DR/CR column |
| card-practice.csv | Credit card | semicolons, "05 Oct 26" dates, "1,499.00 Dr" amounts |

Each file should give exactly these 7 subscriptions:

- Netflix ₹649 monthly (price went up from ₹499 in August)
- Spotify ₹139 monthly (UPI mandate)
- YouTube Premium ₹129 monthly (card)
- Google One ₹130 monthly (Google Play)
- Jio ₹349 every 28 days
- Amazon Prime ₹1,499 yearly (charged once)
- Pixelhost Cloud ₹299 monthly (NACH auto debit, an app Sweep doesn't know, so it shows unticked)

And never: rent, loan EMI, money to a friend, electricity bill, Swiggy, Uber, salary or a refund.

`src/lib/utils/practiceKit.test.ts` checks all of this on every test run.
To change the data, edit `generate.py` and run `python3 practice-kit/generate.py`.
