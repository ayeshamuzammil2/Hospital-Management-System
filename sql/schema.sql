
CREATE TABLE IF NOT EXISTS specialities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) UNIQUE NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '🩺'
);

INSERT INTO specialities (name, icon) VALUES
  ('General Physician', '🩺'),
  ('Dentist', '🦷'),
  ('Eye Specialist', '👁️'),
  ('Cardiologist', '❤️'),
  ('Dermatologist', '🧴'),
  ('Orthopedic', '🦴'),
  ('ENT Specialist', '👂'),
  ('Neurologist', '🧠'),
  ('Gynecologist', '🤰'),
  ('Pediatrician', '🧒')
ON CONFLICT (name) DO NOTHING;

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  age INT NOT NULL CHECK (age > 0 AND age < 130),
  password_hash TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 5000.00, -- simulated wallet for card payments
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  speciality_id INT NOT NULL REFERENCES specialities(id),
  room_no VARCHAR(20) NOT NULL,
  fee NUMERIC(10,2) NOT NULL DEFAULT 1000.00,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- earnings wallet
  bio VARCHAR(300) DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Doctor's available slots (a doctor defines these at signup / anytime after)
CREATE TABLE IF NOT EXISTS doctor_slots (
  id SERIAL PRIMARY KEY,
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(doctor_id, slot_date, start_time)
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_id INT NOT NULL REFERENCES doctor_slots(id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting | checked | cancelled
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Payments / receipts
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  appointment_id INT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id INT NOT NULL REFERENCES patients(id),
  doctor_id INT NOT NULL REFERENCES doctors(id),
  amount NUMERIC(10,2) NOT NULL,
  method VARCHAR(10) NOT NULL, -- card | cash
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid
  receipt_no VARCHAR(40) UNIQUE NOT NULL,
  card_last4 VARCHAR(4),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session store table (used by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

CREATE INDEX IF NOT EXISTS idx_appt_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_slots_doctor_date ON doctor_slots(doctor_id, slot_date);
