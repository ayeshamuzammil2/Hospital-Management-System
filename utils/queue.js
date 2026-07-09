/**
 * Queue.js - classic FIFO Queue data structure (DSA).
 *
 * Used to model each doctor's "waiting room": patients who booked an
 * appointment for today are enqueued in the order of their slot time.
 * When a doctor marks a patient as checked, that patient is dequeued
 * and everyone behind them effectively moves one step closer to the front.
 *
 * We don't keep this queue alive in server memory (the server can restart
 * any time), instead we REBUILD the queue fresh from the database on every
 * request using the real Queue operations below - this keeps it correct
 * even across restarts / multiple server instances, while still genuinely
 * using enqueue/dequeue/peek queue semantics rather than just an array sort.
 */
class Queue {
  constructor() {
    this.items = [];
  }

  enqueue(item) {
    this.items.push(item);
    return this;
  }

  dequeue() {
    return this.items.shift();
  }

  peek() {
    return this.items[0];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }

  toArray() {
    return [...this.items];
  }
}

/**
 * Builds a doctor's live queue for a given day from a list of appointment
 * rows (already ordered waiting appointments) and returns the ordered
 * array with 1-based queue positions attached.
 *
 * @param {Array} waitingAppointments - appointments with status = 'waiting',
 *   pre-sorted by start_time ascending.
 */
function buildDoctorQueue(waitingAppointments) {
  const q = new Queue();
  waitingAppointments.forEach((appt) => q.enqueue(appt));

  const ordered = [];
  let position = 1;
  while (!q.isEmpty()) {
    const patient = q.dequeue();
    ordered.push({ ...patient, queue_position: position });
    position += 1;
  }
  return ordered;
}

module.exports = { Queue, buildDoctorQueue };
