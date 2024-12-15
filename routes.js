const express = require('express');
const db = require('./db');
const router = express.Router();

router.get('/status', (req, res) => {
    const query = 'SELECT seat_id, seatrow_number, seat_number, is_booked FROM seats';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send('Database query error');
        } else {
            res.json(results);
        }
    });
}); 

// Route to book seats
router.post('/book_seats', (req, res) => {
    const { count } = req.body;

    // Validate input count
    if (count < 1 || count > 7) {
        return res.status(400).json({ message: 'You can only book between 1 to 7 seats at a time.' });
    }

    // Try to find seats in the same row
    const querySingleRow = `
        SELECT seatrow_number, GROUP_CONCAT(seat_id) AS seats, COUNT(*) AS available_seats
        FROM seats
        WHERE is_booked = 0
        GROUP BY seatrow_number
        HAVING available_seats >= ?
        ORDER BY seatrow_number
        LIMIT 1;
    `;

    db.query(querySingleRow, [count], (err, rows) => {
        if (err) return res.status(500).send('Database query error');

        if (rows.length > 0) {
            // Found enough seats in a single row
            const seatIds = rows[0].seats.split(',').slice(0, count).map(Number);
            reserveSeats(seatIds, res);
        } else {
            // If no single row has enough seats, find seats across multiple rows
            const queryMultipleRows = `
                SELECT seat_id FROM seats WHERE is_booked = 0 LIMIT ?;
            `;
            db.query(queryMultipleRows, [count], (err, seats) => {
                if (err) return res.status(500).send('Database query error');

                const seatIds = seats.map(s => s.seat_id);
                if (seatIds.length < count) {
                    return res.status(400).json({ message: 'Not enough seats available.' });
                }

                reserveSeats(seatIds, res);
            });
        }
    });
});

// Helper function to reserve seats
function reserveSeats(seatIds, res) {
    const placeholders = seatIds.map(() => '?').join(',');
    const query = `UPDATE seats SET is_booked = 1 WHERE seat_id IN (${placeholders})`;

    db.query(query, seatIds, (err, results) => {
        if (err) {
            res.status(500).send('Database query error');
        } else if (results.affectedRows === seatIds.length) {
            res.json({ message: 'Seats successfully reserved', seats: seatIds });
        } else {
            res.status(400).json({ message: 'Some seats were already booked or invalid' });
        }
    });
}

module.exports = router;
