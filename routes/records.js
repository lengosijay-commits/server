const router = require("express").Router();
const pool = require("../db");

const STATUSES = ["Pending", "In progress", "Completed"];
const COLUMNS = "id, title, category, description, status";
const RULES = {
  title: { label: "Title", min: 3, max: 80 },
  category: { label: "Category", min: 2, max: 40 },
  description: { label: "Description", min: 5, max: 300 }
};

function checkId(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
    return res.status(400).json({ message: "Id must be a positive whole number." });
  }
  req.recordId = Number(req.params.id);
  next();
}

function validate(req, res, next) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const clean = {};
  for (const [field, rule] of Object.entries(RULES)) {
    if (typeof body[field] !== "string") {
      return res.status(400).json({ message: `${rule.label} is required and must be text.` });
    }
    const value = body[field].trim();
    if (value.length < rule.min || value.length > rule.max) {
      return res.status(400).json({ message: `${rule.label} must have ${rule.min} to ${rule.max} characters.` });
    }
    clean[field] = value;
  }
  if (typeof body.status !== "string") {
    return res.status(400).json({ message: "Status is required and must be text." });
  }
  const status = body.status.trim();
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ message: "Status must be Pending, In progress or Completed." });
  }
  clean.status = status;
  req.clean = clean; // any client-supplied id is ignored
  next();
}

router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${COLUMNS} FROM records ORDER BY id`);
    res.status(200).json(result.rows);
  } catch (error) { next(error); }
});

router.get("/:id", checkId, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${COLUMNS} FROM records WHERE id = $1`, [req.recordId]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Record not found." });
    res.status(200).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.post("/", validate, async (req, res, next) => {
  try {
    const { title, category, description, status } = req.clean;
    const result = await pool.query(
      `INSERT INTO records (title, category, description, status)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [title, category, description, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.put("/:id", checkId, validate, async (req, res, next) => {
  try {
    const { title, category, description, status } = req.clean;
    const result = await pool.query(
      `UPDATE records SET title = $1, category = $2, description = $3, status = $4
       WHERE id = $5 RETURNING ${COLUMNS}`,
      [title, category, description, status, req.recordId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Record not found." });
    res.status(200).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.delete("/:id", checkId, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM records WHERE id = $1 RETURNING id", [req.recordId]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Record not found." });
    res.status(200).json({ message: "Record deleted." });
  } catch (error) { next(error); }
});

module.exports = router;
