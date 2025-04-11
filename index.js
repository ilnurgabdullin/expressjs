const express = require("express");
const { Pool, types } = require('pg');
types.setTypeParser(1082, str => str); // это чтобы дата без времени была, в базе всё верно


require('dotenv').config(); 

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
const app = express();

app.use(express.json());

app.get("/", function(req, res){
    res.sendFile(__dirname+"/templates/index.html");
});

app.use(express.static('public'));

app.post('/notes', async (req, res) => {
  const { dateStart, dateEnd } = req.body;

  try {
    let query;
    let params = [];
    
    if (!dateStart) {
      query = 'SELECT * FROM notes ORDER BY id;';
    } else if (dateEnd) {
      query = `
      SELECT * FROM notes
      WHERE date BETWEEN $1 AND $2
      ORDER BY id;
    `;
      params = [dateStart, dateEnd];
    } else {
      query = 'SELECT * FROM notes WHERE date = $1::date ORDER BY id;';
      params = [dateStart];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ 
      error: 'Ошибка при выполнении запроса',
      details: error.message 
    });
  }
});


app.post("/reply", async (req, res) => {
  const allNotes = await pool.query('SELECT * FROM notes ORDER BY id;');
  const { status, text, noteId } = req.body;
  await pool.query("UPDATE public.notes	SET status=$1 WHERE id = $2;", [status, noteId]);
  await pool.query("UPDATE public.notes	SET answer=$1 WHERE id = $2;", [text, noteId]);
  res.send(allNotes.rows);
});

app.get("/edit_note/:id", async (req, res) => {
  res.sendFile(__dirname+"/templates/edit.html");
});

app.get("/get_note/:id", async (req, res) => {
  const noteId = req.params.id;
  const note = await pool.query('SELECT * FROM notes WHERE id = $1', [noteId]);
  await pool.query("UPDATE public.notes	SET status= 'work' WHERE id = $1 AND status='new';", [noteId]);
  res.json(note.rows[0]);
});

app.get("/cancel_notes", async (req, res) => {
  await pool.query("UPDATE public.notes	SET status= 'cancel' WHERE status='work';");
  res.json({'text':'ok'});
});

app.post('/addNote', async (req, res) => {
  const { title, text } = req.body;
  
  try {
    const date = new Date();
    // Добавим три часа чтобы быть по МСК
    date.setHours(date.getHours() + 3);
    await pool.query(

      'INSERT INTO notes (title, text, status, date) VALUES ($1, $2, $3, $4)',
      [title, text, 'new', date.toISOString()]
    );
    res.status(201).send({"text":"ok"});
  } catch (error) {
    console.log(error);
    res.status(500).send('Ошибка сервера');
  }
});


app.listen(3000);