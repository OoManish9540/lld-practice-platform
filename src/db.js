/**
 * db.js
 *
 * Minimal file-backed JSON store.
 *
 * Why not SQLite/Postgres for a 2-day prototype?
 * - Zero native dependencies -> runs anywhere `node` runs, no build step.
 * - The assignment is an LLD exercise, not a persistence-layer exercise.
 * - The Repository class below is the seam: swapping this file for a real
 *   SQL/NoSQL implementation later means changing ONLY this module —
 *   nothing in services/, domain/, or routes/ needs to know.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePathFor(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readCollection(collection) {
  const fp = filePathFor(collection);
  if (!fs.existsSync(fp)) return [];
  const raw = fs.readFileSync(fp, 'utf-8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeCollection(collection, records) {
  const fp = filePathFor(collection);
  fs.writeFileSync(fp, JSON.stringify(records, null, 2), 'utf-8');
}

/**
 * Generic repository providing basic CRUD over a JSON-file collection.
 * Kept intentionally dumb — all domain logic lives in the model/service
 * classes, NOT here. This class only knows how to persist plain objects.
 */
class JsonRepository {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  all() {
    return readCollection(this.collectionName);
  }

  findById(id) {
    return this.all().find((r) => r.id === id) || null;
  }

  findWhere(predicate) {
    return this.all().filter(predicate);
  }

  insert(record) {
    const records = this.all();
    records.push(record);
    writeCollection(this.collectionName, records);
    return record;
  }

  update(id, updater) {
    const records = this.all();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    records[idx] = updater(records[idx]);
    writeCollection(this.collectionName, records);
    return records[idx];
  }

  reset(records = []) {
    writeCollection(this.collectionName, records);
  }
}

module.exports = { JsonRepository, DATA_DIR };
