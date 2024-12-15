const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

// Enable CORS for your React app's port
app.use(cors({ origin: 'http://localhost:3000' }));

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Jsr@1234',
    database: 'train_booking'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL database.');
});

app.get('/status', (req, res) => {
    const query = 'SELECT seat_id, seatrow_number, seat_number, is_booked FROM seats';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send('Database query error');
        } else {
            res.json(results);
        }
    });
}); 

app.post('/check_availability', (req, res) => {
    const { count } = req.body;
    console.log("req.body", req.body);    
 
    // Validate seat count
    if (count < 1 || count > 7) {
        return res.status(400).json({ message: 'Can only reserve between 1 to 7 seats at a time.' });
    }
 
    // Step 1: Look for available seats in the same row
    const querySingleRow = `
        SELECT seatrow_number
        FROM seats
        WHERE is_booked = 0
        GROUP BY seatrow_number
        HAVING COUNT(*) >= ?
        LIMIT 1;
    `;
 
    db.query(querySingleRow, [count], (err, results) => {
        if (err) return res.status(500).send('Database query error');
 
        if (results.length > 0) {
            // Found seats in a single row
            const row = results[0].seatrow_number;
            db.query(`SELECT seat_id FROM seats WHERE seatrow_number = ? AND is_booked = 0 LIMIT ?`, [row, count], (err, seats) => {
                if (err) return res.status(500).send('Database query error');
                res.json(seats.map(s => s.seat_id));
            });
        } else {
            // Step 2: Look for nearby seats in multiple rows
            const queryMultipleRows = `
                SELECT seat_id FROM seats WHERE is_booked = 0 LIMIT ?
            `;
            db.query(queryMultipleRows, [count], (err, seats) => {
                if (err) return res.status(500).send('Database query error');
                res.json(seats.map(s => s.seat_id));
            });
        }
    });
}); 

app.post('/reserve', (req, res) => {
    const { seat_ids } = req.body;
 
    // Update seat status to booked
    const placeholders = seat_ids.map(() => '?').join(',');
    const query = `UPDATE seats SET is_booked = 1 WHERE seat_id IN (${placeholders})`;
 
    db.query(query, seat_ids, (err, results) => {
        if (err) {
            res.status(500).send('Database query error');
        } else if (results.affectedRows === seat_ids.length) {
            res.json({ message: 'Seats successfully reserved', seats: seat_ids });
        } else {
            res.status(400).json({ message: 'Some seats were already booked or invalid' });
        }
    });
});


// Route to book seats
app.post('/book_seats', (req, res) => {
    const { count } = req.body;

    // Validate input count
    if (count < 1 || count > 7) {
        return res.status(400).json({ message: 'You can only book between 1 to 7 seats at a time.' });
    }

    // Step 1: Try to find seats in the same row
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

            // Proceed to reserve these seats
            reserveSeats(seatIds, res);
        } else {
            // Step 2: If no single row has enough, find the closest seats across rows
            const queryMultipleRows = `
                SELECT seat_id FROM seats WHERE is_booked = 0 LIMIT ?;
            `;

            db.query(queryMultipleRows, [count], (err, seats) => {
                if (err) return res.status(500).send('Database query error');

                const seatIds = seats.map(s => s.seat_id);
                if (seatIds.length < count) {
                    return res.status(400).json({ message: 'Not enough seats available.' });
                }

                // Reserve these seats
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


const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
