# 🏥 MediCare+ — Hospital Management System

A full-stack hospital management platform with three portals — **Patient**, **Doctor**, and **Admin** — built with a **Node.js/Express** backend, a **Neon (serverless Postgres)** database, and a plain **HTML/CSS/JS** frontend.

It includes real **DSA implementations** at its core: a **Queue** drives each doctor's live waiting room, and a **Linked List** threads a patient's appointment history.

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express, `pg` (node-postgres)
- **Database:** Neon (PostgreSQL)
- **Frontend:** Plain HTML5, CSS3, JavaScript — no framework, no build step
- **DSA:** `utils/queue.js` (doctor waiting-room queue), `utils/linkedlist.js` (patient appointment history)

---

## 📂 Folder Structure

```
hms/
├── server.js                 # Express entry point
├── config/
│   └── db.js                  # Neon/Postgres connection pool
├── middleware/
│   └── auth.js                 # Role-based route guards
├── utils/
│   ├── queue.js                 # DSA Queue — doctor's live waiting room
│   └── linkedlist.js             # DSA Linked List — patient appointment history
├── routes/
│   ├── auth.js                   # signup / login / forgot-password (patient, doctor, admin)
│   ├── catalog.js                 # specialities, doctors, slots (public)
│   ├── patients.js                 # patient profile
│   ├── doctors.js                   # doctor profile + slot management
│   ├── appointments.js               # booking, payments, receipts, queue, check-in
│   └── admin.js                        # admin views + stats
├── sql/
│   └── schema.sql                      # run this once in Neon
└── public/                              # frontend (served statically by Express)
    ├── index.html                        # landing page + auth modal
    ├── patient/dashboard.html
    ├── doctor/dashboard.html
    └── admin/dashboard.html
```

---

## 🚀 Getting Started

### 1. Set Up the Neon Database

1. Create a free project at [neon.tech](https://neon.tech) (or use an existing one).
2. Copy the connection string from **Dashboard → Connection Details**.

### 2. Configure the Project

```bash
create .env
```

Open `.env` and fill in:

```
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-NEON-HOST/DBNAME?sslmode=require
SESSION_SECRET=your_own_random_secret
ADMIN_EMAIL=admin@medicare.com
ADMIN_PASSWORD=Admin@123
```

### 3. Create the Database Tables

Open the **Neon SQL editor** (or use `psql`) and run everything inside `sql/schema.sql`. This creates all tables and seeds 10 doctor specialities.

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

### 4. Install & Run (VS Code)

Open the project folder in **VS Code** and use its integrated terminal:

```bash
npm install        # installs express, pg, bcryptjs, etc.
npm start           # starts the server
```

Then open **http://localhost:3000**.

> This is a Node.js project, so VS Code needs zero setup. IntelliJ can run Node too (with its Node.js plugin), but VS Code's terminal is simpler here.

---

## 🔑 Logging in as Admin

Admin has no signup — credentials come directly from `.env`:

```
ADMIN_EMAIL=admin@medicare.com
ADMIN_PASSWORD=Admin@123
```

Click **"Admin"** in the top navigation on the landing page to log in.

---

## ✨ What's Included

### 👤 Patient Portal
- Simple signup (name, email, age, password — no OTP) and login, with forgot-password support
- Drawer-style dashboard
- Book appointments by **category → doctor → real open slot**, then pay by card or cash
- Instant receipt with room number and appointment timing
- View and cancel upcoming appointments
- Edit profile

### 🩺 Doctor Portal
- Signup with speciality (10 categories), room number, and consultation fee
- Login with forgot-password support
- Live patient waiting-room queue, powered by a genuine DSA **Queue**
- Mark patients as "checked" — automatically dequeues them
- Confirm cash payments once physically received
- Add new appointment slots
- Edit profile

### 🛡 Admin Portal
- Fixed credentials from `.env` — no signup
- View every registered patient and doctor
- Daily revenue chart (14 days)
- Revenue-by-speciality chart
- Pending vs. paid payment totals

### 💰 Wallets & Payments
- Every patient starts with a simulated **Rs. 5,000 wallet balance**
- **Card payments** deduct instantly from the patient's wallet and credit the doctor's balance right away
- **Cash payments** stay **pending** until the doctor confirms they physically received it — only then is the doctor's balance updated

### 🧮 Real Data Structures
- **Queue** (`utils/queue.js`) — rebuilt fresh from the database on every request using genuine `enqueue`/`dequeue` operations, so the doctor's waiting room stays accurate even after a server restart
- **Linked List** (`utils/linkedlist.js`) — threads together a patient's full appointment history

---

## 📝 Notes

- Card payments accept **any dummy values** — this is a simulation, not a real payment gateway.
- Appointment slots are defined by the doctor; patients can only pick from real open slots, never a custom time.
- If the app can't reach the database, double-check `DATABASE_URL` in `.env` and confirm you ran `sql/schema.sql` in the Neon SQL editor first.
- Keep `.env` out of version control — it holds your database connection string and admin credentials. Make sure it's listed in `.gitignore` before pushing to GitHub.

<img width="959" height="502" alt="image" src="https://github.com/user-attachments/assets/0c4d0e6d-c823-4b7c-b39d-d098cfc61704" />
<img width="959" height="505" alt="image" src="https://github.com/user-attachments/assets/e32ef1d0-aea5-4ee3-9f69-5aeba8d3dc82" />
