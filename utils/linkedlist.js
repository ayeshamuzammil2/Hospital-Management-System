/**
 * linkedlist.js - Singly Linked List (DSA)
 *
 * Used to represent a patient's appointment history as a chronological
 * timeline. Rows come back from Postgres already ordered by date, and we
 * thread them into a real linked list, then traverse it to produce the
 * final ordered history array sent to the frontend - a natural fit since
 * a medical history is inherently a linear, ordered chain of visits.
 */
class Node {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  append(data) {
    const node = new Node(data);
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length += 1;
    return this;
  }

  toArray() {
    const arr = [];
    let current = this.head;
    while (current) {
      arr.push(current.data);
      current = current.next;
    }
    return arr;
  }
}

function buildHistory(rows) {
  const list = new LinkedList();
  rows.forEach((row) => list.append(row));
  return list.toArray();
}

module.exports = { LinkedList, buildHistory };
