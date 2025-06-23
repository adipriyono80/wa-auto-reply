const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Path ke file JSON
const faqPath = path.join(__dirname, 'data', 'faq.json');
const productPath = path.join(__dirname, 'data', 'products.json');
const multiAnswerPath = path.join(__dirname, 'data', 'jawaban.json');

// --- API FAQ ---
app.get('/api/faq', (req, res) => {
    const data = fs.readFileSync(faqPath);
    res.json(JSON.parse(data));
});

app.post('/api/faq', (req, res) => {
    const { question, answer } = req.body;
    const data = JSON.parse(fs.readFileSync(faqPath));
    data[question.toLowerCase()] = answer;
    fs.writeFileSync(faqPath, JSON.stringify(data, null, 2));
    res.redirect('/');
});

app.delete('/api/faq/:key', (req, res) => {
    const key = req.params.key.toLowerCase();
    const data = JSON.parse(fs.readFileSync(faqPath));
    delete data[key];
    fs.writeFileSync(faqPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// --- API PRODUK ---
app.get('/api/products', (req, res) => {
    const data = fs.readFileSync(productPath);
    res.json(JSON.parse(data));
});

app.post('/api/products', (req, res) => {
    const { name, priceKonsumen, priceReseller } = req.body;
    const data = JSON.parse(fs.readFileSync(productPath));
    data[name.toLowerCase()] = {
        konsumen: parseInt(priceKonsumen),
        reseller: parseInt(priceReseller)
    };
    fs.writeFileSync(productPath, JSON.stringify(data, null, 2));
    res.redirect('/');
});

app.delete('/api/products/:key', (req, res) => {
    const key = req.params.key.toLowerCase();
    const data = JSON.parse(fs.readFileSync(productPath));
    delete data[key];
    fs.writeFileSync(productPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// --- API MULTIPLE QUESTIONS ---
app.get('/api/multi-questions', (req, res) => {
    const data = fs.readFileSync(multiAnswerPath);
    res.json(JSON.parse(data));
});

app.post('/api/multi-questions', (req, res) => {
    const { questions, answer } = req.body;
    const data = JSON.parse(fs.readFileSync(multiAnswerPath));
    data.push({ pertanyaan: questions, jawaban: answer });
    fs.writeFileSync(multiAnswerPath, JSON.stringify(data, null, 2));
    res.redirect('/');
});

app.delete('/api/multi-questions/:index', (req, res) => {
    const index = parseInt(req.params.index);
    let data = JSON.parse(fs.readFileSync(multiAnswerPath));
    if (index >= 0 && index < data.length) {
        data.splice(index, 1);
        fs.writeFileSync(multiAnswerPath, JSON.stringify(data, null, 2));
    }
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Admin panel berjalan di http://localhost:${PORT}`);
});