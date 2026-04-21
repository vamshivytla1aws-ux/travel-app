CREATE TABLE IF NOT EXISTS finance_loans (
  id BIGSERIAL PRIMARY KEY,
  registration_no VARCHAR(40) NOT NULL,
  vehicle_type_or_bus_name VARCHAR(160) NOT NULL,
  purchase_date DATE NOT NULL,
  vendor_dealer VARCHAR(160),
  financier_bank_name VARCHAR(160) NOT NULL,
  loan_account_number VARCHAR(80) NOT NULL UNIQUE,
  loan_type VARCHAR(80),
  interest_rate NUMERIC(8,3) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  total_bus_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_bus_cost >= 0),
  down_payment NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  loan_amount_taken NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (loan_amount_taken >= 0),
  processing_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (processing_fee >= 0),
  insurance_amount_financed NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (insurance_amount_financed >= 0),
  emi_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (emi_amount >= 0),
  loan_start_date DATE NOT NULL,
  loan_end_date DATE NOT NULL,
  total_tenure_months INTEGER NOT NULL DEFAULT 0 CHECK (total_tenure_months >= 0),
  months_paid INTEGER NOT NULL DEFAULT 0 CHECK (months_paid >= 0),
  months_left INTEGER NOT NULL DEFAULT 0 CHECK (months_left >= 0),
  outstanding_principal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (outstanding_principal >= 0),
  outstanding_interest NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (outstanding_interest >= 0),
  next_emi_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'overdue', 'repossessed')),
  created_by BIGINT REFERENCES users(id),
  updated_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_loans_end_after_start CHECK (loan_end_date > loan_start_date)
);

CREATE INDEX IF NOT EXISTS idx_finance_loans_status ON finance_loans(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_finance_loans_registration ON finance_loans(registration_no);
CREATE INDEX IF NOT EXISTS idx_finance_loans_next_emi_date ON finance_loans(next_emi_date);
